'use strict';

/**
 * Datos de ejemplo con varias facultades y carreras.
 *  - En modo demostración (vistas previas de Vercel) se cargan solos al arrancar.
 *  - En tu computadora: npm run demo  (o npm run demo -- --force para reemplazar todo).
 */

const { all, get, run, batch, setSettingSql, IS_DEMO } = require('./db');
const { parseSchedule, datesFor } = require('./schedule');

const DEMO_ADMIN = { username: 'demo', password: 'demo1234' };
const DEMO_STUDENTS = [
  { cedula: '12345678', email: 'estudiante@demo.com', name: 'María Pérez', career: 'ECO', semester: 1 },
  { cedula: '23456789', email: 'informatica@demo.com', name: 'Luis Ramírez', career: 'INF', semester: 1 },
  { cedula: '34567890', email: 'psicologia@demo.com', name: 'Ana Torres', career: 'PSI', semester: 1 },
  { cedula: '45678901', email: 'jose.gomez@demo.com', name: 'José Gómez', career: 'ECO', semester: 2 },
  { cedula: '56789012', email: 'carla.mendez@demo.com', name: 'Carla Méndez', career: 'ADM', semester: 1 },
];

const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** PDF mínimo válido de una página. */
function makePdf(title, lines) {
  const strip = (l) => l.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[()\\]/g, '');
  const text = [title, '', ...lines].map((l, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 72 ${740 - i * 22} Td (${strip(l)}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text, 'latin1')} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// [nombre, código, color, profesor, horario, aula, créditos]
const S = (name, code, color, professor, schedule, classroom, credits = 4) => ({ name, code, color, professor, schedule, classroom, credits });

const FACULTIES = [
  {
    name: 'Facultad de Ciencias Económicas y Sociales',
    code: 'FACES',
    color: '#8b5cf6',
    description: 'Economía, administración y contaduría.',
    careers: [
      {
        name: 'Economía',
        code: 'ECO',
        color: '#6366f1',
        semesters: [
          [
            S('Historia Contemporánea', 'CB1101', '#f97316', 'Prof. Rosa Medina', 'Lun · 10:25 a 12:40', 'Aula 1312', 3),
            S('Introducción a la Economía', 'CB1102', '#10b981', 'Prof. Luis Martínez', 'Jue · 10:25 a 1:25 p. m.', 'Aula 1313', 3),
            S('Introducción a la Matemática', 'CB1103', '#6366f1', 'Prof. Carmen Díaz', 'Lun · 7:20 a 10:20', 'Aula 1408', 4),
            S('Métodos de Investigación I', 'CB1104', '#ec4899', 'Prof. Jorge Salas', 'Vie · 7:20 a 10:20', 'Aula 1308', 3),
          ],
          [
            S('Microeconomía I', 'CB1201', '#8b5cf6', 'Prof. Ana Rodríguez', 'Lun y Mié · 9:00 a 10:30', 'Aula 1210'),
            S('Estadística I', 'CB1202', '#f59e0b', 'Prof. Pedro Herrera', 'Mar y Jue · 7:00 a 8:30', 'Lab. 2'),
            S('Matemática II', 'CB1203', '#14b8a6', 'Prof. Gabriela Torres', 'Vie · 7:00 a 10:00', 'Aula 1102'),
          ],
        ],
      },
      {
        name: 'Administración',
        code: 'ADM',
        color: '#0ea5e9',
        semesters: [
          [
            S('Fundamentos de Administración', 'AD1101', '#3b82f6', 'Prof. Daniel Castillo', 'Lun y Mié · 7:00 a 8:30', 'Aula 2101'),
            S('Contabilidad I', 'AD1102', '#10b981', 'Prof. Laura Rivas', 'Mar y Jue · 9:00 a 10:30', 'Aula 2104'),
            S('Matemática I', 'AD1103', '#f43f5e', 'Prof. Carmen Díaz', 'Vie · 8:00 a 11:00', 'Aula 2107'),
          ],
          [
            S('Mercadeo', 'AD1201', '#d946ef', 'Prof. Andrés Paz', 'Lun · 9:00 a 12:00', 'Aula 2201'),
            S('Comportamiento Organizacional', 'AD1202', '#f97316', 'Prof. Elena Suárez', 'Mié · 9:00 a 12:00', 'Aula 2203'),
          ],
        ],
      },
      {
        name: 'Contaduría Pública',
        code: 'CON',
        color: '#14b8a6',
        semesters: [
          [
            S('Contabilidad General', 'CP1101', '#14b8a6', 'Prof. Jorge Salas', 'Lun y Mié · 10:00 a 11:30', 'Aula 3101'),
            S('Derecho Mercantil', 'CP1102', '#64748b', 'Prof. Miguel Lugo', 'Jue · 8:00 a 11:00', 'Aula 3102', 3),
          ],
        ],
      },
    ],
  },
  {
    name: 'Facultad de Ingeniería',
    code: 'ING',
    color: '#0ea5e9',
    description: 'Ingenierías informática y civil.',
    careers: [
      {
        name: 'Ingeniería Informática',
        code: 'INF',
        color: '#3b82f6',
        semesters: [
          [
            S('Programación I', 'IN1101', '#3b82f6', 'Prof. Ricardo Peña', 'Lun y Mié · 7:00 a 9:00', 'Lab. Computación 1', 5),
            S('Cálculo I', 'IN1102', '#f43f5e', 'Prof. Sofía Blanco', 'Mar y Jue · 7:00 a 9:00', 'Aula 4102', 5),
            S('Álgebra Lineal', 'IN1103', '#f59e0b', 'Prof. Tomás Ortega', 'Vie · 9:00 a 12:00', 'Aula 4103'),
          ],
          [
            S('Estructuras de Datos', 'IN1201', '#8b5cf6', 'Prof. Ricardo Peña', 'Lun y Mié · 9:00 a 11:00', 'Lab. Computación 2', 5),
            S('Física I', 'IN1202', '#06b6d4', 'Prof. Hugo Navas', 'Mar y Jue · 9:00 a 11:00', 'Aula 4201', 5),
          ],
        ],
      },
      {
        name: 'Ingeniería Civil',
        code: 'CIV',
        color: '#f97316',
        semesters: [
          [
            S('Dibujo Técnico', 'IC1101', '#f97316', 'Prof. Beatriz Luna', 'Lun · 7:00 a 11:00', 'Taller de Dibujo', 3),
            S('Cálculo I', 'IC1102', '#f43f5e', 'Prof. Sofía Blanco', 'Mar y Jue · 9:00 a 11:00', 'Aula 4104', 5),
            S('Química General', 'IC1103', '#10b981', 'Prof. Raúl Méndez', 'Mié · 8:00 a 11:00', 'Lab. Química'),
          ],
        ],
      },
    ],
  },
  {
    name: 'Facultad de Humanidades y Educación',
    code: 'HUM',
    color: '#ec4899',
    description: 'Psicología y comunicación social.',
    careers: [
      {
        name: 'Psicología',
        code: 'PSI',
        color: '#ec4899',
        semesters: [
          [
            S('Introducción a la Psicología', 'PS1101', '#ec4899', 'Prof. Natalia Ríos', 'Lun y Mié · 8:00 a 9:30', 'Aula 5101'),
            S('Biología Humana', 'PS1102', '#10b981', 'Prof. Óscar Vega', 'Mar · 8:00 a 11:00', 'Lab. Biología'),
          ],
        ],
      },
      {
        name: 'Comunicación Social',
        code: 'COM',
        color: '#d946ef',
        semesters: [
          [
            S('Teoría de la Comunicación', 'CS1101', '#d946ef', 'Prof. Paula Herrera', 'Mar y Jue · 10:00 a 11:30', 'Aula 6101'),
            S('Redacción Periodística', 'CS1102', '#f59e0b', 'Prof. Iván Rojas', 'Vie · 8:00 a 11:00', 'Sala de Redacción', 3),
          ],
        ],
      },
    ],
  },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const EXAM_TYPES = ['parcial', 'quiz', 'examen', 'entrega', 'exposicion'];

/** Borra el contenido académico (no toca administradores ni ajustes). */
async function wipe() {
  const storage = require('./storage');
  await storage.removeFiles(await all("SELECT * FROM materials WHERE kind = 'file'"));
  await batch([
    ['DELETE FROM sessions WHERE role = ?', 'student'],
    ['DELETE FROM events'],
    ['DELETE FROM materials'],
    ['DELETE FROM classes'],
    ['DELETE FROM subjects'],
    ['DELETE FROM students'],
    ['DELETE FROM semesters'],
    ['DELETE FROM careers'],
    ['DELETE FROM faculties'],
  ]);
}

async function seedDemo({ force = false } = {}) {
  if ((await get('SELECT COUNT(*) AS n FROM subjects')).n > 0 && !force) return false;
  if (force) await wipe();
  const storage = require('./storage');

  await batch([
    setSettingSql('site_name', 'Universidad Demo'),
    setSettingSql('site_tagline', 'Portal universitario'),
    setSettingSql('university', 'Universidad de demostración'),
    setSettingSql('period', '2026-II'),
    setSettingSql('welcome_message', 'Todas las facultades y carreras en un solo portal: materias, materiales y calendario de evaluaciones.'),
  ]);

  const careerIds = {};
  const semesterIds = {};
  const subjectIds = {};
  let phone = 100;

  for (const [fi, f] of FACULTIES.entries()) {
    const facultyId = (await run('INSERT INTO faculties (name, code, description, color, position) VALUES (?, ?, ?, ?, ?)', f.name, f.code, f.description, f.color, fi + 1))
      .lastInsertRowid;
    for (const [ci, c] of f.careers.entries()) {
      const careerId = (await run('INSERT INTO careers (faculty_id, name, code, color, position) VALUES (?, ?, ?, ?, ?)', facultyId, c.name, c.code, c.color, ci + 1))
        .lastInsertRowid;
      careerIds[c.code] = careerId;
      for (const [si, subjects] of c.semesters.entries()) {
        const semId = (
          await run('INSERT INTO semesters (career_id, name, number, period, position) VALUES (?, ?, ?, ?, ?)', careerId, `Semestre ${ROMAN[si]}`, si + 1, '2026-II', si + 1)
        ).lastInsertRowid;
        semesterIds[`${c.code}:${si + 1}`] = semId;
        for (const [ji, sub] of subjects.entries()) {
          phone += 7;
          subjectIds[sub.code] = (
            await run(
              `INSERT INTO subjects (semester_id, name, code, color, professor, professor_phone, schedule, classroom, credits, position, description)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              semId,
              sub.name,
              sub.code,
              sub.color,
              sub.professor,
              `+58 414 555 ${String(1000 + phone).slice(-4)}`,
              sub.schedule,
              sub.classroom,
              sub.credits,
              ji + 1,
              `Materia de ${c.name} (${ROMAN[si]} semestre).\n\nEvaluación:\n• Primer parcial — 25%\n• Segundo parcial — 25%\n• Quices y talleres — 20%\n• Trabajo final — 30%`
            )
          ).lastInsertRowid;
        }
      }
    }
  }

  // Clases (temas) y materiales de algunas materias
  const statements = [];
  const all_subjects = FACULTIES.flatMap((f) => f.careers.flatMap((c) => c.semesters.flat()));
  for (const [i, sub] of all_subjects.entries()) {
    const sid = subjectIds[sub.code];
    statements.push(
      ['INSERT INTO classes (subject_id, title, date, content) VALUES (?, ?, ?, ?)', sid, 'Presentación de la materia', day(-14), 'Programa, forma de evaluación y bibliografía.'],
      ['INSERT INTO classes (subject_id, title, date, content) VALUES (?, ?, ?, ?)', sid, 'Unidad 1: conceptos básicos', day(-7), 'Lectura del capítulo 1 y ejercicios de la guía.'],
      ["INSERT INTO materials (subject_id, title, kind, url) VALUES (?, ?, 'link', ?)", sid, `Video introductorio — ${sub.name}`, 'https://www.youtube.com/results?search_query=' + encodeURIComponent(sub.name)],
      [
        'INSERT INTO events (subject_id, title, type, date, start_time, end_time, location) VALUES (?, ?, ?, ?, ?, ?, ?)',
        sid,
        i % 2 ? 'Primer parcial' : 'Quiz 1',
        EXAM_TYPES[i % EXAM_TYPES.length],
        day(3 + ((i * 3) % 24)),
        '08:00',
        '10:00',
        sub.classroom,
      ]
    );
  }
  await batch(statements);

  for (const code of ['CB1102', 'CB1103', 'IN1101', 'PS1101', 'AD1101']) {
    const sub = all_subjects.find((s) => s.code === code);
    const name = `Guía de estudio - ${sub.name}.pdf`;
    const f = await storage.saveBuffer(name, makePdf(`Guia de estudio: ${sub.name}`, ['Unidad 1: conceptos basicos', 'Unidad 2: aplicaciones', 'Ejercicios propuestos']), 'application/pdf');
    await run(
      `INSERT INTO materials (subject_id, title, description, kind, url, file_name, original_name, mime, size) VALUES (?, ?, ?, 'file', ?, ?, ?, 'application/pdf', ?)`,
      subjectIds[code],
      name.replace(/\.pdf$/, ''),
      'Resumen de los temas del primer parcial.',
      f.url,
      f.file_name,
      name,
      f.size
    );
  }

  // Horario real de Economía, Semestre I, durante las próximas 10 semanas
  const { items } = parseSchedule(
    [
      'Lunes 07:20-10:20 CB1103 Introducción a la Matemática',
      'Lunes 10:25-12:40 CB1101 Historia Contemporánea',
      'Jueves 10:25-13:25 CB1102 Introducción a la Economía',
      'Viernes 07:20-10:20 CB1104 Métodos de Investigación I',
    ].join('\n')
  );
  const classEvents = [];
  for (const it of items) {
    for (const date of datesFor(it.weekday, day(-7), day(70))) {
      classEvents.push(["INSERT INTO events (subject_id, title, type, date, start_time, end_time) VALUES (?, ?, 'clase', ?, ?, ?)", subjectIds[it.code], it.title, date, it.start, it.end]);
    }
  }
  classEvents.push(["INSERT INTO events (title, type, date, description) VALUES ('Semana de receso', 'otro', ?, 'No hay clases en toda la universidad.')", day(30)]);
  await batch(classEvents);

  await batch(
    DEMO_STUDENTS.map((st) => [
      'INSERT OR IGNORE INTO students (cedula, email, name, career_id, semester_id) VALUES (?, ?, ?, ?, ?)',
      st.cedula,
      st.email,
      st.name,
      careerIds[st.career],
      semesterIds[`${st.career}:${st.semester}`],
    ])
  );
  return true;
}

/** Modo demostración: administrador de prueba y datos de ejemplo. */
async function prepareDemo() {
  const auth = require('./auth');
  await run(
    'INSERT OR IGNORE INTO admins (username, name, password_hash, must_change) VALUES (?, ?, ?, 0)',
    DEMO_ADMIN.username,
    'Administrador demo',
    auth.hashPassword(DEMO_ADMIN.password)
  );
  if (!(await get('SELECT id FROM faculties LIMIT 1'))) await seedDemo({ force: true });
}

const demoInfo = () =>
  IS_DEMO
    ? {
        admin: DEMO_ADMIN,
        students: DEMO_STUDENTS.slice(0, 3).map(({ cedula, email, name, career }) => ({
          cedula,
          email,
          name,
          career: FACULTIES.flatMap((f) => f.careers).find((c) => c.code === career).name,
        })),
      }
    : null;

module.exports = { seedDemo, prepareDemo, demoInfo, DEMO_ADMIN };
