/** Legal library: source registry, legal texts, articles + version control, jurisprudence. */
const express = require('express');
const { db, now } = require('../db');
const { authenticate, requirePerm, audit } = require('../middleware/auth');
const { ok, fail, paginate, normalizeForSearch } = require('./helpers');

const router = express.Router();
router.use(authenticate);

const VERIFICATION_LABELS = {
  official: { fr: 'Source officielle', ar: 'مصدر رسمي' },
  imported: { fr: 'Référence importée', ar: 'مرجع مستورد' },
  user_note: { fr: 'Note utilisateur', ar: 'ملاحظة مستخدم' },
  ai_suggestion: { fr: 'Suggestion IA — non officielle', ar: 'اقتراح آلي — غير رسمي' },
  unverified: { fr: 'Non vérifié', ar: 'غير محقق' },
  demo: { fr: 'DÉMO — fictif', ar: 'تجريبي — وهمي' }
};
router.get('/verification-labels', (req, res) => ok(res, VERIFICATION_LABELS));

// ================================================================ SOURCES
router.get('/sources', (req, res) => {
  ok(res, db.prepare('SELECT * FROM legal_sources WHERE is_active = 1 ORDER BY id').all());
});
router.post('/sources', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.name_fr) return fail(res, 400, 'missing_fields');
  const r = db.prepare('INSERT INTO legal_sources (name_ar, name_fr, url, kind, description, last_verified_at, notes) VALUES (?,?,?,?,?,?,?)')
    .run(b.name_ar ?? null, b.name_fr, b.url ?? null, b.kind || 'official', b.description ?? null, b.last_verified_at ?? null, b.notes ?? null);
  audit(req, 'create', 'legal_source', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});
router.put('/sources/:id', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM legal_sources WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  db.prepare('UPDATE legal_sources SET name_ar=?, name_fr=?, url=?, kind=?, description=?, last_verified_at=?, notes=?, is_active=? WHERE id=?')
    .run(m.name_ar, m.name_fr, m.url, m.kind, m.description, m.last_verified_at, m.notes, m.is_active, req.params.id);
  audit(req, 'update', 'legal_source', req.params.id);
  ok(res, { updated: true });
});

// ================================================================ LEGAL TEXTS
const TEXT_SELECT = `
  SELECT t.*, s.name_fr AS source_name_fr, s.url AS source_url,
    (SELECT COUNT(*) FROM legal_articles a WHERE a.text_id = t.id) AS articles_count
  FROM legal_texts t LEFT JOIN legal_sources s ON s.id = t.source_id`;

router.get('/texts', requirePerm('legal.view'), (req, res) => {
  const { page, limit, offset } = paginate(req);
  const conds = ['1=1'];
  const params = [];
  if (req.query.kind) { conds.push('t.kind = ?'); params.push(req.query.kind); }
  if (req.query.status) { conds.push('t.status = ?'); params.push(req.query.status); }
  if (req.query.verification_status) { conds.push('t.verification_status = ?'); params.push(req.query.verification_status); }
  if (req.query.q) { conds.push('t.search_norm LIKE ?'); params.push(`%${normalizeForSearch(req.query.q)}%`); }
  const where = `WHERE ${conds.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM legal_texts t ${where}`).get(...params).c;
  const rows = db.prepare(`${TEXT_SELECT} ${where} ORDER BY t.kind, t.title_fr LIMIT ? OFFSET ?`).all(...params, limit, offset);
  ok(res, { rows, total, page, limit });
});

router.get('/texts/:id', requirePerm('legal.view'), (req, res) => {
  const row = db.prepare(`${TEXT_SELECT} WHERE t.id = ?`).get(req.params.id);
  if (!row) return fail(res, 404, 'not_found');
  row.articles = db.prepare('SELECT a.id, a.article_number, a.title_ar, a.title_fr, a.status, a.version, a.verification_status, a.modified_by, a.modification_date, a.effective_date FROM legal_articles a WHERE a.text_id = ? ORDER BY a.rowid').all(req.params.id);
  ok(res, row);
});

router.post('/texts', requirePerm('legal.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.title_fr && !b.title_ar) return fail(res, 400, 'missing_title');
  const r = db.prepare(`INSERT INTO legal_texts
    (kind, title_ar, title_fr, number, date, publication_date, oj_number, subject, status, effective_date, repeal_date,
     source_id, source_url, pdf_document_id, tags, verification_status, last_verified_at, notes, search_norm, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.kind || 'law', b.title_ar ?? null, b.title_fr, b.number ?? null, b.date ?? null,
    b.publication_date ?? null, b.oj_number ?? null, b.subject ?? null, b.status || 'in_force',
    b.effective_date ?? null, b.repeal_date ?? null, b.source_id ?? null, b.source_url ?? null,
    b.pdf_document_id ?? null, b.tags ?? null, b.verification_status || 'unverified',
    b.last_verified_at ?? null, b.notes ?? null,
    normalizeForSearch([b.title_ar, b.title_fr, b.number, b.subject, b.tags].join(' ')),
    req.user.id, now(), now()
  );
  audit(req, 'create', 'legal_text', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/texts/:id', requirePerm('legal.edit'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM legal_texts WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  db.prepare(`UPDATE legal_texts SET kind=?, title_ar=?, title_fr=?, number=?, date=?, publication_date=?, oj_number=?, subject=?,
    status=?, effective_date=?, repeal_date=?, source_id=?, source_url=?, pdf_document_id=?, tags=?, verification_status=?,
    last_verified_at=?, notes=?, search_norm=?, updated_at=? WHERE id=?`).run(
    m.kind, m.title_ar, m.title_fr, m.number, m.date, m.publication_date, m.oj_number, m.subject, m.status,
    m.effective_date, m.repeal_date, m.source_id, m.source_url, m.pdf_document_id, m.tags, m.verification_status,
    m.last_verified_at, m.notes, normalizeForSearch([m.title_ar, m.title_fr, m.number, m.subject, m.tags].join(' ')), now(), req.params.id
  );
  audit(req, 'update', 'legal_text', req.params.id);
  ok(res, { updated: true });
});

router.delete('/texts/:id', requirePerm('legal.edit'), (req, res) => {
  db.prepare('DELETE FROM legal_texts WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'legal_text', req.params.id);
  ok(res, { deleted: true });
});

// ================================================================ ARTICLES + VERSIONS
router.get('/articles/:id', requirePerm('legal.view'), (req, res) => {
  const row = db.prepare(`
    SELECT a.*, t.title_fr AS text_title_fr, t.kind AS text_kind, t.number AS text_number,
      s.name_fr AS source_name_fr, s.url AS source_url
    FROM legal_articles a LEFT JOIN legal_texts t ON t.id = a.text_id
    LEFT JOIN legal_sources s ON s.id = a.source_id WHERE a.id = ?`).get(req.params.id);
  if (!row) return fail(res, 404, 'not_found');
  row.versions = db.prepare('SELECT * FROM legal_article_versions WHERE article_id = ? ORDER BY version').all(req.params.id);
  row.related_cases = [];
  ok(res, row);
});

router.post('/texts/:id/articles', requirePerm('legal.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.article_number) return fail(res, 400, 'missing_fields');
  const r = db.prepare(`INSERT INTO legal_articles
    (text_id, article_number, title_ar, title_fr, body_ar, body_fr, status, modified_by, modification_date, version,
     effective_date, source_id, source_url, oj_number, tags, notes, verification_status, search_norm, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    req.params.id, b.article_number, b.title_ar ?? null, b.title_fr ?? null, b.body_ar ?? null, b.body_fr ?? null,
    b.status || 'in_force', b.modified_by ?? null, b.modification_date ?? null, 1,
    b.effective_date ?? null, b.source_id ?? null, b.source_url ?? null, b.oj_number ?? null,
    b.tags ?? null, b.notes ?? null, b.verification_status || 'unverified',
    normalizeForSearch([b.article_number, b.title_ar, b.title_fr, b.body_ar, b.body_fr].join(' ')), now(), now()
  );
  if (b.body_ar || b.body_fr) {
    db.prepare('INSERT INTO legal_article_versions (article_id, version, body_ar, body_fr, effective_date, modified_by, change_note, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(r.lastInsertRowid, 1, b.body_ar ?? null, b.body_fr ?? null, b.effective_date ?? null, null, 'Version initiale', now());
  }
  audit(req, 'create', 'legal_article', r.lastInsertRowid, { text_id: req.params.id, article: b.article_number });
  ok(res, { id: r.lastInsertRowid });
});

router.put('/articles/:id', requirePerm('legal.edit'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM legal_articles WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  const versionBump = (b.body_ar !== undefined && b.body_ar !== ex.body_ar) || (b.body_fr !== undefined && b.body_fr !== ex.body_fr);
  let newVersion = ex.version;
  if (versionBump) {
    newVersion = ex.version + 1;
    db.prepare('INSERT INTO legal_article_versions (article_id, version, body_ar, body_fr, effective_date, modified_by, change_note, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(ex.id, ex.version, ex.body_ar, ex.body_fr, ex.effective_date, ex.modified_by, 'Archivé avant modification', now());
  }
  db.prepare(`UPDATE legal_articles SET article_number=?, title_ar=?, title_fr=?, body_ar=?, body_fr=?, status=?, modified_by=?,
    modification_date=?, version=?, effective_date=?, source_id=?, source_url=?, oj_number=?, tags=?, notes=?,
    verification_status=?, search_norm=?, updated_at=? WHERE id=?`).run(
    m.article_number, m.title_ar, m.title_fr, m.body_ar, m.body_fr, m.status, m.modified_by, m.modification_date,
    newVersion, m.effective_date, m.source_id, m.source_url, m.oj_number, m.tags, m.notes, m.verification_status,
    normalizeForSearch([m.article_number, m.title_ar, m.title_fr, m.body_ar, m.body_fr].join(' ')), now(), req.params.id
  );
  audit(req, 'update', 'legal_article', req.params.id, { version_bump: versionBump });
  ok(res, { updated: true, version: newVersion });
});

// ================================================================ JURISPRUDENCE
const JURI_SELECT = `
  SELECT j.*, je.name_fr AS court_name_fr, je.name_ar AS court_name_ar, s.name_fr AS source_name_fr, s.url AS source_url
  FROM jurisprudence j
  LEFT JOIN judicial_entities je ON je.id = j.court_id
  LEFT JOIN legal_sources s ON s.id = j.source_id`;

router.get('/jurisprudence', requirePerm('legal.view'), (req, res) => {
  const { page, limit, offset } = paginate(req);
  const conds = ['1=1'];
  const params = [];
  if (req.query.court_id) { conds.push('j.court_id = ?'); params.push(req.query.court_id); }
  if (req.query.from) { conds.push('j.decision_date >= ?'); params.push(req.query.from); }
  if (req.query.to) { conds.push('j.decision_date <= ?'); params.push(req.query.to); }
  if (req.query.verification_status) { conds.push('j.verification_status = ?'); params.push(req.query.verification_status); }
  if (req.query.q) { conds.push('j.search_norm LIKE ?'); params.push(`%${normalizeForSearch(req.query.q)}%`); }
  const where = `WHERE ${conds.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM jurisprudence j ${where}`).get(...params).c;
  const bookmarked = new Set(db.prepare('SELECT decision_id FROM jurisprudence_bookmarks WHERE user_id = ?').all(req.user.id).map((r) => r.decision_id));
  const rows = db.prepare(`${JURI_SELECT} ${where} ORDER BY COALESCE(j.decision_date, '9999') DESC, j.id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset)
    .map((r) => ({ ...r, bookmarked: bookmarked.has(r.id) }));
  ok(res, { rows, total, page, limit });
});

router.get('/jurisprudence/bookmarks', requirePerm('legal.view'), (req, res) => {
  const rows = db.prepare(`
    SELECT j.*, je.name_fr AS court_name_fr, je.name_ar AS court_name_ar, s.name_fr AS source_name_fr
    FROM jurisprudence_bookmarks b
    JOIN jurisprudence j ON j.id = b.decision_id
    LEFT JOIN judicial_entities je ON je.id = j.court_id
    LEFT JOIN legal_sources s ON s.id = j.source_id
    WHERE b.user_id = ? ORDER BY b.created_at DESC`).all(req.user.id);
  ok(res, rows);
});

router.get('/jurisprudence/:id', requirePerm('legal.view'), (req, res) => {
  const row = db.prepare(`${JURI_SELECT} WHERE j.id = ?`).get(req.params.id);
  if (!row) return fail(res, 404, 'not_found');
  db.prepare('INSERT OR REPLACE INTO jurisprudence_views (user_id, decision_id, viewed_at) VALUES (?,?,?)').run(req.user.id, req.params.id, now());
  row.bookmarked = !!db.prepare('SELECT 1 FROM jurisprudence_bookmarks WHERE user_id = ? AND decision_id = ?').get(req.user.id, req.params.id);
  row.related = db.prepare(`SELECT id, court_id, chamber, decision_number, decision_date, subject, summary_fr FROM jurisprudence
    WHERE id != ? AND (court_id = ? OR subject LIKE ?) LIMIT 5`).all(req.params.id, row.court_id, `%${(row.subject || '').split(' ')[0] || '%'}%`);
  ok(res, row);
});

router.post('/jurisprudence', requirePerm('legal.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.subject) return fail(res, 400, 'missing_fields');
  const r = db.prepare(`INSERT INTO jurisprudence
    (court_id, chamber, decision_number, decision_date, case_number, subject, keywords,
     principle_ar, principle_fr, summary_ar, summary_fr, full_text_ar, full_text_fr,
     source_id, source_url, pdf_document_id, related_article_ids, related_case_ids, notes, verification_status, search_norm, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.court_id ?? null, b.chamber ?? null, b.decision_number ?? null, b.decision_date ?? null, b.case_number ?? null,
    b.subject, b.keywords ?? null,
    b.principle_ar ?? null, b.principle_fr ?? null, b.summary_ar ?? null, b.summary_fr ?? null,
    b.full_text_ar ?? null, b.full_text_fr ?? null,
    b.source_id ?? null, b.source_url ?? null, b.pdf_document_id ?? null,
    b.related_article_ids ?? null, b.related_case_ids ?? null, b.notes ?? null,
    b.verification_status || 'unverified',
    normalizeForSearch([b.subject, b.keywords, b.chamber, b.decision_number, b.case_number, b.summary_fr, b.summary_ar, b.principle_fr].join(' ')),
    req.user.id, now(), now()
  );
  audit(req, 'create', 'jurisprudence', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/jurisprudence/:id', requirePerm('legal.edit'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM jurisprudence WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  db.prepare(`UPDATE jurisprudence SET court_id=?, chamber=?, decision_number=?, decision_date=?, case_number=?, subject=?, keywords=?,
    principle_ar=?, principle_fr=?, summary_ar=?, summary_fr=?, full_text_ar=?, full_text_fr=?, source_id=?, source_url=?,
    pdf_document_id=?, related_article_ids=?, related_case_ids=?, notes=?, verification_status=?, search_norm=?, updated_at=? WHERE id=?`).run(
    m.court_id, m.chamber, m.decision_number, m.decision_date, m.case_number, m.subject, m.keywords,
    m.principle_ar, m.principle_fr, m.summary_ar, m.summary_fr, m.full_text_ar, m.full_text_fr, m.source_id, m.source_url,
    m.pdf_document_id, m.related_article_ids, m.related_case_ids, m.notes, m.verification_status,
    normalizeForSearch([m.subject, m.keywords, m.chamber, m.decision_number, m.case_number, m.summary_fr, m.summary_ar].join(' ')),
    now(), req.params.id
  );
  audit(req, 'update', 'jurisprudence', req.params.id);
  ok(res, { updated: true });
});

router.delete('/jurisprudence/:id', requirePerm('legal.edit'), (req, res) => {
  db.prepare('DELETE FROM jurisprudence WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'jurisprudence', req.params.id);
  ok(res, { deleted: true });
});

router.post('/jurisprudence/:id/bookmark', requirePerm('legal.view'), (req, res) => {
  db.prepare('INSERT OR REPLACE INTO jurisprudence_bookmarks (user_id, decision_id, created_at) VALUES (?,?,?)').run(req.user.id, req.params.id, now());
  ok(res, { bookmarked: true });
});
router.delete('/jurisprudence/:id/bookmark', requirePerm('legal.view'), (req, res) => {
  db.prepare('DELETE FROM jurisprudence_bookmarks WHERE user_id = ? AND decision_id = ?').run(req.user.id, req.params.id);
  ok(res, { bookmarked: false });
});
router.get('/jurisprudence-recent', requirePerm('legal.view'), (req, res) => {
  ok(res, db.prepare(`SELECT v.viewed_at, j.id, j.subject, j.decision_number, je.name_fr AS court_name_fr
    FROM jurisprudence_views v JOIN jurisprudence j ON j.id = v.decision_id
    LEFT JOIN judicial_entities je ON je.id = j.court_id
    WHERE v.user_id = ? ORDER BY v.viewed_at DESC LIMIT 10`).all(req.user.id));
});

module.exports = router;
