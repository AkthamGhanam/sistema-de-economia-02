'use strict';

const express = require('express');
const { all, get, run } = require('../db');
const storage = require('../storage');
const fileLinks = require('../filelinks');
const { requireAuth } = require('../auth');
const { notFound, bad, id, str, isDate, today } = require('../util');

const router = express.Router();

/*
 * Archivos: se aceptan con sesión o con un enlace firmado (file_url). En el teléfono
 * el archivo suele abrirse en otro navegador o en el gestor de descargas, sin la sesión.
 */
router.get('/materials/:id/file', async (req, res) => {
  const materialId = id(req.params.id);
  const signed = await fileLinks.verify(materialId, req.query.exp, req.query.sig);
  if (!signed && !req.auth) {
    return storage.fileError(
      req,
      res,
      401,
      'Para abrir este archivo inicia sesión en el portal y vuelve a tocar "Ver" o "Descargar". Si el enlace es de hace muchas horas, ábrelo de nuevo desde la materia.'
    );
  }
  const m = await get('SELECT * FROM materials WHERE id = ?', materialId);
  if (!m || m.kind !== 'file') return storage.fileError(req, res, 404, 'El archivo no existe o fue eliminado.');
  await storage.sendFile(req, res, m);
});

router.use(requireAuth);

/* ---------- consultas compartidas (también las usa el panel admin) ---------- */

const EVENT_SELECT = `
  SELECT e.*, s.name AS subject_name, s.color AS subject_color, s.code AS subject_code,
         s.semester_id AS semester_id, sem.name AS semester_name
    FROM events e
    LEFT JOIN subjects s   ON s.id = e.subject_id
    LEFT JOIN semesters sem ON sem.id = s.semester_id`;

// La URL interna de los archivos no se expone: se descargan por /api/materials/:id/file.
const MATERIAL_SELECT = `
  SELECT m.id, m.subject_id, m.class_id, m.title, m.description, m.kind,
         CASE WHEN m.kind = 'link' THEN m.url END AS url,
         m.original_name, m.mime, m.size, m.created_at,
         s.name AS subject_name, s.color AS subject_color, s.semester_id AS semester_id,
         c.title AS class_title
    FROM materials m
    JOIN subjects s ON s.id = m.subject_id
    LEFT JOIN classes c ON c.id = m.class_id`;

/** Facultades con sus carreras y algunos totales. */
async function getStructure() {
  const [faculties, careers] = await Promise.all([
    all('SELECT * FROM faculties ORDER BY position, name COLLATE NOCASE, id'),
    all(`SELECT c.*,
                (SELECT COUNT(*) FROM semesters s WHERE s.career_id = c.id) AS semester_count,
                (SELECT COUNT(*) FROM subjects sub JOIN semesters s ON s.id = sub.semester_id WHERE s.career_id = c.id) AS subject_count,
                (SELECT COUNT(*) FROM students st WHERE st.career_id = c.id) AS student_count
           FROM careers c ORDER BY c.position, c.name COLLATE NOCASE, c.id`),
  ]);
  return faculties.map((f) => ({ ...f, careers: careers.filter((c) => c.faculty_id === f.id) }));
}

function listSemesters(careerId = null) {
  return all(
    `SELECT sem.*, car.name AS career_name, car.faculty_id,
            (SELECT COUNT(*) FROM subjects s WHERE s.semester_id = sem.id) AS subject_count
       FROM semesters sem LEFT JOIN careers car ON car.id = sem.career_id
      WHERE (?1 IS NULL OR sem.career_id = ?1)
      ORDER BY car.position, car.id, sem.position, sem.number, sem.id`,
    careerId
  );
}

function listSubjects(semesterId, t, careerId = null) {
  return all(
    `SELECT s.*, sem.name AS semester_name, sem.career_id, car.name AS career_name,
            (SELECT COUNT(*) FROM materials m WHERE m.subject_id = s.id) AS material_count,
            (SELECT COUNT(*) FROM classes c WHERE c.subject_id = s.id) AS class_count,
            (SELECT e.date FROM events e WHERE e.subject_id = s.id AND e.type <> 'clase' AND e.date >= ?1 ORDER BY e.date, e.start_time LIMIT 1) AS next_event_date,
            (SELECT e.title FROM events e WHERE e.subject_id = s.id AND e.type <> 'clase' AND e.date >= ?1 ORDER BY e.date, e.start_time LIMIT 1) AS next_event_title,
            (SELECT e.type FROM events e WHERE e.subject_id = s.id AND e.type <> 'clase' AND e.date >= ?1 ORDER BY e.date, e.start_time LIMIT 1) AS next_event_type
       FROM subjects s
       JOIN semesters sem ON sem.id = s.semester_id
       LEFT JOIN careers car ON car.id = sem.career_id
      WHERE (?2 IS NULL OR s.semester_id = ?2) AND (?3 IS NULL OR sem.career_id = ?3)
      ORDER BY car.position, car.id, sem.position, sem.number, sem.id, s.position, s.name COLLATE NOCASE`,
    t,
    semesterId,
    careerId
  );
}

async function subjectDetail(subjectId) {
  const [subject, classes, materials, events] = await Promise.all([
    get(
      `SELECT s.*, sem.name AS semester_name, sem.period AS semester_period, sem.career_id,
              car.name AS career_name, fac.name AS faculty_name
         FROM subjects s JOIN semesters sem ON sem.id = s.semester_id
         LEFT JOIN careers car ON car.id = sem.career_id
         LEFT JOIN faculties fac ON fac.id = car.faculty_id
        WHERE s.id = ?`,
      subjectId
    ),
    all(
      `SELECT c.*, (SELECT COUNT(*) FROM materials m WHERE m.class_id = c.id) AS material_count
         FROM classes c WHERE c.subject_id = ?
        ORDER BY c.date IS NULL, c.date, c.id`,
      subjectId
    ),
    all(`${MATERIAL_SELECT} WHERE m.subject_id = ? ORDER BY m.created_at DESC, m.id DESC`, subjectId).then(fileLinks.addFileUrls),
    all(`${EVENT_SELECT} WHERE e.subject_id = ? AND e.type <> 'clase' ORDER BY e.date, e.start_time`, subjectId),
  ]);
  if (!subject) return null;
  return Object.assign(subject, { classes, materials, events });
}

/** evaluationsOnly: sin las sesiones de clase (para "Próximas evaluaciones" y contadores). */
function listEvents({ from, to, semesterId, subjectId, careerId, limit, evaluationsOnly }) {
  const where = [];
  const params = [];
  if (evaluationsOnly) where.push("e.type <> 'clase'");
  if (from) {
    where.push('e.date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('e.date <= ?');
    params.push(to);
  }
  if (subjectId) {
    where.push('e.subject_id = ?');
    params.push(subjectId);
  } else if (semesterId) {
    where.push('(s.semester_id = ? OR e.subject_id IS NULL)');
    params.push(semesterId);
  } else if (careerId) {
    where.push('(s.semester_id IN (SELECT id FROM semesters WHERE career_id = ?) OR e.subject_id IS NULL)');
    params.push(careerId);
  }
  const lim = limit ? `LIMIT ${Math.min(Math.max(Number(limit) || 1, 1), 1000)}` : '';
  return all(`${EVENT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY e.date, e.start_time IS NULL, e.start_time, e.id ${lim}`, ...params);
}

async function listMaterials({ subjectId, semesterId, careerId, q, limit }) {
  const where = [];
  const params = [];
  if (subjectId) {
    where.push('m.subject_id = ?');
    params.push(subjectId);
  } else if (semesterId) {
    where.push('s.semester_id = ?');
    params.push(semesterId);
  } else if (careerId) {
    where.push('s.semester_id IN (SELECT id FROM semesters WHERE career_id = ?)');
    params.push(careerId);
  }
  if (q) {
    where.push('(m.title LIKE ? OR m.description LIKE ? OR m.original_name LIKE ? OR s.name LIKE ?)');
    const like = `%${q.replace(/[%_]/g, '')}%`;
    params.push(like, like, like, like);
  }
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 500);
  return fileLinks.addFileUrls(
    await all(`${MATERIAL_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.created_at DESC, m.id DESC LIMIT ${lim}`, ...params)
  );
}

/** Semestre por defecto: el que pide el cliente, o el del estudiante. */
function semesterFor(req) {
  if (req.query.semester_id === 'all' || req.query.career_id) return id(req.query.semester_id);
  const q = id(req.query.semester_id);
  if (q) return q;
  if (req.auth.role === 'student') return req.auth.user.semester_id || null;
  return null;
}

/** Carrera por defecto: la que pide el cliente ("all" = todas) o la del estudiante. */
function careerFor(req) {
  if (req.query.career_id === 'all') return null;
  const q = id(req.query.career_id);
  if (q) return q;
  if (req.auth.role === 'student') return req.auth.user.career_id || null;
  return null;
}

/* ---------- rutas ---------- */

router.get('/structure', async (req, res) => {
  res.json(await getStructure());
});

router.get('/semesters', async (req, res) => {
  res.json(await listSemesters(id(req.query.career_id)));
});

router.get('/subjects', async (req, res) => {
  res.json(await listSubjects(id(req.query.semester_id), today(req), id(req.query.career_id)));
});

router.get('/subjects/:id', async (req, res) => {
  const subject = await subjectDetail(id(req.params.id));
  if (!subject) throw notFound('La materia no existe');
  res.json(subject);
});

router.get('/events', async (req, res) => {
  const from = isDate(req.query.from) ? req.query.from : null;
  const to = isDate(req.query.to) ? req.query.to : null;
  res.json(
    await listEvents({ from, to, semesterId: id(req.query.semester_id), subjectId: id(req.query.subject_id), careerId: id(req.query.career_id) })
  );
});

router.get('/materials', async (req, res) => {
  res.json(
    await listMaterials({
      subjectId: id(req.query.subject_id),
      semesterId: id(req.query.semester_id),
      careerId: id(req.query.career_id),
      q: str(req.query.q, 80),
      limit: req.query.limit,
    })
  );
});

router.get('/dashboard', async (req, res) => {
  const t = today(req);
  const semesterId = semesterFor(req);
  const careerId = semesterId ? null : careerFor(req);
  const in30 = new Date(t + 'T00:00:00Z');
  in30.setUTCDate(in30.getUTCDate() + 30);
  const to30 = in30.toISOString().slice(0, 10);
  const semFilter = semesterId
    ? 'WHERE s.semester_id = ?'
    : careerId
      ? 'WHERE s.semester_id IN (SELECT id FROM semesters WHERE career_id = ?)'
      : '';
  const semParams = semesterId ? [semesterId] : careerId ? [careerId] : [];
  const eventScope = semesterId
    ? 'AND (s.semester_id = ? OR e.subject_id IS NULL)'
    : careerId
      ? 'AND (s.semester_id IN (SELECT id FROM semesters WHERE career_id = ?) OR e.subject_id IS NULL)'
      : '';

  const effectiveCareer = careerId || (semesterId ? (await get('SELECT career_id FROM semesters WHERE id = ?', semesterId))?.career_id : null);
  const [upcoming, recentMaterials, subjects, semester, materialCount, upcoming30, career] = await Promise.all([
    listEvents({ from: t, semesterId, careerId, limit: 8, evaluationsOnly: true }),
    listMaterials({ semesterId, careerId, limit: 6 }),
    listSubjects(semesterId, t, careerId),
    semesterId ? get('SELECT * FROM semesters WHERE id = ?', semesterId) : null,
    get(`SELECT COUNT(*) AS n FROM materials m JOIN subjects s ON s.id = m.subject_id ${semFilter}`, ...semParams),
    get(
      `SELECT COUNT(*) AS n FROM events e LEFT JOIN subjects s ON s.id = e.subject_id
        WHERE e.type <> 'clase' AND e.date >= ? AND e.date <= ? ${eventScope}`,
      t,
      to30,
      ...semParams
    ),
    effectiveCareer
      ? get(
          `SELECT c.id, c.name, c.code, f.id AS faculty_id, f.name AS faculty_name
             FROM careers c JOIN faculties f ON f.id = c.faculty_id WHERE c.id = ?`,
          effectiveCareer
        )
      : null,
  ]);

  res.json({
    today: t,
    semester_id: semesterId,
    semester: semester || null,
    career: career || null,
    upcoming,
    recentMaterials,
    subjects,
    counts: { subjects: subjects.length, materials: materialCount.n, upcoming30: upcoming30.n },
  });
});

/* ---------- perfil del estudiante ---------- */

router.put('/me', async (req, res) => {
  if (req.auth.role !== 'student') throw bad('Solo los estudiantes tienen perfil editable aquí');
  const name = str(req.body.name, 120);
  let careerId = id(req.body.career_id);
  if (careerId && !(await get('SELECT id FROM careers WHERE id = ?', careerId))) careerId = null;
  let semesterId = id(req.body.semester_id);
  const sem = semesterId ? await get('SELECT id, career_id FROM semesters WHERE id = ?', semesterId) : null;
  if (!sem || (careerId && sem.career_id && sem.career_id !== careerId)) semesterId = null;
  if (sem && semesterId && !careerId) careerId = sem.career_id;
  await run('UPDATE students SET name = ?, career_id = ?, semester_id = ? WHERE id = ?', name, careerId, semesterId, req.auth.user.id);
  res.json({ ok: true });
});

module.exports = { router, getStructure, listSemesters, listSubjects, subjectDetail, listEvents, listMaterials, EVENT_SELECT, MATERIAL_SELECT };
