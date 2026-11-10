'use strict';

// Estructura macro: facultades → carreras → semestres → materias, y filtros por carrera.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-macro-'));
process.env.ADMIN_PASSWORD = 'clave-segura-123';
const app = require('../server.js');

let server;
let base;
before(() => new Promise((r) => (server = app.listen(0, '127.0.0.1', () => ((base = `http://127.0.0.1:${server.address().port}`), r())))));
after(() => {
  server.close();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

function client() {
  let cookie = '';
  return async (method, url, body) => {
    const headers = cookie ? { cookie } : {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* vacío */
    }
    return { status: res.status, data };
  };
}

const admin = client();
const ids = {};

test('crear facultades, carreras y semestres por carrera', async () => {
  await admin('POST', '/api/auth/login/admin', { username: 'admin', password: 'clave-segura-123' });
  ids.faces = (await admin('POST', '/api/admin/faculties', { name: 'Facultad de Ciencias Económicas', code: 'FACES' })).data.id;
  ids.ing = (await admin('POST', '/api/admin/faculties', { name: 'Facultad de Ingeniería', code: 'ING' })).data.id;
  ids.eco = (await admin('POST', '/api/admin/careers', { faculty_id: ids.faces, name: 'Economía', code: 'ECO' })).data.id;
  ids.inf = (await admin('POST', '/api/admin/careers', { faculty_id: ids.ing, name: 'Informática', code: 'INF' })).data.id;
  assert.equal((await admin('POST', '/api/admin/careers', { faculty_id: 9999, name: 'X' })).status, 400);

  // Con carreras creadas, el semestre debe indicar su carrera
  assert.equal((await admin('POST', '/api/admin/semesters', { name: 'Semestre I' })).status, 400);
  ids.ecoS1 = (await admin('POST', '/api/admin/semesters', { career_id: ids.eco, name: 'Semestre I' })).data.id;
  ids.infS1 = (await admin('POST', '/api/admin/semesters', { career_id: ids.inf, name: 'Semestre I' })).data.id;
  ids.micro = (await admin('POST', '/api/admin/subjects', { semester_id: ids.ecoS1, name: 'Microeconomía', code: 'ECO1' })).data.id;
  ids.prog = (await admin('POST', '/api/admin/subjects', { semester_id: ids.infS1, name: 'Programación I', code: 'INF1' })).data.id;
  await admin('POST', '/api/admin/events', { subject_id: ids.micro, title: 'Parcial de micro', type: 'parcial', date: '2099-03-10' });
  await admin('POST', '/api/admin/events', { subject_id: ids.prog, title: 'Parcial de programación', type: 'parcial', date: '2099-03-11' });
  await admin('POST', '/api/admin/events', { title: 'Receso universitario', type: 'otro', date: '2099-03-20' });

  const st = await admin('GET', '/api/structure');
  assert.equal(st.data.length, 2);
  const eco = st.data[0].careers[0];
  assert.equal(eco.name, 'Economía');
  assert.equal(eco.semester_count, 1);
  assert.equal(eco.subject_count, 1);
});

test('el estudiante ve su carrera por defecto y puede explorar otras', async () => {
  const add = await admin('POST', '/api/admin/students', { cedula: '11122233', email: 'eco@correo.com', name: 'Eva', career_id: ids.eco, semester_id: ids.ecoS1 });
  assert.equal(add.data.career_name, 'Economía');
  assert.equal(add.data.faculty_name, 'Facultad de Ciencias Económicas');
  const bad = await admin('POST', '/api/admin/students', { cedula: '99988877', email: 'x@correo.com', career_id: ids.eco, semester_id: ids.infS1 });
  assert.equal(bad.status, 400, 'el semestre debe ser de la misma carrera');

  const st = client();
  await st('POST', '/api/auth/login/student', { cedula: '11122233', email: 'eco@correo.com' });
  const me = await st('GET', '/api/auth/me');
  assert.equal(me.data.auth.user.career_name, 'Economía');

  const dash = await st('GET', '/api/dashboard?today=2099-01-01');
  assert.equal(dash.data.career.name, 'Economía');
  assert.deepEqual(dash.data.upcoming.map((e) => e.title), ['Parcial de micro', 'Receso universitario']);

  const infEvents = await st('GET', `/api/events?career_id=${ids.inf}&from=2099-01-01`);
  assert.deepEqual(infEvents.data.map((e) => e.title), ['Parcial de programación', 'Receso universitario']);
  const infSubjects = await st('GET', `/api/subjects?career_id=${ids.inf}`);
  assert.deepEqual(infSubjects.data.map((s) => s.name), ['Programación I']);
  const sems = await st('GET', `/api/semesters?career_id=${ids.eco}`);
  assert.equal(sems.data.length, 1);

  // Cambia de carrera en su perfil
  await st('PUT', '/api/me', { name: 'Eva', career_id: ids.inf, semester_id: ids.infS1 });
  assert.equal((await st('GET', '/api/auth/me')).data.auth.user.career_name, 'Informática');
  await st('PUT', '/api/me', { name: 'Eva', career_id: ids.eco, semester_id: ids.infS1 });
  const after2 = (await st('GET', '/api/auth/me')).data.auth.user;
  assert.equal(after2.career_name, 'Economía');
  assert.equal(after2.semester_id, null, 'un semestre de otra carrera no se guarda');

  assert.equal((await st('POST', '/api/admin/faculties', { name: 'Hack' })).status, 403);
});

test('no se eliminan facultades o carreras con contenido', async () => {
  assert.equal((await admin('DELETE', `/api/admin/faculties/${ids.faces}`)).status, 400);
  assert.equal((await admin('DELETE', `/api/admin/careers/${ids.eco}`)).status, 400);
  const empty = (await admin('POST', '/api/admin/careers', { faculty_id: ids.ing, name: 'Civil' })).data.id;
  assert.equal((await admin('DELETE', `/api/admin/careers/${empty}`)).status, 200);
  const list = await admin('GET', `/api/admin/students?career_id=${ids.eco}`);
  assert.equal(list.data.length, 1);
  const stats = await admin('GET', '/api/admin/stats');
  assert.equal(stats.data.faculties, 2);
  assert.equal(stats.data.careers, 2);
});
