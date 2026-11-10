'use strict';

const crypto = require('node:crypto');
const { get, run, IS_DEMO } = require('./db');
const { HttpError } = require('./util');

const COOKIE = 'portal_sid';
const STUDENT_TTL = 30 * 24 * 3600; // 30 días
const ADMIN_TTL = 7 * 24 * 3600; // 7 días

/* ---------- contraseñas (scrypt) ---------- */

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

/* ---------- sesiones ---------- */

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

function writeCookie(req, res, value, maxAge) {
  const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (req.secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

/*
 * En modo demostración cada copia del servidor tiene su propia base temporal, así que la
 * sesión no se guarda en la base: va firmada dentro de la cookie (rol, usuario, vencimiento).
 */
const DEMO_SECRET = IS_DEMO
  ? sha256(
      ['portal-demo', process.env.SESSION_SECRET, process.env.VERCEL_DEPLOYMENT_ID, process.env.VERCEL_PROJECT_ID, process.env.TURSO_AUTH_TOKEN, process.env.BLOB_READ_WRITE_TOKEN]
        .filter(Boolean)
        .join('|') + (process.env.VERCEL ? '' : crypto.randomBytes(16).toString('hex'))
    )
  : null;
const demoSign = (payload) => crypto.createHmac('sha256', DEMO_SECRET).update(payload).digest('base64url');

function readDemoToken(token) {
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(demoSign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.e > Date.now() ? { role: data.r, userId: data.u } : null;
  } catch {
    return null;
  }
}

async function createSession(req, res, role, userId) {
  const ttl = role === 'admin' ? ADMIN_TTL : STUDENT_TTL;
  if (IS_DEMO) {
    const payload = Buffer.from(JSON.stringify({ r: role, u: userId, e: Date.now() + ttl * 1000 })).toString('base64url');
    return writeCookie(req, res, `${payload}.${demoSign(payload)}`, ttl);
  }
  const token = crypto.randomBytes(32).toString('base64url');
  await run(
    'INSERT INTO sessions (token_hash, role, user_id, expires_at) VALUES (?, ?, ?, ?)',
    sha256(token),
    role,
    userId,
    Date.now() + ttl * 1000
  );
  writeCookie(req, res, token, ttl);
}

async function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token && !IS_DEMO) await run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  writeCookie(req, res, '', 0);
}

const ADMIN_COLS = 'a.id AS admin_id, a.username, a.name AS admin_name, a.must_change';
const STUDENT_COLS = `st.id AS student_id, st.cedula, st.email, st.name AS student_name, st.semester_id, st.career_id, st.active,
       sem.name AS semester_name, car.name AS career_name, car.faculty_id, fac.name AS faculty_name`;
const STUDENT_JOINS = `LEFT JOIN semesters sem ON sem.id = st.semester_id
       LEFT JOIN careers car   ON car.id = st.career_id
       LEFT JOIN faculties fac ON fac.id = car.faculty_id`;

function authFromRow(s) {
  if (!s) return null;
  if (s.role === 'admin' && s.admin_id) {
    return { role: 'admin', user: { id: s.admin_id, username: s.username, name: s.admin_name, must_change: s.must_change } };
  }
  if (s.role === 'student' && s.student_id && s.active) {
    return {
      role: 'student',
      user: {
        id: s.student_id,
        cedula: s.cedula,
        email: s.email,
        name: s.student_name,
        active: s.active,
        semester_id: s.semester_id,
        semester_name: s.semester_name,
        career_id: s.career_id,
        career_name: s.career_name,
        faculty_id: s.faculty_id,
        faculty_name: s.faculty_name,
      },
    };
  }
  return null;
}

/** Carga la sesión (si existe) en req.auth = { role, user } con una sola consulta. */
async function loadSession(req, res, next) {
  req.auth = null;
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return next();

  if (IS_DEMO) {
    const t = readDemoToken(token);
    if (t) {
      const row =
        t.role === 'admin'
          ? await get(`SELECT 'admin' AS role, ${ADMIN_COLS} FROM admins a WHERE a.id = ?`, t.userId)
          : await get(`SELECT 'student' AS role, ${STUDENT_COLS} FROM students st ${STUDENT_JOINS} WHERE st.id = ?`, t.userId);
      req.auth = authFromRow(row);
    }
    return next();
  }

  const s = await get(
    `SELECT s.role, s.expires_at, ${ADMIN_COLS}, ${STUDENT_COLS}
       FROM sessions s
       LEFT JOIN admins a    ON s.role = 'admin'   AND a.id = s.user_id
       LEFT JOIN students st ON s.role = 'student' AND st.id = s.user_id
       ${STUDENT_JOINS}
      WHERE s.token_hash = ?`,
    sha256(token)
  );
  if (s && s.expires_at >= Date.now()) req.auth = authFromRow(s);
  next();
}

function requireAuth(req, res, next) {
  if (!req.auth) return next(new HttpError(401, 'Debes iniciar sesión'));
  next();
}

function requireAdmin(req, res, next) {
  if (!req.auth) return next(new HttpError(401, 'Debes iniciar sesión'));
  if (req.auth.role !== 'admin') return next(new HttpError(403, 'Solo el administrador puede hacer esto'));
  next();
}

/* ---------- límite de intentos de inicio de sesión ---------- */

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;

function loginKey(req, identifier) {
  return `${req.ip}|${String(identifier || '').toLowerCase()}`;
}

function checkRateLimit(req, identifier) {
  const key = loginKey(req, identifier);
  const entry = attempts.get(key);
  if (entry && entry.reset > Date.now() && entry.count >= MAX_FAILS) {
    const mins = Math.ceil((entry.reset - Date.now()) / 60000);
    throw new HttpError(429, `Demasiados intentos fallidos. Intenta de nuevo en ${mins} min.`);
  }
}

function registerFailure(req, identifier) {
  const key = loginKey(req, identifier);
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.reset < now) attempts.set(key, { count: 1, reset: now + WINDOW_MS });
  else entry.count += 1;
}

function clearFailures(req, identifier) {
  attempts.delete(loginKey(req, identifier));
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
}, 30 * 60 * 1000).unref();

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  loadSession,
  requireAuth,
  requireAdmin,
  checkRateLimit,
  registerFailure,
  clearFailures,
};
