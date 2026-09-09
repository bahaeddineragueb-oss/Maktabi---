/**
 * Authentication & authorization middleware.
 * JWT-based sessions + granular RBAC (role defaults, per-user overrides) + audit logging.
 */
const jwt = require('jsonwebtoken');
const { db, now } = require('../db');
const { ROLE_DEFAULTS } = require('../permissions');

const JWT_SECRET = process.env.ADV_JWT_SECRET || 'advocate-pro-algerie-dev-secret-change-in-production';
const JWT_EXPIRES = process.env.ADV_JWT_EXPIRES || '12h';

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function effectivePermissions(user) {
  const set = new Set(ROLE_DEFAULTS[user.role] || []);
  const overrides = db.prepare('SELECT permission, allowed FROM user_permissions WHERE user_id = ?').all(user.id);
  for (const o of overrides) {
    if (o.allowed) set.add(o.permission);
    else set.delete(o.permission);
  }
  return [...set];
}

function authenticate(req, res, next) {
  let token = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
  if (!token && req.query && req.query.token) token = String(req.query.token);
  if (!token) return res.status(401).json({ error: 'authentication_required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'user_inactive_or_missing' });
    user.permissions = effectivePermissions(user);
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_or_expired_token' });
  }
}

function requirePerm(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'authentication_required' });
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'permission_denied', permission });
    }
    next();
  };
}

function audit(req, action, entity, entityId, details) {
  try {
    db.prepare(
      'INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, details, ip, created_at) VALUES (?,?,?,?,?,?,?,?)'
    ).run(
      req.user ? req.user.id : null,
      req.user ? (req.user.full_name_fr || req.user.username) : 'system',
      action,
      entity,
      entityId || null,
      details ? JSON.stringify(details).slice(0, 4000) : null,
      req.ip || null,
      now()
    );
  } catch (e) {
    console.error('audit error', e.message);
  }
}

module.exports = { authenticate, requirePerm, audit, signToken, effectivePermissions, JWT_SECRET };
