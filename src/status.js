'use strict';

/** Estado de la base de datos y del almacenamiento de archivos (sin revelar secretos). */

const db = require('./db');
const storage = require('./storage');
const pkg = require('../package.json');

async function systemStatus() {
  const st = storage.status();
  let database = db.IS_DEMO ? 'demostración (datos de ejemplo)' : db.IS_REMOTE ? 'Turso (nube)' : db.IS_VERCEL ? 'falta configurar' : 'archivo local';
  let dbOk = !db.configError();
  if (dbOk) {
    try {
      await db.ready();
      await db.get('SELECT 1 AS ok');
    } catch {
      dbOk = false;
      database += ' (sin conexión: revisa TURSO_DATABASE_URL y TURSO_AUTH_TOKEN)';
    }
  }
  const archivos =
    st.mode === 'blob'
      ? 'vercel blob conectado'
      : st.mode === 'local'
        ? 'disco local'
        : st.blob_store_id
          ? 'falta la variable BLOB_READ_WRITE_TOKEN'
          : 'falta conectar Vercel Blob';
  return {
    ok: dbOk && st.mode !== 'missing',
    base_de_datos: database,
    base_de_datos_ok: dbOk,
    archivos,
    archivos_ok: st.mode !== 'missing',
    en_vercel: db.IS_VERCEL,
    demo: db.IS_DEMO,
    entorno: process.env.VERCEL_ENV || (db.IS_VERCEL ? 'vercel' : 'local'),
    version: pkg.version,
  };
}

module.exports = { systemStatus };
