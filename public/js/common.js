/* =========================================================================
   Portal académico · utilidades compartidas (estudiante + admin)
   ========================================================================= */
'use strict';

/* ---------- íconos (trazos estilo Lucide) ---------- */

const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  'calendar-plus': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v5M9.5 16.5h5"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  'cloud-upload': '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M12 12v9M16 16l-4-4-4 4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/>',
  'file-text': '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  video: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  presentation: '<path d="M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
  'arrow-left': '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  id: '<rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="8" cy="12" r="2.2"/><path d="M14 10h4M14 14h4M5.5 16.5c.6-1.2 1.5-1.8 2.5-1.8s1.9.6 2.5 1.8"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  // Logo: línea de mercado que sube hasta su máximo; la caída marca la barra de una "A" escondida.
  landmark: '<path d="M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M12 3l9 5H3z"/>',
  logo: '<path d="M3.6 21 L7.4 13.4 L10.2 15.6 L12.4 3.6 L20.4 21"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
  door: '<path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.56v16.16a.5.5 0 0 1-.6.49L5 19.66V5.4a1 1 0 0 1 .76-.97l6-1.5a1 1 0 0 1 1.24.97Z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
};

function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
}

/* ---------- texto ---------- */

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

/** Escapa el texto y convierte las URLs http(s) en enlaces. */
function linkify(text) {
  return esc(text).replace(/\bhttps?:\/\/[^\s<]+/g, (url) => {
    const clean = url.replace(/[.,;:!?)\]]+$/, '');
    return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${url.slice(clean.length)}`;
  });
}

function initials(name) {
  const parts = String(name || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(de|del|la|las|los|y|e|el|en|a|i|ii|iii|iv|v)$/i.test(w));
  if (!parts.length) return (name || '?').slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/* ---------- fechas ---------- */

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => toISO(new Date());
function parseISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

function fmtDate(s, style = 'long') {
  if (!s) return '';
  const d = parseISO(s);
  if (style === 'long') return `${DAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
  if (style === 'day') return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  if (style === 'medium') return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function daysUntil(s) {
  return Math.round((parseISO(s) - parseISO(todayISO())) / 86400000);
}

function relDay(s) {
  const n = daysUntil(s);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  if (n > 1) return n < 60 ? `En ${n} días` : `En ${Math.round(n / 30)} meses`;
  return -n < 60 ? `Hace ${-n} días` : fmtDate(s, 'medium');
}

function whenClass(s) {
  const n = daysUntil(s);
  if (n < 0) return 'past';
  if (n === 0) return 'today';
  if (n <= 7) return 'soon';
  return '';
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad2(m)} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

function timeRange(e) {
  if (e.start_time && e.end_time) return `${fmtTime(e.start_time)} – ${fmtTime(e.end_time)}`;
  if (e.start_time) return fmtTime(e.start_time);
  return '';
}

/** Fechas de SQLite ("YYYY-MM-DD HH:MM:SS" en UTC) → "hace 2 h". */
function timeAgo(sqlDate) {
  if (!sqlDate) return '';
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'justo ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) {
    const n = Math.floor(s / 86400);
    return n === 1 ? 'ayer' : `hace ${n} días`;
  }
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/* ---------- catálogos ---------- */

const EVENT_TYPES = {
  examen: { label: 'Examen', icon: 'clipboard', color: '#ef4444' },
  parcial: { label: 'Parcial', icon: 'file-text', color: '#f97316' },
  quiz: { label: 'Quiz', icon: 'zap', color: '#eab308' },
  entrega: { label: 'Entrega', icon: 'upload', color: '#0ea5e9' },
  exposicion: { label: 'Exposición', icon: 'presentation', color: '#8b5cf6' },
  otro: { label: 'Actividad', icon: 'star', color: '#64748b' },
  clase: { label: 'Clase', icon: 'book', color: '#64748b' },
};

const SUBJECT_COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b'];

const INLINE_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'mp3', 'ogg', 'wav', 'txt'];

function extOf(name) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

function fileKind(m) {
  if (m.kind === 'link') {
    const u = String(m.url || '');
    if (/youtube\.com|youtu\.be|vimeo\.com/i.test(u)) return { label: 'Video', icon: 'video', color: '#ef4444', ext: '' };
    if (/drive\.google|docs\.google/i.test(u)) return { label: 'Google Drive', icon: 'folder', color: '#10b981', ext: '' };
    return { label: 'Enlace', icon: 'link', color: '#0ea5e9', ext: '' };
  }
  const ext = extOf(m.original_name);
  const k = (label, ic, color) => ({ label, icon: ic, color, ext });
  if (ext === 'pdf') return k('PDF', 'file-text', '#ef4444');
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return k('Documento', 'file-text', '#2563eb');
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return k('Presentación', 'presentation', '#f97316');
  if (['xls', 'xlsx', 'xlsm', 'csv', 'ods'].includes(ext)) return k('Hoja de cálculo', 'sheet', '#16a34a');
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return k('Imagen', 'image', '#ec4899');
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return k('Video', 'video', '#8b5cf6');
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return k('Audio', 'music', '#06b6d4');
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return k('Comprimido', 'archive', '#a16207');
  if (['txt', 'md'].includes(ext)) return k('Texto', 'file-text', '#64748b');
  return k('Archivo', 'file', '#64748b');
}

/* ---------- API ---------- */

async function api(path, { method = 'GET', body, query } = {}) {
  let url = '/api' + path;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }
  const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new Error('No hay conexión con el servidor');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* sin cuerpo JSON */
  }
  if (res.status === 401 && !path.startsWith('/auth/')) {
    location.href = '/';
    throw new Error('Tu sesión expiró');
  }
  if (!res.ok) throw new Error((data && data.error) || 'Ocurrió un error');
  return data;
}

/** Subida con barra de progreso (multipart). */
function apiUpload(path, formData, { method = 'POST', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, '/api' + path);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      const data = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error((data && data.error) || `Error al subir (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Se perdió la conexión durante la subida'));
    xhr.send(formData);
  });
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    location.href = '/';
  }
}

/* ---------- tema ---------- */

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem('theme', t);
  } catch {
    /* modo privado */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#090b16' : '#f3f4fb');
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => (b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon')));
}

function bindThemeToggles(root = document) {
  root.querySelectorAll('[data-theme-toggle]').forEach((b) => {
    b.innerHTML = icon(currentTheme() === 'dark' ? 'sun' : 'moon');
    b.setAttribute('aria-label', 'Cambiar tema');
    b.title = 'Cambiar tema claro/oscuro';
    b.onclick = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });
}

/* ---------- toast ---------- */

function toast(message, type = 'success') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.setAttribute('role', 'status');
  t.innerHTML = `<span class="t-ico">${icon(type === 'error' ? 'x' : 'check')}</span><span>${esc(message)}</span>`;
  root.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 260);
  }, type === 'error' ? 4500 : 2800);
}

/* ---------- modales ---------- */

const modalStack = [];

function openModal({ title = '', body = '', footer = '', size = '', raw = null, onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">${
    raw !== null
      ? raw
      : `<div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn sm plain" data-close aria-label="Cerrar">${icon('x')}</button></div>
         <div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}`
  }</div>`;
  (document.getElementById('modal-root') || document.body).appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  const prevFocus = document.activeElement;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    const i = modalStack.indexOf(api_);
    if (i >= 0) modalStack.splice(i, 1);
    backdrop.classList.add('closing');
    setTimeout(() => {
      backdrop.remove();
      if (!modalStack.length) document.body.style.overflow = '';
      prevFocus?.focus?.({ preventScroll: true });
    }, 180);
    onClose?.();
  };
  const api_ = { el: backdrop.querySelector('.modal'), backdrop, close };
  modalStack.push(api_);

  let downOnBackdrop = false;
  backdrop.addEventListener('mousedown', (e) => (downOnBackdrop = e.target === backdrop));
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && downOnBackdrop) close();
    if (e.target.closest('[data-close]')) close();
  });
  setTimeout(() => {
    const f = api_.el.querySelector('[autofocus], .modal-body input:not([type=hidden]), .modal-body select, .modal-body textarea');
    if (f && window.matchMedia('(min-width: 641px)').matches) f.focus();
  }, 60);
  return api_;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close();
});

function confirmDialog({ title = '¿Estás seguro?', message = '', confirmLabel = 'Eliminar', danger = true } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = openModal({
      title,
      size: 'sm',
      body: `<p class="muted">${message}</p>`,
      footer: `<button type="button" class="btn btn-ghost" data-close>Cancelar</button>
               <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmLabel)}</button>`,
      onClose: () => !answered && resolve(false),
    });
    m.el.querySelector('[data-ok]').onclick = () => {
      answered = true;
      resolve(true);
      m.close();
    };
  });
}

/* ---------- formularios ---------- */

function optionsHtml(options, value) {
  const groups = new Map();
  for (const o of options) {
    const g = o.group || '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(o);
  }
  const opt = (o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`;
  let html = '';
  for (const [g, list] of groups) html += g ? `<optgroup label="${esc(g)}">${list.map(opt).join('')}</optgroup>` : list.map(opt).join('');
  return html;
}

function fieldHtml(f, values) {
  const v = values[f.name] ?? f.value ?? '';
  const id = `f-${f.name}-${Math.random().toString(36).slice(2, 7)}`;
  const req = f.required ? 'required' : '';
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
  const attrs = f.attrs || '';
  let control;
  switch (f.type) {
    case 'textarea':
      control = `<textarea class="textarea" id="${id}" name="${f.name}" rows="${f.rows || 4}" ${req} ${ph} ${attrs}>${esc(v)}</textarea>`;
      break;
    case 'select':
      control = `<select class="select" id="${id}" name="${f.name}" ${req} ${attrs}>${optionsHtml(f.options || [], v)}</select>`;
      break;
    case 'color': {
      const cur = v || SUBJECT_COLORS[0];
      control = `<input type="hidden" name="${f.name}" value="${esc(cur)}"><div class="swatches" role="radiogroup">${SUBJECT_COLORS.map(
        (c) => `<button type="button" class="swatch ${c === cur ? 'active' : ''}" style="--c:${c}" data-color="${c}" aria-label="Color ${c}"></button>`
      ).join('')}</div>`;
      break;
    }
    case 'toggle':
      control = `<label class="toggle"><input type="checkbox" name="${f.name}" ${v === true || v === 1 || v === '1' ? 'checked' : ''}><span class="track"></span><span>${esc(f.toggleLabel || '')}</span></label>`;
      break;
    case 'html':
      control = f.html;
      break;
    default:
      control = `<input class="input" type="${f.type || 'text'}" id="${id}" name="${f.name}" value="${esc(v)}" ${req} ${ph} ${attrs}>`;
  }
  if (f.type === 'hidden') return `<input type="hidden" name="${f.name}" value="${esc(v)}">`;
  return `<div class="field ${f.full ? 'full' : ''}">${f.label ? `<label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>` : ''}${control}${
    f.hint ? `<span class="hint">${f.hint}</span>` : ''
  }</div>`;
}

function fieldsHtml(fields, values = {}) {
  return `<div class="form-grid">${fields.map((f) => fieldHtml(f, values)).join('')}</div>`;
}

function bindFields(root) {
  root.querySelectorAll('.swatches').forEach((sw) => {
    sw.addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      sw.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === b));
      sw.parentElement.querySelector('input[type=hidden]').value = b.dataset.color;
    });
  });
}

function readFields(form, fields) {
  const out = {};
  for (const f of fields) {
    if (!f.name || f.type === 'html') continue;
    const el = form.querySelector(`[name="${f.name}"]`);
    if (!el) continue;
    out[f.name] = f.type === 'toggle' ? el.checked : el.value;
  }
  return out;
}

function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>${label ? ` ${esc(label)}` : ''}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.label || btn.innerHTML;
    btn.disabled = false;
  }
}

/**
 * Modal con formulario generado a partir de una lista de campos.
 * onSubmit(values) puede lanzar un Error para mostrar el mensaje en el modal.
 */
function formModal({ title, fields, values = {}, submitLabel = 'Guardar', onSubmit, size = '', intro = '', onDelete, deleteLabel = 'Eliminar', onMount }) {
  const m = openModal({
    title,
    size,
    raw: `<form novalidate>
      <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn sm plain" data-close aria-label="Cerrar">${icon('x')}</button></div>
      <div class="modal-body">
        ${intro}
        <div class="alert" data-error hidden></div>
        ${fieldsHtml(fields, values)}
      </div>
      <div class="modal-foot">
        ${onDelete ? `<button type="button" class="btn btn-danger-soft left" data-delete>${icon('trash')} <span class="hide-mobile">${esc(deleteLabel)}</span></button>` : ''}
        <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
      </div>
    </form>`,
  });
  const form = m.el.querySelector('form');
  const err = form.querySelector('[data-error]');
  bindFields(form);
  onMount?.(form, m);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    for (const f of fields) {
      if (!f.required) continue;
      const el = form.querySelector(`[name="${f.name}"]`);
      if (el && !String(el.value).trim()) {
        err.innerHTML = `${icon('alert')}<span>Completa el campo "${esc(f.label)}"</span>`;
        err.hidden = false;
        el.focus();
        return;
      }
    }
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Guardando…');
    try {
      await onSubmit(readFields(form, fields), m);
      m.close();
    } catch (ex) {
      err.innerHTML = `${icon('alert')}<span>${esc(ex.message)}</span>`;
      err.hidden = false;
      err.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } finally {
      setBusy(btn, false);
    }
  });

  if (onDelete) {
    form.querySelector('[data-delete]').onclick = async () => {
      try {
        const done = await onDelete(readFields(form, fields));
        if (done !== false) m.close();
      } catch (ex) {
        toast(ex.message, 'error');
      }
    };
  }
  return m;
}

/* ---------- componentes ---------- */

function emptyState({ icon: ic = 'sparkles', title, text = '', action = '', small = false }) {
  return `<div class="empty ${small ? 'sm' : ''}"><div class="e-ico">${icon(ic)}</div><h4>${esc(title)}</h4>${text ? `<p>${text}</p>` : ''}${action}</div>`;
}

function skeleton(blocks = [['100%', '180px'], ['100%', '96px'], ['100%', '260px']]) {
  return `<div class="loading-view">${blocks.map(([w, h]) => `<div class="skeleton" style="width:${w};height:${h}"></div>`).join('')}</div>`;
}

function eventColor(e) {
  return e.subject_color || (EVENT_TYPES[e.type] || EVENT_TYPES.otro).color;
}

function eventItem(e, { showSubject = true } = {}) {
  const t = EVENT_TYPES[e.type] || EVENT_TYPES.otro;
  const d = parseISO(e.date);
  const time = timeRange(e);
  return `<button type="button" class="event" style="--c:${eventColor(e)}" data-event-id="${e.id}">
    <div class="date-tile"><small>${MONTHS_SHORT[d.getMonth()]}</small><b>${d.getDate()}</b></div>
    <div class="info">
      <strong>${esc(e.title)}</strong>
      <div class="meta">
        <span class="badge" style="--c:${t.color}">${icon(t.icon)}${t.label}</span>
        ${showSubject && e.subject_name && e.type !== 'clase' ? `<span>${icon('book')}${esc(e.subject_name)}</span>` : ''}
        ${time ? `<span>${icon('clock')}${esc(time)}</span>` : ''}
        ${e.location ? `<span>${icon('pin')}${esc(e.location)}</span>` : ''}
      </div>
    </div>
    <div class="when"><span class="when-pill ${whenClass(e.date)}">${relDay(e.date)}</span></div>
  </button>`;
}

function materialItem(m, { admin = false, showSubject = false, showClass = true } = {}) {
  const k = fileKind(m);
  const fileUrl = m.file_url || `/api/materials/${m.id}/file`;
  const downloadUrl = fileUrl + (fileUrl.includes('?') ? '&' : '?') + 'download=1';
  const canView = m.kind === 'file' && INLINE_EXT.includes(k.ext);
  const meta = [
    `<span>${esc(k.label)}</span>`,
    m.size ? `<span class="dot-sep">${fmtSize(m.size)}</span>` : '',
    showSubject && m.subject_name ? `<span class="dot-sep">${esc(m.subject_name)}</span>` : '',
    showClass && m.class_title ? `<span class="dot-sep">${esc(m.class_title)}</span>` : '',
    `<span class="dot-sep">${timeAgo(m.created_at)}</span>`,
  ].join('');
  let actions;
  if (m.kind === 'link') {
    actions = `<a class="btn btn-soft btn-sm" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" title="Abrir enlace">${icon('external')}<span class="btn-label">Abrir</span></a>`;
  } else {
    actions =
      (canView ? `<a class="btn btn-ghost btn-sm" href="${esc(fileUrl)}" target="_blank" rel="noopener" title="Ver">${icon('eye')}<span class="btn-label">Ver</span></a>` : '') +
      `<a class="btn btn-soft btn-sm" href="${esc(downloadUrl)}" download="${esc(m.original_name || m.title)}" title="Descargar">${icon('download')}<span class="btn-label">Descargar</span></a>`;
  }
  if (admin) {
    actions += `<button type="button" class="icon-btn sm plain" data-edit-material="${m.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
                <button type="button" class="icon-btn sm plain danger" data-delete-material="${m.id}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>`;
  }
  return `<div class="material" style="--c:${k.color}">
    <div class="file-ico">${icon(k.icon)}${k.ext ? `<span class="ext">${esc(k.ext.slice(0, 4))}</span>` : ''}</div>
    <div class="info">
      <strong title="${esc(m.title)}">${esc(m.title)}</strong>
      <div class="meta">${meta}</div>
      ${m.description ? `<div class="desc">${esc(m.description)}</div>` : ''}
    </div>
    <div class="actions">${actions}</div>
  </div>`;
}

/** Ventana con el detalle de una evaluación. */
function showEventDetail(e, { onEdit, onDelete } = {}) {
  const t = EVENT_TYPES[e.type] || EVENT_TYPES.otro;
  const time = timeRange(e);
  const n = daysUntil(e.date);
  const m = openModal({
    raw: `<div class="event-detail-top" style="--c:${eventColor(e)}">
        <button type="button" class="icon-btn sm" data-close aria-label="Cerrar">${icon('x')}</button>
        <span class="badge">${icon(t.icon)}${t.label}</span>
        <h3>${esc(e.title)}</h3>
        <div>${e.subject_name ? esc(e.subject_name) : 'Actividad general'}${e.semester_name ? ` · ${esc(e.semester_name)}` : ''}</div>
      </div>
      <div class="modal-body">
        <div class="detail-list">
          <div class="d"><span class="t-ico">${icon('calendar')}</span><div><small>Fecha</small><strong>${cap(fmtDate(e.date))}</strong>
            <div><span class="when-pill ${whenClass(e.date)}" style="margin-top:6px">${n >= 0 ? relDay(e.date) : 'Ya pasó'}</span></div></div></div>
          ${time ? `<div class="d"><span class="t-ico">${icon('clock')}</span><div><small>Hora</small><strong>${esc(time)}</strong></div></div>` : ''}
          ${e.location ? `<div class="d"><span class="t-ico">${icon('pin')}</span><div><small>Lugar</small><strong>${esc(e.location)}</strong></div></div>` : ''}
          ${e.description ? `<div class="d"><span class="t-ico">${icon('info')}</span><div style="min-width:0"><small>Detalles</small><div class="rich">${linkify(e.description)}</div></div></div>` : ''}
        </div>
      </div>
      <div class="modal-foot">
        ${onDelete ? `<button type="button" class="btn btn-danger-soft left" data-del>${icon('trash')}</button>` : ''}
        ${e.subject_id && !onEdit ? `<a class="btn btn-ghost" href="#/materias/${e.subject_id}" data-close>${icon('book')} Ver materia</a>` : ''}
        ${onEdit ? `<button type="button" class="btn btn-primary" data-edit>${icon('edit')} Editar</button>` : `<button type="button" class="btn btn-primary" data-close>Listo</button>`}
      </div>`,
  });
  m.el.querySelector('[data-edit]')?.addEventListener('click', () => {
    m.close();
    onEdit(e);
  });
  m.el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (await onDelete(e)) m.close();
  });
  return m;
}

/* ---------- calendario ---------- */

/**
 * Calendario mensual con agenda del día y vista de lista.
 * opts.load(from, to) → Promise<eventos>
 */
class CalendarView {
  constructor(root, opts) {
    this.root = root;
    this.opts = opts;
    const t = new Date();
    this.year = t.getFullYear();
    this.month = t.getMonth();
    this.selected = todayISO();
    this.mode = sessionStorage.getItem('cal-mode') || 'month';
    try {
      this.showClasses = localStorage.getItem('cal-classes') !== '0';
    } catch {
      this.showClasses = true;
    }
    this.events = [];
    this.root.addEventListener('click', (e) => this.onClick(e));
  }

  range() {
    const first = new Date(this.year, this.month, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(this.year, this.month, 1 - offset);
    const days = new Date(this.year, this.month + 1, 0).getDate();
    const cells = Math.ceil((offset + days) / 7) * 7;
    const end = new Date(start);
    end.setDate(start.getDate() + cells - 1);
    return { start, end, cells };
  }

  async reload() {
    this.root.innerHTML = `<div class="skeleton" style="height:520px"></div>`;
    try {
      if (this.mode === 'list') {
        this.events = await this.opts.load(todayISO(), null);
      } else {
        const { start, end } = this.range();
        this.events = await this.opts.load(toISO(start), toISO(end));
      }
      this.render();
    } catch (err) {
      this.root.innerHTML = `<div class="card">${emptyState({ icon: 'alert', title: 'No se pudo cargar el calendario', text: esc(err.message) })}</div>`;
    }
  }

  /** Eventos visibles: las clases se pueden ocultar para ver solo evaluaciones. */
  visible() {
    return this.showClasses ? this.events : this.events.filter((e) => e.type !== 'clase');
  }

  eventsOn(iso) {
    // Primero las evaluaciones, luego las clases; dentro de cada grupo, por hora.
    return this.visible()
      .filter((e) => e.date === iso)
      .sort((a, b) => (a.type === 'clase') - (b.type === 'clase') || String(a.start_time || '').localeCompare(String(b.start_time || '')));
  }

  header() {
    return `<div class="cal-head">
      ${
        this.mode === 'month'
          ? `<button class="icon-btn sm" data-cal="prev" aria-label="Mes anterior">${icon('left')}</button>
             <button class="icon-btn sm" data-cal="next" aria-label="Mes siguiente">${icon('right')}</button>
             <h3>${cap(MONTHS[this.month])} ${this.year}</h3>
             <button class="btn btn-ghost btn-sm" data-cal="today">Hoy</button>`
          : `<h3>Próximas fechas</h3>`
      }
      ${
        this.events.some((e) => e.type === 'clase')
          ? `<button class="btn btn-ghost btn-sm cal-toggle ${this.showClasses ? 'on' : ''}" data-cal="classes" aria-pressed="${this.showClasses}" title="Mostrar u ocultar las clases">${icon(this.showClasses ? 'eye' : 'eye-off')}Clases</button>`
          : ''
      }
      <div class="tabs" style="padding:3px">
        <button class="tab ${this.mode === 'month' ? 'active' : ''}" data-cal="month" style="height:32px" aria-label="Vista mensual">${icon('grid')}</button>
        <button class="tab ${this.mode === 'list' ? 'active' : ''}" data-cal="list" style="height:32px" aria-label="Vista de lista">${icon('list')}</button>
      </div>
    </div>`;
  }

  render() {
    if (this.mode === 'list') return this.renderList();
    const { start, cells } = this.range();
    const today = todayISO();
    let grid = DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('');
    for (let i = 0; i < cells; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISO(d);
      const evs = this.eventsOn(iso);
      const cls = [
        'cal-day',
        d.getMonth() !== this.month ? 'out' : '',
        iso === today ? 'today' : '',
        iso === this.selected ? 'selected' : '',
        d.getDay() === 0 || d.getDay() === 6 ? 'weekend' : '',
      ].join(' ');
      const pills = evs
        .slice(0, 3)
        .map((e) => `<span class="cal-pill ${e.type === 'clase' ? 'is-class' : ''}" style="--c:${eventColor(e)}" data-event-id="${e.id}" title="${esc(e.title)}"><span>${esc(e.title)}</span></span>`)
        .join('');
      const more = evs.length > 3 ? `<span class="cal-more">+${evs.length - 3} más</span>` : '';
      const dots = evs.length ? `<span class="cal-dots">${evs.slice(0, 4).map((e) => `<i style="--c:${eventColor(e)}"></i>`).join('')}</span>` : '';
      grid += `<button type="button" class="${cls}" data-date="${iso}" aria-label="${fmtDate(iso, 'day')}${evs.length ? `, ${evs.length} evento(s)` : ''}"><span class="num">${d.getDate()}</span>${pills}${more}${dots}</button>`;
    }

    const subjects = new Map();
    for (const e of this.visible()) if (e.subject_name) subjects.set(e.subject_name, e.subject_color);
    const legend = [...subjects]
      .slice(0, 10)
      .map(([n, c]) => `<span><i style="--c:${c || '#64748b'}"></i>${esc(n)}</span>`)
      .join('');

    this.root.innerHTML = `<div class="cal-layout">
      <div class="card cal">
        ${this.header()}
        <div class="cal-grid">${grid}</div>
        ${legend ? `<div class="legend" style="margin-top:16px">${legend}</div>` : ''}
      </div>
      <div class="card agenda" data-agenda>${this.agendaHtml()}</div>
    </div>`;
  }

  agendaHtml() {
    const evs = this.eventsOn(this.selected);
    const extra = this.opts.agendaActions ? this.opts.agendaActions(this.selected) : '';
    const n = daysUntil(this.selected);
    const label = n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n === -1 ? 'Ayer' : 'Día seleccionado';
    return `<div class="agenda-head"><small>${label}</small><h3>${cap(fmtDate(this.selected, 'day'))}</h3></div>
      <div class="agenda-body stack-sm">
        ${evs.length ? `<div class="list">${evs.map((e) => eventItem(e)).join('')}</div>` : emptyState({ icon: 'calendar', title: 'Día libre', text: 'No hay evaluaciones ni actividades para este día.', small: true })}
        ${extra}
      </div>`;
  }

  renderList() {
    const groups = new Map();
    for (const e of this.visible()) {
      const d = parseISO(e.date);
      const key = `${cap(MONTHS[d.getMonth()])} ${d.getFullYear()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const body = groups.size
      ? [...groups]
          .map(([k, evs]) => `<div class="month-group"><h4>${k}</h4><div class="list">${evs.map((e) => eventItem(e)).join('')}</div></div>`)
          .join('')
      : emptyState({ icon: 'calendar', title: 'No hay fechas próximas', text: 'Cuando se programen evaluaciones aparecerán aquí.' });
    const extra = this.opts.agendaActions ? this.opts.agendaActions(todayISO()) : '';
    this.root.innerHTML = `<div class="card cal">${this.header()}<div class="stack">${body}</div>${extra ? `<div style="margin-top:16px">${extra}</div>` : ''}</div>`;
  }

  onClick(e) {
    const ctl = e.target.closest('[data-cal]');
    if (ctl && ctl !== this.root) {
      const a = ctl.dataset.cal;
      if (a === 'prev' || a === 'next') {
        this.month += a === 'prev' ? -1 : 1;
        if (this.month < 0) {
          this.month = 11;
          this.year--;
        } else if (this.month > 11) {
          this.month = 0;
          this.year++;
        }
        const first = new Date(this.year, this.month, 1);
        const sameMonth = parseISO(this.selected).getMonth() === this.month && parseISO(this.selected).getFullYear() === this.year;
        if (!sameMonth) this.selected = toISO(first);
        if (toISO(new Date()).slice(0, 7) === toISO(first).slice(0, 7)) this.selected = todayISO();
        this.reload();
      } else if (a === 'today') {
        const t = new Date();
        this.year = t.getFullYear();
        this.month = t.getMonth();
        this.selected = todayISO();
        this.reload();
      } else if (a === 'classes') {
        this.showClasses = !this.showClasses;
        try {
          localStorage.setItem('cal-classes', this.showClasses ? '1' : '0');
        } catch {
          /* sin almacenamiento */
        }
        this.render();
      } else if (a === 'month' || a === 'list') {
        if (this.mode === a) return;
        this.mode = a;
        sessionStorage.setItem('cal-mode', a);
        this.reload();
      }
      return;
    }
    const evEl = e.target.closest('[data-event-id]');
    const dayEl = e.target.closest('[data-date]');
    // En pantallas grandes, tocar una "píldora" abre la evaluación directamente.
    if (evEl && (evEl.classList.contains('event') || window.matchMedia('(min-width: 641px)').matches)) {
      const ev = this.events.find((x) => String(x.id) === evEl.dataset.eventId);
      if (ev) this.opts.onEvent(ev);
      return;
    }
    if (dayEl) {
      this.selected = dayEl.dataset.date;
      const d = parseISO(this.selected);
      if (d.getMonth() !== this.month) {
        this.year = d.getFullYear();
        this.month = d.getMonth();
        return this.reload();
      }
      this.root.querySelectorAll('.cal-day.selected').forEach((x) => x.classList.remove('selected'));
      dayEl.classList.add('selected');
      const ag = this.root.querySelector('[data-agenda]');
      ag.innerHTML = this.agendaHtml();
      if (window.matchMedia('(max-width: 1180px)').matches) ag.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

/* ---------- shell + router ---------- */

const Shell = {
  setTitle(title, sub = '') {
    const h = document.getElementById('page-title');
    const p = document.getElementById('page-sub');
    if (h) h.textContent = title;
    if (p) {
      p.textContent = sub;
      p.hidden = !sub;
    }
    document.title = `${title} · ${Shell.siteName || 'Portal académico'}`;
  },

  init({ nav, bottomNav, user, role, settings, onMore }) {
    Shell.siteName = settings.site_name;
    document.querySelectorAll('[data-site-name]').forEach((el) => (el.textContent = settings.site_name));
    document.querySelectorAll('[data-site-tagline]').forEach((el) => (el.textContent = settings.site_tagline || settings.university || ''));
    document.querySelectorAll('[data-brand-logo]').forEach((el) => (el.innerHTML = icon('logo')));

    const side = document.getElementById('side-nav');
    side.innerHTML = nav
      .map((n) =>
        n.section
          ? `<div class="nav-label">${esc(n.section)}</div>`
          : `<a class="nav-item" href="${n.href}" data-match="${n.match || n.href.slice(1)}">${icon(n.icon)}<span>${esc(n.label)}</span></a>`
      )
      .join('');

    const bottom = document.getElementById('bottom-nav');
    bottom.innerHTML = bottomNav
      .map((n) =>
        n.action
          ? `<button type="button" data-action="${n.action}" data-match="${(n.matches || []).join(' ')}"><span class="bn-ico">${icon(n.icon)}</span>${esc(n.label)}</button>`
          : `<a href="${n.href}" data-match="${n.match || n.href.slice(1)}"><span class="bn-ico">${icon(n.icon)}</span>${esc(n.label)}</a>`
      )
      .join('');
    bottom.querySelector('[data-action="more"]')?.addEventListener('click', onMore);

    const name = user.name || user.username || 'Estudiante';
    document.querySelectorAll('[data-user-name]').forEach((el) => (el.textContent = name));
    document.querySelectorAll('[data-user-role]').forEach((el) => (el.textContent = role));
    document.querySelectorAll('[data-user-avatar]').forEach((el) => (el.textContent = initials(name)));
    document.querySelectorAll('[data-logout]').forEach((b) => {
      b.innerHTML = b.innerHTML || icon('logout');
      b.onclick = async () => {
        if (await confirmDialog({ title: 'Cerrar sesión', message: '¿Quieres salir del portal?', confirmLabel: 'Salir', danger: false })) logout();
      };
    });
    bindThemeToggles();

    const topbar = document.querySelector('.topbar');
    const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
  },

  setActive(path) {
    document.querySelectorAll('[data-match]').forEach((el) => {
      const keys = el.dataset.match.split(' ').filter(Boolean);
      el.classList.toggle('active', keys.some((k) => path === k || path.startsWith(k + '/')));
    });
  },
};

const Router = {
  routes: [],
  token: 0,
  timers: [],
  on(pattern, handler) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$');
    this.routes.push({ re, keys, handler });
    return this;
  },
  /** Registra un intervalo que se limpia al cambiar de página. */
  interval(fn, ms) {
    this.timers.push(setInterval(fn, ms));
  },
  async resolve() {
    const path = decodeURI(location.hash.slice(1).split('?')[0]) || this.fallback;
    this.timers.forEach(clearInterval);
    this.timers = [];
    const token = ++this.token;
    for (const r of this.routes) {
      const m = path.match(r.re);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => (params[k] = m[i + 1]));
      Shell.setActive(path);
      // Contenedor nuevo en cada navegación: así no se acumulan listeners de páginas anteriores.
      const old = document.getElementById('view');
      const view = old.cloneNode(false);
      old.replaceWith(view);
      const ctx = {
        params,
        alive: () => token === this.token,
        render: (html) => {
          if (token !== this.token) return false;
          view.innerHTML = html;
          return true;
        },
      };
      window.scrollTo({ top: 0 });
      try {
        await r.handler(ctx);
      } catch (err) {
        console.error(err);
        ctx.render(`<div class="card">${emptyState({ icon: 'alert', title: 'Algo salió mal', text: esc(err.message), action: `<a class="btn btn-ghost" href="#${this.fallback}">Volver al inicio</a>` })}</div>`);
      }
      return;
    }
    location.hash = '#' + this.fallback;
  },
  start(fallback) {
    this.fallback = fallback;
    window.addEventListener('hashchange', () => {
      while (modalStack.length) modalStack[modalStack.length - 1].close();
      this.resolve();
    });
    this.resolve();
  },
  refresh() {
    this.resolve();
  },
};

/* ---------- vistas compartidas: materias ---------- */

function semesterChips(semesters, current, { all = true } = {}) {
  return `<div class="chips" role="tablist">
    ${all ? `<button class="chip ${current === 'all' ? 'active' : ''}" data-sem="all">${icon('layers')}Todos</button>` : ''}
    ${semesters.map((s) => `<button class="chip ${current === String(s.id) ? 'active' : ''}" data-sem="${s.id}">${esc(s.name)}</button>`).join('')}
  </div>`;
}

function subjectCard(s, { showCareer = false } = {}) {
  const next = s.next_event_date;
  const t = EVENT_TYPES[s.next_event_type] || EVENT_TYPES.examen;
  return `<a class="subject-card" href="#/materias/${s.id}" style="--c:${s.color || '#6366f1'}">
    <div class="subject-cover">
      ${s.code ? `<span class="badge">${esc(s.code)}</span>` : '<span></span>'}
      ${s.credits ? `<span class="badge">${s.credits} UC</span>` : ''}
    </div>
    <div class="subject-initials">${esc(initials(s.name))}</div>
    <div class="subject-body">
      <h3>${esc(s.name)}</h3>
      <div class="meta-list">
        ${s.professor ? `<span>${icon('user')}<em>${esc(s.professor)}</em></span>` : ''}
        ${s.schedule ? `<span>${icon('clock')}<em>${esc(s.schedule)}</em></span>` : ''}
        ${s.classroom ? `<span>${icon('pin')}<em>${esc(s.classroom)}</em></span>` : ''}
        ${showCareer && s.career_name ? `<span>${icon('landmark')}<em>${esc(s.career_name)} · ${esc(s.semester_name)}</em></span>` : ''}
        ${!showCareer && !s.professor && !s.schedule && !s.classroom ? `<span>${icon('layers')}<em>${esc(s.semester_name)}</em></span>` : ''}
      </div>
    </div>
    <div class="subject-foot">
      <span class="counter">${icon('folder')}${s.material_count}</span>
      <span class="counter">${icon('book')}${s.class_count}</span>
      ${next ? `<span class="badge" style="--c:${t.color}" title="${esc(s.next_event_title || '')}">${icon(t.icon)}${relDay(next)}</span>` : ''}
    </div>
  </a>`;
}

/** Enlace para llamar y, si el número trae código de país (+…), también para WhatsApp. */
function phoneLinks(phone) {
  const tel = String(phone).replace(/[^\d+]/g, '');
  const wa = tel.startsWith('+') ? `https://wa.me/${tel.slice(1)}` : '';
  return `<a href="tel:${esc(tel)}">${esc(phone)}</a>${wa ? ` · <a href="${esc(wa)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}`;
}

function subjectHero(s, { back = '#/materias', actions = '' } = {}) {
  const tiles = [
    s.professor && ['user', 'Profesor', esc(s.professor)],
    s.professor_phone && ['phone', 'Teléfono', phoneLinks(s.professor_phone)],
    s.schedule && ['clock', 'Horario', esc(s.schedule)],
    s.classroom && ['pin', 'Aula', esc(s.classroom)],
    s.credits && ['award', 'Créditos', `${s.credits} UC`],
  ].filter(Boolean);
  return `<section class="subject-hero" style="--c:${s.color || '#6366f1'}">
    <div class="row wrap">
      <a class="back" href="${back}">${icon('arrow-left')} Volver</a>
      <span class="spacer"></span>
      ${actions}
    </div>
    <div class="row wrap" style="margin-top:14px;gap:8px">
      ${s.career_name ? `<span class="badge">${icon('landmark')}${esc(s.career_name)}</span>` : ''}
      <span class="badge">${icon('layers')}${esc(s.semester_name)}</span>
      ${s.code ? `<span class="badge">${icon('hash')}${esc(s.code)}</span>` : ''}
    </div>
    <h2>${esc(s.name)}</h2>
    ${tiles.length ? `<div class="info-grid">${tiles.map(([ic, l, v]) => `<div class="info-tile"><span class="t-ico">${icon(ic)}</span><div style="min-width:0"><small>${l}</small><strong>${v}</strong></div></div>`).join('')}</div>` : ''}
  </section>`;
}

function classTimeline(s, { admin = false } = {}) {
  if (!s.classes.length) return null;
  const byClass = new Map();
  for (const m of s.materials) {
    if (!m.class_id) continue;
    if (!byClass.has(m.class_id)) byClass.set(m.class_id, []);
    byClass.get(m.class_id).push(m);
  }
  return `<div class="timeline" style="--c:${s.color || '#6366f1'}">${s.classes
    .map((c, i) => {
      const files = byClass.get(c.id) || [];
      return `<div class="tl-item"><div class="tl-card">
        <div class="tl-head">
          <div style="flex:1;min-width:0">
            <div class="tl-num">Clase ${i + 1}</div>
            <h4>${esc(c.title)}</h4>
            ${c.date ? `<div class="tl-date">${icon('calendar')}<span>${cap(fmtDate(c.date, 'day'))}</span></div>` : ''}
          </div>
          ${
            admin
              ? `<button type="button" class="icon-btn sm plain" data-edit-class="${c.id}" aria-label="Editar clase">${icon('edit')}</button>
                 <button type="button" class="icon-btn sm plain danger" data-delete-class="${c.id}" aria-label="Eliminar clase">${icon('trash')}</button>`
              : ''
          }
        </div>
        ${c.content ? `<div class="rich">${linkify(c.content)}</div>` : ''}
        ${
          files.length
            ? `<div class="tl-files">${files
                .map((m) => {
                  const k = fileKind(m);
                  const base = m.file_url || `/api/materials/${m.id}/file`;
                  const href = esc(m.kind === 'link' ? m.url : base + (INLINE_EXT.includes(k.ext) ? '' : (base.includes('?') ? '&' : '?') + 'download=1'));
                  return `<a class="tl-file" style="--fc:${k.color}" href="${href}" target="_blank" rel="noopener noreferrer">${icon(k.icon)}<span>${esc(m.title)}</span></a>`;
                })
                .join('')}</div>`
            : ''
        }
      </div></div>`;
    })
    .join('')}</div>`;
}


/* ---------- estructura: facultades y carreras ---------- */

/** <option> de carreras agrupadas por facultad. */
function careerOptionsHtml(structure, value, { allLabel = '', emptyLabel = '' } = {}) {
  let html = '';
  if (allLabel) html += `<option value="all" ${value === 'all' ? 'selected' : ''}>${esc(allLabel)}</option>`;
  if (emptyLabel) html += `<option value="" ${!value ? 'selected' : ''}>${esc(emptyLabel)}</option>`;
  for (const f of structure) {
    if (!f.careers.length) continue;
    html += `<optgroup label="${esc(f.name)}">${f.careers
      .map((c) => `<option value="${c.id}" ${String(value) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`)
      .join('')}</optgroup>`;
  }
  return html;
}

/** Carreras como opciones del formulario genérico (agrupadas por facultad). */
const careerFieldOptions = (structure) => structure.flatMap((f) => f.careers.map((c) => ({ value: c.id, label: c.name, group: f.name })));

function careerById(structure, careerId) {
  for (const f of structure) for (const c of f.careers) if (String(c.id) === String(careerId)) return { ...c, faculty: f };
  return null;
}

/** Selector de carrera para la barra de filtros. */
function careerPicker(structure, value, { allLabel = 'Todas las carreras' } = {}) {
  return `<label class="career-picker">${icon('landmark')}<select class="select" data-career aria-label="Carrera">${careerOptionsHtml(structure, value, { allLabel })}</select></label>`;
}
