'use strict';

/**
 * Carga datos de ejemplo con varias facultades y carreras.
 *   npm run demo            → solo si no hay materias todavía
 *   npm run demo -- --force → borra el contenido académico actual y lo vuelve a crear
 *
 * Estudiante de prueba: cédula 12345678 · correo estudiante@demo.com (Economía)
 */

try {
  process.loadEnvFile();
} catch {
  /* sin .env */
}

const { ready } = require('../src/db');
const { seedDemo } = require('../src/demo');

(async () => {
  await ready();
  const done = await seedDemo({ force: process.argv.includes('--force') });
  if (!done) {
    console.log('Ya hay materias cargadas. Usa "npm run demo -- --force" para reemplazarlas por los datos de ejemplo.');
    return;
  }
  console.log('Datos de ejemplo cargados: 3 facultades, 7 carreras.');
  console.log('  Estudiante de prueba → cédula: 12345678 · correo: estudiante@demo.com (Economía)');
})().catch((err) => {
  console.error('No se pudieron cargar los datos de ejemplo:', err.message);
  process.exit(1);
});
