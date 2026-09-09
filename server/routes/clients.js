/** Client & contact management. */
const express = require('express');
const { db, now } = require('../db');
const { authenticate, requirePerm, audit } = require('../middleware/auth');
const { ok, fail, paginate, searchCond, normalizeForSearch, logCaseEvent } = require('./helpers');

const router = express.Router();
router.use(authenticate);

const CLIENT_SELECT = `
  SELECT c.*, w.name_fr AS wilaya_name_fr, w.name_ar AS wilaya_name_ar, w.code AS wilaya_code,
    (SELECT COUNT(*) FROM cases k WHERE k.client_id = c.id AND k.is_archived = 0) AS cases_count,
    (SELECT COUNT(*) FROM documents d WHERE d.client_id = c.id) AS documents_count
  FROM clients c LEFT JOIN wilayas w ON w.id = c.wilaya_id`;

router.get('/', requirePerm('clients.view'), (req, res) => {
  const { page, limit, offset } = paginate(req);
  const conds = ['c.is_archived = 0'];
  const params = [];
  if (req.query.archived === '1') conds[0] = 'c.is_archived = 1';
  if (req.query.type) { conds.push('c.client_type = ?'); params.push(req.query.type); }
  if (req.query.wilaya_id) { conds.push('c.wilaya_id = ?'); params.push(req.query.wilaya_id); }
  if (req.query.q) {
    conds.push('c.search_norm LIKE ?');
    params.push(`%${normalizeForSearch(req.query.q)}%`);
  }
  const where = `WHERE ${conds.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM clients c ${where}`).get(...params).c;
  const rows = db.prepare(`${CLIENT_SELECT} ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  ok(res, { rows, total, page, limit });
});

router.get('/:id', requirePerm('clients.view'), (req, res) => {
  const row = db.prepare(`${CLIENT_SELECT} WHERE c.id = ?`).get(req.params.id);
  if (!row) return fail(res, 404, 'not_found');
  row.cases = db.prepare(`
    SELECT k.id, k.reference, k.title_fr, k.title_ar, k.status_id, k.priority, k.opening_date, k.closing_date,
           s.name_fr AS status_name_fr, s.name_ar AS status_name_ar, s.color AS status_color,
           u.full_name_fr AS lawyer_name_fr, u.full_name_ar AS lawyer_name_ar
    FROM cases k LEFT JOIN case_statuses s ON s.id = k.status_id
    LEFT JOIN users u ON u.id = k.responsible_lawyer_id
    WHERE k.client_id = ? AND k.is_archived = 0 ORDER BY k.opening_date DESC`).all(req.params.id);
  row.documents = db.prepare('SELECT id, title, doc_type, created_at, version, original_name FROM documents WHERE client_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT 100').all(req.params.id);
  row.relationships = db.prepare('SELECT * FROM client_relationships WHERE client_id = ?').all(req.params.id);
  row.invoices = db.prepare('SELECT id, number, issue_date, due_date, status, total, paid_amount FROM invoices WHERE client_id = ? ORDER BY issue_date DESC').all(req.params.id);
  ok(res, row);
});

function clientSearchBlob(b) {
  return normalizeForSearch([b.full_name_ar, b.full_name_fr, b.legal_name, b.commercial_name, b.rc, b.nif, b.nis, b.id_number, b.phone, b.email, b.address, b.municipality, b.profession].filter(Boolean).join(' '));
}

router.post('/', requirePerm('clients.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.client_type) b.client_type = 'individual';
  if (!b.full_name_ar && !b.full_name_fr && !b.legal_name) return fail(res, 400, 'missing_name');
  const r = db.prepare(`INSERT INTO clients
    (client_type, full_name_ar, full_name_fr, legal_name, commercial_name, legal_form, rc, nif, nis, identifiers_note,
     date_of_birth, place_of_birth, nationality, id_number, address, wilaya_id, municipality, phone, alt_phone, email,
     profession, employer, emergency_contact_name, emergency_contact_phone, notes, tags, search_norm, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.client_type, b.full_name_ar ?? null, b.full_name_fr ?? null, b.legal_name ?? null, b.commercial_name ?? null,
    b.legal_form ?? null, b.rc ?? null, b.nif ?? null, b.nis ?? null, b.identifiers_note ?? null,
    b.date_of_birth ?? null, b.place_of_birth ?? null, b.nationality ?? null, b.id_number ?? null,
    b.address ?? null, b.wilaya_id ?? null, b.municipality ?? null, b.phone ?? null, b.alt_phone ?? null, b.email ?? null,
    b.profession ?? null, b.employer ?? null, b.emergency_contact_name ?? null, b.emergency_contact_phone ?? null,
    b.notes ?? null, b.tags ?? null, clientSearchBlob(b), req.user.id, now(), now()
  );
  audit(req, 'create', 'client', r.lastInsertRowid, { name: b.full_name_fr || b.legal_name });
  ok(res, { id: r.lastInsertRowid });
});

router.put('/:id', requirePerm('clients.edit'), (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, 404, 'not_found');
  const merged = { ...existing, ...b, id: existing.id };
  db.prepare(`UPDATE clients SET
    client_type=?, full_name_ar=?, full_name_fr=?, legal_name=?, commercial_name=?, legal_form=?, rc=?, nif=?, nis=?, identifiers_note=?,
    date_of_birth=?, place_of_birth=?, nationality=?, id_number=?, address=?, wilaya_id=?, municipality=?, phone=?, alt_phone=?, email=?,
    profession=?, employer=?, emergency_contact_name=?, emergency_contact_phone=?, notes=?, tags=?, search_norm=?, is_archived=?, updated_at=?
    WHERE id=?`).run(
    merged.client_type, merged.full_name_ar, merged.full_name_fr, merged.legal_name, merged.commercial_name, merged.legal_form,
    merged.rc, merged.nif, merged.nis, merged.identifiers_note, merged.date_of_birth, merged.place_of_birth, merged.nationality,
    merged.id_number, merged.address, merged.wilaya_id, merged.municipality, merged.phone, merged.alt_phone, merged.email,
    merged.profession, merged.employer, merged.emergency_contact_name, merged.emergency_contact_phone, merged.notes, merged.tags,
    clientSearchBlob(merged), merged.is_archived ? 1 : 0, now(), req.params.id
  );
  audit(req, 'update', 'client', req.params.id);
  ok(res, { updated: true });
});

router.put('/:id/archive', requirePerm('clients.edit'), (req, res) => {
  db.prepare('UPDATE clients SET is_archived = 1, updated_at = ? WHERE id = ?').run(now(), req.params.id);
  audit(req, 'archive', 'client', req.params.id);
  ok(res, { archived: true });
});

router.put('/:id/restore', requirePerm('clients.edit'), (req, res) => {
  db.prepare('UPDATE clients SET is_archived = 0, updated_at = ? WHERE id = ?').run(now(), req.params.id);
  audit(req, 'restore', 'client', req.params.id);
  ok(res, { restored: true });
});

router.delete('/:id', requirePerm('clients.delete'), (req, res) => {
  const used = db.prepare('SELECT COUNT(*) c FROM cases WHERE client_id = ?').get(req.params.id).c;
  if (used > 0) return fail(res, 409, 'client_has_cases');
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'client', req.params.id);
  ok(res, { deleted: true });
});

// relationships (for conflict checking)
router.post('/:id/relationships', requirePerm('clients.edit'), (req, res) => {
  const { related_name, related_type, relationship, notes } = req.body || {};
  if (!related_name) return fail(res, 400, 'missing_name');
  const r = db.prepare('INSERT INTO client_relationships (client_id, related_name, related_type, relationship, notes) VALUES (?,?,?,?,?)')
    .run(req.params.id, related_name, related_type || 'person', relationship || null, notes || null);
  audit(req, 'create', 'client_relationship', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.delete('/relationships/:rid', requirePerm('clients.edit'), (req, res) => {
  db.prepare('DELETE FROM client_relationships WHERE id = ?').run(req.params.rid);
  audit(req, 'delete', 'client_relationship', req.params.rid);
  ok(res, { deleted: true });
});

// ================================================================ CONTACTS
router.get('/contacts/list', requirePerm('contacts.view'), (req, res) => {
  const { page, limit, offset } = paginate(req);
  const conds = ['is_archived = 0'];
  const params = [];
  if (req.query.type) { conds.push('contact_type = ?'); params.push(req.query.type); }
  if (req.query.q) { conds.push('search_norm LIKE ?'); params.push(`%${normalizeForSearch(req.query.q)}%`); }
  const where = `WHERE ${conds.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM contacts ${where}`).get(...params).c;
  const rows = db.prepare(`SELECT ct.*, w.name_fr AS wilaya_name_fr FROM contacts ct LEFT JOIN wilayas w ON w.id = ct.wilaya_id ${where} ORDER BY ct.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  ok(res, { rows, total, page, limit });
});

router.post('/contacts', requirePerm('contacts.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.name_fr && !b.name_ar) return fail(res, 400, 'missing_name');
  const r = db.prepare(`INSERT INTO contacts (contact_type, name_ar, name_fr, organization, job_title, phone, email, address, wilaya_id, notes, tags, search_norm, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.contact_type || 'person', b.name_ar ?? null, b.name_fr ?? null, b.organization ?? null, b.job_title ?? null,
    b.phone ?? null, b.email ?? null, b.address ?? null, b.wilaya_id ?? null, b.notes ?? null, b.tags ?? null,
    normalizeForSearch([b.name_ar, b.name_fr, b.organization, b.phone, b.email].join(' ')), req.user.id, now(), now()
  );
  audit(req, 'create', 'contact', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/contacts/:id', requirePerm('contacts.edit'), (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, 404, 'not_found');
  const m = { ...existing, ...b };
  db.prepare(`UPDATE contacts SET contact_type=?, name_ar=?, name_fr=?, organization=?, job_title=?, phone=?, email=?, address=?, wilaya_id=?, notes=?, tags=?, search_norm=?, updated_at=? WHERE id=?`).run(
    m.contact_type, m.name_ar, m.name_fr, m.organization, m.job_title, m.phone, m.email, m.address, m.wilaya_id, m.notes, m.tags,
    normalizeForSearch([m.name_ar, m.name_fr, m.organization, m.phone, m.email].join(' ')), now(), req.params.id
  );
  audit(req, 'update', 'contact', req.params.id);
  ok(res, { updated: true });
});

router.delete('/contacts/:id', requirePerm('contacts.edit'), (req, res) => {
  db.prepare('UPDATE contacts SET is_archived = 1 WHERE id = ?').run(req.params.id);
  audit(req, 'archive', 'contact', req.params.id);
  ok(res, { archived: true });
});

// ================================================================ CONFLICT CHECK
/**
 * Conflict-of-interest checker.
 * The system only flags POSSIBLE relationships/conflicts — it never declares
 * a legal conflict. GREEN = nothing detected, YELLOW = relationship found,
 * RED = party already involved on the other side of an existing case.
 */
router.post('/check-conflicts', requirePerm('conflict.check'), (req, res) => {
  const { client_name, opposing_party, related = [] } = req.body || {};
  const names = [client_name, opposing_party, ...related].map((s) => (s || '').trim()).filter(Boolean);
  if (!names.length) return fail(res, 400, 'missing_names');
  const matches = [];
  const check = (label, name) => {
    if (!name) return;
    const norm = normalizeForSearch(name);
    if (!norm) return;
    // 1. existing clients
    const clients = db.prepare('SELECT id, client_type, full_name_ar, full_name_fr, legal_name, commercial_name FROM clients WHERE search_norm LIKE ? LIMIT 20').all(`%${norm}%`);
    for (const c of clients) {
      matches.push({
        severity: 'yellow', scope: 'client', label,
        matched: c.legal_name || c.commercial_name || c.full_name_fr || c.full_name_ar,
        detail: `Client existant (type: ${c.client_type})`, client_id: c.id
      });
    }
    // 2. opposing parties in existing cases
    const cases = db.prepare(`
      SELECT k.id, k.reference, k.title_fr, k.title_ar, k.opposing_party, k.client_id,
             cl.full_name_fr AS client_name_fr, cl.legal_name AS client_legal_name
      FROM cases k LEFT JOIN clients cl ON cl.id = k.client_id
      WHERE k.is_archived = 0 AND k.search_norm LIKE ? LIMIT 20`).all(`%${norm}%`);
    for (const k of cases) {
      const isOpposingSide = normalizeForSearch(k.opposing_party || '').includes(norm);
      matches.push({
        severity: isOpposingSide ? 'red' : 'yellow', scope: 'case', label,
        matched: k.opposing_party || k.title_fr || k.title_ar,
        case_id: k.id, case_ref: k.reference,
        detail: isOpposingSide
          ? `Partie adverse dans le dossier ${k.reference} (client: ${k.client_name_fr || k.client_legal_name || '—'})`
          : `Correspondance trouvée dans le dossier ${k.reference}`
      });
    }
    // 3. relationships declared on client files (JS-side normalization)
    const rels = db.prepare(`
      SELECT r.*, c.full_name_fr AS client_name_fr, c.legal_name AS client_legal_name
      FROM client_relationships r JOIN clients c ON c.id = r.client_id`).all();
    for (const r of rels) {
      if (normalizeForSearch(r.related_name || '').includes(norm)) {
        matches.push({
          severity: 'yellow', scope: 'relationship', label,
          matched: r.related_name,
          detail: `Lié au client ${r.client_name_fr || r.client_legal_name} (${r.relationship || r.related_type})`,
          client_id: r.client_id
        });
      }
    }
  };
  check('client', client_name);
  check('opposing', opposing_party);
  related.forEach((n, i) => check(`related_${i + 1}`, n));

  // dedupe by severity+matched+case
  const seen = new Set();
  const unique = matches.filter((m) => {
    const key = `${m.severity}|${m.matched}|${m.case_id || ''}|${m.client_id || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const level = unique.some((m) => m.severity === 'red') ? 'red' : unique.length ? 'yellow' : 'green';
  audit(req, 'conflict_check', 'conflict', null, { level, names });
  ok(res, { level, matches: unique, disclaimer: 'Le système détecte uniquement des correspondances POSSIBLES. Il ne déclare jamais un conflit d\'intérêts juridique — l\'analyse appartient à l\'avocat.' });
});

module.exports = router;
