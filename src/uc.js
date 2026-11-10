'use strict';

/**
 * Facultades y carreras de pregrado de la Universidad de Carabobo (UC).
 *
 * Fuentes (noviembre de 2026):
 *  - Sitios oficiales: faces.uc.edu.ve, fcjp.uc.edu.ve, facyt.uc.edu.ve, fcs.uc.edu.ve.
 *  - Wikipedia (es) "Universidad de Carabobo" para Ingeniería, Educación, Odontología y las
 *    carreras técnicas de Ciencias de la Salud (sus sitios estaban en mantenimiento o sin la lista).
 * No se incluyen carreras aprobadas que aún no inician (Arquitectura, Ciencias Ambientales).
 */

const { all, run, batch } = require('./db');

const UC_STRUCTURE = [
  {
    name: 'Facultad de Ciencias Económicas y Sociales',
    code: 'FACES',
    color: '#8b5cf6',
    description: 'Campus Bárbula (Carabobo) y La Morita (Aragua).',
    careers: ['Economía', 'Administración Comercial', 'Contaduría Pública', 'Relaciones Industriales'],
  },
  {
    name: 'Facultad de Ciencias Jurídicas y Políticas',
    code: 'FCJP',
    color: '#64748b',
    description: 'Escuelas de Derecho, Estudios Políticos y Fiscales, y Ciencias Forenses.',
    careers: ['Derecho', 'Estudios Políticos', 'Ciencias Fiscales', 'Ciencias Forenses'],
  },
  {
    name: 'Facultad de Ciencias de la Salud',
    code: 'FCS',
    color: '#ef4444',
    description: 'Sedes Carabobo y Aragua.',
    careers: [
      'Medicina',
      'Bioanálisis',
      'Enfermería',
      'Fisioterapia',
      'Psicología',
      'TSU en Tecnología Cardiopulmonar',
      'TSU en Citotecnología',
      'TSU en Imagenología',
      'TSU en Histotecnología',
      'TSU en Terapia Psicosocial',
      'TSU en Registros y Estadísticas de Salud',
    ],
  },
  {
    name: 'Facultad de Ingeniería',
    code: 'FACING',
    color: '#0ea5e9',
    description: 'Escuelas de ingeniería en el campus Bárbula.',
    careers: [
      'Ingeniería Civil',
      'Ingeniería Eléctrica',
      'Ingeniería Industrial',
      'Ingeniería Mecánica',
      'Ingeniería Química',
      'Ingeniería de Telecomunicaciones',
    ],
  },
  {
    name: 'Facultad de Ciencias de la Educación',
    code: 'FaCE',
    color: '#f59e0b',
    description: 'Escuela de Educación y sus menciones.',
    careers: [
      'Educación, mención Artes Plásticas',
      'Educación, mención Biología',
      'Educación, mención Ciencias Sociales',
      'Educación Física, Deportes y Recreación',
      'Educación Preescolar',
      'Educación Integral',
      'Educación Musical',
      'Educación para el Trabajo (Comercial)',
      'Educación, mención Física',
      'Educación, mención Francés',
      'Educación, mención Informática',
      'Educación, mención Inglés',
      'Educación, mención Lengua y Literatura',
      'Educación, mención Matemática',
      'Educación, mención Orientación',
      'Educación, mención Química',
    ],
  },
  {
    name: 'Facultad Experimental de Ciencias y Tecnología',
    code: 'FACYT',
    color: '#10b981',
    description: 'Licenciaturas en ciencias básicas y computación.',
    careers: ['Biología', 'Computación', 'Física', 'Matemática', 'Química'],
  },
  {
    name: 'Facultad de Odontología',
    code: 'FAO',
    color: '#14b8a6',
    description: 'Escuela de Odontología.',
    careers: ['Odontología'],
  },
];

const PALETTE = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b'];
const key = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Crea las facultades y carreras de la UC que falten (por nombre). No borra ni cambia nada
 * de lo que ya exista. Devuelve cuántas creó y el id de la carrera de Economía.
 */
async function loadUcStructure() {
  const faculties = await all('SELECT id, name FROM faculties');
  const careers = await all('SELECT id, faculty_id, name FROM careers');
  let facultiesCreated = 0;
  const careerInserts = [];

  for (const [fi, f] of UC_STRUCTURE.entries()) {
    let faculty = faculties.find((x) => key(x.name) === key(f.name));
    if (!faculty) {
      const info = await run('INSERT INTO faculties (name, code, description, color, position) VALUES (?, ?, ?, ?, ?)', f.name, f.code, f.description, f.color, fi + 1);
      faculty = { id: info.lastInsertRowid, name: f.name };
      facultiesCreated++;
    }
    f.careers.forEach((name, ci) => {
      if (careers.some((c) => c.faculty_id === faculty.id && key(c.name) === key(name))) return;
      careerInserts.push(['INSERT INTO careers (faculty_id, name, color, position) VALUES (?, ?, ?, ?)', faculty.id, name, PALETTE[(fi * 3 + ci) % PALETTE.length], ci + 1]);
    });
  }
  await batch(careerInserts);

  const rows = await all('SELECT c.id, c.name, f.name AS faculty FROM careers c JOIN faculties f ON f.id = c.faculty_id');
  const economia = rows.find((c) => key(c.name) === 'economia' && key(c.faculty) === key(UC_STRUCTURE[0].name));

  return { faculties: facultiesCreated, careers: careerInserts.length, economiaId: economia ? economia.id : null };
}

const UC_TOTALS = {
  faculties: UC_STRUCTURE.length,
  careers: UC_STRUCTURE.reduce((n, f) => n + f.careers.length, 0),
};

module.exports = { UC_STRUCTURE, UC_TOTALS, loadUcStructure };
