'use strict';

// Facultades y carreras de la Universidad de Carabobo: migración de bases anteriores y carga manual.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-uc-'));
process.env.ADMIN_PASSWORD = 'clave-segura-123';

let server;
after(() => {
  if (server) server.close();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

const SRC = path.join(__dirname, '..', 'src') + path.sep;
const freshModules = () => {
  for (const k of Object.keys(require.cache)) if (k.startsWith(SRC) || k.endsWith(`${path.sep}server.js`)) delete require.cache[k];
};

test('una base de la versión anterior pasa a la estructura de la UC (FACES → Economía)', async () => {
  // 1) Base "vieja": semestre y estudiante sin carrera
  let db = require('../src/db');
  await db.ready();
  const sem = await db.run("INSERT INTO semesters (name, number, position) VALUES ('Semestre I', 1, 1)");
  await db.run("INSERT INTO students (cedula, email, name, semester_id) VALUES ('11111111', 'viejo@demo.com', 'Viejo', ?)", sem.lastInsertRowid);

  // 2) Nuevo arranque del servidor: corre la migración
  freshModules();
  db = require('../src/db');
  await db.ready();
  const { UC_TOTALS } = require('../src/uc');
  assert.deepEqual(UC_TOTALS, { faculties: 7, careers: 47 });
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM faculties')).n, 7);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM careers')).n, 47);

  const row = await db.get(
    `SELECT c.name AS career, f.code AS faculty, st.career_id = s.career_id AS same
       FROM semesters s JOIN careers c ON c.id = s.career_id JOIN faculties f ON f.id = c.faculty_id
       JOIN students st ON st.semester_id = s.id WHERE s.id = ?`,
    sem.lastInsertRowid
  );
  assert.deepEqual({ ...row }, { career: 'Economía', faculty: 'FACES', same: 1 });
});

test('cargar las facultades de la UC desde el panel no duplica nada', async () => {
  freshModules();
  const app = require('../server.js');
  const base = await new Promise((r) => (server = app.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}`))));
  const login = await fetch(base + '/api/auth/login/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'clave-segura-123' }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const res = await fetch(base + '/api/admin/structure/uc', { method: 'POST', headers: { cookie } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { faculties: 0, careers: 0 });

  const structure = await (await fetch(base + '/api/structure', { headers: { cookie } })).json();
  assert.equal(structure.length, 7);
  assert.equal(structure.reduce((n, f) => n + f.careers.length, 0), 47);
  assert.deepEqual(
    structure.find((f) => f.code === 'FACES').careers.map((c) => c.name),
    ['Economía', 'Administración Comercial', 'Contaduría Pública', 'Relaciones Industriales']
  );

  // Sin sesión de administrador no se puede
  assert.equal((await fetch(base + '/api/admin/structure/uc', { method: 'POST' })).status, 401);
});
