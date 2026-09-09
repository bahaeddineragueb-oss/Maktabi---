/** Shared route helpers. */
const { db, now } = require('../db');
const { normalizeForSearch } = require('../utils/normalize');

const ok = (res, data) => res.json({ ok: true, data });
const fail = (res, status, error, extra) => res.status(status).json({ ok: false, error, ...extra });

function paginate(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

/** Build a LIKE search condition on a normalized column. */
function searchCond(req, column = 'search_norm') {
  const q = req.query.q ? normalizeForSearch(req.query.q) : '';
  if (!q) return { cond: null, param: null };
  return { cond: `AND ${column} LIKE ?`, param: `%${q}%` };
}

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

/** Update a case's "last action" timestamp + append a timeline event. */
function logCaseEvent(caseId, userId, eventType, description, refs = {}) {
  if (!caseId) return;
  const ts = now();
  db.prepare('UPDATE cases SET last_action_at = ?, updated_at = ? WHERE id = ?').run(ts, ts, caseId);
  db.prepare(
    `INSERT INTO case_events (case_id, event_date, event_time, user_id, event_type, description, document_id, task_id, hearing_id, deadline_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    caseId, ts.slice(0, 10), ts.slice(11, 16), userId, eventType, description,
    refs.document_id || null, refs.task_id || null, refs.hearing_id || null, refs.deadline_id || null, ts
  );
}

/** Recompute cached next-hearing date on a case. */
function refreshNextHearing(caseId) {
  if (!caseId) return;
  const row = db.prepare(
    "SELECT date, time FROM hearings WHERE case_id = ? AND date >= date('now','localtime') AND status = 'scheduled' ORDER BY date, time LIMIT 1"
  ).get(caseId);
  // stored on the fly by API joins; keep a marker in settings-less way: we recompute in queries.
  return row || null;
}

/** Assemble WHERE clauses from a filter map {column: {op, val}}. */
function buildWhere(conditions) {
  const clauses = conditions.filter(Boolean);
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

module.exports = { ok, fail, paginate, searchCond, getSetting, logCaseEvent, refreshNextHearing, buildWhere, normalizeForSearch };
