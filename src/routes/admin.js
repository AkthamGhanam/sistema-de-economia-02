'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { all, get, run, batch, UPLOAD_DIR, getSettings, setSettingSql } = require('../db');
const storage = require('../storage');
const auth = require('../auth');
const {
  HttpError,
  bad,
  notFound,
  str,
  requiredStr,
  int,
  id,
  optDate,
  optTime,
  isColor,
  normalizeCedula,
  isValidCedula,
  normalizeEmail,
  isEmail,
  normalizePhone,
  isPhone,
  isHttpUrl,
  today,
} = require('../util');
const { subjectDetail, listEvents, listMaterials, MATERIAL_SELECT } = require('./portal');
const { systemStatus } = require('../status');
const fileLinks = require('../filelinks');
const { parseSchedule, datesFor, fold } = require('../schedule');

const router = express.Router();
router.use(auth.requireAdmin);
router.use((req, res, next) => {
  if (!req.body) req.body = {};
  next();
});

const EVENT_TYPES = ['examen', 'parcial', 'quiz', 'entrega', 'exposicion', 'otro', 'clase'];
const { MAX_UPLOAD_MB } = storage;

/* ---------- subida de archivos al disco (solo en modo local) ---------- */

let diskUpload = null;
if (storage.MODE === 'local') {
  diskUpload = multer({
    storage: multer.diskStorage({
      destination: UPLOAD_DIR,
      filename(req, file, cb) {
        const ext = path
          .extname(file.originalname || '')
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, '')
          .slice(0, 12);
        cb(null, crypto.randomUUID() + ext);
      },
    }),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 20 },
  });
}

const uploadArray = (req, res, next) => (diskUpload && req.is('multipart/form-data') ? diskUpload.array('files', 20)(req, res, next) : next());
const uploadSingle = (req, res, next) => (diskUpload && req.is('multipart/form-data') ? diskUpload.single('file')(req, res, next) : next());

/** Busboy entrega los nombres en latin1; los pasamos a UTF-8 para conservar tildes y ñ. */
function originalName(file) {
  const raw = file.originalname || 'archivo';
  const fixed = Buffer.from(raw, 'latin1').toString('utf8');
  return (fixed.includes('�') ? raw : fixed).slice(0, 200);
}

function removeUploaded(req) {
  const files = req.files || (req.file ? [req.file] : []);
  for (const f of files) fs.rm(f.path, { force: true }, () => {});
}

/** Ejecuta el handler y, si falla, borra los archivos recién subidos al disco. */
const withUploadCleanup = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    removeUploaded(req);
    throw err;
  }
};

/* ---------- resumen ---------- */

router.get('/stats', async (req, res) => {
  const t = today(req);
  const n = (sql, ...p) => get(sql, ...p).then((r) => r.n);
  const [semesters, faculties, careers, subjects, classes, materials, students, active_students, upcoming, storage_bytes, upcoming_events, recent_materials] =
    await Promise.all([
      n('SELECT COUNT(*) AS n FROM semesters'),
      n('SELECT COUNT(*) AS n FROM faculties'),
      n('SELECT COUNT(*) AS n FROM careers'),
      n('SELECT COUNT(*) AS n FROM subjects'),
      n('SELECT COUNT(*) AS n FROM classes'),
      n('SELECT COUNT(*) AS n FROM materials'),
      n('SELECT COUNT(*) AS n FROM students'),
      n('SELECT COUNT(*) AS n FROM students WHERE active = 1'),
      n("SELECT COUNT(*) AS n FROM events WHERE date >= ? AND type <> 'clase'", t),
      n("SELECT COALESCE(SUM(size), 0) AS n FROM materials WHERE kind = 'file'"),
      listEvents({ from: t, limit: 6, evaluationsOnly: true }),
      listMaterials({ limit: 6 }),
    ]);
  res.json({
    semesters,
    faculties,
    careers,
    subjects,
    classes,
    materials,
    students,
    active_students,
    upcoming,
    storage_bytes,
    upcoming_events,
    recent_materials,
    must_change_password: !!req.auth.user.must_change,
    storage: storage.MODE,
  });
});

/* ---------- facultades y carreras ---------- */

function facultyInput(body) {
  return {
    name: requiredStr(body.name, 'Nombre de la facultad', 160),
    code: str(body.code, 30),
    description: str(body.description, 1000),
    color: isColor(body.color) ? body.color.toLowerCase() : '#8b5cf6',
    position: int(body.position) ?? 0,
  };
}

router.post('/faculties', async (req, res) => {
  const f = facultyInput(req.body);
  const info = await run('INSERT INTO faculties (name, code, description, color, position) VALUES (?, ?, ?, ?, ?)', f.name, f.code, f.description, f.color, f.position);
  res.status(201).json(await get('SELECT * FROM faculties WHERE id = ?', info.lastInsertRowid));
});

router.put('/faculties/:id', async (req, res) => {
  const facultyId = id(req.params.id);
  if (!(await get('SELECT id FROM faculties WHERE id = ?', facultyId))) throw notFound('La facultad no existe');
  const f = facultyInput(req.body);
  await run('UPDATE faculties SET name = ?, code = ?, description = ?, color = ?, position = ? WHERE id = ?', f.name, f.code, f.description, f.color, f.position, facultyId);
  res.json(await get('SELECT * FROM faculties WHERE id = ?', facultyId));
});

router.delete('/faculties/:id', async (req, res) => {
  const facultyId = id(req.params.id);
  if (!(await get('SELECT id FROM faculties WHERE id = ?', facultyId))) throw notFound('La facultad no existe');
  if ((await get('SELECT COUNT(*) AS n FROM careers WHERE faculty_id = ?', facultyId)).n) {
    throw bad('Esta facultad todavía tiene carreras. Elimínalas o muévelas a otra facultad primero.');
  }
  await run('DELETE FROM faculties WHERE id = ?', facultyId);
  res.json({ ok: true });
});

async function careerInput(body) {
  const facultyId = id(body.faculty_id);
  if (!facultyId || !(await get('SELECT id FROM faculties WHERE id = ?', facultyId))) throw bad('Selecciona una facultad válida');
  return {
    faculty_id: facultyId,
    name: requiredStr(body.name, 'Nombre de la carrera', 160),
    code: str(body.code, 30),
    description: str(body.description, 1000),
    color: isColor(body.color) ? body.color.toLowerCase() : '#6366f1',
    position: int(body.position) ?? 0,
  };
}

router.post('/careers', async (req, res) => {
  const c = await careerInput(req.body);
  const info = await run(
    'INSERT INTO careers (faculty_id, name, code, description, color, position) VALUES (?, ?, ?, ?, ?, ?)',
    c.faculty_id,
    c.name,
    c.code,
    c.description,
    c.color,
    c.position
  );
  res.status(201).json(await get('SELECT * FROM careers WHERE id = ?', info.lastInsertRowid));
});

router.put('/careers/:id', async (req, res) => {
  const careerId = id(req.params.id);
  if (!(await get('SELECT id FROM careers WHERE id = ?', careerId))) throw notFound('La carrera no existe');
  const c = await careerInput(req.body);
  await run(
    'UPDATE careers SET faculty_id = ?, name = ?, code = ?, description = ?, color = ?, position = ? WHERE id = ?',
    c.faculty_id,
    c.name,
    c.code,
    c.description,
    c.color,
    c.position,
    careerId
  );
  res.json(await get('SELECT * FROM careers WHERE id = ?', careerId));
});

router.delete('/careers/:id', async (req, res) => {
  const careerId = id(req.params.id);
  if (!(await get('SELECT id FROM careers WHERE id = ?', careerId))) throw notFound('La carrera no existe');
  if ((await get('SELECT COUNT(*) AS n FROM semesters WHERE career_id = ?', careerId)).n) {
    throw bad('Esta carrera todavía tiene semestres. Elimínalos primero (se borran con sus materias).');
  }
  await batch([
    ['UPDATE students SET career_id = NULL WHERE career_id = ?', careerId],
    ['DELETE FROM careers WHERE id = ?', careerId],
  ]);
  res.json({ ok: true });
});

/* ---------- semestres ---------- */

async function semesterInput(body) {
  let careerId = id(body.career_id);
  if (body.career_id !== undefined && body.career_id !== '' && body.career_id !== null) {
    if (!careerId || !(await get('SELECT id FROM careers WHERE id = ?', careerId))) throw bad('Selecciona una carrera válida');
  } else if ((await get('SELECT COUNT(*) AS n FROM careers')).n) {
    throw bad('Selecciona la carrera a la que pertenece el semestre');
  }
  return {
    career_id: careerId,
    name: requiredStr(body.name, 'Nombre', 80),
    number: int(body.number),
    period: str(body.period, 40),
    description: str(body.description, 1000),
    position: int(body.position) ?? 0,
  };
}

router.post('/semesters', async (req, res) => {
  const s = await semesterInput(req.body);
  const info = await run(
    'INSERT INTO semesters (career_id, name, number, period, description, position) VALUES (?, ?, ?, ?, ?, ?)',
    s.career_id,
    s.name,
    s.number,
    s.period,
    s.description,
    s.position
  );
  res.status(201).json(await get('SELECT * FROM semesters WHERE id = ?', info.lastInsertRowid));
});

router.put('/semesters/:id', async (req, res) => {
  const semId = id(req.params.id);
  if (!(await get('SELECT id FROM semesters WHERE id = ?', semId))) throw notFound('El semestre no existe');
  const s = await semesterInput(req.body);
  await run(
    'UPDATE semesters SET career_id = ?, name = ?, number = ?, period = ?, description = ?, position = ? WHERE id = ?',
    s.career_id,
    s.name,
    s.number,
    s.period,
    s.description,
    s.position,
    semId
  );
  res.json(await get('SELECT * FROM semesters WHERE id = ?', semId));
});

router.delete('/semesters/:id', async (req, res) => {
  const semId = id(req.params.id);
  if (!(await get('SELECT id FROM semesters WHERE id = ?', semId))) throw notFound('El semestre no existe');
  const files = await all('SELECT m.* FROM materials m JOIN subjects s ON s.id = m.subject_id WHERE s.semester_id = ?', semId);
  const ofSemester = 'SELECT id FROM subjects WHERE semester_id = ?';
  await batch([
    [`DELETE FROM events WHERE subject_id IN (${ofSemester})`, semId],
    [`DELETE FROM materials WHERE subject_id IN (${ofSemester})`, semId],
    [`DELETE FROM classes WHERE subject_id IN (${ofSemester})`, semId],
    ['DELETE FROM subjects WHERE semester_id = ?', semId],
    ['UPDATE students SET semester_id = NULL WHERE semester_id = ?', semId],
    ['DELETE FROM semesters WHERE id = ?', semId],
  ]);
  await storage.removeFiles(files);
  res.json({ ok: true });
});

/* ---------- materias ---------- */

async function subjectInput(body) {
  const semesterId = id(body.semester_id);
  if (!semesterId || !(await get('SELECT id FROM semesters WHERE id = ?', semesterId))) throw bad('Selecciona un semestre válido');
  const phone = normalizePhone(body.professor_phone);
  if (phone && !isPhone(phone)) throw bad('El teléfono del profesor no es válido (ej: +58 414 123 4567)');
  return {
    semester_id: semesterId,
    name: requiredStr(body.name, 'Nombre de la materia', 120),
    code: str(body.code, 30),
    professor: str(body.professor, 120),
    professor_phone: phone || null,
    schedule: str(body.schedule, 200),
    classroom: str(body.classroom, 120),
    credits: int(body.credits),
    description: str(body.description, 10000),
    color: isColor(body.color) ? body.color.toLowerCase() : '#6366f1',
    position: int(body.position) ?? 0,
  };
}

const SUBJECT_FIELDS = [
  'semester_id',
  'name',
  'code',
  'professor',
  'professor_phone',
  'schedule',
  'classroom',
  'credits',
  'description',
  'color',
  'position',
];

router.post('/subjects', async (req, res) => {
  const s = await subjectInput(req.body);
  const info = await run(
    `INSERT INTO subjects (${SUBJECT_FIELDS.join(', ')}) VALUES (${SUBJECT_FIELDS.map(() => '?').join(', ')})`,
    ...SUBJECT_FIELDS.map((f) => s[f])
  );
  res.status(201).json(await subjectDetail(info.lastInsertRowid));
});

router.put('/subjects/:id', async (req, res) => {
  const subjectId = id(req.params.id);
  if (!(await get('SELECT id FROM subjects WHERE id = ?', subjectId))) throw notFound('La materia no existe');
  const s = await subjectInput(req.body);
  await run(
    `UPDATE subjects SET ${SUBJECT_FIELDS.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
    ...SUBJECT_FIELDS.map((f) => s[f]),
    subjectId
  );
  res.json(await subjectDetail(subjectId));
});

router.delete('/subjects/:id', async (req, res) => {
  const subjectId = id(req.params.id);
  if (!(await get('SELECT id FROM subjects WHERE id = ?', subjectId))) throw notFound('La materia no existe');
  const files = await all('SELECT * FROM materials WHERE subject_id = ?', subjectId);
  await batch([
    ['DELETE FROM events WHERE subject_id = ?', subjectId],
    ['DELETE FROM materials WHERE subject_id = ?', subjectId],
    ['DELETE FROM classes WHERE subject_id = ?', subjectId],
    ['DELETE FROM subjects WHERE id = ?', subjectId],
  ]);
  await storage.removeFiles(files);
  res.json({ ok: true });
});

/* ---------- clases ---------- */

async function classInput(body) {
  const subjectId = id(body.subject_id);
  if (!subjectId || !(await get('SELECT id FROM subjects WHERE id = ?', subjectId))) throw bad('Selecciona una materia válida');
  return {
    subject_id: subjectId,
    title: requiredStr(body.title, 'Título de la clase', 200),
    date: optDate(body.date, 'Fecha'),
    content: str(body.content, 20000),
  };
}

router.post('/classes', async (req, res) => {
  const c = await classInput(req.body);
  const info = await run('INSERT INTO classes (subject_id, title, date, content) VALUES (?, ?, ?, ?)', c.subject_id, c.title, c.date, c.content);
  res.status(201).json(await get('SELECT * FROM classes WHERE id = ?', info.lastInsertRowid));
});

router.put('/classes/:id', async (req, res) => {
  const classId = id(req.params.id);
  if (!(await get('SELECT id FROM classes WHERE id = ?', classId))) throw notFound('La clase no existe');
  const c = await classInput(req.body);
  await run('UPDATE classes SET subject_id = ?, title = ?, date = ?, content = ? WHERE id = ?', c.subject_id, c.title, c.date, c.content, classId);
  res.json(await get('SELECT * FROM classes WHERE id = ?', classId));
});

router.delete('/classes/:id', async (req, res) => {
  const classId = id(req.params.id);
  if (!(await get('SELECT id FROM classes WHERE id = ?', classId))) throw notFound('La clase no existe');
  await batch([
    ['UPDATE materials SET class_id = NULL WHERE class_id = ?', classId],
    ['DELETE FROM classes WHERE id = ?', classId],
  ]);
  res.json({ ok: true });
});

/* ---------- materiales ---------- */

async function materialTarget(body) {
  const subjectId = id(body.subject_id);
  if (!subjectId || !(await get('SELECT id FROM subjects WHERE id = ?', subjectId))) throw bad('Selecciona una materia válida');
  let classId = id(body.class_id);
  if (classId && !(await get('SELECT id FROM classes WHERE id = ? AND subject_id = ?', classId, subjectId))) classId = null;
  return { subjectId, classId };
}

const stripExt = (name) => name.replace(/\.[^.]+$/, '');

/** Permiso para que el navegador suba un archivo directo a Vercel Blob. */
router.post('/blob-upload', async (req, res) => {
  if (storage.MODE !== 'blob') throw bad('La subida directa a Vercel Blob no está activada');
  if (req.body.type !== 'blob.generate-client-token') throw bad('Solicitud de subida inválida');
  res.json(await storage.handleClientUpload(req));
});

router.post(
  '/materials',
  uploadArray,
  withUploadCleanup(async (req, res) => {
    const { subjectId, classId } = await materialTarget(req.body);
    const description = str(req.body.description, 5000);
    const title = str(req.body.title, 200);
    const kind = req.body.kind === 'link' ? 'link' : 'file';

    if (kind === 'link') {
      const url = str(req.body.url, 2000);
      if (!url || !isHttpUrl(url)) throw bad('Escribe un enlace válido (debe empezar por http:// o https://)');
      const info = await run(
        "INSERT INTO materials (subject_id, class_id, title, description, kind, url) VALUES (?, ?, ?, ?, 'link', ?)",
        subjectId,
        classId,
        title || url,
        description,
        url
      );
      return res.status(201).json(await fileLinks.addFileUrls([await get(`${MATERIAL_SELECT} WHERE m.id = ?`, info.lastInsertRowid)]));
    }

    // Archivos: en disco (multipart) o ya subidos a Vercel Blob (JSON con sus datos).
    let files;
    if (req.files && req.files.length) {
      files = req.files.map((f) => ({ name: originalName(f), file_name: f.filename, url: null, mime: str(f.mimetype, 120), size: f.size }));
    } else if (Array.isArray(req.body.files) && req.body.files.length) {
      if (storage.MODE !== 'blob') throw bad('Selecciona al menos un archivo');
      if (req.body.files.length > 20) throw bad('Puedes subir máximo 20 archivos a la vez');
      files = req.body.files.map((f) => {
        if (!storage.validBlobUpload(f)) throw bad('Los datos del archivo subido no son válidos');
        return {
          name: (str(f.name, 200) || f.pathname.split('/').pop()).slice(0, 200),
          file_name: str(f.pathname, 500),
          url: String(f.url),
          mime: str(f.contentType, 120),
          size: Number.isFinite(Number(f.size)) ? Number(f.size) : null,
        };
      });
    } else if (storage.MODE === 'missing') {
      throw new HttpError(503, 'Falta conectar Vercel Blob para guardar archivos. Mientras tanto puedes agregar enlaces.');
    } else {
      throw bad('Selecciona al menos un archivo');
    }

    const results = await batch(
      files.map((f) => {
        let t = stripExt(f.name);
        if (title) t = files.length === 1 ? title : `${title} · ${stripExt(f.name)}`;
        return [
          `INSERT INTO materials (subject_id, class_id, title, description, kind, url, file_name, original_name, mime, size)
           VALUES (?, ?, ?, ?, 'file', ?, ?, ?, ?, ?)`,
          subjectId,
          classId,
          t.slice(0, 200),
          description,
          f.url,
          f.file_name,
          f.name,
          f.mime,
          f.size,
        ];
      })
    );
    const ids = results.map((r) => r.lastInsertRowid);
    res.status(201).json(await fileLinks.addFileUrls(await all(`${MATERIAL_SELECT} WHERE m.id IN (${ids.map(() => '?').join(', ')}) ORDER BY m.id`, ...ids)));
  })
);

router.put(
  '/materials/:id',
  uploadSingle,
  withUploadCleanup(async (req, res) => {
    const materialId = id(req.params.id);
    const current = await get('SELECT * FROM materials WHERE id = ?', materialId);
    if (!current) throw notFound('El material no existe');
    const { subjectId, classId } = await materialTarget(req.body);
    const title = requiredStr(req.body.title, 'Título', 200);
    const description = str(req.body.description, 5000);

    if (current.kind === 'link') {
      const url = str(req.body.url, 2000);
      if (!url || !isHttpUrl(url)) throw bad('Escribe un enlace válido (debe empezar por http:// o https://)');
      await run(
        'UPDATE materials SET subject_id = ?, class_id = ?, title = ?, description = ?, url = ? WHERE id = ?',
        subjectId,
        classId,
        title,
        description,
        url,
        materialId
      );
    } else if (req.file) {
      await run(
        `UPDATE materials SET subject_id = ?, class_id = ?, title = ?, description = ?,
                url = NULL, file_name = ?, original_name = ?, mime = ?, size = ? WHERE id = ?`,
        subjectId,
        classId,
        title,
        description,
        req.file.filename,
        originalName(req.file),
        str(req.file.mimetype, 120),
        req.file.size,
        materialId
      );
      await storage.removeFiles([current]);
    } else {
      await run(
        'UPDATE materials SET subject_id = ?, class_id = ?, title = ?, description = ? WHERE id = ?',
        subjectId,
        classId,
        title,
        description,
        materialId
      );
    }
    res.json(await fileLinks.addFileUrls(await get(`${MATERIAL_SELECT} WHERE m.id = ?`, materialId)));
  })
);

router.delete('/materials/:id', async (req, res) => {
  const m = await get('SELECT * FROM materials WHERE id = ?', id(req.params.id));
  if (!m) throw notFound('El material no existe');
  await run('DELETE FROM materials WHERE id = ?', m.id);
  await storage.removeFiles([m]);
  res.json({ ok: true });
});

/* ---------- calendario / evaluaciones ---------- */

async function eventInput(body) {
  const subjectId = id(body.subject_id);
  if (subjectId && !(await get('SELECT id FROM subjects WHERE id = ?', subjectId))) throw bad('La materia seleccionada no existe');
  const date = optDate(body.date, 'Fecha');
  if (!date) throw bad('La fecha es obligatoria');
  const start = optTime(body.start_time, 'Inicio');
  const end = optTime(body.end_time, 'Fin');
  if (start && end && end < start) throw bad('La hora de fin no puede ser antes de la hora de inicio');
  return {
    subject_id: subjectId || null,
    title: requiredStr(body.title, 'Título', 200),
    type: EVENT_TYPES.includes(body.type) ? body.type : 'examen',
    date,
    start_time: start,
    end_time: end,
    location: str(body.location, 200),
    description: str(body.description, 5000),
  };
}

const EVENT_FIELDS = ['subject_id', 'title', 'type', 'date', 'start_time', 'end_time', 'location', 'description'];

router.post('/events', async (req, res) => {
  const e = await eventInput(req.body);
  const info = await run(
    `INSERT INTO events (${EVENT_FIELDS.join(', ')}) VALUES (${EVENT_FIELDS.map(() => '?').join(', ')})`,
    ...EVENT_FIELDS.map((f) => e[f])
  );
  res.status(201).json(await get('SELECT * FROM events WHERE id = ?', info.lastInsertRowid));
});

/**
 * Carga un horario semanal: crea una sesión "Clase" por cada día entre from y to.
 * Con replace, primero borra las clases con el mismo título en ese período.
 */
router.post('/events/schedule', async (req, res) => {
  const from = optDate(req.body.from, 'Desde');
  const to = optDate(req.body.to, 'Hasta');
  if (!from || !to) throw bad('Elige la fecha de inicio y de fin del semestre');
  if (to < from) throw bad('La fecha de fin debe ser después de la de inicio');
  if ((new Date(to) - new Date(from)) / 86400000 > 400) throw bad('El período no puede ser mayor a un año');

  const { items, errors } = parseSchedule(req.body.text);
  if (!items.length) throw bad(errors[0] ? `Línea ${errors[0].line}: ${errors[0].reason}` : 'Pega al menos una línea del horario');

  // Se asocia cada clase a su materia (por código o nombre) para que tome su color.
  const subjects = await all('SELECT id, name, code FROM subjects');
  const findSubject = (it) =>
    (it.code && subjects.find((s) => s.code && fold(s.code).replace(/[\s-]/g, '') === fold(it.code).replace(/[\s-]/g, ''))) ||
    (it.name && subjects.find((s) => fold(s.name) === fold(it.name))) ||
    null;

  const deletes = req.body.replace === false || req.body.replace === '0'
    ? []
    : [...new Set(items.map((it) => it.title))].map((title) => [
        "DELETE FROM events WHERE type = 'clase' AND date >= ? AND date <= ? AND title = ?",
        from,
        to,
        title,
      ]);

  const inserts = [];
  const summary = items.map((it) => {
    const subject = findSubject(it);
    const dates = datesFor(it.weekday, from, to);
    for (const date of dates) {
      inserts.push([
        "INSERT INTO events (subject_id, title, type, date, start_time, end_time) VALUES (?, ?, 'clase', ?, ?, ?)",
        subject ? subject.id : null,
        it.title,
        date,
        it.start,
        it.end,
      ]);
    }
    return { day: it.day, start: it.start, end: it.end, title: it.title, sessions: dates.length, subject: subject ? subject.name : null };
  });
  if (inserts.length > 2000) throw bad('Son demasiadas clases de una vez; usa un período más corto');

  const results = await batch([...deletes, ...inserts]);
  const deleted = results.slice(0, deletes.length).reduce((sum, r) => sum + (r.changes || 0), 0);
  res.status(201).json({ created: inserts.length, deleted, items: summary, errors });
});

/** Quita todas las sesiones de clase de un período. */
router.delete('/events/classes', async (req, res) => {
  const from = optDate(req.query.from, 'Desde');
  const to = optDate(req.query.to, 'Hasta');
  if (!from || !to) throw bad('Elige la fecha de inicio y de fin');
  const info = await run("DELETE FROM events WHERE type = 'clase' AND date >= ? AND date <= ?", from, to);
  res.json({ deleted: info.changes });
});

router.put('/events/:id', async (req, res) => {
  const eventId = id(req.params.id);
  if (!(await get('SELECT id FROM events WHERE id = ?', eventId))) throw notFound('La evaluación no existe');
  const e = await eventInput(req.body);
  await run(`UPDATE events SET ${EVENT_FIELDS.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`, ...EVENT_FIELDS.map((f) => e[f]), eventId);
  res.json(await get('SELECT * FROM events WHERE id = ?', eventId));
});

router.delete('/events/:id', async (req, res) => {
  const info = await run('DELETE FROM events WHERE id = ?', id(req.params.id));
  if (!info.changes) throw notFound('La evaluación no existe');
  res.json({ ok: true });
});

/* ---------- estudiantes ---------- */

const STUDENT_SELECT = `
  SELECT st.*, sem.name AS semester_name, car.name AS career_name, fac.name AS faculty_name
    FROM students st
    LEFT JOIN semesters sem ON sem.id = st.semester_id
    LEFT JOIN careers car   ON car.id = st.career_id
    LEFT JOIN faculties fac ON fac.id = car.faculty_id`;

/** Carrera y semestre coherentes: el semestre debe pertenecer a la carrera. */
async function careerAndSemester(body) {
  let careerId = id(body.career_id);
  if (careerId && !(await get('SELECT id FROM careers WHERE id = ?', careerId))) careerId = null;
  let semesterId = id(body.semester_id);
  const sem = semesterId ? await get('SELECT id, career_id FROM semesters WHERE id = ?', semesterId) : null;
  if (!sem) semesterId = null;
  else if (careerId && sem.career_id && sem.career_id !== careerId) throw bad('El semestre elegido no pertenece a esa carrera');
  else if (!careerId) careerId = sem.career_id || null;
  return { careerId, semesterId };
}

async function studentInput(body) {
  const cedula = normalizeCedula(body.cedula);
  const email = normalizeEmail(body.email);
  if (!isValidCedula(cedula)) throw bad('La cédula no es válida');
  if (!isEmail(email)) throw bad('El correo no es válido');
  const { careerId, semesterId } = await careerAndSemester(body);
  return {
    cedula,
    email,
    name: str(body.name, 120),
    career_id: careerId,
    semester_id: semesterId,
    active: body.active === undefined ? 1 : body.active === true || body.active === 1 || body.active === '1' ? 1 : 0,
  };
}

router.get('/students', async (req, res) => {
  const q = str(req.query.q, 80);
  const careerId = id(req.query.career_id);
  const where = [];
  const params = [];
  if (careerId) {
    where.push('st.career_id = ?');
    params.push(careerId);
  }
  if (q) {
    const like = `%${q.replace(/[%_]/g, '')}%`;
    where.push('(st.name LIKE ? OR st.email LIKE ? OR st.cedula LIKE ?)');
    params.push(like, like, like);
  }
  res.json(
    await all(`${STUDENT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY st.name IS NULL, st.name COLLATE NOCASE, st.id`, ...params)
  );
});

router.post('/students', async (req, res) => {
  const s = await studentInput(req.body);
  if (await get('SELECT id FROM students WHERE cedula = ?', s.cedula)) throw new HttpError(409, 'Ya existe un estudiante con esa cédula');
  const info = await run(
    'INSERT INTO students (cedula, email, name, career_id, semester_id, active) VALUES (?, ?, ?, ?, ?, ?)',
    s.cedula,
    s.email,
    s.name,
    s.career_id,
    s.semester_id,
    s.active
  );
  res.status(201).json(await get(`${STUDENT_SELECT} WHERE st.id = ?`, info.lastInsertRowid));
});

router.put('/students/:id', async (req, res) => {
  const studentId = id(req.params.id);
  if (!(await get('SELECT id FROM students WHERE id = ?', studentId))) throw notFound('El estudiante no existe');
  const s = await studentInput(req.body);
  if (await get('SELECT id FROM students WHERE cedula = ? AND id <> ?', s.cedula, studentId)) {
    throw new HttpError(409, 'Ya existe otro estudiante con esa cédula');
  }
  await batch([
    [
      'UPDATE students SET cedula = ?, email = ?, name = ?, career_id = ?, semester_id = ?, active = ? WHERE id = ?',
      s.cedula,
      s.email,
      s.name,
      s.career_id,
      s.semester_id,
      s.active,
      studentId,
    ],
    ...(s.active ? [] : [["DELETE FROM sessions WHERE role = 'student' AND user_id = ?", studentId]]),
  ]);
  res.json(await get(`${STUDENT_SELECT} WHERE st.id = ?`, studentId));
});

router.delete('/students/:id', async (req, res) => {
  const studentId = id(req.params.id);
  const [, del] = await batch([
    ["DELETE FROM sessions WHERE role = 'student' AND user_id = ?", studentId],
    ['DELETE FROM students WHERE id = ?', studentId],
  ]);
  if (!del.changes) throw notFound('El estudiante no existe');
  res.json({ ok: true });
});

/**
 * Importación masiva: una línea por estudiante. Los campos se separan con coma,
 * punto y coma o tabulación, en cualquier orden: se detecta la cédula (números)
 * y el correo (contiene @); lo demás se toma como nombre.
 */
router.post('/students/import', async (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text : '';
  if (!text.trim()) throw bad('Pega la lista de estudiantes');
  const { careerId, semesterId } = await careerAndSemester(req.body);

  const existing = new Set((await all('SELECT cedula FROM students')).map((r) => r.cedula));
  const result = { created: 0, updated: 0, errors: [] };
  const statements = [];

  text
    .split(/\r?\n/)
    .slice(0, 3000)
    .forEach((line, i) => {
      if (!line.trim()) return;
      const parts = line
        .split(/[,;\t|]/)
        .map((p) => p.trim())
        .filter(Boolean);
      let cedula = '';
      let email = '';
      const nameParts = [];
      for (const p of parts) {
        if (!email && p.includes('@')) email = normalizeEmail(p);
        else if (!cedula && /\d{4,}/.test(p.replace(/[.\-\s]/g, '')) && isValidCedula(normalizeCedula(p))) cedula = normalizeCedula(p);
        else nameParts.push(p);
      }
      if (!cedula || !email || !isEmail(email)) {
        // Probablemente sea un encabezado (cedula, correo, nombre); lo ignoramos sin error.
        if (i === 0 && !cedula && !email.includes('.')) return;
        result.errors.push({ line: i + 1, text: line.slice(0, 120), reason: !cedula ? 'Falta una cédula válida' : 'Falta un correo válido' });
        return;
      }
      if (existing.has(cedula)) result.updated++;
      else {
        result.created++;
        existing.add(cedula);
      }
      statements.push([
        `INSERT INTO students (cedula, email, name, career_id, semester_id) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(cedula) DO UPDATE SET email = excluded.email,
           name = COALESCE(excluded.name, students.name),
           career_id = COALESCE(excluded.career_id, students.career_id),
           semester_id = COALESCE(excluded.semester_id, students.semester_id)`,
        cedula,
        email,
        nameParts.join(' ').slice(0, 120) || null,
        careerId,
        semesterId,
      ]);
    });

  await batch(statements);
  res.json(result);
});

/* ---------- ajustes ---------- */

router.get('/settings', async (req, res) => {
  res.json({
    ...(await getSettings()),
    system: await systemStatus(),
    admin: { username: req.auth.user.username, name: req.auth.user.name },
    storage: storage.MODE,
    max_upload_mb: MAX_UPLOAD_MB,
  });
});

router.put('/settings', async (req, res) => {
  const b = req.body;
  const s = {
    site_name: requiredStr(b.site_name, 'Nombre del portal', 80),
    site_tagline: str(b.site_tagline, 120) || '',
    university: str(b.university, 160) || '',
    period: str(b.period, 40) || '',
    welcome_message: str(b.welcome_message, 500) || '',
    allow_self_register: b.allow_self_register === true || b.allow_self_register === '1' ? '1' : '0',
  };
  await batch(Object.entries(s).map(([k, v]) => setSettingSql(k, v)));
  res.json(await getSettings());
});

router.put('/account', async (req, res) => {
  const admin = await get('SELECT * FROM admins WHERE id = ?', req.auth.user.id);
  const current = typeof req.body.current_password === 'string' ? req.body.current_password : '';
  if (!auth.verifyPassword(current, admin.password_hash)) throw bad('La contraseña actual no es correcta');

  const username = requiredStr(req.body.username, 'Usuario', 60);
  if (!/^[a-zA-Z0-9._-]{3,60}$/.test(username)) throw bad('El usuario solo puede tener letras, números, punto, guion y guion bajo (mínimo 3)');
  if (await get('SELECT id FROM admins WHERE username = ? AND id <> ?', username, admin.id)) throw bad('Ese usuario ya existe');

  const next = typeof req.body.new_password === 'string' ? req.body.new_password : '';
  if (next && next.length < 8) throw bad('La nueva contraseña debe tener al menos 8 caracteres');
  if (admin.must_change && !next) throw bad('Debes elegir una nueva contraseña');

  await run(
    'UPDATE admins SET username = ?, name = ?, password_hash = ?, must_change = ? WHERE id = ?',
    username,
    str(req.body.name, 120),
    next ? auth.hashPassword(next) : admin.password_hash,
    next ? 0 : admin.must_change,
    admin.id
  );
  res.json({ ok: true });
});

/* ---------- administradores ---------- */

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,60}$/;
const USERNAME_MSG = 'El usuario solo puede tener letras, números, punto, guion y guion bajo (mínimo 3)';

function newPassword(value) {
  const pw = typeof value === 'string' ? value : '';
  if (pw.length < 8) throw bad('La contraseña debe tener al menos 8 caracteres');
  if (pw.length > 200) throw bad('La contraseña es demasiado larga');
  return pw;
}

const mustChange = (v) => (v === false || v === 0 || v === '0' ? 0 : 1);

router.get('/admins', async (req, res) => {
  const rows = await all('SELECT id, username, name, must_change, created_at FROM admins ORDER BY id');
  res.json(rows.map((a) => ({ ...a, me: a.id === req.auth.user.id })));
});

router.post('/admins', async (req, res) => {
  const username = requiredStr(req.body.username, 'Usuario', 60);
  if (!USERNAME_RE.test(username)) throw bad(USERNAME_MSG);
  const password = newPassword(req.body.password);
  if (await get('SELECT id FROM admins WHERE username = ?', username)) throw new HttpError(409, 'Ya existe un administrador con ese usuario');
  const info = await run(
    'INSERT INTO admins (username, name, password_hash, must_change) VALUES (?, ?, ?, ?)',
    username,
    str(req.body.name, 120),
    auth.hashPassword(password),
    mustChange(req.body.must_change)
  );
  res.status(201).json(await get('SELECT id, username, name, must_change, created_at FROM admins WHERE id = ?', info.lastInsertRowid));
});

/** Pone una contraseña nueva a otro administrador (por ejemplo si la olvidó) y cierra sus sesiones. */
router.put('/admins/:id/password', async (req, res) => {
  const adminId = id(req.params.id);
  if (adminId === req.auth.user.id) throw bad('Para cambiar tu propia contraseña usa "Tu cuenta de administrador"');
  if (!(await get('SELECT id FROM admins WHERE id = ?', adminId))) throw notFound('El administrador no existe');
  const password = newPassword(req.body.password);
  await batch([
    ['UPDATE admins SET password_hash = ?, must_change = ? WHERE id = ?', auth.hashPassword(password), mustChange(req.body.must_change), adminId],
    ["DELETE FROM sessions WHERE role = 'admin' AND user_id = ?", adminId],
  ]);
  res.json({ ok: true });
});

router.delete('/admins/:id', async (req, res) => {
  const adminId = id(req.params.id);
  if (adminId === req.auth.user.id) throw bad('No puedes eliminar tu propia cuenta');
  if (!(await get('SELECT id FROM admins WHERE id = ?', adminId))) throw notFound('El administrador no existe');
  if ((await get('SELECT COUNT(*) AS n FROM admins')).n <= 1) throw bad('Debe quedar al menos un administrador');
  await batch([
    ["DELETE FROM sessions WHERE role = 'admin' AND user_id = ?", adminId],
    ['DELETE FROM admins WHERE id = ?', adminId],
  ]);
  res.json({ ok: true });
});

module.exports = { router, EVENT_TYPES, MAX_UPLOAD_MB };
