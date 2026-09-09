/** Document management (secure storage, versioning, tags, download) + template engine. */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db, now, UPLOADS_DIR } = require('../db');
const { authenticate, requirePerm, audit } = require('../middleware/auth');
const { ok, fail, paginate, normalizeForSearch, logCaseEvent } = require('./helpers');

const router = express.Router();
router.use(authenticate);

const ALLOWED_EXT = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.jpg', '.jpeg', '.png', '.zip', '.txt', '.md'];
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, new Date().toISOString().slice(0, 7));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.includes(ext)) cb(null, true);
    else cb(new Error('file_type_not_allowed'));
  }
});

const DOC_SELECT = `
  SELECT d.*, k.reference AS case_reference, k.title_fr AS case_title_fr,
    c.full_name_fr AS client_name_fr, c.legal_name AS client_legal_name,
    u.full_name_fr AS creator_name_fr, je.name_fr AS court_name_fr
  FROM documents d
  LEFT JOIN cases k ON k.id = d.case_id
  LEFT JOIN clients c ON c.id = d.client_id
  LEFT JOIN users u ON u.id = d.created_by
  LEFT JOIN judicial_entities je ON je.id = d.court_id`;

router.get('/', requirePerm('documents.view'), (req, res) => {
  const { page, limit, offset } = paginate(req);
  const conds = ['d.is_archived = 0'];
  const params = [];
  if (req.query.case_id) { conds.push('d.case_id = ?'); params.push(req.query.case_id); }
  if (req.query.client_id) { conds.push('d.client_id = ?'); params.push(req.query.client_id); }
  if (req.query.doc_type) { conds.push('d.doc_type = ?'); params.push(req.query.doc_type); }
  if (req.query.court_id) { conds.push('d.court_id = ?'); params.push(req.query.court_id); }
  if (req.query.owner_user_id) { conds.push('d.owner_user_id = ?'); params.push(req.query.owner_user_id); }
  if (req.query.tag) { conds.push("(',' || d.tags || ',') LIKE ?"); params.push(`%,${req.query.tag},%`); }
  if (req.query.q) { conds.push('d.search_norm LIKE ?'); params.push(`%${normalizeForSearch(req.query.q)}%`); }
  const where = `WHERE ${conds.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM documents d ${where}`).get(...params).c;
  const rows = db.prepare(`${DOC_SELECT} ${where} ORDER BY d.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  ok(res, { rows, total, page, limit });
});

router.post('/', requirePerm('documents.upload'), upload.array('files', 20), (req, res) => {
  const b = req.body;
  const created = [];
  const tx = db.transaction(() => {
    for (const f of req.files || []) {
      let parentId = b.parent_id || null;
      let version = 1;
      if (parentId) {
        const parent = db.prepare('SELECT * FROM documents WHERE id = ?').get(parentId);
        if (parent) version = parent.version + 1;
        else parentId = null;
      }
      const r = db.prepare(`INSERT INTO documents
        (title, doc_type, client_id, case_id, hearing_id, task_id, owner_user_id, court_id,
         file_path, original_name, mime_type, size, parent_id, version, tags, ocr_text, notes, expires_at, search_norm, created_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        b.title || f.originalname, b.doc_type || 'other', b.client_id ?? null, b.case_id ?? null,
        b.hearing_id ?? null, b.task_id ?? null, b.owner_user_id ?? null, b.court_id ?? null,
        f.path, f.originalname, f.mimetype, f.size, parentId, version,
        b.tags ?? null, b.ocr_text ?? null, b.notes ?? null, b.expires_at ?? null,
        normalizeForSearch([b.title, f.originalname, b.tags, b.ocr_text].join(' ')), req.user.id, now(), now()
      );
      created.push({ id: r.lastInsertRowid, title: b.title || f.originalname, version });
    }
    // metadata-only registration (no file)
    if (!req.files || req.files.length === 0) {
      if (!b.title) return fail(res, 400, 'missing_title_or_file');
      const r = db.prepare(`INSERT INTO documents
        (title, doc_type, client_id, case_id, hearing_id, task_id, owner_user_id, court_id, tags, notes, expires_at, search_norm, created_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        b.title, b.doc_type || 'other', b.client_id ?? null, b.case_id ?? null, b.hearing_id ?? null,
        b.task_id ?? null, b.owner_user_id ?? null, b.court_id ?? null, b.tags ?? null, b.notes ?? null,
        b.expires_at ?? null, normalizeForSearch([b.title, b.tags].join(' ')), req.user.id, now(), now()
      );
      created.push({ id: r.lastInsertRowid, title: b.title, version: 1, metadata_only: true });
    }
    for (const c of created) {
      if (b.case_id) logCaseEvent(b.case_id, req.user.id, 'document', `Document ajouté : ${c.title}`, { document_id: c.id });
    }
  });
  try { tx(); audit(req, 'upload', 'document', created.map((c) => c.id).join(',')); ok(res, { created }); }
  catch (e) { return fail(res, 500, 'upload_failed', { detail: e.message }); }
});

router.get('/types', requirePerm('documents.view'), (req, res) => {
  ok(res, ['power_of_attorney', 'identity_document', 'lawsuit', 'defense_memo', 'response_memo', 'appeal', 'cassation_appeal',
    'correspondence', 'notice', 'formal_notice', 'contract', 'judgment', 'court_decision', 'expert_report',
    'bailiff_report', 'evidence', 'receipt', 'invoice', 'payment_proof', 'administrative_document', 'other']);
});

// ================================================================ TEMPLATES
router.get('/templates', (req, res) => {
  ok(res, db.prepare('SELECT t.*, u.full_name_fr AS creator_name_fr FROM templates t LEFT JOIN users u ON u.id = t.created_by ORDER BY t.category, t.name_fr').all());
});

const VAR_RE = /\{\{([A-Z_0-9]+)\}\}/g;

router.get('/templates/variables', (req, res) => {
  ok(res, ['CLIENT_NAME', 'CLIENT_ADDRESS', 'CASE_NUMBER', 'CASE_TITLE', 'COURT_NAME', 'LAWYER_NAME', 'DATE', 'HEARING_DATE', 'OPPOSING_PARTY', 'WILAYA', 'COURT', 'CASE_TYPE']);
});

router.post('/templates', requirePerm('documents.upload'), (req, res) => {
  const b = req.body || {};
  if (!b.name_fr || !b.body) return fail(res, 400, 'missing_fields');
  const r = db.prepare('INSERT INTO templates (name_ar, name_fr, category, language, body, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(b.name_ar ?? null, b.name_fr, b.category || 'letter', b.language || 'fr', b.body, req.user.id, now(), now());
  audit(req, 'create', 'template', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/templates/:id', requirePerm('documents.upload'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  db.prepare('UPDATE templates SET name_ar=?, name_fr=?, category=?, language=?, body=?, updated_at=? WHERE id=?')
    .run(m.name_ar, m.name_fr, m.category, m.language, m.body, now(), req.params.id);
  audit(req, 'update', 'template', req.params.id);
  ok(res, { updated: true });
});

router.delete('/templates/:id', requirePerm('documents.upload'), (req, res) => {
  db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'template', req.params.id);
  ok(res, { deleted: true });
});

/** Render a template with real data — returns text only; never a validated legal act. */
router.post('/templates/:id/render', requirePerm('documents.view'), (req, res) => {
  const tpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!tpl) return fail(res, 404, 'not_found');
  const { case_id, client_id, hearing_date } = req.body || {};
  const vars = {
    DATE: new Date().toLocaleDateString('fr-FR'),
    HEARING_DATE: hearing_date || '',
    CLIENT_NAME: '', CLIENT_ADDRESS: '', CASE_NUMBER: '', CASE_TITLE: '', COURT_NAME: '',
    LAWYER_NAME: req.user.full_name_fr || '', OPPOSING_PARTY: '', WILAYA: '', COURT: '', CASE_TYPE: ''
  };
  if (client_id) {
    const c = db.prepare('SELECT c.*, w.name_fr AS wilaya_name_fr FROM clients c LEFT JOIN wilayas w ON w.id = c.wilaya_id WHERE c.id = ?').get(client_id);
    if (c) {
      vars.CLIENT_NAME = c.legal_name || c.commercial_name || c.full_name_fr || c.full_name_ar || '';
      vars.CLIENT_ADDRESS = c.address || '';
      vars.WILAYA = c.wilaya_name_fr || '';
    }
  }
  if (case_id) {
    const k = db.prepare(`SELECT k.*, je.name_fr AS court_name_fr, w.name_fr AS wilaya_name_fr, c.full_name_fr AS client_name_fr, c.legal_name AS client_legal_name, c.address AS client_address
      FROM cases k LEFT JOIN judicial_entities je ON je.id = k.court_id
      LEFT JOIN wilayas w ON w.id = je.wilaya_id
      LEFT JOIN clients c ON c.id = k.client_id WHERE k.id = ?`).get(case_id);
    if (k) {
      vars.CASE_NUMBER = k.court_file_number || k.reference || '';
      vars.CASE_TITLE = k.title_fr || k.title_ar || '';
      vars.COURT_NAME = k.court_name_fr || '';
      vars.COURT = k.court_name_fr || '';
      vars.WILAYA = k.wilaya_name_fr || vars.WILAYA;
      vars.OPPOSING_PARTY = k.opposing_party || '';
      vars.CASE_TYPE = k.case_type || '';
      if (!vars.CLIENT_NAME && k.client_id) {
        vars.CLIENT_NAME = k.client_legal_name || k.client_name_fr || '';
        vars.CLIENT_ADDRESS = k.client_address || '';
      }
    }
  }
  const rendered = tpl.body.replace(VAR_RE, (m, name) => vars[name] !== undefined ? vars[name] : m);
  audit(req, 'render', 'template', tpl.id);
  ok(res, { rendered, template: { id: tpl.id, name_fr: tpl.name_fr, language: tpl.language }, notice: 'Document généré à partir d\'un modèle — relire et vérifier avant toute utilisation professionnelle.' });
});


router.get('/:id', requirePerm('documents.view'), (req, res) => {
  const row = db.prepare(`${DOC_SELECT} WHERE d.id = ?`).get(req.params.id);
  if (!row) return fail(res, 404, 'not_found');
  row.versions = row.parent_id
    ? db.prepare('SELECT id, version, created_at, original_name, created_by FROM documents WHERE id = ? OR parent_id = ? ORDER BY version').all(row.parent_id, row.parent_id)
    : db.prepare('SELECT id, version, created_at, original_name, created_by FROM documents WHERE id = ? OR parent_id = ? ORDER BY version').all(row.id, row.id);
  ok(res, row);
});

router.put('/:id', requirePerm('documents.upload'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b, id: ex.id };
  db.prepare(`UPDATE documents SET title=?, doc_type=?, tags=?, ocr_text=?, notes=?, expires_at=?, is_archived=?, search_norm=?, updated_at=? WHERE id=?`).run(
    m.title, m.doc_type, m.tags, m.ocr_text, m.notes, m.expires_at, m.is_archived ? 1 : 0,
    normalizeForSearch([m.title, m.original_name, m.tags, m.ocr_text].join(' ')), now(), req.params.id
  );
  audit(req, 'update', 'document', req.params.id);
  ok(res, { updated: true });
});

router.delete('/:id', requirePerm('documents.delete'), (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return fail(res, 404, 'not_found');
  db.prepare('UPDATE documents SET is_archived = 1, updated_at = ? WHERE id = ?').run(now(), req.params.id);
  audit(req, 'archive', 'document', req.params.id, { title: doc.title });
  ok(res, { archived: true });
});

router.get('/:id/download', requirePerm('documents.view'), (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return fail(res, 404, 'not_found');
  audit(req, 'download', 'document', doc.id, { title: doc.title });
  if (!doc.file_path || !fs.existsSync(doc.file_path)) {
    return fail(res, 404, 'file_not_attached');
  }
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_name || path.basename(doc.file_path))}"`);
  res.sendFile(path.resolve(doc.file_path));
});

module.exports = router;
