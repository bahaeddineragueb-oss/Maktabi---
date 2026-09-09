/** Hearings, deadlines (+rules, holidays), tasks, appointments, unified calendar & ICS export. */
const express = require('express');
const { db, now } = require('../db');
const { authenticate, requirePerm, audit } = require('../middleware/auth');
const { ok, fail, normalizeForSearch, logCaseEvent, getSetting } = require('./helpers');
const { computeDeadline } = require('../utils/deadlines');
const dayjs = require('dayjs');

const router = express.Router();
router.use(authenticate);

// ================================================================ HEARINGS
const HEARING_SELECT = `
  SELECT h.*, k.reference AS case_reference, k.title_fr AS case_title_fr, k.title_ar AS case_title_ar, k.client_id AS case_client_id,
    cl.full_name_fr AS client_name_fr, cl.legal_name AS client_legal_name,
    u.full_name_fr AS lawyer_name_fr, u.full_name_ar AS lawyer_name_ar,
    a.full_name_fr AS assistant_name_fr,
    je.name_fr AS court_name_fr, je.name_ar AS court_name_ar,
    ch.name_fr AS chamber_name_fr, ch.name_ar AS chamber_name_ar
  FROM hearings h
  LEFT JOIN cases k ON k.id = h.case_id
  LEFT JOIN clients cl ON cl.id = k.client_id
  LEFT JOIN users u ON u.id = h.lawyer_id
  LEFT JOIN users a ON a.id = h.assistant_id
  LEFT JOIN judicial_entities je ON je.id = h.court_id
  LEFT JOIN chambers ch ON ch.id = h.chamber_id`;

router.get('/hearings', requirePerm('hearings.view'), (req, res) => {
  const conds = ['1=1'];
  const params = [];
  if (req.query.from) { conds.push('h.date >= ?'); params.push(req.query.from); }
  if (req.query.to) { conds.push('h.date <= ?'); params.push(req.query.to); }
  if (req.query.date) { conds.push('h.date = ?'); params.push(req.query.date); }
  if (req.query.case_id) { conds.push('h.case_id = ?'); params.push(req.query.case_id); }
  if (req.query.court_id) { conds.push('h.court_id = ?'); params.push(req.query.court_id); }
  if (req.query.lawyer_id) { conds.push('(h.lawyer_id = ? OR h.assistant_id = ?)'); params.push(req.query.lawyer_id, req.query.lawyer_id); }
  if (req.query.status) { conds.push('h.status = ?'); params.push(req.query.status); }
  if (req.query.q) {
    conds.push('(k.search_norm LIKE ? OR h.purpose LIKE ?)');
    const like = `%${normalizeForSearch(req.query.q)}%`;
    params.push(like, `%${req.query.q}%`);
  }
  const rows = db.prepare(`${HEARING_SELECT} WHERE ${conds.join(' AND ')} ORDER BY h.date, h.time`).all(...params);
  ok(res, rows);
});

router.post('/hearings', requirePerm('hearings.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.date || !b.case_id) return fail(res, 400, 'missing_fields');
  const r = db.prepare(`INSERT INTO hearings
    (case_id, court_id, chamber_id, date, time, hearing_type, lawyer_id, assistant_id, room, judge, purpose, required_documents, status, notes, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.case_id, b.court_id ?? null, b.chamber_id ?? null, b.date, b.time || null, b.hearing_type || 'civil',
    b.lawyer_id ?? null, b.assistant_id ?? null, b.room ?? null, b.judge ?? null, b.purpose ?? null,
    b.required_documents ?? null, b.status || 'scheduled', b.notes ?? null, req.user.id, now(), now()
  );
  logCaseEvent(b.case_id, req.user.id, 'hearing', `Audience programmée le ${b.date}${b.time ? ' à ' + b.time : ''}`, { hearing_id: r.lastInsertRowid });
  audit(req, 'create', 'hearing', r.lastInsertRowid, { case_id: b.case_id, date: b.date });
  ok(res, { id: r.lastInsertRowid });
});

router.put('/hearings/:id', requirePerm('hearings.edit'), (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM hearings WHERE id = ?').get(req.params.id);
  if (!existing) return fail(res, 404, 'not_found');
  const m = { ...existing, ...b };
  db.prepare(`UPDATE hearings SET case_id=?, court_id=?, chamber_id=?, date=?, time=?, hearing_type=?, lawyer_id=?, assistant_id=?,
    room=?, judge=?, purpose=?, required_documents=?, outcome=?, adjournment_reason=?, next_date=?, status=?, notes=?, updated_at=? WHERE id=?`).run(
    m.case_id, m.court_id, m.chamber_id, m.date, m.time, m.hearing_type, m.lawyer_id, m.assistant_id,
    m.room, m.judge, m.purpose, m.required_documents, m.outcome, m.adjournment_reason, m.next_date, m.status, m.notes, now(), req.params.id
  );
  if (b.outcome && b.outcome !== existing.outcome) {
    logCaseEvent(m.case_id, req.user.id, 'hearing', `Issue d'audience enregistrée : ${b.outcome}`, { hearing_id: existing.id });
  } else {
    logCaseEvent(m.case_id, req.user.id, 'hearing', `Audience modifiée (${m.date})`, { hearing_id: existing.id });
  }
  audit(req, 'update', 'hearing', req.params.id);
  ok(res, { updated: true });
});

router.put('/hearings/:id/outcome', requirePerm('hearings.edit'), (req, res) => {
  const b = req.body || {};
  const h = db.prepare('SELECT * FROM hearings WHERE id = ?').get(req.params.id);
  if (!h) return fail(res, 404, 'not_found');
  db.prepare(`UPDATE hearings SET outcome=?, adjournment_reason=?, next_date=?, status=?, notes=?, updated_at=? WHERE id=?`)
    .run(b.outcome ?? null, b.adjournment_reason ?? null, b.next_date ?? null, b.status || 'held', b.notes ?? h.notes, now(), req.params.id);
  logCaseEvent(h.case_id, req.user.id, 'hearing', `Issue de l'audience du ${h.date} : ${b.outcome || 'enregistrée'}${b.next_date ? ` — prochaine : ${b.next_date}` : ''}`, { hearing_id: h.id });
  if (b.next_date) {
    // auto-create next hearing draft
    db.prepare(`INSERT INTO hearings (case_id, court_id, chamber_id, date, time, hearing_type, lawyer_id, status, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(h.case_id, h.court_id, h.chamber_id, b.next_date, h.time, h.hearing_type, h.lawyer_id, 'scheduled', req.user.id, now(), now());
  }
  if (b.create_tasks && Array.isArray(b.tasks)) {
    const q = db.prepare('INSERT INTO tasks (title, case_id, assigned_to, created_by, due_date, priority, status, related_hearing_id, search_norm, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    for (const t of b.tasks) {
      if (t && t.title) q.run(t.title, h.case_id, t.assigned_to || h.lawyer_id, req.user.id, t.due_date || b.next_date || h.date, t.priority || 'medium', 'todo', h.id, normalizeForSearch(t.title), now(), now());
    }
  }
  audit(req, 'outcome', 'hearing', req.params.id);
  ok(res, { updated: true });
});

router.delete('/hearings/:id', requirePerm('hearings.edit'), (req, res) => {
  db.prepare('DELETE FROM hearings WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'hearing', req.params.id);
  ok(res, { deleted: true });
});

// ================================================================ DEADLINE RULES
router.get('/deadline-rules', requirePerm('deadlines.view'), (req, res) => {
  ok(res, db.prepare('SELECT r.*, s.name_fr AS source_name_fr FROM deadline_rules r LEFT JOIN legal_sources s ON s.id = r.source_id WHERE r.is_active = 1 ORDER BY r.id').all());
});

router.post('/deadline-rules', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.name_fr || !b.amount) return fail(res, 400, 'missing_fields');
  const r = db.prepare(`INSERT INTO deadline_rules (code, name_ar, name_fr, description, amount, unit, day_type, direction, holiday_exclusion, legal_basis, verified, source_id, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.code || `rule_${Date.now()}`, b.name_ar ?? null, b.name_fr, b.description ?? null, b.amount,
    b.unit || 'day', b.day_type || 'calendar', b.direction || 'forward', b.holiday_exclusion ? 1 : 0,
    b.legal_basis ?? null, b.verified ? 1 : 0, b.source_id ?? null, b.notes ?? null
  );
  audit(req, 'create', 'deadline_rule', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/deadline-rules/:id', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM deadline_rules WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  db.prepare(`UPDATE deadline_rules SET code=?, name_ar=?, name_fr=?, description=?, amount=?, unit=?, day_type=?, direction=?, holiday_exclusion=?, legal_basis=?, verified=?, source_id=?, notes=?, is_active=? WHERE id=?`).run(
    m.code, m.name_ar, m.name_fr, m.description, m.amount, m.unit, m.day_type, m.direction, m.holiday_exclusion, m.legal_basis,
    m.verified, m.source_id, m.notes, m.is_active, req.params.id
  );
  audit(req, 'update', 'deadline_rule', req.params.id);
  ok(res, { updated: true });
});

// preview computation (never asserts legal validity)
router.post('/deadlines/preview', requirePerm('deadlines.view'), (req, res) => {
  const b = req.body || {};
  if (!b.start_date || !b.amount) return fail(res, 400, 'missing_fields');
  let rule = { amount: b.amount, unit: b.unit, day_type: b.day_type, direction: b.direction, holiday_exclusion: b.holiday_exclusion };
  if (b.rule_id) {
    const r = db.prepare('SELECT * FROM deadline_rules WHERE id = ?').get(b.rule_id);
    if (r) rule = { amount: r.amount, unit: r.unit, day_type: r.day_type, direction: r.direction, holiday_exclusion: r.holiday_exclusion };
  }
  let holidays = [];
  try { holidays = JSON.parse(getSetting('calendar.custom_holidays', '[]')); } catch (e) { holidays = []; }
  holidays = holidays.concat(db.prepare('SELECT date, is_recurring_annual FROM holidays WHERE court_id IS NULL').all());
  const weekendDays = (() => { try { return JSON.parse(getSetting('calendar.weekend_days', '[5,6]')); } catch (e) { return [5, 6]; } })();
  const result = computeDeadline({ ...rule, start_date: b.start_date, holidays, weekend_days: weekendDays });
  ok(res, { ...result, rule, warning: 'Calculation performed automatically — verify against the applicable legal texts before relying on it. / حساب آلي — يجب التحقق منه قبل الاعتماد عليه.' });
});

// ================================================================ DEADLINES
const DEADLINE_SELECT = `
  SELECT d.*, k.reference AS case_reference, k.title_fr AS case_title_fr, k.title_ar AS case_title_ar,
    u.full_name_fr AS lawyer_name_fr, u.full_name_ar AS lawyer_name_ar,
    r.name_fr AS rule_name_fr, r.verified AS rule_verified
  FROM deadlines d
  LEFT JOIN cases k ON k.id = d.case_id
  LEFT JOIN users u ON u.id = d.responsible_lawyer_id
  LEFT JOIN deadline_rules r ON r.id = d.rule_id`;

router.get('/deadlines', requirePerm('deadlines.view'), (req, res) => {
  const conds = ['1=1'];
  const params = [];
  if (req.query.case_id) { conds.push('d.case_id = ?'); params.push(req.query.case_id); }
  if (req.query.status) { conds.push('d.status = ?'); params.push(req.query.status); }
  if (req.query.priority) { conds.push('d.priority = ?'); params.push(req.query.priority); }
  if (req.query.from) { conds.push('d.end_date >= ?'); params.push(req.query.from); }
  if (req.query.to) { conds.push('d.end_date <= ?'); params.push(req.query.to); }
  if (req.query.lawyer_id) { conds.push('d.responsible_lawyer_id = ?'); params.push(req.query.lawyer_id); }
  if (req.query.q) { conds.push('(d.title_fr LIKE ? OR d.title_ar LIKE ? OR k.search_norm LIKE ?)'); const like = `%${req.query.q}%`; params.push(like, like, `%${normalizeForSearch(req.query.q)}%`); }
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
  const rows = db.prepare(`${DEADLINE_SELECT} WHERE ${conds.join(' AND ')} ORDER BY d.status='active' DESC, d.end_date ${order}`).all(...params);
  ok(res, rows);
});

router.post('/deadlines', requirePerm('deadlines.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.title_fr && !b.title_ar) return fail(res, 400, 'missing_title');
  let end_date = b.end_date;
  let is_computed = 0;
  if (b.rule_id || b.amount) {
    let rule = null;
    if (b.rule_id) rule = db.prepare('SELECT * FROM deadline_rules WHERE id = ?').get(b.rule_id);
    const cfg = rule || {};
    let holidays = [];
    try { holidays = JSON.parse(getSetting('calendar.custom_holidays', '[]')); } catch (e) { holidays = []; }
    holidays = holidays.concat(db.prepare('SELECT date, is_recurring_annual FROM holidays WHERE court_id IS NULL').all());
    const weekendDays = (() => { try { return JSON.parse(getSetting('calendar.weekend_days', '[5,6]')); } catch (e) { return [5, 6]; } })();
    const computed = computeDeadline({
      start_date: b.start_date || dayjs().format('YYYY-MM-DD'),
      amount: b.amount ?? cfg.amount, unit: b.unit ?? cfg.unit, day_type: b.day_type ?? cfg.day_type,
      direction: b.direction ?? cfg.direction, holiday_exclusion: b.holiday_exclusion ?? cfg.holiday_exclusion,
      holidays, weekend_days: weekendDays
    });
    end_date = computed.end_date;
    is_computed = 1;
  }
  if (!end_date) return fail(res, 400, 'missing_end_date');
  const r = db.prepare(`INSERT INTO deadlines
    (case_id, title_ar, title_fr, deadline_type, start_date, rule_id, amount, unit, day_type, holiday_exclusion, direction,
     end_date, is_computed, responsible_lawyer_id, priority, source, legal_basis, verification_status, status, notes, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.case_id ?? null, b.title_ar ?? null, b.title_fr, b.deadline_type || 'procedural',
    b.start_date ?? null, b.rule_id ?? null, b.amount ?? null, b.unit ?? 'day', b.day_type ?? 'calendar',
    b.holiday_exclusion ? 1 : 0, b.direction || 'forward',
    end_date, is_computed, b.responsible_lawyer_id ?? null, b.priority || 'medium',
    b.source ?? null, b.legal_basis ?? null, b.verification_status || 'unverified', b.status || 'active',
    b.notes ?? null, req.user.id, now(), now()
  );
  if (b.case_id) logCaseEvent(b.case_id, req.user.id, 'deadline', `Échéance créée : ${b.title_fr} (${end_date})`, { deadline_id: r.lastInsertRowid });
  audit(req, 'create', 'deadline', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid, end_date, is_computed });
});

router.put('/deadlines/:id', requirePerm('deadlines.edit'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM deadlines WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  if (b.recompute && m.rule_id) {
    const rule = db.prepare('SELECT * FROM deadline_rules WHERE id = ?').get(m.rule_id);
    if (rule) {
      let holidays = db.prepare('SELECT date, is_recurring_annual FROM holidays WHERE court_id IS NULL').all();
      const weekendDays = (() => { try { return JSON.parse(getSetting('calendar.weekend_days', '[5,6]')); } catch (e) { return [5, 6]; } })();
      const computed = computeDeadline({ start_date: m.start_date, amount: rule.amount, unit: rule.unit, day_type: rule.day_type, direction: rule.direction, holiday_exclusion: rule.holiday_exclusion, holidays, weekend_days: weekendDays });
      m.end_date = computed.end_date;
      m.is_computed = 1;
    }
  }
  db.prepare(`UPDATE deadlines SET case_id=?, title_ar=?, title_fr=?, deadline_type=?, start_date=?, rule_id=?, amount=?, unit=?, day_type=?,
    holiday_exclusion=?, direction=?, end_date=?, is_computed=?, responsible_lawyer_id=?, priority=?, source=?, legal_basis=?,
    verification_status=?, status=?, suspended_until=?, extended_until=?, completed_at=?, notes=?, updated_at=? WHERE id=?`).run(
    m.case_id, m.title_ar, m.title_fr, m.deadline_type, m.start_date, m.rule_id, m.amount, m.unit, m.day_type,
    m.holiday_exclusion, m.direction, m.end_date, m.is_computed, m.responsible_lawyer_id, m.priority, m.source, m.legal_basis,
    m.verification_status, m.status, m.suspended_until, m.extended_until, m.completed_at, m.notes, now(), req.params.id
  );
  if (b.status && b.status !== ex.status && m.case_id) {
    logCaseEvent(m.case_id, req.user.id, 'deadline', `Échéance « ${m.title_fr} » : ${b.status}`, { deadline_id: ex.id });
  }
  audit(req, 'update', 'deadline', req.params.id);
  ok(res, { updated: true, end_date: m.end_date });
});

router.put('/deadlines/:id/complete', requirePerm('deadlines.edit'), (req, res) => {
  const d = db.prepare('SELECT * FROM deadlines WHERE id = ?').get(req.params.id);
  if (!d) return fail(res, 404, 'not_found');
  db.prepare("UPDATE deadlines SET status='done', completed_at=?, updated_at=? WHERE id=?").run(now(), now(), req.params.id);
  if (d.case_id) logCaseEvent(d.case_id, req.user.id, 'deadline', `Échéance accomplie : ${d.title_fr}`, { deadline_id: d.id });
  audit(req, 'complete', 'deadline', req.params.id);
  ok(res, { done: true });
});

// ================================================================ HOLIDAYS
router.get('/holidays', (req, res) => {
  const conds = ['1=1'];
  const params = [];
  if (req.query.from) { conds.push('date >= ?'); params.push(req.query.from); }
  if (req.query.to) { conds.push('date <= ?'); params.push(req.query.to); }
  if (req.query.kind) { conds.push('kind = ?'); params.push(req.query.kind); }
  ok(res, db.prepare(`SELECT h.*, je.name_fr AS court_name_fr FROM holidays h LEFT JOIN judicial_entities je ON je.id = h.court_id WHERE ${conds.join(' AND ')} ORDER BY h.date`).all(...params));
});

router.post('/holidays', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.name_fr || !b.date) return fail(res, 400, 'missing_fields');
  const r = db.prepare(`INSERT INTO holidays (name_ar, name_fr, date, kind, court_id, is_recurring_annual, verification_status, source_id, notes)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(b.name_ar ?? b.name_fr, b.name_fr, b.date, b.kind || 'public', b.court_id ?? null,
    b.is_recurring_annual ? 1 : 0, b.verification_status || 'unverified', b.source_id ?? null, b.notes ?? null);
  audit(req, 'create', 'holiday', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/holidays/:id', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM holidays WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  db.prepare(`UPDATE holidays SET name_ar=?, name_fr=?, date=?, kind=?, court_id=?, is_recurring_annual=?, verification_status=?, source_id=?, notes=? WHERE id=?`).run(
    m.name_ar, m.name_fr, m.date, m.kind, m.court_id, m.is_recurring_annual, m.verification_status, m.source_id, m.notes, req.params.id
  );
  audit(req, 'update', 'holiday', req.params.id);
  ok(res, { updated: true });
});

router.delete('/holidays/:id', requirePerm('settings.manage'), (req, res) => {
  db.prepare('DELETE FROM holidays WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'holiday', req.params.id);
  ok(res, { deleted: true });
});

// ================================================================ TASKS
router.get('/tasks', requirePerm('tasks.view'), (req, res) => {
  const conds = ['1=1'];
  const params = [];
  if (req.query.case_id) { conds.push('t.case_id = ?'); params.push(req.query.case_id); }
  if (req.query.assigned_to) { conds.push('t.assigned_to = ?'); params.push(req.query.assigned_to); }
  if (req.query.status) { conds.push('t.status = ?'); params.push(req.query.status); } else if (req.query.open === '1') { conds.push("t.status IN ('todo','in_progress')"); }
  if (req.query.priority) { conds.push('t.priority = ?'); params.push(req.query.priority); }
  if (req.query.overdue === '1') { conds.push("t.due_date < date('now','localtime') AND t.status IN ('todo','in_progress')"); }
  if (req.query.q) { conds.push('t.search_norm LIKE ?'); params.push(`%${normalizeForSearch(req.query.q)}%`); }
  const rows = db.prepare(`
    SELECT t.*, k.reference AS case_reference, k.title_fr AS case_title_fr,
      u.full_name_fr AS assignee_name_fr, u.full_name_ar AS assignee_name_ar,
      c.full_name_fr AS creator_name_fr
    FROM tasks t LEFT JOIN cases k ON k.id = t.case_id
    LEFT JOIN users u ON u.id = t.assigned_to LEFT JOIN users c ON c.id = t.created_by
    WHERE ${conds.join(' AND ')} ORDER BY t.status != 'done' DESC, t.due_date, t.id DESC`).all(...params);
  ok(res, rows);
});

router.post('/tasks', requirePerm('tasks.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.title) return fail(res, 400, 'missing_title');
  const r = db.prepare(`INSERT INTO tasks (title, description, case_id, assigned_to, created_by, due_date, due_time, priority, status, related_hearing_id, related_deadline_id, search_norm, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.title, b.description ?? null, b.case_id ?? null, b.assigned_to ?? null, req.user.id,
    b.due_date ?? null, b.due_time ?? null, b.priority || 'medium', b.status || 'todo',
    b.related_hearing_id ?? null, b.related_deadline_id ?? null, normalizeForSearch(b.title), now(), now()
  );
  if (b.case_id) logCaseEvent(b.case_id, req.user.id, 'task', `Tâche créée : ${b.title}`, { task_id: r.lastInsertRowid });
  if (b.assigned_to && b.assigned_to !== req.user.id) {
    db.prepare(`INSERT INTO notifications (user_id, kind, title_ar, title_fr, body_ar, body_fr, ref_type, ref_id, is_read, created_at) VALUES (?,?,?,?,?,?,?,?,0,?)`)
      .run(b.assigned_to, 'task', 'مهمة جديدة', 'Nouvelle tâche', b.title, b.title, 'task', r.lastInsertRowid, now());
  }
  audit(req, 'create', 'task', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/tasks/:id', requirePerm('tasks.edit'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  if (b.status === 'done' && ex.status !== 'done') m.completed_at = now();
  db.prepare(`UPDATE tasks SET title=?, description=?, case_id=?, assigned_to=?, due_date=?, due_time=?, priority=?, status=?, completed_at=?, search_norm=?, updated_at=? WHERE id=?`).run(
    m.title, m.description, m.case_id, m.assigned_to, m.due_date, m.due_time, m.priority, m.status, m.completed_at, normalizeForSearch(m.title), now(), req.params.id
  );
  if (b.status === 'done' && ex.status !== 'done' && m.case_id) {
    logCaseEvent(m.case_id, req.user.id, 'task', `Tâche accomplie : ${m.title}`, { task_id: ex.id });
  }
  audit(req, 'update', 'task', req.params.id);
  ok(res, { updated: true });
});

router.delete('/tasks/:id', requirePerm('tasks.edit'), (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'task', req.params.id);
  ok(res, { deleted: true });
});

// ================================================================ EVENTS (appointments)
router.get('/events', requirePerm('calendar.view'), (req, res) => {
  const conds = ['1=1'];
  const params = [];
  if (req.query.from) { conds.push('start_at >= ?'); params.push(`${req.query.from}T00:00`); }
  if (req.query.to) { conds.push('start_at <= ?'); params.push(`${req.query.to}T23:59`); }
  if (req.query.type) { conds.push('event_type = ?'); params.push(req.query.type); }
  ok(res, db.prepare(`SELECT e.*, k.reference AS case_reference, k.title_fr AS case_title_fr, c.full_name_fr AS client_name_fr, c.legal_name AS client_legal_name
    FROM events e LEFT JOIN cases k ON k.id = e.case_id LEFT JOIN clients c ON c.id = e.client_id
    WHERE ${conds.join(' AND ')} ORDER BY e.start_at`).all(...params));
});

router.post('/events', requirePerm('calendar.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.start_at) return fail(res, 400, 'missing_fields');
  const r = db.prepare(`INSERT INTO events (title, event_type, start_at, end_at, location, court_id, case_id, client_id, participants, notes, search_norm, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.title, b.event_type || 'appointment', b.start_at, b.end_at ?? null, b.location ?? null,
    b.court_id ?? null, b.case_id ?? null, b.client_id ?? null,
    Array.isArray(b.participants) ? JSON.stringify(b.participants) : (b.participants || null),
    b.notes ?? null, normalizeForSearch(b.title), req.user.id, now(), now()
  );
  if (b.case_id) logCaseEvent(b.case_id, req.user.id, 'event', `Rendez-vous : ${b.title}`);
  audit(req, 'create', 'event', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/events/:id', requirePerm('calendar.edit'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  db.prepare(`UPDATE events SET title=?, event_type=?, start_at=?, end_at=?, location=?, case_id=?, client_id=?, participants=?, notes=?, search_norm=?, updated_at=? WHERE id=?`).run(
    m.title, m.event_type, m.start_at, m.end_at, m.location, m.case_id, m.client_id,
    Array.isArray(m.participants) ? JSON.stringify(m.participants) : m.participants,
    m.notes, normalizeForSearch(m.title), now(), req.params.id
  );
  audit(req, 'update', 'event', req.params.id);
  ok(res, { updated: true });
});

router.delete('/events/:id', requirePerm('calendar.edit'), (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'event', req.params.id);
  ok(res, { deleted: true });
});

// ================================================================ UNIFIED CALENDAR
router.get('/calendar', requirePerm('calendar.view'), (req, res) => {
  const from = req.query.from || dayjs().startOf('month').format('YYYY-MM-DD');
  const to = req.query.to || dayjs().endOf('month').format('YYYY-MM-DD');
  const items = [];
  const lawyer = req.query.lawyer_id;

  const hConds = ["h.date >= ? AND h.date <= ?"];
  const hParams = [from, to];
  if (lawyer) { hConds.push('(h.lawyer_id = ? OR h.assistant_id = ?)'); hParams.push(lawyer, lawyer); }
  db.prepare(`SELECT h.id, h.date, h.time, h.hearing_type, h.status, h.room, h.purpose, k.id AS case_id, k.reference AS case_ref, k.title_fr AS case_title,
      u.full_name_fr AS lawyer_name, je.name_fr AS court_name, ch.name_fr AS chamber_name
    FROM hearings h LEFT JOIN cases k ON k.id = h.case_id LEFT JOIN users u ON u.id = h.lawyer_id
    LEFT JOIN judicial_entities je ON je.id = h.court_id LEFT JOIN chambers ch ON ch.id = h.chamber_id
    WHERE ${hConds.join(' AND ')}`).all(...hParams).forEach((h) => {
    items.push({ type: 'hearing', date: h.date, time: h.time, title: `${h.case_ref ? h.case_ref + ' — ' : ''}${h.case_title || ''}`, sub: `${h.court_name || ''}${h.chamber_name ? ' · ' + h.chamber_name : ''}`, ref_id: h.id, case_id: h.case_id, extra: h });
  });

  db.prepare(`SELECT d.id, d.end_date, d.title_fr, d.priority, d.status, k.id AS case_id, k.reference AS case_ref
    FROM deadlines d LEFT JOIN cases k ON k.id = d.case_id
    WHERE d.end_date >= ? AND d.end_date <= ? AND d.status = 'active'`).all(from, to).forEach((d) => {
    items.push({ type: 'deadline', date: d.end_date, time: null, title: d.title_fr, sub: d.case_ref || '', priority: d.priority, ref_id: d.id, case_id: d.case_id });
  });

  db.prepare(`SELECT e.* FROM events e WHERE e.start_at >= ? AND e.start_at <= ?`).all(`${from}T00:00`, `${to}T23:59`).forEach((e) => {
    items.push({ type: e.event_type === 'client_meeting' ? 'meeting' : 'appointment', date: e.start_at.slice(0, 10), time: e.start_at.slice(11, 16), title: e.title, sub: e.location || '', ref_id: e.id, case_id: e.case_id });
  });

  db.prepare(`SELECT t.id, t.due_date, t.title, t.status, k.reference AS case_ref FROM tasks t LEFT JOIN cases k ON k.id = t.case_id
    WHERE t.due_date >= ? AND t.due_date <= ? AND t.status IN ('todo','in_progress')`).all(from, to).forEach((t) => {
    items.push({ type: 'task', date: t.due_date, time: null, title: t.title, sub: t.case_ref || '', ref_id: t.id });
  });

  db.prepare(`SELECT h.name_fr, h.date, h.kind FROM holidays h WHERE (h.date >= ? AND h.date <= ?) OR (h.is_recurring_annual = 1) ORDER BY h.date`).all(from, to).forEach((h) => {
    items.push({ type: 'holiday', date: h.date, title: h.name_fr, sub: h.kind, ref_id: null });
  });

  ok(res, { from, to, items });
});

// ICS export (works with Google Calendar / Outlook imports)
router.get('/calendar.ics', (req, res) => {
  const from = req.query.from || dayjs().format('YYYY-MM-DD');
  const to = req.query.to || dayjs().add(3, 'month').format('YYYY-MM-DD');
  const stamp = (s) => String(s).replace(/[-:]/g, '');
  const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ADVOCATE PRO ALGERIE//Calendar//FR', 'CALSCALE:GREGORIAN'];
  const push = (uid, date, time, title, desc) => {
    const dtStart = time ? `${stamp(date)}T${stamp(time)}00` : `${stamp(date)}`;
    lines.push('BEGIN:VEVENT', `UID:${uid}@advocate-pro.dz`, `DTSTAMP:${stamp(dayjs().format('YYYY-MM-DDTHH:mm'))}00`,
      time ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
      time ? `DTEND:${stamp(date)}T${stamp(time)}00` : `DTEND;VALUE=DATE:${stamp(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}`,
      `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc || '')}`, 'END:VEVENT');
  };
  db.prepare(`SELECT h.*, k.reference, k.title_fr AS case_title FROM hearings h LEFT JOIN cases k ON k.id = h.case_id WHERE h.date >= ? AND h.date <= ?`).all(from, to)
    .forEach((h) => push(`hearing-${h.id}`, h.date, h.time, `Audience — ${h.case_title || h.reference || ''}`, `${h.purpose || ''}`));
  db.prepare(`SELECT d.*, k.reference FROM deadlines d LEFT JOIN cases k ON k.id = d.case_id WHERE d.end_date >= ? AND d.end_date <= ? AND d.status='active'`).all(from, to)
    .forEach((d) => push(`deadline-${d.id}`, d.end_date, null, `Échéance — ${d.title_fr}`, d.case_ref || ''));
  db.prepare(`SELECT * FROM events WHERE start_at >= ? AND start_at <= ?`).all(`${from}T00:00`, `${to}T23:59`)
    .forEach((e) => push(`event-${e.id}`, e.start_at.slice(0, 10), e.start_at.slice(11, 16) || null, e.title, e.location || ''));
  lines.push('END:VCALENDAR');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="advocate-pro-calendrier.ics"');
  res.send(lines.join('\r\n'));
});

module.exports = router;
