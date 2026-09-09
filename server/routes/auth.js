/** Auth routes: login, session info, password change. */
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { db, now } = require('../db');
const { authenticate, signToken, audit } = require('../middleware/auth');
const { ok, fail } = require('./helpers');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return fail(res, 400, 'missing_credentials');
  const user = db.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1').get(String(username).trim(), String(username).trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return fail(res, 401, 'invalid_credentials');
  }
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now(), user.id);
  const { effectivePermissions } = require('../middleware/auth');
  const perms = effectivePermissions(user);
  audit({ user, ip: req.ip }, 'login', 'user', user.id, { username: user.username });
  ok(res, {
    token: signToken(user),
    user: {
      id: user.id, username: user.username, email: user.email,
      full_name_ar: user.full_name_ar, full_name_fr: user.full_name_fr,
      role: user.role, permissions: perms
    }
  });
});

router.get('/me', authenticate, (req, res) => {
  const u = req.user;
  ok(res, {
    id: u.id, username: u.username, email: u.email,
    full_name_ar: u.full_name_ar, full_name_fr: u.full_name_fr,
    role: u.role, phone: u.phone, specializations: u.specializations,
    languages: u.languages, permissions: u.permissions
  });
});

router.post('/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password || new_password.length < 8) return fail(res, 400, 'invalid_password');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) return fail(res, 401, 'invalid_credentials');
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), now(), user.id);
  audit(req, 'change_password', 'user', user.id);
  ok(res, { changed: true });
});

module.exports = router;
