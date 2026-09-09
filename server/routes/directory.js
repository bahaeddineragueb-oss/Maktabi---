/** Judicial directory: wilayas, court types, judicial entities, chambers. */
const express = require('express');
const { db, now } = require('../db');
const { authenticate, requirePerm, audit } = require('../middleware/auth');
const { ok, fail, searchCond } = require('./helpers');

const router = express.Router();
router.use(authenticate);

// ---- wilayas
router.get('/wilayas', requirePerm('directory.view'), (req, res) => {
  const { cond, param } = searchCond(req, "name_ar || ' ' || name_fr || ' ' || code");
  let sql = `SELECT w.*, (SELECT COUNT(*) FROM judicial_entities je WHERE je.wilaya_id = w.id AND je.is_active = 1) AS courts_count
             FROM wilayas w ${cond ? `WHERE ${cond.replace('AND ', '')}` : ''} ORDER BY w.code`;
  const rows = param ? db.prepare(sql).all(param) : db.prepare(sql).all();
  ok(res, rows);
});

// ---- court types
router.get('/court-types', requirePerm('directory.view'), (req, res) => {
  ok(res, db.prepare('SELECT * FROM court_types ORDER BY jurisdiction, level').all());
});

router.post('/court-types', requirePerm('directory.edit'), (req, res) => {
  const { code, name_ar, name_fr, jurisdiction, level, notes } = req.body || {};
  if (!code || !name_ar || !name_fr) return fail(res, 400, 'missing_fields');
  try {
    const r = db.prepare('INSERT INTO court_types (code, name_ar, name_fr, jurisdiction, level, notes) VALUES (?,?,?,?,?,?)')
      .run(code, name_ar, name_fr, jurisdiction || 'ordinary', level || 1, notes || null);
    audit(req, 'create', 'court_type', r.lastInsertRowid);
    ok(res, { id: r.lastInsertRowid });
  } catch (e) {
    return fail(res, 400, 'duplicate_code');
  }
});

router.put('/court-types/:id', requirePerm('directory.edit'), (req, res) => {
  const { name_ar, name_fr, jurisdiction, level, notes, is_active } = req.body || {};
  db.prepare('UPDATE court_types SET name_ar=COALESCE(?,name_ar), name_fr=COALESCE(?,name_fr), jurisdiction=COALESCE(?,jurisdiction), level=COALESCE(?,level), notes=COALESCE(?,notes), is_active=COALESCE(?,is_active) WHERE id=?')
    .run(name_ar || null, name_fr || null, jurisdiction || null, level ?? null, notes ?? null, is_active ?? null, req.params.id);
  audit(req, 'update', 'court_type', req.params.id);
  ok(res, { updated: true });
});

// ---- judicial entities (courts)
const COURT_SELECT = `
  SELECT je.*, ct.code AS type_code, ct.name_ar AS type_name_ar, ct.name_fr AS type_name_fr,
         ct.jurisdiction AS type_jurisdiction, ct.level AS type_level,
         w.name_ar AS wilaya_name_ar, w.name_fr AS wilaya_name_fr, w.code AS wilaya_code,
         p.name_fr AS parent_name_fr, p.name_ar AS parent_name_ar,
         s.name_fr AS source_name_fr, s.url AS source_url,
         (SELECT COUNT(*) FROM chambers c WHERE c.court_id = je.id AND c.is_active = 1) AS chambers_count
  FROM judicial_entities je
  LEFT JOIN court_types ct ON ct.id = je.entity_type_id
  LEFT JOIN wilayas w ON w.id = je.wilaya_id
  LEFT JOIN judicial_entities p ON p.id = je.parent_id
  LEFT JOIN legal_sources s ON s.id = je.source_id`;

router.get('/courts', requirePerm('directory.view'), (req, res) => {
  const conds = ['je.is_active = 1'];
  const params = [];
  if (req.query.wilaya_id) { conds.push('je.wilaya_id = ?'); params.push(req.query.wilaya_id); }
  if (req.query.type_id) { conds.push('je.entity_type_id = ?'); params.push(req.query.type_id); }
  if (req.query.jurisdiction) { conds.push('ct.jurisdiction = ?'); params.push(req.query.jurisdiction); }
  if (req.query.parent_id) { conds.push('je.parent_id = ?'); params.push(req.query.parent_id); }
  if (req.query.level) { conds.push('ct.level = ?'); params.push(req.query.level); }
  if (req.query.q) {
    conds.push('(je.name_ar LIKE ? OR je.name_fr LIKE ? OR je.municipality LIKE ? OR je.jurisdiction LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like, like, like);
  }
  const rows = db.prepare(`${COURT_SELECT} WHERE ${conds.join(' AND ')} ORDER BY w.code, ct.level DESC, je.name_fr`).all(...params);
  ok(res, rows);
});

router.get('/courts/:id', requirePerm('directory.view'), (req, res) => {
  const row = db.prepare(`${COURT_SELECT} WHERE je.id = ?`).get(req.params.id);
  if (!row) return fail(res, 404, 'not_found');
  row.chambers = db.prepare('SELECT * FROM chambers WHERE court_id = ? ORDER BY id').all(req.params.id);
  ok(res, row);
});

function courtPayload(body) {
  const b = body || {};
  return [
    b.entity_type_id ?? null, b.name_ar ?? null, b.name_fr ?? null, b.wilaya_id ?? null,
    b.municipality ?? null, b.address ?? null, b.phone ?? null, b.email ?? null, b.website ?? null,
    b.lat ?? null, b.lng ?? null, b.jurisdiction ?? null, b.parent_id ?? null,
    b.opening_hours ?? null, b.notes ?? null, b.source_id ?? null,
    b.verification_status || 'unverified', b.last_verified_at ?? null
  ];
}

router.post('/courts', requirePerm('directory.edit'), (req, res) => {
  const [typeId, ar, fr] = courtPayload(req.body);
  if (!typeId || !ar || !fr) return fail(res, 400, 'missing_fields');
  const r = db.prepare(`INSERT INTO judicial_entities
    (entity_type_id, name_ar, name_fr, wilaya_id, municipality, address, phone, email, website, lat, lng, jurisdiction, parent_id, opening_hours, notes, source_id, verification_status, last_verified_at, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...courtPayload(req.body), now(), now());
  audit(req, 'create', 'judicial_entity', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/courts/:id', requirePerm('directory.edit'), (req, res) => {
  const b = req.body || {};
  db.prepare(`UPDATE judicial_entities SET
    entity_type_id=COALESCE(?,entity_type_id), name_ar=COALESCE(?,name_ar), name_fr=COALESCE(?,name_fr),
    wilaya_id=COALESCE(?,wilaya_id), municipality=COALESCE(?,municipality), address=COALESCE(?,address),
    phone=COALESCE(?,phone), email=COALESCE(?,email), website=COALESCE(?,website),
    lat=COALESCE(?,lat), lng=COALESCE(?,lng), jurisdiction=COALESCE(?,jurisdiction),
    parent_id=COALESCE(?,parent_id), opening_hours=COALESCE(?,opening_hours), notes=COALESCE(?,notes),
    source_id=COALESCE(?,source_id), verification_status=COALESCE(?,verification_status),
    last_verified_at=COALESCE(?,last_verified_at), is_active=COALESCE(?,is_active), updated_at=?
    WHERE id=?`).run(
    b.entity_type_id ?? null, b.name_ar ?? null, b.name_fr ?? null, b.wilaya_id ?? null,
    b.municipality ?? null, b.address ?? null, b.phone ?? null, b.email ?? null, b.website ?? null,
    b.lat ?? null, b.lng ?? null, b.jurisdiction ?? null, b.parent_id ?? null,
    b.opening_hours ?? null, b.notes ?? null, b.source_id ?? null,
    b.verification_status ?? null, b.last_verified_at ?? null, b.is_active ?? null, now(), req.params.id
  );
  audit(req, 'update', 'judicial_entity', req.params.id);
  ok(res, { updated: true });
});

router.delete('/courts/:id', requirePerm('directory.edit'), (req, res) => {
  db.prepare('UPDATE judicial_entities SET is_active = 0, updated_at = ? WHERE id = ?').run(now(), req.params.id);
  audit(req, 'deactivate', 'judicial_entity', req.params.id);
  ok(res, { deactivated: true });
});

// ---- chambers (configurable per court)
router.post('/courts/:id/chambers', requirePerm('directory.edit'), (req, res) => {
  const { name_ar, name_fr, kind, notes } = req.body || {};
  if (!name_ar || !name_fr) return fail(res, 400, 'missing_fields');
  const r = db.prepare('INSERT INTO chambers (court_id, name_ar, name_fr, kind, notes, verification_status) VALUES (?,?,?,?,?,?)')
    .run(req.params.id, name_ar, name_fr, kind || 'other', notes || null, 'unverified');
  audit(req, 'create', 'chamber', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/chambers/:id', requirePerm('directory.edit'), (req, res) => {
  const b = req.body || {};
  db.prepare('UPDATE chambers SET name_ar=COALESCE(?,name_ar), name_fr=COALESCE(?,name_fr), kind=COALESCE(?,kind), notes=COALESCE(?,notes), is_active=COALESCE(?,is_active), verification_status=COALESCE(?,verification_status) WHERE id=?')
    .run(b.name_ar ?? null, b.name_fr ?? null, b.kind ?? null, b.notes ?? null, b.is_active ?? null, b.verification_status ?? null, req.params.id);
  audit(req, 'update', 'chamber', req.params.id);
  ok(res, { updated: true });
});

router.delete('/chambers/:id', requirePerm('directory.edit'), (req, res) => {
  db.prepare('UPDATE chambers SET is_active = 0 WHERE id = ?').run(req.params.id);
  audit(req, 'deactivate', 'chamber', req.params.id);
  ok(res, { deactivated: true });
});

module.exports = router;
