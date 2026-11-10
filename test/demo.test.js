'use strict';

// Modo demostración: datos de ejemplo propios, accesos de prueba y sesiones firmadas.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-demo-test-'));
process.env.DEMO_MODE = '1';
process.env.TURSO_DATABASE_URL = 'libsql://no-debe-usarse.turso.io';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_NoDebeUsarse_xxxxxxxxxxxxxxxxxxxxxxxxxx';
const app = require('../server.js');

let server;
let base;
before(() => new Promise((r) => (server = app.listen(0, '127.0.0.1', () => ((base = `http://127.0.0.1:${server.address().port}`), r())))));
after(() => {
  server.close();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

const get = async (url, cookie) => {
  const res = await fetch(base + url, { headers: cookie ? { cookie } : {} });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const login = async (url, body) => {
  const res = await fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
};

test('no usa Turso ni el Blob real, y carga los datos de ejemplo', async () => {
  const h = await get('/api/health');
  assert.equal(h.data.ok, true);
  assert.equal(h.data.demo, true);
  assert.match(h.data.base_de_datos, /demostración/);
  assert.equal(h.data.archivos, 'disco local');

  const s = await get('/api/auth/settings');
  assert.equal(s.data.site_name, 'Universidad Demo');
  assert.equal(s.data.demo.admin.username, 'demo');
  assert.equal(s.data.demo.students[0].career, 'Economía');
});

test('accesos de prueba con sesión firmada', async () => {
  const ad = await login('/api/auth/login/admin', { username: 'demo', password: 'demo1234' });
  assert.equal(ad.status, 200);
  assert.match(ad.cookie, /^portal_sid=[\w-]+\.[\w-]+$/);
  const st = await get('/api/structure', ad.cookie);
  assert.equal(st.data.length, 3);
  assert.equal(st.data.reduce((n, f) => n + f.careers.length, 0), 7);

  const stu = await login('/api/auth/login/student', { cedula: '12345678', email: 'estudiante@demo.com' });
  const me = await get('/api/auth/me', stu.cookie);
  assert.equal(me.data.auth.user.career_name, 'Economía');
  const subjects = await get('/api/subjects?semester_id=' + me.data.auth.user.semester_id, stu.cookie);
  assert.deepEqual(subjects.data.map((x) => x.code).sort(), ['CB1101', 'CB1102', 'CB1103', 'CB1104']);
  const classes = await get('/api/events?career_id=' + me.data.auth.user.career_id, stu.cookie);
  assert.ok(classes.data.some((e) => e.type === 'clase' && e.title === 'Introducción a la Matemática (CB1103)'));

  // Una cookie alterada no da acceso
  const forged = ad.cookie.replace(/\.[\w-]+$/, '.AAAA');
  assert.equal((await get('/api/admin/stats', forged)).status, 401);
});
