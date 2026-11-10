'use strict';

/**
 * Carga las facultades y carreras de la Universidad de Carabobo con contenido de ejemplo en Economía.
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
  console.log('Datos de ejemplo cargados: 7 facultades y 47 carreras de la UC (contenido en Economía).');
  console.log('  Estudiante de prueba → cédula: 12345678 · correo: estudiante@demo.com (Economía)');
})().catch((err) => {
  console.error('No se pudieron cargar los datos de ejemplo:', err.message);
  process.exit(1);
});
