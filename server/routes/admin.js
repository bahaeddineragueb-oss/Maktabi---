/** Administration: users & permissions, settings, taxonomy, audit logs, backup, data conflicts, notifications. */
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, now } = require('../db');
const { authenticate, requirePerm, audit, effectivePermissions } = require('../middleware/auth');
const { ok, fail, normalizeForSearch } = require('./helpers');
const { PERMISSIONS, ROLE_DEFAULTS, ROLES } = require('../permissions');

const router = express.Router();
router.use(authenticate);

// ================================================================ USERS / STAFF
router.get('/users', requirePerm('staff.view'), (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name_ar, u.full_name_fr, u.role, u.bar_registration, u.bar_association,
      u.phone, u.address, u.specializations, u.languages, u.professional_status, u.is_active, u.last_login_at, u.created_at,
      (SELECT COUNT(*) FROM cases k WHERE (k.responsible_lawyer_id = u.id OR k.assistant_id = u.id) AND k.is_archived = 0) AS cases_count
    FROM users u ORDER BY u.role, u.full_name_fr`).all();
  ok(res, rows);
});

router.get('/users/:id', requirePerm('staff.view'), (req, res) => {
  const u = db.prepare(`SELECT id, username, email, full_name_ar, full_name_fr, role, bar_registration, bar_association,
    phone, address, specializations, languages, professional_status, is_active, last_login_at FROM users WHERE id = ?`).get(req.params.id);
  if (!u) return fail(res, 404, 'not_found');
  u.permissions = effectivePermissions(u);
  u.permission_overrides = db.prepare('SELECT permission, allowed FROM user_permissions WHERE user_id = ?').all(req.params.id);
  u.cases = db.prepare(`
    SELECT k.id, k.reference, k.title_fr, s.name_fr AS status_name_fr, s.color AS status_color
    FROM cases k LEFT JOIN case_statuses s ON s.id = k.status_id
    WHERE (k.responsible_lawyer_id = ? OR k.id IN (SELECT case_id FROM case_lawyers WHERE user_id = ?)) AND k.is_archived = 0`).all(req.params.id, req.params.id);
  ok(res, u);
});

router.post('/users', requirePerm('staff.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.username || !b.password || !b.role) return fail(res, 400, 'missing_fields');
  if (String(b.password).length < 8) return fail(res, 400, 'password_too_short');
  if (!ROLES.includes(b.role)) return fail(res, 400, 'invalid_role');
  try {
    const r = db.prepare(`INSERT INTO users (username, email, password_hash, full_name_ar, full_name_fr, role, bar_registration, bar_association, phone, address, specializations, languages, professional_status, is_active, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`).run(
      String(b.username).trim().toLowerCase(), b.email ?? null, bcrypt.hashSync(b.password, 10),
      b.full_name_ar ?? null, b.full_name_fr ?? null, b.role, b.bar_registration ?? null, b.bar_association ?? null,
      b.phone ?? null, b.address ?? null, b.specializations ?? null, b.languages ?? null, b.professional_status || 'active', now(), now()
    );
    audit(req, 'create', 'user', r.lastInsertRowid, { username: b.username, role: b.role });
    ok(res, { id: r.lastInsertRowid });
  } catch (e) {
    return fail(res, 409, 'username_taken');
  }
});

router.put('/users/:id', requirePerm('staff.manage'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  if (b.role && !ROLES.includes(b.role)) return fail(res, 400, 'invalid_role');
  if (b.password) {
    if (String(b.password).length < 8) return fail(res, 400, 'password_too_short');
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(bcrypt.hashSync(b.password, 10), now(), req.params.id);
  }
  db.prepare(`UPDATE users SET email=COALESCE(?,email), full_name_ar=COALESCE(?,full_name_ar), full_name_fr=COALESCE(?,full_name_fr),
    role=COALESCE(?,role), bar_registration=COALESCE(?,bar_registration), bar_association=COALESCE(?,bar_association),
    phone=COALESCE(?,phone), address=COALESCE(?,address), specializations=COALESCE(?,specializations),
    languages=COALESCE(?,languages), professional_status=COALESCE(?,professional_status), is_active=COALESCE(?,is_active), updated_at=? WHERE id=?`).run(
    b.email ?? null, b.full_name_ar ?? null, b.full_name_fr ?? null, b.role ?? null, b.bar_registration ?? null,
    b.bar_association ?? null, b.phone ?? null, b.address ?? null, b.specializations ?? null, b.languages ?? null,
    b.professional_status ?? null, b.is_active ?? null, now(), req.params.id
  );
  audit(req, 'update', 'user', req.params.id);
  ok(res, { updated: true });
});

router.delete('/users/:id', requirePerm('staff.manage'), (req, res) => {
  if (Number(req.params.id) === req.user.id) return fail(res, 400, 'cannot_deactivate_self');
  db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').run(now(), req.params.id);
  audit(req, 'deactivate', 'user', req.params.id);
  ok(res, { deactivated: true });
});

// permissions catalog + per-user overrides
router.get('/permissions', requirePerm('staff.view'), (req, res) => {
  ok(res, { permissions: PERMISSIONS, role_defaults: ROLE_DEFAULTS, roles: ROLES });
});

router.put('/users/:id/permissions', requirePerm('staff.manage'), (req, res) => {
  const { overrides } = req.body || {};
  if (!Array.isArray(overrides)) return fail(res, 400, 'missing_overrides');
  db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(req.params.id);
  const q = db.prepare('INSERT OR REPLACE INTO user_permissions (user_id, permission, allowed) VALUES (?,?,?)');
  for (const o of overrides) {
    if (!PERMISSIONS.includes(o.permission)) continue;
    q.run(req.params.id, o.permission, o.allowed ? 1 : 0);
  }
  audit(req, 'update_permissions', 'user', req.params.id);
  ok(res, { updated: true });
});

// ================================================================ SETTINGS
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  ok(res, obj);
});

router.put('/settings', requirePerm('settings.manage'), (req, res) => {
  const { settings } = req.body || {};
  if (!settings || typeof settings !== 'object') return fail(res, 400, 'missing_settings');
  const q = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)');
  for (const [k, v] of Object.entries(settings)) q.run(k, String(v));
  audit(req, 'update', 'settings', null, { keys: Object.keys(settings) });
  ok(res, { updated: true });
});

// ================================================================ TAXONOMY: practice areas
router.get('/practice-areas', (req, res) => {
  ok(res, db.prepare('SELECT p.*, parent.name_fr AS parent_name_fr FROM practice_areas p LEFT JOIN practice_areas parent ON parent.id = p.parent_id WHERE p.is_active = 1 ORDER BY p.sort').all());
});
router.post('/practice-areas', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.name_fr || !b.name_ar) return fail(res, 400, 'missing_fields');
  const r = db.prepare('INSERT INTO practice_areas (code, name_ar, name_fr, parent_id, sort) VALUES (?,?,?,?,?)')
    .run(b.code || `custom_${Date.now()}`, b.name_ar, b.name_fr, b.parent_id ?? null, b.sort ?? 999);
  audit(req, 'create', 'practice_area', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});
router.put('/practice-areas/:id', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  db.prepare('UPDATE practice_areas SET name_ar=COALESCE(?,name_ar), name_fr=COALESCE(?,name_fr), parent_id=COALESCE(?,parent_id), is_active=COALESCE(?,is_active) WHERE id=?')
    .run(b.name_ar ?? null, b.name_fr ?? null, b.parent_id ?? null, b.is_active ?? null, req.params.id);
  audit(req, 'update', 'practice_area', req.params.id);
  ok(res, { updated: true });
});

// ================================================================ TAXONOMY: case statuses (custom statuses)
router.post('/case-statuses', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.name_fr || !b.name_ar) return fail(res, 400, 'missing_fields');
  try {
    const r = db.prepare('INSERT INTO case_statuses (code, name_ar, name_fr, color, is_system, sort, is_active) VALUES (?,?,?,?,0,?,1)')
      .run(b.code, b.name_ar, b.name_fr, b.color || '#1890ff', b.sort ?? 200);
    audit(req, 'create', 'case_status', r.lastInsertRowid);
    ok(res, { id: r.lastInsertRowid });
  } catch (e) { return fail(res, 409, 'duplicate_code'); }
});
router.put('/case-statuses/:id', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM case_statuses WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  if (ex.is_system && b.code && b.code !== ex.code) return fail(res, 400, 'system_status_code_locked');
  db.prepare('UPDATE case_statuses SET code=COALESCE(?,code), name_ar=COALESCE(?,name_ar), name_fr=COALESCE(?,name_fr), color=COALESCE(?,color), sort=COALESCE(?,sort), is_active=COALESCE(?,is_active) WHERE id=?')
    .run(b.code ?? null, b.name_ar ?? null, b.name_fr ?? null, b.color ?? null, b.sort ?? null, b.is_active ?? null, req.params.id);
  audit(req, 'update', 'case_status', req.params.id);
  ok(res, { updated: true });
});

// ================================================================ AUDIT LOGS
router.get('/audit', requirePerm('audit.view'), (req, res) => {
  const conds = ['1=1'];
  const params = [];
  if (req.query.entity) { conds.push('entity = ?'); params.push(req.query.entity); }
  if (req.query.user_id) { conds.push('user_id = ?'); params.push(req.query.user_id); }
  if (req.query.from) { conds.push('created_at >= ?'); params.push(req.query.from); }
  if (req.query.to) { conds.push('created_at <= ?'); params.push(`${req.query.to}T23:59:59`); }
  const limit = Math.min(500, parseInt(req.query.limit, 10) || 100);
  const rows = db.prepare(`SELECT * FROM audit_logs WHERE ${conds.join(' AND ')} ORDER BY id DESC LIMIT ?`).all(...params, limit);
  ok(res, rows);
});

// ================================================================ BACKUP (JSON export)
router.get('/backup/export', requirePerm('backup.manage'), (req, res) => {
  const tables = ['settings', 'users', 'clients', 'client_relationships', 'contacts', 'cases', 'case_lawyers', 'case_events',
    'hearings', 'deadlines', 'deadline_rules', 'holidays', 'tasks', 'events', 'documents', 'templates',
    'legal_sources', 'legal_texts', 'legal_articles', 'legal_article_versions', 'jurisprudence',
    'invoices', 'invoice_items', 'payments', 'expenses', 'notifications', 'data_conflicts',
    'wilayas', 'court_types', 'judicial_entities', 'chambers', 'practice_areas', 'case_statuses'];
  const dump = { meta: { app: 'ADVOCATE PRO ALGÉRIE', exported_at: now(), version: '1.0' } };
  for (const t of tables) dump[t] = db.prepare(`SELECT * FROM ${t}`).all();
  audit(req, 'backup_export', 'system', null);
  res.setHeader('Content-Disposition', `attachment; filename="advocate-pro-backup-${now().slice(0, 10)}.json"`);
  res.json(dump);
});

// ================================================================ DATA CONFLICTS
router.get('/data-conflicts', requirePerm('directory.view'), (req, res) => {
  ok(res, db.prepare('SELECT * FROM data_conflicts ORDER BY status = "open" DESC, created_at DESC').all());
});
router.post('/data-conflicts', requirePerm('directory.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.entity || !b.field) return fail(res, 400, 'missing_fields');
  const r = db.prepare('INSERT INTO data_conflicts (entity, entity_ref, field, value_a, value_b, source_a, source_b, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(b.entity, b.entity_ref ?? null, b.field, b.value_a ?? null, b.value_b ?? null, b.source_a ?? null, b.source_b ?? null, 'open', b.notes ?? null, now());
  audit(req, 'create', 'data_conflict', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});
router.put('/data-conflicts/:id', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM data_conflicts WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  db.prepare('UPDATE data_conflicts SET status=?, resolution=?, notes=?, resolved_at=?, resolved_by=? WHERE id=?').run(
    m.status, m.resolution, m.notes,
    m.status !== 'open' ? now() : null, m.status !== 'open' ? req.user.id : null, req.params.id
  );
  audit(req, 'update', 'data_conflict', req.params.id);
  ok(res, { updated: true });
});

// ================================================================ NOTIFICATIONS
router.get('/notifications', (req, res) => {
  const items = [];
  const today = now().slice(0, 10);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  // dynamic digest
  db.prepare(`SELECT h.id, h.date, h.time, h.hearing_type, k.id AS case_id, k.reference, k.title_fr AS case_title, je.name_fr AS court_name
    FROM hearings h LEFT JOIN cases k ON k.id = h.case_id LEFT JOIN judicial_entities je ON je.id = h.court_id
    WHERE h.date = ? AND h.status = 'scheduled'`).all(today).forEach((h) =>
    items.push({ kind: 'hearing_today', date: today, title_fr: `Audience aujourd'hui — ${h.reference || ''} ${h.case_title || ''}`, sub_fr: `${h.court_name || ''} ${h.time || ''}`, case_id: h.case_id })
  );
  db.prepare(`SELECT h.id, h.date, h.time, k.id AS case_id, k.reference, k.title_fr AS case_title, je.name_fr AS court_name
    FROM hearings h LEFT JOIN cases k ON k.id = h.case_id LEFT JOIN judicial_entities je ON je.id = h.court_id
    WHERE h.date = ? AND h.status = 'scheduled'`).all(tomorrow).forEach((h) =>
    items.push({ kind: 'hearing_tomorrow', date: tomorrow, title_fr: `Audience demain — ${h.reference || ''} ${h.case_title || ''}`, sub_fr: `${h.court_name || ''} ${h.time || ''}`, case_id: h.case_id })
  );
  db.prepare(`SELECT d.id, d.end_date, d.title_fr, d.case_id, k.reference FROM deadlines d LEFT JOIN cases k ON k.id = d.case_id
    WHERE d.status = 'active' AND d.end_date >= ? AND d.end_date <= ?`).all(today, in7).forEach((d) =>
    items.push({ kind: 'deadline_soon', date: d.end_date, title_fr: `Échéance proche — ${d.title_fr}`, sub_fr: d.reference || '', case_id: d.case_id, priority: true })
  );
  db.prepare(`SELECT t.id, t.title, t.due_date, t.case_id FROM tasks t
    WHERE t.status IN ('todo','in_progress') AND t.due_date < ?`).all(today).forEach((t) =>
    items.push({ kind: 'task_overdue', date: t.due_date, title_fr: `Tâche en retard — ${t.title}`, case_id: t.case_id, priority: true })
  );
  db.prepare(`SELECT i.id, i.number, i.due_date, i.total - i.paid_amount AS due, c.full_name_fr AS client_name
    FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
    WHERE i.status NOT IN ('cancelled','draft') AND i.due_date < ? AND i.total > i.paid_amount`).all(today).forEach((i) =>
    items.push({ kind: 'invoice_overdue', date: i.due_date, title_fr: `Facture impayée ${i.number} — ${i.client_name || ''}`, sub_fr: `Reste à payer : ${Math.round(i.due).toLocaleString('fr-FR')} DZD` })
  );
  db.prepare(`SELECT e.id, e.title, e.start_at FROM events e WHERE e.start_at >= ? AND e.start_at <= ?`).all(`${today}T00:00`, `${in7}T23:59`).forEach((e) =>
    items.push({ kind: 'appointment', date: e.start_at.slice(0, 10), title_fr: `Rendez-vous — ${e.title}`, sub_fr: e.start_at.slice(11, 16) })
  );

  // stored notifications
  const stored = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(req.user.id);
  ok(res, { dynamic: items, stored, unread: db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).c });
});

router.put('/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  ok(res, { read: true });
});
router.put('/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  ok(res, { read: true });
});

module.exports = router;
