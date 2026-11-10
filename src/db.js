'use strict';

/**
 * Base de datos SQLite a través de libSQL:
 *  - En tu computadora: un archivo local (DATA_DIR/portal.db), sin configurar nada.
 *  - En Vercel: una base de datos Turso (variables TURSO_DATABASE_URL y TURSO_AUTH_TOKEN),
 *    porque Vercel no conserva archivos entre ejecuciones.
 *  - Modo demostración (vistas previas de Vercel o DEMO_MODE=1): una base temporal con
 *    datos de ejemplo, separada de la base real. Nunca toca Turso.
 */

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

/** Busca una variable por su nombre exacto o con prefijo (p. ej. "STORAGE_TURSO_DATABASE_URL"). */
function env(...names) {
  for (const n of names) if (process.env[n]) return process.env[n];
  for (const n of names) {
    const key = Object.keys(process.env).find((k) => k.endsWith('_' + n) && process.env[k]);
    if (key) return process.env[key];
  }
  return null;
}

const IS_VERCEL = !!process.env.VERCEL;
// Las vistas previas de Vercel (ramas distintas de main) usan datos de ejemplo, salvo que
// se pida explícitamente la base real con PREVIEW_USE_PRODUCTION_DB=1.
const IS_DEMO =
  process.env.DEMO_MODE === '1' || (process.env.VERCEL_ENV === 'preview' && process.env.PREVIEW_USE_PRODUCTION_DB !== '1');
const DATA_DIR = path.resolve(
  IS_DEMO && IS_VERCEL ? '/tmp/portal-demo' : process.env.DATA_DIR || path.join(__dirname, '..', 'data')
);
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

let remoteUrl = IS_DEMO ? null : env('TURSO_DATABASE_URL', 'LIBSQL_URL', 'TURSO_URL');
if (!IS_DEMO && !remoteUrl && /^(libsql|https?|wss?):\/\//.test(process.env.DATABASE_URL || '')) remoteUrl = process.env.DATABASE_URL;
const authToken = env('TURSO_AUTH_TOKEN', 'LIBSQL_AUTH_TOKEN', 'TURSO_TOKEN', 'DATABASE_AUTH_TOKEN');

const IS_REMOTE = !!remoteUrl;
let client = null;
let configError = null;

if (IS_REMOTE) {
  client = createClient({ url: remoteUrl, authToken: authToken || undefined });
} else if (IS_VERCEL && !IS_DEMO) {
  configError =
    'Falta conectar la base de datos. En Vercel → Settings → Environment Variables agrega TURSO_DATABASE_URL y TURSO_AUTH_TOKEN, y vuelve a desplegar.';
} else {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  client = createClient({ url: 'file:' + path.join(DATA_DIR, 'portal.db') });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT,
  password_hash TEXT NOT NULL,
  must_change   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faculties (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT,
  description TEXT,
  color       TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS careers (
  id          INTEGER PRIMARY KEY,
  faculty_id  INTEGER NOT NULL REFERENCES faculties(id),
  name        TEXT NOT NULL,
  code        TEXT,
  description TEXT,
  color       TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS semesters (
  id          INTEGER PRIMARY KEY,
  career_id   INTEGER REFERENCES careers(id),
  name        TEXT NOT NULL,
  number      INTEGER,
  period      TEXT,
  description TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id          INTEGER PRIMARY KEY,
  cedula      TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL COLLATE NOCASE,
  name        TEXT,
  career_id   INTEGER REFERENCES careers(id),
  semester_id INTEGER REFERENCES semesters(id) ON DELETE SET NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  last_login  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subjects (
  id              INTEGER PRIMARY KEY,
  semester_id     INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT,
  professor       TEXT,
  professor_email TEXT,
  professor_phone TEXT,
  schedule        TEXT,
  classroom       TEXT,
  credits         INTEGER,
  description     TEXT,
  color           TEXT,
  position        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS classes (
  id         INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  date       TEXT,
  content    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS materials (
  id            INTEGER PRIMARY KEY,
  subject_id    INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id      INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  kind          TEXT NOT NULL CHECK (kind IN ('file', 'link')),
  url           TEXT,
  file_name     TEXT,
  original_name TEXT,
  mime          TEXT,
  size          INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY,
  subject_id  INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'examen',
  date        TEXT NOT NULL,
  start_time  TEXT,
  end_time    TEXT,
  location    TEXT,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  user_id    INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester_id);
CREATE INDEX IF NOT EXISTS idx_classes_subject   ON classes(subject_id);
CREATE INDEX IF NOT EXISTS idx_materials_subject ON materials(subject_id);
CREATE INDEX IF NOT EXISTS idx_materials_class   ON materials(class_id);
CREATE INDEX IF NOT EXISTS idx_events_date       ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_subject    ON events(subject_id);
CREATE INDEX IF NOT EXISTS idx_students_email    ON students(email);
CREATE INDEX IF NOT EXISTS idx_sessions_expires  ON sessions(expires_at);
`;

/* ---------- helpers ---------- */

function clean(params) {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

function toObjects(rs) {
  return rs.rows.map((row) => {
    const o = {};
    rs.columns.forEach((c, i) => {
      o[c] = typeof row[i] === 'bigint' ? Number(row[i]) : row[i];
    });
    return o;
  });
}

function db() {
  if (!client) throw Object.assign(new Error(configError), { status: 503 });
  return client;
}

async function all(sql, ...params) {
  return toObjects(await db().execute({ sql, args: clean(params) }));
}

async function get(sql, ...params) {
  return (await all(sql, ...params))[0];
}

async function run(sql, ...params) {
  const rs = await db().execute({ sql, args: clean(params) });
  return { lastInsertRowid: rs.lastInsertRowid === undefined ? null : Number(rs.lastInsertRowid), changes: rs.rowsAffected };
}

/** Ejecuta varias sentencias en una sola transacción: q(sql, ...params). */
async function batch(statements) {
  if (!statements.length) return [];
  const results = await db().batch(
    statements.map(([sql, ...params]) => ({ sql, args: clean(params) })),
    'write'
  );
  return results.map((rs) => ({
    lastInsertRowid: rs.lastInsertRowid === undefined ? null : Number(rs.lastInsertRowid),
    changes: rs.rowsAffected,
    rows: toObjects(rs),
  }));
}

/* ---------- ajustes ---------- */

const DEFAULT_SETTINGS = {
  site_name: 'Economía 02',
  site_tagline: 'Portal académico',
  university: 'Universidad',
  period: '2026-II',
  allow_self_register: '0',
  welcome_message: 'Aquí encontrarás tus materias, materiales de apoyo y las fechas de evaluación.',
};

async function getSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const row of await all("SELECT key, value FROM settings WHERE key <> 'file_secret'")) out[row.key] = row.value;
  return out;
}

const setSettingSql = (key, value) => [
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  key,
  value,
];

/* ---------- migraciones (bases creadas con versiones anteriores) ---------- */

async function addColumnIfMissing(table, column, type) {
  const cols = await all(`SELECT name FROM pragma_table_info('${table}')`);
  if (cols.some((c) => c.name === column)) return;
  try {
    await db().execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (err) {
    // Otra instancia pudo agregarla al mismo tiempo.
    if (!/duplicate column/i.test(err.message)) throw err;
  }
}

async function migrate() {
  await addColumnIfMissing('subjects', 'professor_phone', 'TEXT');
  await addColumnIfMissing('semesters', 'career_id', 'INTEGER');
  await addColumnIfMissing('students', 'career_id', 'INTEGER');
  await db().executeMultiple(`
    CREATE INDEX IF NOT EXISTS idx_careers_faculty  ON careers(faculty_id);
    CREATE INDEX IF NOT EXISTS idx_semesters_career ON semesters(career_id);
    CREATE INDEX IF NOT EXISTS idx_students_career  ON students(career_id);
  `);

  // Bases de la versión anterior (sin facultades): se cargan las facultades y carreras de la
  // Universidad de Carabobo y los semestres existentes pasan a FACES → Economía.
  if ((await get('SELECT COUNT(*) AS n FROM semesters WHERE career_id IS NULL')).n > 0) {
    let career = null;
    try {
      const { economiaId } = await require('./uc').loadUcStructure();
      if (economiaId) career = { id: economiaId };
    } catch (err) {
      console.error('No se pudo cargar la estructura de la UC:', err.message);
    }
    if (!career) career = await get('SELECT id FROM careers ORDER BY position, id LIMIT 1');
    if (!career) {
      let faculty = await get('SELECT id FROM faculties ORDER BY position, id LIMIT 1');
      if (!faculty) faculty = { id: (await run("INSERT INTO faculties (name, position) VALUES ('Facultad principal', 1)")).lastInsertRowid };
      career = { id: (await run("INSERT INTO careers (faculty_id, name, position) VALUES (?, 'Carrera principal', 1)", faculty.id)).lastInsertRowid };
    }
    await batch([
      ['UPDATE semesters SET career_id = ? WHERE career_id IS NULL', career.id],
      ['UPDATE students SET career_id = (SELECT career_id FROM semesters WHERE semesters.id = students.semester_id) WHERE career_id IS NULL AND semester_id IS NOT NULL'],
      ['UPDATE students SET career_id = ? WHERE career_id IS NULL', career.id],
    ]);
  }
}

/* ---------- inicialización (una vez por proceso) ---------- */

let readyPromise = null;

async function init() {
  const c = db();
  if (!IS_REMOTE) {
    await c.execute('PRAGMA journal_mode = WAL');
    await c.execute('PRAGMA busy_timeout = 5000');
  }
  await c.executeMultiple(SCHEMA);
  await migrate();
  await batch(Object.entries(DEFAULT_SETTINGS).map(([k, v]) => ['INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', k, v]));

  const auth = require('./auth');
  if (IS_DEMO) {
    await require('./demo').prepareDemo();
  } else if (!(await get('SELECT id FROM admins LIMIT 1'))) {
    const username = process.env.ADMIN_USER || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    await run(
      'INSERT OR IGNORE INTO admins (username, name, password_hash, must_change) VALUES (?, ?, ?, ?)',
      username,
      'Administrador',
      auth.hashPassword(password),
      process.env.ADMIN_PASSWORD ? 0 : 1
    );
    console.log(`Administrador creado → usuario: "${username}"` + (process.env.ADMIN_PASSWORD ? '' : `, contraseña: "${password}" (cámbiala al entrar)`));
  }
  await run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
}

function ready() {
  if (!readyPromise) {
    readyPromise = init().catch((err) => {
      readyPromise = null; // se reintenta en la próxima petición
      throw err;
    });
  }
  return readyPromise;
}

module.exports = {
  env,
  IS_VERCEL,
  IS_REMOTE,
  IS_DEMO,
  DATA_DIR,
  UPLOAD_DIR,
  all,
  get,
  run,
  batch,
  ready,
  getSettings,
  setSettingSql,
  DEFAULT_SETTINGS,
  configError: () => configError,
};
