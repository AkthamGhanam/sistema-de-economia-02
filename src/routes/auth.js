'use strict';

const express = require('express');
const { get, run, getSettings } = require('../db');
const auth = require('../auth');
const { HttpError, bad, str, normalizeCedula, isValidCedula, normalizeEmail, isEmail } = require('../util');

const router = express.Router();

async function publicSettings() {
  const s = await getSettings();
  return {
    site_name: s.site_name,
    site_tagline: s.site_tagline,
    university: s.university,
    period: s.period,
    welcome_message: s.welcome_message,
    allow_self_register: s.allow_self_register === '1',
    demo: require('../demo').demoInfo(),
  };
}

router.get('/settings', async (req, res) => {
  res.json(await publicSettings());
});

router.get('/me', async (req, res) => {
  res.json({ auth: req.auth, settings: await publicSettings() });
});

router.post('/login/student', async (req, res) => {
  const cedula = normalizeCedula(req.body.cedula);
  const email = normalizeEmail(req.body.email);
  if (!isValidCedula(cedula)) throw bad('Escribe una cédula válida');
  if (!isEmail(email)) throw bad('Escribe un correo válido');

  auth.checkRateLimit(req, cedula);
  const generic = 'La cédula y el correo no coinciden con ningún estudiante registrado.';

  let student = await get('SELECT * FROM students WHERE cedula = ?', cedula);
  if (student) {
    if (normalizeEmail(student.email) !== email) {
      auth.registerFailure(req, cedula);
      throw new HttpError(401, generic);
    }
    if (!student.active) throw new HttpError(403, 'Tu acceso está desactivado. Habla con el administrador.');
  } else {
    const settings = await getSettings();
    if (settings.allow_self_register !== '1') {
      auth.registerFailure(req, cedula);
      throw new HttpError(401, generic + ' Pide al administrador que te agregue.');
    }
    if (await get('SELECT id FROM students WHERE email = ?', email)) {
      auth.registerFailure(req, cedula);
      throw new HttpError(401, generic);
    }
    const info = await run('INSERT INTO students (cedula, email, name) VALUES (?, ?, ?)', cedula, email, str(req.body.name, 120));
    student = { id: info.lastInsertRowid };
  }

  auth.clearFailures(req, cedula);
  await run("UPDATE students SET last_login = datetime('now') WHERE id = ?", student.id);
  await auth.createSession(req, res, 'student', student.id);
  res.json({ ok: true, redirect: '/app' });
});

router.post('/login/admin', async (req, res) => {
  const username = str(req.body.username, 80);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!username || !password) throw bad('Escribe tu usuario y contraseña');

  auth.checkRateLimit(req, 'admin:' + username);
  const admin = await get('SELECT * FROM admins WHERE username = ?', username);
  if (!admin || !auth.verifyPassword(password, admin.password_hash)) {
    auth.registerFailure(req, 'admin:' + username);
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  auth.clearFailures(req, 'admin:' + username);
  await auth.createSession(req, res, 'admin', admin.id);
  res.json({ ok: true, redirect: '/admin' });
});

router.post('/logout', async (req, res) => {
  await auth.destroySession(req, res);
  res.json({ ok: true });
});

module.exports = { router, publicSettings };
