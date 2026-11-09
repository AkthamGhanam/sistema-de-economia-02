'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-test-'));
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'clave-segura-123';
const app = require('../server.js');

let server;
let base;

before(
  () =>
    new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        base = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    })
);

after(() => {
  server.close();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

/** Cliente HTTP con su propia cookie de sesión. */
function client() {
  let cookie = '';
  const fn = async (method, url, body, { form } = {}) => {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const buf = Buffer.from(await res.arrayBuffer());
    let data;
    try {
      data = JSON.parse(buf.toString('utf8'));
    } catch {
      data = buf;
    }
    return { status: res.status, data, headers: res.headers };
  };
  fn.cookie = () => cookie;
  return fn;
}

const admin = client();
const student = client();
const studentCookie = async () => student.cookie();
const ids = {};

test('sin sesión no se puede ver el contenido', async () => {
  const anon = client();
  assert.equal((await anon('GET', '/api/subjects')).status, 401);
  assert.equal((await anon('GET', '/app')).status, 302);
  assert.equal((await anon('GET', '/admin')).status, 302);
  assert.equal((await anon('GET', '/')).status, 200);
});

test('estado del sistema en modo local', async () => {
  const h = await client()('GET', '/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.data.ok, true);
  assert.equal(h.data.base_de_datos, 'archivo local');
  assert.equal(h.data.archivos, 'disco local');
});

test('login de administrador', async () => {
  const bad = await admin('POST', '/api/auth/login/admin', { username: 'admin', password: 'incorrecta' });
  assert.equal(bad.status, 401);
  const ok = await admin('POST', '/api/auth/login/admin', { username: 'admin', password: 'clave-segura-123' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.redirect, '/admin');
  const me = await admin('GET', '/api/auth/me');
  assert.equal(me.data.auth.role, 'admin');
  assert.equal((await admin('GET', '/admin')).status, 200);
});

test('el admin crea semestre, materia, clase y evaluación', async () => {
  const sem = await admin('POST', '/api/admin/semesters', { name: 'Semestre III', number: 3, period: '2026-II' });
  assert.equal(sem.status, 201);
  ids.semester = sem.data.id;

  const sub = await admin('POST', '/api/admin/subjects', {
    semester_id: ids.semester,
    name: 'Microeconomía I',
    code: 'ECO-301',
    professor: 'Prof. Ana Rodríguez',
    professor_phone: '+58 414-123 4567',
    schedule: 'Lun y Mié 8:00',
    color: '#ec4899',
    credits: '4',
    description: 'Programa: https://uni.edu/programa',
  });
  assert.equal(sub.status, 201);
  ids.subject = sub.data.id;
  assert.equal(sub.data.credits, 4);
  assert.equal(sub.data.professor_phone, '+58 414-123 4567');

  const badPhone = await admin('POST', '/api/admin/subjects', { semester_id: ids.semester, name: 'X', professor_phone: 'llamar a Ana' });
  assert.equal(badPhone.status, 400);

  const cls = await admin('POST', '/api/admin/classes', { subject_id: ids.subject, title: 'Oferta y demanda', date: '2026-11-02', content: 'Tema 1' });
  assert.equal(cls.status, 201);
  ids.class = cls.data.id;

  const badEv = await admin('POST', '/api/admin/events', { title: 'X', date: '2026-11-10', start_time: '10:00', end_time: '09:00' });
  assert.equal(badEv.status, 400);
  const badDate = await admin('POST', '/api/admin/events', { title: 'X', date: '2026-02-30' });
  assert.equal(badDate.status, 400);

  const ev = await admin('POST', '/api/admin/events', {
    subject_id: ids.subject,
    title: 'Primer parcial',
    type: 'parcial',
    date: '2099-11-10',
    start_time: '08:00',
    end_time: '10:00',
    location: 'Aula 12',
  });
  assert.equal(ev.status, 201);
  ids.event = ev.data.id;
});

test('el admin sube archivos (con tildes) y enlaces', async () => {
  const form = new FormData();
  form.append('subject_id', String(ids.subject));
  form.append('class_id', String(ids.class));
  form.append('kind', 'file');
  form.append('files', new Blob(['%PDF-1.4 contenido de prueba'], { type: 'application/pdf' }), 'Guía de ejercicios ñ.pdf');
  const up = await admin('POST', '/api/admin/materials', undefined, { form });
  assert.equal(up.status, 201, JSON.stringify(up.data));
  assert.equal(up.data[0].original_name, 'Guía de ejercicios ñ.pdf');
  assert.equal(up.data[0].title, 'Guía de ejercicios ñ');
  assert.equal(up.data[0].class_title, 'Oferta y demanda');
  ids.material = up.data[0].id;

  const badLink = await admin('POST', '/api/admin/materials', undefined, {
    form: (() => {
      const f = new FormData();
      f.append('subject_id', String(ids.subject));
      f.append('kind', 'link');
      f.append('url', 'javascript:alert(1)');
      return f;
    })(),
  });
  assert.equal(badLink.status, 400);

  const link = new FormData();
  link.append('subject_id', String(ids.subject));
  link.append('kind', 'link');
  link.append('url', 'https://youtube.com/watch?v=abc');
  link.append('title', 'Video de elasticidad');
  const l = await admin('POST', '/api/admin/materials', undefined, { form: link });
  assert.equal(l.status, 201);

  const edit = await admin('PUT', `/api/admin/materials/${ids.material}`, { subject_id: ids.subject, title: 'Guía 1', class_id: '' });
  assert.equal(edit.status, 200);
  assert.equal(edit.data.title, 'Guía 1');
  assert.equal(edit.data.class_id, null);
});

test('login de estudiante con cédula y correo', async () => {
  const notYet = await student('POST', '/api/auth/login/student', { cedula: '12345678', email: 'maria@correo.com' });
  assert.equal(notYet.status, 401);

  const add = await admin('POST', '/api/admin/students', { cedula: 'V-12.345.678', email: 'Maria@Correo.com', name: 'María Pérez', semester_id: ids.semester });
  assert.equal(add.status, 201);
  assert.equal(add.data.cedula, '12345678');
  ids.student = add.data.id;

  const dup = await admin('POST', '/api/admin/students', { cedula: '12345678', email: 'otra@correo.com' });
  assert.equal(dup.status, 409);

  const wrongMail = await student('POST', '/api/auth/login/student', { cedula: '12345678', email: 'otro@correo.com' });
  assert.equal(wrongMail.status, 401);

  const ok = await student('POST', '/api/auth/login/student', { cedula: '12.345.678', email: ' MARIA@correo.com ' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.redirect, '/app');
  const me = await student('GET', '/api/auth/me');
  assert.equal(me.data.auth.role, 'student');
  assert.equal(me.data.auth.user.semester_id, ids.semester);
});

test('el estudiante ve materias, clases, materiales y calendario', async () => {
  const subs = await student('GET', `/api/subjects?semester_id=${ids.semester}&today=2026-11-01`);
  assert.equal(subs.status, 200);
  assert.equal(subs.data.length, 1);
  assert.equal(subs.data[0].material_count, 2);
  assert.equal(subs.data[0].next_event_date, '2099-11-10');

  const detail = await student('GET', `/api/subjects/${ids.subject}`);
  assert.equal(detail.data.classes.length, 1);
  assert.equal(detail.data.materials.length, 2);
  assert.equal(detail.data.events.length, 1);
  assert.ok(!('file_name' in detail.data.materials[0]), 'no se expone el nombre interno del archivo');

  const evs = await student('GET', '/api/events?from=2099-11-01&to=2099-11-30');
  assert.equal(evs.data.length, 1);
  assert.equal(evs.data[0].subject_name, 'Microeconomía I');

  const dash = await student('GET', '/api/dashboard?today=2026-11-01');
  assert.equal(dash.status, 200);
  assert.equal(dash.data.semester_id, ids.semester);
  assert.equal(dash.data.upcoming.length, 1);
  assert.equal(dash.data.counts.materials, 2);

  const file = await student('GET', `/api/materials/${ids.material}/file?download=1`);
  assert.equal(file.status, 200);
  assert.equal(file.data.toString(), '%PDF-1.4 contenido de prueba');
  assert.match(file.headers.get('content-disposition'), /^attachment;.*filename\*=UTF-8''Gu%C3%ADa/);

  const inline = await student('GET', `/api/materials/${ids.material}/file`);
  assert.equal(inline.headers.get('content-type'), 'application/pdf');
  assert.match(inline.headers.get('content-disposition'), /^inline/);

  const prof = await student('PUT', '/api/me', { name: 'María José Pérez', semester_id: ids.semester });
  assert.equal(prof.status, 200);
});

test('enlaces firmados: el archivo se abre sin sesión (teléfono, gestor de descargas)', async () => {
  const detail = await student('GET', `/api/subjects/${ids.subject}`);
  const file = detail.data.materials.find((m) => m.kind === 'file');
  assert.match(file.file_url, /^\/api\/materials\/\d+\/file\?exp=\d+&sig=[\w-]{32}$/);
  assert.equal(detail.data.materials.find((m) => m.kind === 'link').file_url, undefined);

  // Sin cookies, como lo pide el visor de PDF o el gestor de descargas del celular.
  const anon = await fetch(base + file.file_url + '&download=1');
  assert.equal(anon.status, 200);
  assert.equal(await anon.text(), '%PDF-1.4 contenido de prueba');

  const tampered = await fetch(base + file.file_url.replace(/sig=.{4}/, 'sig=AAAA'), { headers: { accept: 'text/html' } });
  assert.equal(tampered.status, 401);
  assert.match(await tampered.text(), /inicia sesión/);

  const past = Math.floor(Date.now() / 1000) - 60;
  const expired = await fetch(base + file.file_url.replace(/exp=\d+/, `exp=${past}`));
  assert.equal(expired.status, 401);

  const noSig = await fetch(`${base}/api/materials/${file.id}/file`);
  assert.equal(noSig.status, 401);

  const settings = await admin('GET', '/api/admin/settings');
  assert.equal(settings.data.file_secret, undefined, 'el secreto no se expone');
});

test('archivo de Vercel Blob abierto desde un servidor sin acceso: aviso claro', async () => {
  const { createClient } = require('@libsql/client');
  const c = createClient({ url: 'file:' + path.join(process.env.DATA_DIR, 'portal.db') });
  const r = await c.execute({
    sql: "INSERT INTO materials (subject_id, title, kind, url, file_name, original_name, size) VALUES (?, 'En Blob', 'file', ?, ?, 'en-blob.pdf', 10)",
    args: [ids.subject, 'https://teststore.private.blob.vercel-storage.com/materiales/1/en-blob.pdf', 'materiales/1/en-blob.pdf'],
  });
  c.close();
  const mid = Number(r.lastInsertRowid);

  const asJson = await student('GET', `/api/materials/${mid}/file`);
  assert.equal(asJson.status, 503);
  assert.match(asJson.data.error, /Vercel Blob/);

  const page = await fetch(`${base}/api/materials/${mid}/file?download=1`, { headers: { accept: 'text/html', cookie: await studentCookie() } });
  assert.equal(page.status, 503);
  assert.match(await page.text(), /No se pudo abrir el archivo[\s\S]*sistema-de-economia-02\.vercel\.app/);
  await admin('DELETE', `/api/admin/materials/${mid}`);
});

test('el estudiante no puede usar el panel admin', async () => {
  assert.equal((await student('POST', '/api/admin/semesters', { name: 'Hack' })).status, 403);
  assert.equal((await student('GET', '/api/admin/students')).status, 403);
  assert.equal((await student('DELETE', `/api/admin/subjects/${ids.subject}`)).status, 403);
  assert.equal((await student('GET', '/admin')).status, 302);
});

test('horario de clases: crea las sesiones semanales sin mezclarlas con evaluaciones', async () => {
  const horario = [
    'Lunes 07:20-10:20 CB1103 Introducción a la Matemática',
    'Lunes 10:25-12:40 CB1101 Historia Contemporánea',
    'jueves 10:25 - 13:25 Introducción a la Economía (CB1102)',
    'Vie 7:20 a 10:20 CB1104 Métodos de Investigación I',
    'esto no es una clase',
  ].join('\n');
  const mat = await admin('POST', '/api/admin/subjects', { semester_id: ids.semester, name: 'Introducción a la Matemática', code: 'CB1103' });
  assert.equal((await student('POST', '/api/admin/events/schedule', { text: horario, from: '2026-11-02', to: '2026-11-30' })).status, 403);

  const r = await admin('POST', '/api/admin/events/schedule', { text: horario, from: '2026-11-02', to: '2026-11-30', replace: true });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  // Noviembre 2026: 5 lunes (×2 clases) + 4 jueves + 4 viernes = 18
  assert.equal(r.data.created, 18);
  assert.equal(r.data.errors.length, 1);
  assert.deepEqual(r.data.items.map((i) => [i.day, i.start, i.end, i.title, i.sessions]), [
    ['Lunes', '07:20', '10:20', 'Introducción a la Matemática (CB1103)', 5],
    ['Lunes', '10:25', '12:40', 'Historia Contemporánea (CB1101)', 5],
    ['Jueves', '10:25', '13:25', 'Introducción a la Economía (CB1102)', 4],
    ['Viernes', '07:20', '10:20', 'Métodos de Investigación I (CB1104)', 4],
  ]);
  assert.equal(r.data.items[0].subject, 'Introducción a la Matemática', 'se asocia a la materia por su código');

  // Volver a cargar reemplaza en vez de duplicar
  const again = await admin('POST', '/api/admin/events/schedule', { text: horario, from: '2026-11-02', to: '2026-11-30' });
  assert.equal(again.data.deleted, 18);
  const nov = (await student('GET', '/api/events?from=2026-11-01&to=2026-11-30')).data.filter((e) => e.type === 'clase');
  assert.equal(nov.length, 18);
  assert.equal(nov[0].date, '2026-11-02');
  assert.equal(nov[0].subject_id, mat.data.id);

  // No aparecen como evaluaciones
  const dash = await student('GET', '/api/dashboard?today=2026-11-01');
  assert.ok(dash.data.upcoming.every((e) => e.type !== 'clase'));
  const subs = await student('GET', `/api/subjects?semester_id=${ids.semester}&today=2026-11-01`);
  assert.equal(subs.data.find((s) => s.code === 'CB1103').next_event_date, null);

  const bad = await admin('POST', '/api/admin/events/schedule', { text: horario, from: '2026-11-30', to: '2026-11-01' });
  assert.equal(bad.status, 400);

  const del = await admin('DELETE', '/api/admin/events/classes?from=2026-11-01&to=2026-11-30');
  assert.equal(del.data.deleted, 18);
  await admin('DELETE', `/api/admin/subjects/${mat.data.id}`);
});

test('importación masiva de estudiantes', async () => {
  const text = ['cedula, correo, nombre', '23456789, jose@correo.com, José Gómez', 'Ana Ruiz;ana.ruiz@correo.com;E-34567890', 'sin datos validos', '12345678, maria.nueva@correo.com'].join('\n');
  const r = await admin('POST', '/api/admin/students/import', { text, semester_id: ids.semester });
  assert.equal(r.status, 200);
  assert.equal(r.data.created, 2);
  assert.equal(r.data.updated, 1);
  assert.equal(r.data.errors.length, 1);
  const list = await admin('GET', '/api/admin/students?q=ana');
  assert.equal(list.data[0].cedula, '34567890');
  assert.equal(list.data[0].name, 'Ana Ruiz');
});

test('registro abierto y desactivación de estudiantes', async () => {
  const visitor = client();
  assert.equal((await visitor('POST', '/api/auth/login/student', { cedula: '99999999', email: 'nuevo@correo.com' })).status, 401);

  const settings = await admin('GET', '/api/admin/settings');
  await admin('PUT', '/api/admin/settings', { ...settings.data, allow_self_register: true });
  const reg = await visitor('POST', '/api/auth/login/student', { cedula: '99999999', email: 'nuevo@correo.com' });
  assert.equal(reg.status, 200);
  await admin('PUT', '/api/admin/settings', { ...settings.data, allow_self_register: false });

  const st = (await admin('GET', '/api/admin/students?q=99999999')).data[0];
  const off = await admin('PUT', `/api/admin/students/${st.id}`, { ...st, active: false });
  assert.equal(off.status, 200);
  assert.equal((await visitor('GET', '/api/subjects')).status, 401, 'la sesión del estudiante desactivado se cierra');
  assert.equal((await visitor('POST', '/api/auth/login/student', { cedula: '99999999', email: 'nuevo@correo.com' })).status, 403);
});

test('cambio de contraseña del admin', async () => {
  const bad = await admin('PUT', '/api/admin/account', { username: 'admin', current_password: 'x', new_password: 'nuevaClave2026' });
  assert.equal(bad.status, 400);
  const short = await admin('PUT', '/api/admin/account', { username: 'admin', current_password: 'clave-segura-123', new_password: 'corta' });
  assert.equal(short.status, 400);
  const ok = await admin('PUT', '/api/admin/account', { username: 'admin', current_password: 'clave-segura-123', new_password: 'nuevaClave2026' });
  assert.equal(ok.status, 200);
  const again = client();
  assert.equal((await again('POST', '/api/auth/login/admin', { username: 'admin', password: 'nuevaClave2026' })).status, 200);
});

test('administradores: agregar, entrar, nueva contraseña y eliminar', async () => {
  assert.equal((await student('POST', '/api/admin/admins', { username: 'hacker', password: '12345678' })).status, 403);

  const weak = await admin('POST', '/api/admin/admins', { username: 'adminprueba', password: 'corta' });
  assert.equal(weak.status, 400);
  const badUser = await admin('POST', '/api/admin/admins', { username: 'con espacio', password: 'Clave-Prueba-1' });
  assert.equal(badUser.status, 400);

  const created = await admin('POST', '/api/admin/admins', { username: 'adminprueba', name: 'Prueba', password: 'Clave-Prueba-1', must_change: true });
  assert.equal(created.status, 201);
  assert.equal(created.data.must_change, 1);
  assert.equal(created.data.password_hash, undefined, 'no se expone el hash');
  assert.equal((await admin('POST', '/api/admin/admins', { username: 'ADMINPRUEBA', password: 'Otra-Clave-22' })).status, 409);

  const list = await admin('GET', '/api/admin/admins');
  assert.equal(list.data.length, 2);
  assert.ok(list.data.find((a) => a.me).username === 'admin');

  // El nuevo administrador entra y ve que debe cambiar su contraseña
  const other = client();
  assert.equal((await other('POST', '/api/auth/login/admin', { username: 'adminprueba', password: 'Clave-Prueba-1' })).status, 200);
  const stats = await other('GET', '/api/admin/stats');
  assert.equal(stats.data.must_change_password, true);
  assert.equal((await other('DELETE', `/api/admin/admins/${created.data.id}`)).status, 400, 'no puede eliminarse a sí mismo');

  // Nueva contraseña: se cierran sus sesiones
  assert.equal((await admin('PUT', `/api/admin/admins/${created.data.id}/password`, { password: 'Nueva-Clave-33', must_change: false })).status, 200);
  assert.equal((await other('GET', '/api/admin/stats')).status, 401);
  assert.equal((await other('POST', '/api/auth/login/admin', { username: 'adminprueba', password: 'Nueva-Clave-33' })).status, 200);

  assert.equal((await admin('DELETE', `/api/admin/admins/${created.data.id}`)).status, 200);
  assert.equal((await other('GET', '/api/admin/stats')).status, 401, 'al eliminarlo pierde el acceso');
  const me = list.data.find((a) => a.me);
  assert.equal((await admin('DELETE', `/api/admin/admins/${me.id}`)).status, 400, 'no se puede eliminar el último administrador ni a uno mismo');
});

test('al borrar la materia se borran sus archivos', async () => {
  const files = fs.readdirSync(path.join(process.env.DATA_DIR, 'uploads'));
  assert.equal(files.length, 1);
  const del = await admin('DELETE', `/api/admin/subjects/${ids.subject}`);
  assert.equal(del.status, 200);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fs.readdirSync(path.join(process.env.DATA_DIR, 'uploads')).length, 0);
  assert.equal((await student('GET', `/api/subjects/${ids.subject}`)).status, 404);
  assert.equal((await student('GET', '/api/events')).data.length, 0);
});

test('cerrar sesión', async () => {
  assert.equal((await student('POST', '/api/auth/logout')).status, 200);
  assert.equal((await student('GET', '/api/subjects')).status, 401);
});
