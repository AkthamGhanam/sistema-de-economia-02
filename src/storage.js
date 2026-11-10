'use strict';

/**
 * Almacenamiento de los materiales:
 *  - "local": carpeta DATA_DIR/uploads (tu computadora, un VPS, Docker…).
 *  - "blob":  Vercel Blob privado. Se activa solo cuando existe BLOB_READ_WRITE_TOKEN.
 *    Los archivos se suben directo desde el navegador y se entregan a través del
 *    servidor, que comprueba la sesión antes de enviarlos.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { env, UPLOAD_DIR, IS_VERCEL, IS_DEMO } = require('./db');

// En modo demostración los archivos van a una carpeta temporal: nunca al Blob real.
const BLOB_TOKEN = IS_DEMO ? null : env('BLOB_READ_WRITE_TOKEN');
const MODE = BLOB_TOKEN ? 'blob' : IS_VERCEL && !IS_DEMO ? 'missing' : 'local';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || (MODE === 'blob' ? 100 : 50);

let blobSdk = null;
const blob = () => (blobSdk ||= require('@vercel/blob'));

const INLINE_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

function contentDisposition(type, filename) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

const isBlobFile = (m) => m && m.kind === 'file' && typeof m.url === 'string' && /^https:\/\//.test(m.url);

/**
 * Error al abrir un archivo. Los enlaces "Ver" y "Descargar" abren una pestaña nueva,
 * así que al navegador se le muestra una página legible en lugar de un JSON.
 */
function fileError(req, res, status, message) {
  res.status(status);
  if (req.accepts(['json', 'html']) === 'html') {
    const safe = String(message).replace(/[<>&]/g, '');
    return res.type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>No se pudo abrir el archivo</title>
<link rel="stylesheet" href="/css/styles.css"></head><body><div class="login-panel" style="min-height:100vh">
<div class="login-card"><h2>No se pudo abrir el archivo</h2><div class="alert warn"><span>${safe}</span></div>
<a class="btn btn-primary" href="/">Volver al portal</a></div></div></body></html>`);
  }
  return res.json({ error: message });
}

const BLOB_UNAVAILABLE =
  'Este archivo está guardado en Vercel Blob, pero el servidor que atendió la petición no tiene acceso a él. ' +
  'Ábrelo desde la dirección principal del portal (https://sistema-de-economia-02.vercel.app). ' +
  'Si estás usando el portal en tu computadora, agrega BLOB_READ_WRITE_TOKEN a tu archivo .env.';

/** Envía el archivo de un material al navegador (ver en línea o descargar). */
async function sendFile(req, res, m) {
  const name = m.original_name || m.file_name || 'archivo';
  const ext = path.extname(name).toLowerCase();
  const inlineType = INLINE_TYPES[ext];
  const inline = req.query.download !== '1' && inlineType;
  const headers = {
    'Content-Type': inline ? inlineType : 'application/octet-stream',
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', name),
    'X-Content-Type-Options': 'nosniff',
  };

  if (isBlobFile(m)) {
    let result;
    try {
      // Sin BLOB_READ_WRITE_TOKEN, en Vercel el SDK usa la conexión automática (OIDC) del Blob.
      result = await blob().get(m.url, {
        access: 'private',
        ...(BLOB_TOKEN ? { token: BLOB_TOKEN } : {}),
        ifNoneMatch: req.headers['if-none-match'] || undefined,
      });
    } catch (err) {
      console.error('No se pudo leer el archivo de Vercel Blob:', err.message);
      return fileError(req, res, 503, BLOB_UNAVAILABLE);
    }
    if (!result) return fileError(req, res, 404, 'El archivo ya no está disponible.');
    if (result.statusCode === 304) {
      res.set({ ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' });
      return res.status(304).end();
    }
    res.set({ ...headers, ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' });
    if (result.blob.size) res.set('Content-Length', String(result.blob.size));
    await new Promise((resolve, reject) => {
      Readable.fromWeb(result.stream).on('error', reject).pipe(res).on('finish', resolve).on('error', reject);
    });
    return;
  }

  const filePath = path.join(UPLOAD_DIR, path.basename(m.file_name || ''));
  if (!m.file_name || !fs.existsSync(filePath)) return fileError(req, res, 404, 'El archivo ya no está disponible.');
  res.set({ ...headers, 'Cache-Control': 'private, max-age=3600' });
  res.sendFile(filePath);
}

/** Borra los archivos (locales o en Blob) de los materiales indicados. */
async function removeFiles(rows) {
  const blobs = [];
  for (const r of rows) {
    if (!r || r.kind === 'link') continue;
    if (isBlobFile(r)) blobs.push(r.url);
    else if (r.file_name) fs.rm(path.join(UPLOAD_DIR, path.basename(r.file_name)), { force: true }, () => {});
  }
  if (blobs.length && BLOB_TOKEN) {
    try {
      await blob().del(blobs, { token: BLOB_TOKEN });
    } catch (err) {
      console.error('No se pudieron borrar algunos archivos de Blob:', err.message);
    }
  }
}

/** Guarda un archivo generado en el servidor (datos de ejemplo). */
async function saveBuffer(name, buffer, contentType) {
  if (MODE === 'blob') {
    const r = await blob().put(`materiales/demo/${name}`, buffer, {
      access: 'private',
      token: BLOB_TOKEN,
      contentType,
      addRandomSuffix: true,
    });
    return { file_name: r.pathname, url: r.url, size: buffer.length };
  }
  const stored = crypto.randomUUID() + path.extname(name).toLowerCase();
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buffer);
  return { file_name: stored, url: null, size: buffer.length };
}

/** Atiende la petición del navegador que pide permiso para subir a Blob. */
async function handleClientUpload(req) {
  const { handleUpload } = require('@vercel/blob/client');
  return handleUpload({
    token: BLOB_TOKEN,
    request: req,
    body: req.body,
    onBeforeGenerateToken: async (pathname) => {
      if (typeof pathname !== 'string' || !/^materiales\/\d+\/[^/]+$/.test(pathname)) {
        throw Object.assign(new Error('Ruta de archivo no permitida'), { status: 400 });
      }
      return {
        addRandomSuffix: true,
        maximumSizeInBytes: MAX_UPLOAD_MB * 1024 * 1024,
      };
    },
  });
}

/** Valida los datos de un archivo ya subido a Blob desde el navegador. */
function validBlobUpload(f) {
  if (!f || typeof f !== 'object') return false;
  let u;
  try {
    u = new URL(String(f.url));
  } catch {
    return false;
  }
  return (
    u.protocol === 'https:' &&
    u.hostname.endsWith('.blob.vercel-storage.com') &&
    u.pathname.startsWith('/materiales/') &&
    typeof f.pathname === 'string' &&
    f.pathname.startsWith('materiales/')
  );
}

/** Estado de la conexión de archivos (sin revelar secretos). */
function status() {
  return {
    mode: MODE,
    blob_token: !!BLOB_TOKEN,
    blob_store_id: !!env('BLOB_STORE_ID'),
  };
}

module.exports = {
  MODE,
  status,
  fileError,
  MAX_UPLOAD_MB,
  sendFile,
  removeFiles,
  saveBuffer,
  handleClientUpload,
  validBlobUpload,
  isBlobFile,
};
