/** Case management: list, detail (timeline/parties/documents), CRUD, archive. */
const express = require('express');
const { db, now } = require('../db');
const { authenticate, requirePerm, audit } = require('../middleware/auth');
const { ok, fail, paginate, normalizeForSearch, logCaseEvent } = require('./helpers');

const router = express.Router();
router.use(authenticate);

const CASE_SELECT = `
  SELECT k.*,
    cl.full_name_fr AS client_name_fr, cl.full_name_ar AS client_name_ar,
    cl.legal_name AS client_legal_name, cl.commercial_name AS client_commercial, cl.client_type AS client_type,
    je.name_fr AS court_name_fr, je.name_ar AS court_name_ar,
    ct.name_fr AS court_type_fr, ct.code AS court_type_code,
    ch.name_fr AS chamber_name_fr, ch.name_ar AS chamber_name_ar,
    pa.name_fr AS practice_area_fr, pa.name_ar AS practice_area_ar,
    s.code AS status_code, s.name_fr AS status_name_fr, s.name_ar AS status_name_ar, s.color AS status_color,
    lu.full_name_fr AS lawyer_name_fr, lu.full_name_ar AS lawyer_name_ar,
    au.full_name_fr AS assistant_name_fr, au.full_name_ar AS assistant_name_ar,
    (SELECT MIN(date) FROM hearings h WHERE h.case_id = k.id AND h.date >= date('now','localtime') AND h.status='scheduled') AS next_hearing_date,
    (SELECT time FROM hearings h WHERE h.case_id = k.id AND h.date >= date('now','localtime') AND h.status='scheduled' ORDER BY date, time LIMIT 1) AS next_hearing_time,
    (SELECT COUNT(*) FROM documents d WHERE d.case_id = k.id AND d.is_archived = 0) AS documents_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.case_id = k.id AND t.status IN ('todo','in_progress')) AS open_tasks_count
  FROM cases k
  LEFT JOIN clients cl ON cl.id = k.client_id
  LEFT JOIN judicial_entities je ON je.id = k.court_id
  LEFT JOIN court_types ct ON ct.id = je.entity_type_id
  LEFT JOIN chambers ch ON ch.id = k.chamber_id
  LEFT JOIN practice_areas pa ON pa.id = k.practice_area_id
  LEFT JOIN case_statuses s ON s.id = k.status_id
  LEFT JOIN users lu ON lu.id = k.responsible_lawyer_id
  LEFT JOIN users au ON au.id = k.assistant_id`;

router.get('/', requirePerm('cases.view'), (req, res) => {
  const { page, limit, offset } = paginate(req);
  const conds = ['k.is_archived = 0'];
  const params = [];
  if (req.query.archived === '1') conds[0] = 'k.is_archived = 1';
  if (req.query.status) { conds.push('s.code = ?'); params.push(req.query.status); }
  if (req.query.priority) { conds.push('k.priority = ?'); params.push(req.query.priority); }
  if (req.query.court_id) { conds.push('k.court_id = ?'); params.push(req.query.court_id); }
  if (req.query.client_id) { conds.push('k.client_id = ?'); params.push(req.query.client_id); }
  if (req.query.practice_area_id) { conds.push('(k.practice_area_id = ? OR pa.parent_id = ?)'); params.push(req.query.practice_area_id, req.query.practice_area_id); }
  if (req.query.lawyer_id) { conds.push('(k.responsible_lawyer_id = ? OR k.id IN (SELECT case_id FROM case_lawyers WHERE user_id = ?))'); params.push(req.query.lawyer_id, req.query.lawyer_id); }
  if (req.query.no_activity_days) {
    conds.push("COALESCE(k.last_action_at, k.created_at) < datetime('now', ?)");
    params.push(`-${parseInt(req.query.no_activity_days, 10) || 30} days`);
  }
  if (req.query.q) {
    conds.push('k.search_norm LIKE ?');
    params.push(`%${normalizeForSearch(req.query.q)}%`);
  }
  const where = `WHERE ${conds.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM cases k LEFT JOIN case_statuses s ON s.id = k.status_id LEFT JOIN practice_areas pa ON pa.id = k.practice_area_id ${where}`).get(...params).c;
  const rows = db.prepare(`${CASE_SELECT} ${where} ORDER BY k.updated_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  ok(res, { rows, total, page, limit });
});

router.get('/statuses', requirePerm('cases.view'), (req, res) => {
  ok(res, db.prepare('SELECT * FROM case_statuses WHERE is_active = 1 ORDER BY sort').all());
});

router.get('/:id', requirePerm('cases.view'), (req, res) => {
  const row = db.prepare(`${CASE_SELECT} WHERE k.id = ?`).get(req.params.id);
  if (!row) return fail(res, 404, 'not_found');
  row.hearings = db.prepare(`
    SELECT h.*, u.full_name_fr AS lawyer_name_fr, u.full_name_ar AS lawyer_name_ar, je.name_fr AS court_name_fr, ch.name_fr AS chamber_name_fr
    FROM hearings h LEFT JOIN users u ON u.id = h.lawyer_id
    LEFT JOIN judicial_entities je ON je.id = h.court_id
    LEFT JOIN chambers ch ON ch.id = h.chamber_id
    WHERE h.case_id = ? ORDER BY h.date DESC, h.time`).all(req.params.id);
  row.deadlines = db.prepare(`
    SELECT d.*, u.full_name_fr AS lawyer_name_fr FROM deadlines d
    LEFT JOIN users u ON u.id = d.responsible_lawyer_id
    WHERE d.case_id = ? ORDER BY d.status = 'active' DESC, d.end_date`).all(req.params.id);
  row.tasks = db.prepare(`
    SELECT t.*, u.full_name_fr AS assignee_name_fr, u.full_name_ar AS assignee_name_ar
    FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to WHERE t.case_id = ? ORDER BY t.status, t.due_date`).all(req.params.id);
  row.documents = db.prepare(`
    SELECT d.*, u.full_name_fr AS creator_name_fr FROM documents d
    LEFT JOIN users u ON u.id = d.created_by
    WHERE d.case_id = ? AND d.is_archived = 0 ORDER BY d.created_at DESC`).all(req.params.id);
  row.timeline = db.prepare(`
    SELECT e.*, u.full_name_fr AS user_name_fr, u.full_name_ar AS user_name_ar
    FROM case_events e LEFT JOIN users u ON u.id = e.user_id
    WHERE e.case_id = ? ORDER BY e.event_date DESC, e.id DESC`).all(req.params.id);
  row.team = db.prepare(`
    SELECT u.id, u.full_name_fr, u.full_name_ar, cl.role FROM case_lawyers cl JOIN users u ON u.id = cl.user_id WHERE cl.case_id = ?`).all(req.params.id);
  row.invoices = db.prepare('SELECT id, number, issue_date, due_date, status, total, paid_amount FROM invoices WHERE case_id = ? ORDER BY issue_date DESC').all(req.params.id);
  row.expenses = db.prepare('SELECT * FROM expenses WHERE case_id = ? ORDER BY date DESC').all(req.params.id);
  row.jurisprudence_links = [];
  ok(res, row);
});

function caseSearchBlob(b, clientName) {
  return normalizeForSearch([b.reference, b.internal_number, b.court_file_number, b.title_ar, b.title_fr, b.opposing_party, b.opposing_lawyer, clientName].filter(Boolean).join(' '));
}

router.post('/', requirePerm('cases.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.title_fr && !b.title_ar) return fail(res, 400, 'missing_title');
  if (!b.client_id) return fail(res, 400, 'missing_client');
  const year = new Date().getFullYear();
  const count = db.prepare("SELECT COUNT(*) c FROM cases WHERE reference LIKE ?").get(`${year}/%`).c;
  const reference = b.reference || `${year}/${String(count + 1).padStart(4, '0')}`;
  const client = db.prepare('SELECT full_name_fr, legal_name, commercial_name FROM clients WHERE id = ?').get(b.client_id);
  const r = db.prepare(`INSERT INTO cases
    (reference, internal_number, court_file_number, title_ar, title_fr, client_id, opposing_party, opposing_lawyer,
     court_id, chamber_id, practice_area_id, case_type, judge, jurisdiction, status_id, priority, opening_date, closing_date,
     responsible_lawyer_id, assistant_id, next_action, notes, search_norm, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    reference, b.internal_number ?? reference, b.court_file_number ?? null, b.title_ar ?? null, b.title_fr ?? null,
    b.client_id, b.opposing_party ?? null, b.opposing_lawyer ?? null,
    b.court_id ?? null, b.chamber_id ?? null, b.practice_area_id ?? null, b.case_type ?? null,
    b.judge ?? null, b.jurisdiction ?? null, b.status_id ?? null, b.priority || 'medium',
    b.opening_date || new Date().toISOString().slice(0, 10), b.closing_date ?? null,
    b.responsible_lawyer_id ?? null, b.assistant_id ?? null, b.next_action ?? null, b.notes ?? null,
    caseSearchBlob(b, client ? (client.legal_name || client.commercial_name || client.full_name_fr) : ''),
    req.user.id, now(), now()
  );
  const caseId = r.lastInsertRowid;
  if (Array.isArray(b.team)) {
    const q = db.prepare('INSERT OR REPLACE INTO case_lawyers (case_id, user_id, role) VALUES (?,?,?)');
    for (const uid of b.team) q.run(caseId, uid, 'team');
  }
  logCaseEvent(caseId, req.user.id, 'creation', `Dossier créé (${reference})`);
  audit(req, 'create', 'case', caseId, { reference });
  ok(res, { id: caseId, reference });
});

router.put('/:id', requirePerm('cases.edit'), (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, 404, 'not_found');
  const m = { ...existing, ...b, id: existing.id };
  const client = db.prepare('SELECT full_name_fr, legal_name, commercial_name FROM clients WHERE id = ?').get(m.client_id);
  db.prepare(`UPDATE cases SET
    reference=?, internal_number=?, court_file_number=?, title_ar=?, title_fr=?, client_id=?, opposing_party=?, opposing_lawyer=?,
    court_id=?, chamber_id=?, practice_area_id=?, case_type=?, judge=?, jurisdiction=?, status_id=?, priority=?,
    opening_date=?, closing_date=?, responsible_lawyer_id=?, assistant_id=?, next_action=?, notes=?, search_norm=?, is_archived=?, updated_at=?
    WHERE id=?`).run(
    m.reference, m.internal_number, m.court_file_number, m.title_ar, m.title_fr, m.client_id, m.opposing_party, m.opposing_lawyer,
    m.court_id, m.chamber_id, m.practice_area_id, m.case_type, m.judge, m.jurisdiction, m.status_id, m.priority,
    m.opening_date, m.closing_date, m.responsible_lawyer_id, m.assistant_id, m.next_action, m.notes,
    caseSearchBlob(m, client ? (client.legal_name || client.commercial_name || client.full_name_fr) : ''),
    m.is_archived ? 1 : 0, now(), req.params.id
  );
  if (Array.isArray(b.team)) {
    db.prepare('DELETE FROM case_lawyers WHERE case_id = ?').run(req.params.id);
    const q = db.prepare('INSERT OR REPLACE INTO case_lawyers (case_id, user_id, role) VALUES (?,?,?)');
    for (const uid of b.team) q.run(req.params.id, uid, 'team');
  }
  if (b.status_id && b.status_id !== existing.status_id) {
    const st = db.prepare('SELECT name_fr FROM case_statuses WHERE id = ?').get(b.status_id);
    logCaseEvent(req.params.id, req.user.id, 'status', `Statut changé : ${st ? st.name_fr : b.status_id}`);
  }
  audit(req, 'update', 'case', req.params.id);
  ok(res, { updated: true });
});

router.put('/:id/archive', requirePerm('cases.edit'), (req, res) => {
  db.prepare('UPDATE cases SET is_archived = 1, updated_at = ? WHERE id = ?').run(now(), req.params.id);
  logCaseEvent(req.params.id, req.user.id, 'archive', 'Dossier archivé');
  audit(req, 'archive', 'case', req.params.id);
  ok(res, { archived: true });
});

router.put('/:id/restore', requirePerm('cases.edit'), (req, res) => {
  db.prepare('UPDATE cases SET is_archived = 0, updated_at = ? WHERE id = ?').run(now(), req.params.id);
  audit(req, 'restore', 'case', req.params.id);
  ok(res, { restored: true });
});

router.delete('/:id', requirePerm('cases.delete'), (req, res) => {
  const used = db.prepare('SELECT COUNT(*) c FROM invoices WHERE case_id = ?').get(req.params.id).c;
  if (used > 0) return fail(res, 409, 'case_has_invoices_archive_instead');
  db.prepare('DELETE FROM cases WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'case', req.params.id);
  ok(res, { deleted: true });
});

// manual timeline entry
router.post('/:id/events', requirePerm('cases.edit'), (req, res) => {
  const { event_date, event_type, description } = req.body || {};
  if (!event_date || !description) return fail(res, 400, 'missing_fields');
  const r = db.prepare(`INSERT INTO case_events (case_id, event_date, event_time, user_id, event_type, description, created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(req.params.id, event_date, req.body.event_time || null, req.user.id, event_type || 'note', description, now());
  db.prepare('UPDATE cases SET last_action_at = ?, updated_at = ? WHERE id = ?').run(now(), now(), req.params.id);
  audit(req, 'create', 'case_event', r.lastInsertRowid, { case_id: req.params.id });
  ok(res, { id: r.lastInsertRowid });
});

module.exports = router;
