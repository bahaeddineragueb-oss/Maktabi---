/** Insights: dashboard statistics, reports, and bilingual global search. */
const express = require('express');
const dayjs = require('dayjs');
const { db, now } = require('../db');
const { authenticate, requirePerm } = require('../middleware/auth');
const { ok, normalizeForSearch } = require('./helpers');

const router = express.Router();
router.use(authenticate);

// ================================================================ DASHBOARD
router.get('/dashboard', requirePerm('cases.view'), (req, res) => {
  const today = now().slice(0, 10);
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const in7 = dayjs().add(7, 'day').format('YYYY-MM-DD');
  const in14 = dayjs().add(14, 'day').format('YYYY-MM-DD');

  const hearingsToday = db.prepare(`
    SELECT h.id, h.time, h.room, h.hearing_type, h.case_id, k.reference, k.title_fr, k.title_ar,
      je.name_fr AS court_name_fr, je.name_ar AS court_name_ar, ch.name_fr AS chamber_name_fr,
      u.full_name_fr AS lawyer_name_fr, u.full_name_ar AS lawyer_name_ar, cl.full_name_fr AS client_name_fr
    FROM hearings h LEFT JOIN cases k ON k.id = h.case_id
    LEFT JOIN judicial_entities je ON je.id = h.court_id
    LEFT JOIN chambers ch ON ch.id = h.chamber_id
    LEFT JOIN users u ON u.id = h.lawyer_id
    LEFT JOIN clients cl ON cl.id = k.client_id
    WHERE h.date = ? AND h.status = 'scheduled' ORDER BY h.time`).all(today);

  const hearingsTomorrow = db.prepare(`
    SELECT h.id, h.time, h.hearing_type, h.case_id, k.reference, k.title_fr,
      je.name_fr AS court_name_fr, u.full_name_fr AS lawyer_name_fr
    FROM hearings h LEFT JOIN cases k ON k.id = h.case_id
    LEFT JOIN judicial_entities je ON je.id = h.court_id
    LEFT JOIN users u ON u.id = h.lawyer_id
    WHERE h.date = ? AND h.status = 'scheduled' ORDER BY h.time`).all(tomorrow);

  const deadlinesSoon = db.prepare(`
    SELECT d.id, d.end_date, d.title_fr, d.title_ar, d.priority, d.verification_status, d.is_computed,
      d.case_id, k.reference, k.title_fr AS case_title, u.full_name_fr AS lawyer_name_fr
    FROM deadlines d LEFT JOIN cases k ON k.id = d.case_id LEFT JOIN users u ON u.id = d.responsible_lawyer_id
    WHERE d.status = 'active' AND d.end_date >= ? AND d.end_date <= ? ORDER BY d.end_date`).all(today, in14);

  const overdueTasks = db.prepare(`
    SELECT t.id, t.title, t.due_date, t.priority, t.case_id, k.reference, u.full_name_fr AS assignee_name_fr
    FROM tasks t LEFT JOIN cases k ON k.id = t.case_id LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.status IN ('todo','in_progress') AND t.due_date < ? ORDER BY t.due_date LIMIT 15`).all(today);

  const unpaidInvoices = db.prepare(`
    SELECT i.id, i.number, i.client_id, c.full_name_fr AS client_name, c.legal_name,
      i.total, i.paid_amount, i.due_date, i.total - i.paid_amount AS balance
    FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
    WHERE i.status NOT IN ('cancelled','draft') AND i.total > i.paid_amount ORDER BY i.due_date LIMIT 10`).all();

  const inactiveCases = db.prepare(`
    SELECT k.id, k.reference, k.title_fr, k.last_action_at, k.opening_date, s.name_fr AS status_name_fr, s.color AS status_color
    FROM cases k LEFT JOIN case_statuses s ON s.id = k.status_id
    WHERE k.is_archived = 0 AND COALESCE(k.last_action_at, k.created_at) < datetime('now', '-30 days')
    ORDER BY k.last_action_at LIMIT 10`).all();

  const upcomingAppointments = db.prepare(`
    SELECT e.id, e.title, e.start_at, e.location, e.case_id FROM events e
    WHERE e.start_at >= ? ORDER BY e.start_at LIMIT 8`).all(`${today}T00:00`);

  const counters = {
    active_cases: db.prepare('SELECT COUNT(*) c FROM cases WHERE is_archived = 0').get().c,
    clients: db.prepare('SELECT COUNT(*) c FROM clients WHERE is_archived = 0').get().c,
    hearings_this_week: db.prepare("SELECT COUNT(*) c FROM hearings WHERE date BETWEEN ? AND ? AND status='scheduled'").get(today, in7).c,
    active_deadlines: db.prepare("SELECT COUNT(*) c FROM deadlines WHERE status = 'active'").get().c,
    open_tasks: db.prepare("SELECT COUNT(*) c FROM tasks WHERE status IN ('todo','in_progress')").get().c,
    receivables: db.prepare("SELECT COALESCE(SUM(total - paid_amount),0) s FROM invoices WHERE status NOT IN ('cancelled','draft') AND total > paid_amount").get().s
  };

  const casesByStatus = db.prepare(`
    SELECT s.code, s.name_fr, s.name_ar, s.color, COUNT(k.id) AS count
    FROM case_statuses s LEFT JOIN cases k ON k.status_id = s.id AND k.is_archived = 0
    GROUP BY s.id ORDER BY count DESC`).all();

  ok(res, { today, tomorrow, hearingsToday, hearingsTomorrow, deadlinesSoon, overdueTasks, unpaidInvoices, inactiveCases, upcomingAppointments, counters, casesByStatus });
});

// ================================================================ REPORTS
router.get('/reports', requirePerm('reports.view'), (req, res) => {
  const year = req.query.year || String(new Date().getFullYear());
  const byPracticeArea = db.prepare(`
    SELECT p.name_fr, p.name_ar, COUNT(k.id) AS count FROM practice_areas p
    LEFT JOIN practice_areas c ON c.parent_id = p.id
    LEFT JOIN cases k ON (k.practice_area_id = p.id OR k.practice_area_id = c.id) AND k.is_archived = 0
    WHERE p.parent_id IS NULL GROUP BY p.id, p.name_fr, p.name_ar HAVING count > 0 ORDER BY count DESC`).all();
  const bySubArea = db.prepare(`
    SELECT p.name_fr, COUNT(k.id) AS count FROM practice_areas p
    JOIN cases k ON k.practice_area_id = p.id AND k.is_archived = 0
    GROUP BY p.id ORDER BY count DESC LIMIT 15`).all();
  const byCourt = db.prepare(`
    SELECT je.name_fr, je.name_ar, ct.name_fr AS type_name, COUNT(k.id) AS count
    FROM judicial_entities je
    LEFT JOIN cases k ON k.court_id = je.id AND k.is_archived = 0
    LEFT JOIN court_types ct ON ct.id = je.entity_type_id
    GROUP BY je.id HAVING count > 0 ORDER BY count DESC LIMIT 15`).all();
  const casesByMonth = db.prepare(`
    SELECT substr(opening_date,1,7) AS month, COUNT(*) AS count FROM cases
    WHERE opening_date LIKE ? AND is_archived = 0 GROUP BY month ORDER BY month`).all(`${year}-%`);
  const hearingsByMonth = db.prepare(`
    SELECT substr(date,1,7) AS month, COUNT(*) AS count FROM hearings
    WHERE date LIKE ? GROUP BY month ORDER BY month`).all(`${year}-%`);
  const revenueByMonth = db.prepare(`
    SELECT substr(issue_date,1,7) AS month, SUM(total) AS invoiced, SUM(paid_amount) AS paid
    FROM invoices WHERE issue_date LIKE ? AND status != 'cancelled' GROUP BY month ORDER BY month`).all(`${year}-%`);
  const byLawyer = db.prepare(`
    SELECT u.full_name_fr, u.full_name_ar, COUNT(k.id) AS count FROM users u
    LEFT JOIN cases k ON k.responsible_lawyer_id = u.id AND k.is_archived = 0
    WHERE u.is_active = 1 GROUP BY u.id HAVING count > 0 ORDER BY count DESC`).all();
  const deadlineCompliance = {
    on_time: db.prepare("SELECT COUNT(*) c FROM deadlines WHERE status='done' AND (completed_at IS NULL OR date(completed_at) <= end_date)").get().c,
    late: db.prepare("SELECT COUNT(*) c FROM deadlines WHERE status='done' AND completed_at IS NOT NULL AND date(completed_at) > end_date").get().c
  };
  ok(res, { year, byPracticeArea, bySubArea, byCourt, casesByMonth, hearingsByMonth, revenueByMonth, byLawyer, deadlineCompliance });
});

// ================================================================ GLOBAL SEARCH
router.get('/search', requirePerm('search.use'), (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return ok(res, { q, results: [] });
  const norm = `%${normalizeForSearch(q)}%`;
  const like = `%${q}%`;
  const type = req.query.type;
  const results = [];

  if (!type || type === 'cases') {
    db.prepare(`SELECT k.id, k.reference, k.title_fr, k.title_ar, k.court_file_number,
        cl.full_name_fr AS client_name, s.name_fr AS status_name, s.color AS status_color
      FROM cases k LEFT JOIN clients cl ON cl.id = k.client_id LEFT JOIN case_statuses s ON s.id = k.status_id
      WHERE k.is_archived = 0 AND k.search_norm LIKE ? LIMIT 15`).all(norm)
      .forEach((r) => results.push({ type: 'case', id: r.id, title: r.title_fr || r.title_ar, sub: `${r.reference}${r.client_name ? ' · ' + r.client_name : ''}`, badge: r.status_name, color: r.status_color, route: `/cases/${r.id}` }));
  }
  if (!type || type === 'clients') {
    db.prepare(`SELECT id, full_name_fr, full_name_ar, legal_name, commercial_name, client_type, phone FROM clients WHERE is_archived = 0 AND search_norm LIKE ? LIMIT 10`).all(norm)
      .forEach((r) => results.push({ type: 'client', id: r.id, title: r.legal_name || r.commercial_name || r.full_name_fr || r.full_name_ar, sub: r.phone || r.client_type, route: `/clients/${r.id}` }));
  }
  if (!type || type === 'documents') {
    db.prepare(`SELECT d.id, d.title, d.doc_type, d.version, k.reference FROM documents d LEFT JOIN cases k ON k.id = d.case_id WHERE d.is_archived = 0 AND d.search_norm LIKE ? LIMIT 15`).all(norm)
      .forEach((r) => results.push({ type: 'document', id: r.id, title: r.title, sub: `${r.doc_type}${r.reference ? ' · ' + r.reference : ''}`, route: `/documents?focus=${r.id}` }));
  }
  if (!type || type === 'legal') {
    db.prepare(`SELECT t.id, t.title_fr, t.title_ar, t.number, t.kind FROM legal_texts t WHERE t.search_norm LIKE ? LIMIT 10`).all(norm)
      .forEach((r) => results.push({ type: 'legal_text', id: r.id, title: r.title_fr || r.title_ar, sub: `${r.kind}${r.number ? ' · ' + r.number : ''}`, route: `/library/texts/${r.id}` }));
    db.prepare(`SELECT a.id, a.article_number, a.title_fr, a.body_fr, a.body_ar, t.title_fr AS text_title
      FROM legal_articles a JOIN legal_texts t ON t.id = a.text_id WHERE a.search_norm LIKE ? LIMIT 15`).all(norm)
      .forEach((r) => results.push({ type: 'legal_article', id: r.id, title: `${r.text_title} — Art. ${r.article_number}`, sub: (r.body_fr || r.body_ar || '').slice(0, 120), route: `/library/articles/${r.id}` }));
    db.prepare(`SELECT j.id, j.subject, j.decision_number, j.decision_date, je.name_fr AS court_name FROM jurisprudence j LEFT JOIN judicial_entities je ON je.id = j.court_id WHERE j.search_norm LIKE ? LIMIT 10`).all(norm)
      .forEach((r) => results.push({ type: 'jurisprudence', id: r.id, title: r.subject, sub: `${r.court_name || ''}${r.decision_number ? ' · ' + r.decision_number : ''}`, route: `/library/jurisprudence/${r.id}` }));
  }
  if (!type || type === 'courts') {
    db.prepare(`SELECT je.id, je.name_fr, je.name_ar, w.name_fr AS wilaya FROM judicial_entities je LEFT JOIN wilayas w ON w.id = je.wilaya_id WHERE je.is_active = 1 AND (je.name_fr LIKE ? OR je.name_ar LIKE ?) LIMIT 10`).all(like, like)
      .forEach((r) => results.push({ type: 'court', id: r.id, title: r.name_fr || r.name_ar, sub: r.wilaya || '', route: `/directory?court=${r.id}` }));
  }
  if (!type || type === 'tasks') {
    db.prepare(`SELECT t.id, t.title, t.due_date, t.status, k.reference FROM tasks t LEFT JOIN cases k ON k.id = t.case_id WHERE t.search_norm LIKE ? LIMIT 10`).all(norm)
      .forEach((r) => results.push({ type: 'task', id: r.id, title: r.title, sub: r.reference || r.status, route: `/tasks?focus=${r.id}` }));
  }
  if (!type || type === 'deadlines') {
    db.prepare(`SELECT d.id, d.title_fr, d.title_ar, d.end_date, d.status, k.reference FROM deadlines d LEFT JOIN cases k ON k.id = d.case_id
      WHERE d.title_fr LIKE ? OR d.title_ar LIKE ? OR k.search_norm LIKE ? LIMIT 10`).all(like, like, norm)
      .forEach((r) => results.push({ type: 'deadline', id: r.id, title: r.title_fr || r.title_ar, sub: r.reference || r.status, route: `/deadlines?focus=${r.id}` }));
  }
  if (!type || type === 'contacts') {
    db.prepare(`SELECT id, name_fr, name_ar, organization FROM contacts WHERE is_archived = 0 AND search_norm LIKE ? LIMIT 10`).all(norm)
      .forEach((r) => results.push({ type: 'contact', id: r.id, title: r.name_fr || r.name_ar, sub: r.organization || '', route: `/contacts?focus=${r.id}` }));
  }
  ok(res, { q, results });
});

module.exports = router;
