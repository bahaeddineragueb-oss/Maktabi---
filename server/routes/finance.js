/** Finance: invoices, payments, expenses, accounting summary. */
const express = require('express');
const dayjs = require('dayjs');
const { db, now } = require('../db');
const { authenticate, requirePerm, audit } = require('../middleware/auth');
const { ok, fail, paginate, normalizeForSearch } = require('./helpers');

const router = express.Router();
router.use(authenticate);

const INVOICE_SELECT = `
  SELECT i.*, c.full_name_fr AS client_name_fr, c.full_name_ar AS client_name_ar,
    c.legal_name AS client_legal_name, c.commercial_name AS client_commercial, c.address AS client_address, c.phone AS client_phone,
    k.reference AS case_reference, k.title_fr AS case_title_fr, u.full_name_fr AS creator_name_fr
  FROM invoices i
  LEFT JOIN clients c ON c.id = i.client_id
  LEFT JOIN cases k ON k.id = i.case_id
  LEFT JOIN users u ON u.id = i.created_by`;

router.get('/invoices', requirePerm('finance.view'), (req, res) => {
  const { page, limit, offset } = paginate(req);
  const conds = ['1=1'];
  const params = [];
  if (req.query.status) { conds.push('i.status = ?'); params.push(req.query.status); }
  if (req.query.client_id) { conds.push('i.client_id = ?'); params.push(req.query.client_id); }
  if (req.query.case_id) { conds.push('i.case_id = ?'); params.push(req.query.case_id); }
  if (req.query.q) { conds.push('i.search_norm LIKE ?'); params.push(`%${normalizeForSearch(req.query.q)}%`); }
  const where = `WHERE ${conds.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM invoices i ${where}`).get(...params).c;
  const rows = db.prepare(`${INVOICE_SELECT} ${where} ORDER BY i.issue_date DESC, i.id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  ok(res, { rows, total, page, limit });
});

router.get('/invoices/:id', requirePerm('finance.view'), (req, res) => {
  const row = db.prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(req.params.id);
  if (!row) return fail(res, 404, 'not_found');
  row.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort, id').all(req.params.id);
  row.payments = db.prepare('SELECT p.*, u.full_name_fr AS creator_name_fr FROM payments p LEFT JOIN users u ON u.id = p.created_by WHERE p.invoice_id = ? ORDER BY p.date').all(req.params.id);
  ok(res, row);
});

router.post('/invoices', requirePerm('finance.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.client_id) return fail(res, 400, 'missing_client');
  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) c FROM invoices').get().c;
  const number = b.number || `INV-${year}-${String(count + 1).padStart(3, '0')}`;
  const items = Array.isArray(b.items) ? b.items : [];
  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0);
  const taxRate = b.tax_rate !== undefined ? Number(b.tax_rate) : 19;
  const tax = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + tax;
  const tx = db.transaction(() => {
    const r = db.prepare(`INSERT INTO invoices (number, client_id, case_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total, paid_amount, currency, notes, search_norm, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?, ?,0,?,?,?,?,?,?)`).run(
      number, b.client_id, b.case_id ?? null, b.issue_date || dayjs().format('YYYY-MM-DD'),
      b.due_date ?? null, b.status || 'draft', subtotal, taxRate, tax, total,
      b.currency || 'DZD', b.notes ?? null, normalizeForSearch([number, b.notes].join(' ')), req.user.id, now(), now()
    );
    const q = db.prepare('INSERT INTO invoice_items (invoice_id, description, description_ar, quantity, unit_price, total, sort) VALUES (?,?,?,?,?,?,?)');
    items.forEach((it, idx) => q.run(r.lastInsertRowid, it.description ?? '', it.description_ar ?? null, Number(it.quantity) || 1, Number(it.unit_price) || 0, (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), idx + 1));
    return r.lastInsertRowid;
  });
  const id = tx();
  audit(req, 'create', 'invoice', id, { number });
  ok(res, { id, number });
});

router.put('/invoices/:id', requirePerm('finance.edit'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  let subtotal = ex.subtotal, taxRate = ex.tax_rate, tax = ex.tax_amount, total = ex.total;
  if (Array.isArray(b.items)) {
    subtotal = b.items.reduce((s, it) => s + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0);
    taxRate = b.tax_rate !== undefined ? Number(b.tax_rate) : ex.tax_rate;
    tax = Math.round(subtotal * taxRate) / 100;
    total = subtotal + tax;
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
    const q = db.prepare('INSERT INTO invoice_items (invoice_id, description, description_ar, quantity, unit_price, total, sort) VALUES (?,?,?,?,?,?,?)');
    b.items.forEach((it, idx) => q.run(req.params.id, it.description ?? '', it.description_ar ?? null, Number(it.quantity) || 1, Number(it.unit_price) || 0, (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), idx + 1));
  }
  db.prepare(`UPDATE invoices SET number=?, client_id=?, case_id=?, issue_date=?, due_date=?, status=?, subtotal=?, tax_rate=?, tax_amount=?,
    total=?, notes=?, search_norm=?, updated_at=? WHERE id=?`).run(
    b.number ?? ex.number, b.client_id ?? ex.client_id, b.case_id ?? ex.case_id,
    b.issue_date ?? ex.issue_date, b.due_date ?? ex.due_date, b.status ?? ex.status,
    subtotal, taxRate, tax, total, b.notes ?? ex.notes,
    normalizeForSearch([b.number ?? ex.number, b.notes ?? ex.notes].join(' ')), now(), req.params.id
  );
  audit(req, 'update', 'invoice', req.params.id);
  ok(res, { updated: true });
});

router.post('/invoices/:id/payments', requirePerm('finance.edit'), (req, res) => {
  const b = req.body || {};
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return fail(res, 404, 'not_found');
  if (!b.amount || Number(b.amount) <= 0) return fail(res, 400, 'invalid_amount');
  db.prepare('INSERT INTO payments (invoice_id, amount, date, method, reference, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.params.id, Number(b.amount), b.date || dayjs().format('YYYY-MM-DD'), b.method || 'cash', b.reference ?? null, b.notes ?? null, req.user.id, now());
  const paid = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE invoice_id = ?').get(req.params.id).s;
  const status = paid >= inv.total ? 'paid' : paid > 0 ? 'partial' : inv.status;
  db.prepare('UPDATE invoices SET paid_amount = ?, status = ?, updated_at = ? WHERE id = ?').run(paid, status, now(), req.params.id);
  audit(req, 'payment', 'invoice', req.params.id, { amount: b.amount });
  ok(res, { paid, status });
});

router.delete('/invoices/:id', requirePerm('finance.edit'), (req, res) => {
  const inv = db.prepare('SELECT status FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return fail(res, 404, 'not_found');
  if (inv.status === 'paid') return fail(res, 409, 'paid_invoice_cannot_delete');
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'invoice', req.params.id);
  ok(res, { deleted: true });
});

// ---------------- expenses
router.get('/expenses', requirePerm('finance.view'), (req, res) => {
  const { page, limit, offset } = paginate(req);
  const conds = ['1=1'];
  const params = [];
  if (req.query.case_id) { conds.push('e.case_id = ?'); params.push(req.query.case_id); }
  if (req.query.category) { conds.push('e.category = ?'); params.push(req.query.category); }
  if (req.query.from) { conds.push('e.date >= ?'); params.push(req.query.from); }
  if (req.query.to) { conds.push('e.date <= ?'); params.push(req.query.to); }
  if (req.query.q) { conds.push('e.search_norm LIKE ?'); params.push(`%${normalizeForSearch(req.query.q)}%`); }
  const where = `WHERE ${conds.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c FROM expenses e ${where}`).get(...params).c;
  const rows = db.prepare(`SELECT e.*, k.reference AS case_reference, k.title_fr AS case_title_fr, u.full_name_fr AS user_name_fr
    FROM expenses e LEFT JOIN cases k ON k.id = e.case_id LEFT JOIN users u ON u.id = e.user_id
    ${where} ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  ok(res, { rows, total, page, limit });
});

router.post('/expenses', requirePerm('finance.edit'), (req, res) => {
  const b = req.body || {};
  if (!b.amount) return fail(res, 400, 'missing_amount');
  const r = db.prepare(`INSERT INTO expenses (case_id, client_id, category, description, amount, date, user_id, receipt_document_id, reimbursable, billed, search_norm, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.case_id ?? null, b.client_id ?? null, b.category || 'other', b.description ?? null,
    Number(b.amount), b.date || dayjs().format('YYYY-MM-DD'), b.user_id ?? req.user.id,
    b.receipt_document_id ?? null, b.reimbursable ? 1 : 0, b.billed ? 1 : 0,
    normalizeForSearch([b.description, b.category].join(' ')), req.user.id, now(), now()
  );
  audit(req, 'create', 'expense', r.lastInsertRowid);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/expenses/:id', requirePerm('finance.edit'), (req, res) => {
  const b = req.body || {};
  const ex = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!ex) return fail(res, 404, 'not_found');
  const m = { ...ex, ...b };
  db.prepare(`UPDATE expenses SET case_id=?, category=?, description=?, amount=?, date=?, reimbursable=?, billed=?, search_norm=?, updated_at=? WHERE id=?`).run(
    m.case_id, m.category, m.description, Number(m.amount), m.date, m.reimbursable, m.billed,
    normalizeForSearch([m.description, m.category].join(' ')), now(), req.params.id
  );
  audit(req, 'update', 'expense', req.params.id);
  ok(res, { updated: true });
});

router.delete('/expenses/:id', requirePerm('finance.edit'), (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  audit(req, 'delete', 'expense', req.params.id);
  ok(res, { deleted: true });
});

// ---------------- accounting summary
router.get('/summary', requirePerm('finance.view'), (req, res) => {
  const today = dayjs().format('YYYY-MM-DD');
  const totals = {
    invoiced: db.prepare("SELECT COALESCE(SUM(total),0) s FROM invoices WHERE status != 'cancelled'").get().s,
    paid: db.prepare("SELECT COALESCE(SUM(paid_amount),0) s FROM invoices WHERE status != 'cancelled'").get().s,
    outstanding: db.prepare("SELECT COALESCE(SUM(total - paid_amount),0) s FROM invoices WHERE status != 'cancelled' AND total > paid_amount").get().s,
    overdue: db.prepare("SELECT COUNT(*) c, COALESCE(SUM(total - paid_amount),0) s FROM invoices WHERE status NOT IN ('cancelled','draft') AND due_date < ? AND total > paid_amount").get(today),
    expenses: db.prepare('SELECT COALESCE(SUM(amount),0) s FROM expenses').get().s,
    draft: db.prepare("SELECT COUNT(*) c FROM invoices WHERE status = 'draft'").get().c
  };
  const byMonth = db.prepare(`
    SELECT substr(issue_date,1,7) AS month, SUM(total) AS invoiced, SUM(paid_amount) AS paid
    FROM invoices WHERE status != 'cancelled' AND issue_date >= date('now','-11 months','start of month')
    GROUP BY month ORDER BY month`).all();
  const expensesByMonth = db.prepare(`
    SELECT substr(date,1,7) AS month, SUM(amount) AS total FROM expenses
    WHERE date >= date('now','-11 months','start of month') GROUP BY month ORDER BY month`).all();
  const byCategory = db.prepare('SELECT category, SUM(amount) AS total FROM expenses GROUP BY category ORDER BY total DESC').all();
  const unpaidList = db.prepare(`${INVOICE_SELECT} WHERE i.total > i.paid_amount AND i.status NOT IN ('cancelled','draft') ORDER BY i.due_date LIMIT 20`).all();
  ok(res, { totals, byMonth, expensesByMonth, byCategory, unpaidList, currency: 'DZD' });
});

module.exports = router;
