/* =========================================================================
   Panel de administración
   ========================================================================= */
'use strict';

const A = { auth: null, settings: null, semesters: [], subjects: [], structure: [] };

async function refreshRefs() {
  [A.semesters, A.subjects, A.structure] = await Promise.all([api('/semesters'), api('/subjects'), api('/structure')]);
}

/** Semestres de una carrera ('all' o vacío = todos). */
const semestersOfCareer = (career) =>
  !career || career === 'all' ? A.semesters : A.semesters.filter((s) => String(s.career_id) === String(career));

const semesterOptions = (empty, career = 'all') => [
  ...(empty ? [{ value: '', label: empty }] : []),
  ...semestersOfCareer(career).map((s) => ({ value: s.id, label: s.name + (s.period ? ` (${s.period})` : ''), group: s.career_name || '' })),
];

const subjectOptions = (empty) => [
  ...(empty ? [{ value: '', label: empty }] : []),
  ...A.subjects.map((s) => ({ value: s.id, label: s.name, group: [s.career_name, s.semester_name].filter(Boolean).join(' · ') })),
];

function adminCareer() {
  const v = sessionStorage.getItem('admin-career') || 'all';
  return v === 'all' || careerById(A.structure, v) ? v : 'all';
}

function setAdminCareer(value) {
  sessionStorage.setItem('admin-career', value);
  sessionStorage.removeItem('admin-semester');
}

function adminSemester(career = adminCareer()) {
  const v = sessionStorage.getItem('admin-semester') || 'all';
  return v === 'all' || semestersOfCareer(career).some((s) => String(s.id) === v) ? v : 'all';
}

function adminSemChips(career, current) {
  const sems = semestersOfCareer(career);
  return `<div class="chips">
    <button class="chip ${current === 'all' ? 'active' : ''}" data-sem="all">${icon('layers')}Todos</button>
    ${sems
      .map(
        (s) =>
          `<button class="chip ${current === String(s.id) ? 'active' : ''}" data-sem="${s.id}">${esc(career === 'all' && s.career_name ? `${s.career_name} · ` : '')}${esc(s.name)}</button>`
      )
      .join('')}
  </div>`;
}

/** Consulta de eventos según carrera y semestre elegidos. */
const adminScope = (career, semester) => ({
  semester_id: semester !== 'all' ? semester : '',
  career_id: semester === 'all' && career !== 'all' ? career : '',
});

/** En formularios: el semestre depende de la carrera elegida. */
function wireCareerSemesterFields(form, emptyLabel) {
  const careerSel = form.querySelector('[name=career_id]');
  const semSel = form.querySelector('[name=semester_id]');
  if (!careerSel || !semSel) return;
  careerSel.addEventListener('change', () => {
    semSel.innerHTML = optionsHtml(semesterOptions(emptyLabel, careerSel.value || 'all'), '');
  });
}

/* =========================================================================
   Formularios
   ========================================================================= */

function semesterForm(sem) {
  formModal({
    title: sem ? 'Editar semestre' : 'Nuevo semestre',
    fields: [
      ...(A.structure.some((f) => f.careers.length)
        ? [{ name: 'career_id', label: 'Carrera', type: 'select', required: true, full: true, options: [{ value: '', label: 'Elige la carrera' }, ...careerFieldOptions(A.structure)] }]
        : []),
      { name: 'name', label: 'Nombre', required: true, placeholder: 'Ej: Semestre I' },
      { name: 'period', label: 'Período académico', placeholder: 'Ej: 2026-II' },
      { name: 'number', label: 'Número', type: 'number', placeholder: '1', attrs: 'min="1" max="20"' },
      { name: 'position', label: 'Orden en la lista', type: 'number', hint: 'Se ordenan de menor a mayor.' },
      { name: 'description', label: 'Descripción (opcional)', type: 'textarea', rows: 3, full: true, placeholder: 'Ej: Ciclo básico, sección 02, turno mañana…' },
    ],
    values: sem || {
      career_id: adminCareer() !== 'all' ? adminCareer() : '',
      position: semestersOfCareer(adminCareer()).length + 1,
      number: semestersOfCareer(adminCareer()).length + 1,
      name: `Semestre ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][semestersOfCareer(adminCareer()).length] || ''}`.trim(),
      period: A.settings.period || '',
    },
    submitLabel: sem ? 'Guardar cambios' : 'Crear semestre',
    onSubmit: async (v) => {
      await api(sem ? `/admin/semesters/${sem.id}` : '/admin/semesters', { method: sem ? 'PUT' : 'POST', body: v });
      toast(sem ? 'Semestre actualizado' : 'Semestre creado');
      await refreshRefs();
      Router.refresh();
    },
    onDelete: sem ? () => deleteSemester(sem) : null,
  });
}

function facultyForm(f) {
  formModal({
    title: f ? 'Editar facultad' : 'Nueva facultad',
    fields: [
      { name: 'name', label: 'Nombre de la facultad', required: true, full: true, placeholder: 'Ej: Facultad de Ciencias Económicas y Sociales' },
      { name: 'code', label: 'Siglas o código', placeholder: 'Ej: FACES' },
      { name: 'position', label: 'Orden', type: 'number', hint: 'Menor número = aparece primero.' },
      { name: 'color', label: 'Color', type: 'color', full: true },
      { name: 'description', label: 'Descripción (opcional)', type: 'textarea', rows: 3, full: true },
    ],
    values: f || { position: A.structure.length + 1, color: SUBJECT_COLORS[A.structure.length % SUBJECT_COLORS.length] },
    submitLabel: f ? 'Guardar cambios' : 'Crear facultad',
    onSubmit: async (v) => {
      await api(f ? `/admin/faculties/${f.id}` : '/admin/faculties', { method: f ? 'PUT' : 'POST', body: v });
      toast(f ? 'Facultad actualizada' : 'Facultad creada');
      Router.refresh();
    },
    onDelete: f ? () => deleteFaculty(f) : null,
  });
}

async function deleteFaculty(f) {
  const ok = await confirmDialog({ title: 'Eliminar facultad', message: `Se eliminará <strong>${esc(f.name)}</strong>. Solo se puede eliminar si ya no tiene carreras.` });
  if (!ok) return false;
  await api(`/admin/faculties/${f.id}`, { method: 'DELETE' });
  toast('Facultad eliminada');
  Router.refresh();
  return true;
}

function careerForm(c, facultyId) {
  formModal({
    title: c ? 'Editar carrera' : 'Nueva carrera',
    fields: [
      { name: 'faculty_id', label: 'Facultad', type: 'select', required: true, full: true, options: A.structure.map((f) => ({ value: f.id, label: f.name })) },
      { name: 'name', label: 'Nombre de la carrera', required: true, full: true, placeholder: 'Ej: Economía' },
      { name: 'code', label: 'Código', placeholder: 'Ej: ECO' },
      { name: 'position', label: 'Orden', type: 'number' },
      { name: 'color', label: 'Color', type: 'color', full: true },
      { name: 'description', label: 'Descripción (opcional)', type: 'textarea', rows: 3, full: true },
    ],
    values: c || { faculty_id: facultyId, position: ((A.structure.find((f) => String(f.id) === String(facultyId)) || { careers: [] }).careers.length || 0) + 1 },
    submitLabel: c ? 'Guardar cambios' : 'Crear carrera',
    onSubmit: async (v) => {
      await api(c ? `/admin/careers/${c.id}` : '/admin/careers', { method: c ? 'PUT' : 'POST', body: v });
      toast(c ? 'Carrera actualizada' : 'Carrera creada');
      Router.refresh();
    },
    onDelete: c ? () => deleteCareer(c) : null,
  });
}

async function deleteCareer(c) {
  const ok = await confirmDialog({ title: 'Eliminar carrera', message: `Se eliminará <strong>${esc(c.name)}</strong>. Solo se puede eliminar si ya no tiene semestres.` });
  if (!ok) return false;
  await api(`/admin/careers/${c.id}`, { method: 'DELETE' });
  toast('Carrera eliminada');
  Router.refresh();
  return true;
}

async function deleteSemester(sem) {
  const ok = await confirmDialog({
    title: 'Eliminar semestre',
    message: `Se eliminará <strong>${esc(sem.name)}</strong> con sus ${sem.subject_count || 0} materia(s), clases, materiales y evaluaciones. Esta acción no se puede deshacer.`,
  });
  if (!ok) return false;
  await api(`/admin/semesters/${sem.id}`, { method: 'DELETE' });
  toast('Semestre eliminado');
  await refreshRefs();
  Router.refresh();
  return true;
}

function subjectForm(sub, { semesterId } = {}) {
  if (!A.semesters.length) {
    toast('Primero crea un semestre', 'error');
    location.hash = '#/semestres';
    return;
  }
  formModal({
    title: sub ? 'Editar materia' : 'Nueva materia',
    size: 'lg',
    fields: [
      { name: 'name', label: 'Nombre de la materia', required: true, placeholder: 'Ej: Microeconomía I', full: true },
      { name: 'semester_id', label: 'Semestre', type: 'select', required: true, options: semesterOptions() },
      { name: 'code', label: 'Código', placeholder: 'Ej: ECO-201' },
      { name: 'color', label: 'Color', type: 'color', full: true },
      { name: 'professor', label: 'Profesor(a)', placeholder: 'Ej: Prof. Ana Rodríguez' },
      {
        name: 'professor_phone',
        label: 'Teléfono del profesor',
        type: 'tel',
        placeholder: 'Ej: +58 414 123 4567',
        attrs: 'inputmode="tel" autocomplete="off"',
        hint: 'Con el código de país (+58, +57…) también aparece el botón de WhatsApp.',
      },
      { name: 'schedule', label: 'Horario', placeholder: 'Ej: Lun y Mié · 8:00 a 9:30 a. m.' },
      { name: 'classroom', label: 'Aula / modalidad', placeholder: 'Ej: Aula 12 · Edificio B' },
      { name: 'credits', label: 'Créditos (UC)', type: 'number', attrs: 'min="0" max="30"' },
      { name: 'position', label: 'Orden', type: 'number', hint: 'Opcional. Menor número = aparece primero.' },
      {
        name: 'description',
        label: 'Información de la materia',
        type: 'textarea',
        rows: 7,
        full: true,
        placeholder: 'Objetivos, contenido programático, bibliografía, forma de evaluación, grupo de WhatsApp…',
        hint: 'Los enlaces (https://…) se convierten en botones clicables para los estudiantes.',
      },
    ],
    values: sub || {
      semester_id: semesterId || (adminSemester() !== 'all' ? adminSemester() : (semestersOfCareer(adminCareer())[0] || A.semesters[0] || {}).id),
      color: SUBJECT_COLORS[A.subjects.length % SUBJECT_COLORS.length],
    },
    submitLabel: sub ? 'Guardar cambios' : 'Crear materia',
    onSubmit: async (v) => {
      const saved = await api(sub ? `/admin/subjects/${sub.id}` : '/admin/subjects', { method: sub ? 'PUT' : 'POST', body: v });
      toast(sub ? 'Materia actualizada' : 'Materia creada');
      await refreshRefs();
      if (!sub) location.hash = `#/materias/${saved.id}`;
      else Router.refresh();
    },
    onDelete: sub ? () => deleteSubject(sub) : null,
  });
}

async function deleteSubject(sub, { goBack = false } = {}) {
  const ok = await confirmDialog({
    title: 'Eliminar materia',
    message: `Se eliminará <strong>${esc(sub.name)}</strong> con todas sus clases, materiales y evaluaciones. Esta acción no se puede deshacer.`,
  });
  if (!ok) return false;
  await api(`/admin/subjects/${sub.id}`, { method: 'DELETE' });
  toast('Materia eliminada');
  await refreshRefs();
  if (goBack || location.hash.startsWith('#/materias/')) location.hash = '#/materias';
  else Router.refresh();
  return true;
}

function classForm(cls, subjectId, nextNumber = 1) {
  formModal({
    title: cls ? 'Editar clase' : 'Registrar clase',
    size: 'lg',
    fields: [
      { name: 'title', label: 'Título / tema', required: true, placeholder: `Ej: Clase ${nextNumber}: Oferta y demanda`, full: true },
      { name: 'date', label: 'Fecha', type: 'date' },
      { name: 'subject_id', type: 'hidden' },
      {
        name: 'content',
        label: 'Contenido de la clase',
        type: 'textarea',
        rows: 9,
        full: true,
        placeholder: 'Temas vistos, ejercicios, tareas asignadas, lecturas para la próxima clase…',
        hint: 'Puedes adjuntar archivos a esta clase desde la pestaña “Materiales”.',
      },
    ],
    values: cls || { subject_id: subjectId, date: todayISO() },
    submitLabel: cls ? 'Guardar cambios' : 'Registrar clase',
    onSubmit: async (v) => {
      v.subject_id = subjectId;
      await api(cls ? `/admin/classes/${cls.id}` : '/admin/classes', { method: cls ? 'PUT' : 'POST', body: v });
      toast(cls ? 'Clase actualizada' : 'Clase registrada');
      Router.refresh();
    },
    onDelete: cls ? () => deleteClass(cls) : null,
  });
}

async function deleteClass(cls) {
  const ok = await confirmDialog({
    title: 'Eliminar clase',
    message: `Se eliminará la clase <strong>${esc(cls.title)}</strong>. Los materiales adjuntos se conservan en la materia.`,
  });
  if (!ok) return false;
  await api(`/admin/classes/${cls.id}`, { method: 'DELETE' });
  toast('Clase eliminada');
  Router.refresh();
  return true;
}

function eventForm(ev, { date, subjectId } = {}) {
  formModal({
    title: ev ? 'Editar evaluación' : 'Programar evaluación',
    size: 'lg',
    fields: [
      { name: 'title', label: 'Título', required: true, placeholder: 'Ej: Primer parcial', full: true },
      { name: 'type', label: 'Tipo', type: 'select', options: Object.entries(EVENT_TYPES).map(([k, t]) => ({ value: k, label: t.label })) },
      { name: 'subject_id', label: 'Materia', type: 'select', options: subjectOptions('General (sin materia)') },
      { name: 'date', label: 'Fecha', type: 'date', required: true },
      { name: 'location', label: 'Lugar', placeholder: 'Ej: Aula 12 o “En línea”' },
      { name: 'start_time', label: 'Hora de inicio', type: 'time' },
      { name: 'end_time', label: 'Hora de fin', type: 'time' },
      {
        name: 'description',
        label: 'Detalles',
        type: 'textarea',
        rows: 4,
        full: true,
        placeholder: 'Temas que entran, porcentaje de la nota, materiales permitidos…',
      },
    ],
    values: ev || { type: 'examen', date: date || todayISO(), subject_id: subjectId || '' },
    submitLabel: ev ? 'Guardar cambios' : 'Programar',
    onSubmit: async (v) => {
      await api(ev ? `/admin/events/${ev.id}` : '/admin/events', { method: ev ? 'PUT' : 'POST', body: v });
      toast(ev ? 'Evaluación actualizada' : 'Evaluación programada');
      Router.refresh();
    },
    onDelete: ev ? () => deleteEvent(ev) : null,
  });
}

async function deleteEvent(ev) {
  const ok = await confirmDialog({ title: 'Eliminar evaluación', message: `Se eliminará <strong>${esc(ev.title)}</strong> del calendario.` });
  if (!ok) return false;
  await api(`/admin/events/${ev.id}`, { method: 'DELETE' });
  toast('Evaluación eliminada');
  Router.refresh();
  return true;
}

/** Carga el horario semanal y crea una sesión "Clase" por cada día del período. */
function scheduleForm() {
  const fields = [
    {
      name: 'text',
      label: 'Horario (una línea por clase)',
      type: 'textarea',
      rows: 6,
      required: true,
      full: true,
      placeholder: 'Lunes 07:20-10:20 CB1103 Introducción a la Matemática\nJueves 10:25-13:25 CB1102 Introducción a la Economía',
      hint: 'Formato: <b>Día HH:MM-HH:MM CÓDIGO Nombre</b>. Si la materia ya existe en el portal con ese código, la clase toma su color.',
    },
    { name: 'from', label: 'Primer día de clases', type: 'date', required: true },
    { name: 'to', label: 'Último día de clases', type: 'date', required: true },
    { name: 'replace', type: 'toggle', toggleLabel: 'Reemplazar estas mismas clases si ya las habías cargado en esas fechas', full: true },
  ];
  formModal({
    title: 'Cargar horario de clases',
    size: 'lg',
    intro: `<div class="alert info">${icon('info')}<span>Se crea una clase en el calendario por cada semana del período. Las clases no aparecen en "Próximas evaluaciones" y los estudiantes pueden ocultarlas con el botón <b>Clases</b> del calendario.</span></div>`,
    fields,
    values: { from: todayISO(), replace: true },
    submitLabel: 'Agregar al calendario',
    deleteLabel: 'Quitar clases del período',
    onSubmit: async (v) => {
      const r = await api('/admin/events/schedule', { method: 'POST', body: v });
      toast(`${r.created} clases agregadas${r.deleted ? ` (${r.deleted} reemplazadas)` : ''}`);
      Router.refresh();
      if (r.errors.length) {
        openModal({
          title: `${r.errors.length} línea(s) no se pudieron leer`,
          body: `<div class="list">${r.errors
            .map((e) => `<div class="admin-row"><span class="badge neutral">Línea ${e.line}</span><div class="info"><strong>${esc(e.text)}</strong><span>${esc(e.reason)}</span></div></div>`)
            .join('')}</div>`,
          footer: `<button class="btn btn-primary" data-close>Entendido</button>`,
        });
      }
    },
    onDelete: async (v) => {
      if (!v.from || !v.to) {
        toast('Elige primero el período (primer y último día)', 'error');
        return false;
      }
      const ok = await confirmDialog({
        title: 'Quitar clases',
        message: `Se quitarán del calendario todas las clases entre el <strong>${esc(fmtDate(v.from, 'medium'))}</strong> y el <strong>${esc(fmtDate(v.to, 'medium'))}</strong>. Las evaluaciones no se tocan.`,
        confirmLabel: 'Quitar clases',
      });
      if (!ok) return false;
      const r = await api('/admin/events/classes', { method: 'DELETE', query: { from: v.from, to: v.to } });
      toast(`${r.deleted} clases quitadas`);
      Router.refresh();
      return true;
    },
  });
}

function openEvent(ev) {
  showEventDetail(ev, { onEdit: (e) => eventForm(e), onDelete: (e) => deleteEvent(e) });
}

/* ----- materiales ----- */

async function classOptionsFor(subjectId) {
  if (!subjectId) return [{ value: '', label: 'Sin clase específica' }];
  const s = await api(`/subjects/${subjectId}`);
  return [{ value: '', label: 'Sin clase específica' }, ...s.classes.map((c, i) => ({ value: c.id, label: `Clase ${i + 1}: ${c.title}` }))];
}

async function wireClassSelect(form, classId) {
  const subjectSel = form.querySelector('[name=subject_id]');
  const classSel = form.querySelector('[name=class_id]');
  const update = async (keep) => {
    classSel.disabled = true;
    try {
      const opts = await classOptionsFor(subjectSel.value);
      classSel.innerHTML = optionsHtml(opts, keep || '');
    } finally {
      classSel.disabled = false;
    }
  };
  subjectSel.addEventListener('change', () => update(''));
  await update(classId);
}

function uploadModal({ subjectId, classId } = {}) {
  if (!A.subjects.length) {
    toast('Primero crea una materia', 'error');
    return;
  }
  const sid = subjectId || A.subjects[0].id;
  const m = openModal({
    title: 'Subir material de apoyo',
    size: 'lg',
    raw: `<form novalidate>
      <div class="modal-head"><h3>Subir material de apoyo</h3><button type="button" class="icon-btn sm plain" data-close aria-label="Cerrar">${icon('x')}</button></div>
      <div class="modal-body">
        <div class="alert" data-error hidden></div>
        <div class="form-grid">
          <div class="field"><label>Materia *</label><select class="select" name="subject_id">${optionsHtml(subjectOptions(), sid)}</select></div>
          <div class="field"><label>Clase (opcional)</label><select class="select" name="class_id"><option value="">Cargando…</option></select></div>
        </div>
        <div class="segmented" data-kind>
          <span class="seg-indicator"></span>
          <button type="button" class="active" data-k="file">${icon('upload')} Archivos</button>
          <button type="button" data-k="link">${icon('link')} Enlace</button>
        </div>
        <div data-file-zone class="stack-sm">
          <label class="dropzone" data-dropzone>
            <input type="file" multiple hidden data-files>
            <span class="dz-icon">${icon('cloud-upload')}</span>
            <strong>Arrastra los archivos aquí o toca para elegir</strong>
            <span class="small">PDF, Word, PowerPoint, Excel, imágenes, videos… Puedes elegir varios a la vez.</span>
          </label>
          <div class="file-list" data-file-list></div>
        </div>
        <div data-link-zone hidden class="field">
          <label>Enlace *</label>
          <div class="input-icon">${icon('link')}<input class="input" name="url" type="url" placeholder="https://drive.google.com/… o https://youtube.com/…"></div>
          <span class="hint">Ideal para videos de YouTube, carpetas de Drive, artículos o simuladores.</span>
        </div>
        <div class="form-grid">
          <div class="field full"><label>Título</label><input class="input" name="title" placeholder="Si lo dejas vacío se usa el nombre del archivo"></div>
          <div class="field full"><label>Descripción (opcional)</label><textarea class="textarea" name="description" rows="3" placeholder="Ej: Guía de ejercicios para el primer parcial"></textarea></div>
        </div>
        <div data-progress hidden>
          <div class="row small muted" style="justify-content:space-between"><span>Subiendo…</span><span data-pct>0%</span></div>
          <div style="height:8px;border-radius:99px;background:var(--surface-3);overflow:hidden;margin-top:6px"><div data-bar style="height:100%;width:0;background:var(--grad);transition:width .2s"></div></div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary">${icon('upload')} Subir</button>
      </div>
    </form>`,
  });

  const form = m.el.querySelector('form');
  const err = form.querySelector('[data-error]');
  const input = form.querySelector('[data-files]');
  const list = form.querySelector('[data-file-list]');
  const dz = form.querySelector('[data-dropzone]');
  let files = [];
  let kind = 'file';
  wireClassSelect(form, classId);

  const seg = form.querySelector('[data-kind]');
  const ind = seg.querySelector('.seg-indicator');
  const moveInd = () => {
    const a = seg.querySelector('button.active');
    ind.style.width = `${a.offsetWidth}px`;
    ind.style.transform = `translateX(${a.offsetLeft - 5}px)`;
  };
  requestAnimationFrame(moveInd);
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    kind = b.dataset.k;
    seg.querySelectorAll('[data-k]').forEach((x) => x.classList.toggle('active', x === b));
    form.querySelector('[data-file-zone]').hidden = kind !== 'file';
    form.querySelector('[data-link-zone]').hidden = kind !== 'link';
    form.querySelector('[name=title]').placeholder = kind === 'file' ? 'Si lo dejas vacío se usa el nombre del archivo' : 'Ej: Video explicativo de elasticidad';
    moveInd();
  });

  const drawFiles = () => {
    list.innerHTML = files
      .map((f, i) => {
        const k = fileKind({ kind: 'file', original_name: f.name });
        return `<div class="file-chip" style="--c:${k.color}"><span style="color:${k.color}">${icon(k.icon)}</span><span class="name">${esc(f.name)}</span><span class="muted">${fmtSize(f.size)}</span><button type="button" class="icon-btn sm plain" data-rm="${i}" aria-label="Quitar">${icon('x')}</button></div>`;
      })
      .join('');
  };
  const addFiles = (fl) => {
    files = files.concat([...fl]).slice(0, 20);
    drawFiles();
  };
  input.addEventListener('change', () => {
    addFiles(input.files);
    input.value = '';
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    files.splice(Number(b.dataset.rm), 1);
    drawFiles();
  });
  ['dragenter', 'dragover'].forEach((t) =>
    dz.addEventListener(t, (e) => {
      e.preventDefault();
      dz.classList.add('drag');
    })
  );
  ['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, () => dz.classList.remove('drag')));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  let storageMode = A.settings.storage || 'local';
  let maxMb = Number(A.settings.max_upload_mb) || 50;
  const applyStorage = () => {
    form.querySelector('[data-blob-warn]')?.remove();
    if (storageMode !== 'missing') return;
    form.querySelector('[data-file-zone]').insertAdjacentHTML(
      'afterbegin',
      `<div class="alert warn" data-blob-warn>${icon('alert')}<span>Para guardar archivos en Vercel falta conectar <strong>Vercel Blob</strong> (Storage → Blob, acceso privado). Si ya lo conectaste, recarga la página con Ctrl + Shift + R. Mientras tanto puedes agregar enlaces.</span></div>`
    );
  };
  /** Pregunta de nuevo al servidor: la página pudo abrirse antes de conectar Blob. */
  const refreshStorage = async () => {
    try {
      A.settings = await api('/admin/settings');
      storageMode = A.settings.storage || 'local';
      maxMb = Number(A.settings.max_upload_mb) || 50;
    } catch {
      /* se conserva lo que ya sabíamos */
    }
    applyStorage();
  };
  applyStorage();
  refreshStorage();

  const showError = (msg) => {
    err.innerHTML = `${icon('alert')}<span>${esc(msg)}</span>`;
    err.hidden = false;
  };
  const setProgress = (p) => {
    const pct = `${Math.min(100, Math.round(p * 100))}%`;
    form.querySelector('[data-bar]').style.width = pct;
    form.querySelector('[data-pct]').textContent = pct;
  };

  /** Sube los archivos directo del navegador a Vercel Blob (privado) y devuelve sus datos. */
  async function uploadToBlob(subjectId) {
    if (!window.VercelBlob) throw new Error('No se pudo cargar el módulo de subida. Recarga la página.');
    const out = [];
    for (const [i, f] of files.entries()) {
      const safe = f.name.normalize('NFC').replace(/[\\/#?%*:|"<>]/g, '_');
      const res = await window.VercelBlob.upload(`materiales/${subjectId}/${safe}`, f, {
        access: 'private',
        handleUploadUrl: '/api/admin/blob-upload',
        multipart: f.size > 8 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress((i + percentage / 100) / files.length),
      });
      out.push({ url: res.url, pathname: res.pathname, name: f.name, size: f.size, contentType: res.contentType || f.type });
    }
    return out;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const subjectId = form.querySelector('[name=subject_id]').value;
    const base = {
      subject_id: subjectId,
      class_id: form.querySelector('[name=class_id]').value,
      title: form.querySelector('[name=title]').value,
      description: form.querySelector('[name=description]').value,
      kind,
    };
    const url = form.querySelector('[name=url]').value.trim();
    if (kind === 'file') {
      if (!files.length) return showError('Selecciona al menos un archivo');
      if (storageMode === 'missing') await refreshStorage();
      if (storageMode === 'missing') return showError('Falta conectar Vercel Blob para guardar archivos. Si ya lo conectaste, recarga la página (Ctrl + Shift + R).');
      const big = files.find((f) => f.size > maxMb * 1024 * 1024);
      if (big) return showError(`"${big.name}" supera el máximo de ${maxMb} MB`);
    } else if (!url) {
      return showError('Escribe el enlace');
    }

    const btn = form.querySelector('[type=submit]');
    const prog = form.querySelector('[data-progress]');
    setBusy(btn, true, 'Subiendo…');
    prog.hidden = kind !== 'file';
    setProgress(0);
    try {
      let created;
      if (kind === 'link') {
        created = await api('/admin/materials', { method: 'POST', body: { ...base, url } });
      } else if (storageMode === 'blob') {
        const uploaded = await uploadToBlob(subjectId);
        created = await api('/admin/materials', { method: 'POST', body: { ...base, files: uploaded } });
      } else {
        const fd = new FormData();
        for (const [k, v] of Object.entries(base)) fd.append(k, v);
        files.forEach((f) => fd.append('files', f, f.name));
        created = await apiUpload('/admin/materials', fd, { onProgress: setProgress });
      }
      toast(created.length > 1 ? `${created.length} materiales subidos` : 'Material publicado');
      m.close();
      Router.refresh();
    } catch (ex) {
      showError(ex.message);
      prog.hidden = true;
      setBusy(btn, false);
    }
  });
}

function materialEditForm(mat) {
  const fields = [
    { name: 'title', label: 'Título', required: true, full: true },
    { name: 'subject_id', label: 'Materia', type: 'select', options: subjectOptions() },
    { name: 'class_id', label: 'Clase', type: 'select', options: [{ value: '', label: 'Cargando…' }] },
    ...(mat.kind === 'link' ? [{ name: 'url', label: 'Enlace', type: 'url', required: true, full: true }] : []),
    { name: 'description', label: 'Descripción', type: 'textarea', rows: 3, full: true },
  ];
  formModal({
    title: 'Editar material',
    fields,
    values: mat,
    intro: mat.kind === 'file' ? `<div class="alert info">${icon('file')}<span>Archivo: <strong>${esc(mat.original_name || '')}</strong> (${fmtSize(mat.size)}). Para reemplazarlo, elimina este material y sube el nuevo.</span></div>` : '',
    onMount: (form) => wireClassSelect(form, mat.class_id),
    onSubmit: async (v) => {
      await api(`/admin/materials/${mat.id}`, { method: 'PUT', body: v });
      toast('Material actualizado');
      Router.refresh();
    },
    onDelete: () => deleteMaterial(mat),
  });
}

async function deleteMaterial(mat) {
  const ok = await confirmDialog({ title: 'Eliminar material', message: `Se eliminará <strong>${esc(mat.title)}</strong>. Los estudiantes ya no podrán descargarlo.` });
  if (!ok) return false;
  await api(`/admin/materials/${mat.id}`, { method: 'DELETE' });
  toast('Material eliminado');
  Router.refresh();
  return true;
}

function bindMaterialActions(root, materials) {
  root.addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit-material]');
    const del = e.target.closest('[data-delete-material]');
    const list = typeof materials === 'function' ? materials() : materials;
    const find = (id) => list.find((m) => String(m.id) === id);
    if (ed) materialEditForm(find(ed.dataset.editMaterial));
    if (del) deleteMaterial(find(del.dataset.deleteMaterial)).catch((ex) => toast(ex.message, 'error'));
  });
}

function bindEventItems(root, events) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('.event[data-event-id]');
    if (!el) return;
    const ev = events.find((x) => String(x.id) === el.dataset.eventId);
    if (ev) openEvent(ev);
  });
}

/* ----- estudiantes ----- */

function studentForm(st) {
  formModal({
    title: st ? 'Editar estudiante' : 'Agregar estudiante',
    fields: [
      { name: 'cedula', label: 'Cédula', required: true, placeholder: 'Ej: 12345678', attrs: 'inputmode="numeric"' },
      { name: 'email', label: 'Correo', type: 'email', required: true, placeholder: 'estudiante@correo.com' },
      { name: 'name', label: 'Nombre y apellido', placeholder: 'Ej: María Pérez', full: true },
      { name: 'career_id', label: 'Carrera', type: 'select', options: [{ value: '', label: 'Sin definir' }, ...careerFieldOptions(A.structure)] },
      { name: 'semester_id', label: 'Semestre', type: 'select', options: semesterOptions('Sin definir', st ? st.career_id : adminCareer()) },
      { name: 'active', type: 'toggle', toggleLabel: 'Acceso activo (puede ingresar al portal)', full: true },
    ],
    values: st || { active: true, career_id: adminCareer() !== 'all' ? adminCareer() : '', semester_id: adminSemester() !== 'all' ? adminSemester() : '' },
    onMount: (form) => wireCareerSemesterFields(form, 'Sin definir'),
    submitLabel: st ? 'Guardar cambios' : 'Agregar',
    onSubmit: async (v) => {
      await api(st ? `/admin/students/${st.id}` : '/admin/students', { method: st ? 'PUT' : 'POST', body: v });
      toast(st ? 'Estudiante actualizado' : 'Estudiante agregado');
      Router.refresh();
    },
    onDelete: st ? () => deleteStudent(st) : null,
  });
}

async function deleteStudent(st) {
  const ok = await confirmDialog({ title: 'Eliminar estudiante', message: `<strong>${esc(st.name || st.cedula)}</strong> ya no podrá ingresar al portal.` });
  if (!ok) return false;
  await api(`/admin/students/${st.id}`, { method: 'DELETE' });
  toast('Estudiante eliminado');
  Router.refresh();
  return true;
}

function importForm() {
  formModal({
    title: 'Importar lista de estudiantes',
    size: 'lg',
    intro: `<div class="alert info">${icon('info')}<span>Pega una línea por estudiante con <strong>cédula, correo y nombre</strong> separados por coma, punto y coma o tabulación (puedes copiar y pegar directo desde Excel o Google Sheets). Si la cédula ya existe, se actualizan sus datos.</span></div>`,
    fields: [
      {
        name: 'text',
        label: 'Lista',
        type: 'textarea',
        rows: 10,
        required: true,
        full: true,
        placeholder: '12345678, maria.perez@correo.com, María Pérez\n23456789; jose.gomez@correo.com; José Gómez',
      },
      { name: 'career_id', label: 'Asignar a la carrera', type: 'select', options: [{ value: '', label: 'No cambiar / sin definir' }, ...careerFieldOptions(A.structure)] },
      { name: 'semester_id', label: 'Asignar al semestre', type: 'select', options: semesterOptions('No cambiar / sin definir', adminCareer()) },
    ],
    values: { career_id: adminCareer() !== 'all' ? adminCareer() : '' },
    onMount: (form) => wireCareerSemesterFields(form, 'No cambiar / sin definir'),
    submitLabel: 'Importar',
    onSubmit: async (v) => {
      const r = await api('/admin/students/import', { method: 'POST', body: v });
      toast(`${r.created} agregados · ${r.updated} actualizados`);
      Router.refresh();
      if (r.errors.length) {
        openModal({
          title: `${r.errors.length} línea(s) no se pudieron importar`,
          body: `<div class="list">${r.errors
            .map((e) => `<div class="admin-row"><span class="badge neutral">Línea ${e.line}</span><div class="info"><strong>${esc(e.text)}</strong><span>${esc(e.reason)}</span></div></div>`)
            .join('')}</div>`,
          footer: `<button class="btn btn-primary" data-close>Entendido</button>`,
        });
      }
    },
  });
}

/* =========================================================================
   Páginas
   ========================================================================= */

async function pageOverview(ctx) {
  Shell.setTitle('Resumen', 'Panel de administración');
  ctx.render(skeleton());
  const st = await api('/admin/stats', { query: { today: todayISO() } });
  if (!ctx.alive()) return;

  const steps = [
    ['Crea las facultades y carreras', st.careers > 0, '#/facultades'],
    ['Crea los semestres de cada carrera', st.semesters > 0, '#/semestres'],
    ['Agrega las materias', st.subjects > 0, '#/materias'],
    ['Sube materiales y programa evaluaciones', st.materials > 0 || st.upcoming > 0, '#/materiales'],
    ['Registra a los estudiantes', st.students > 0 || A.settings.allow_self_register === '1', '#/estudiantes'],
  ];
  const pending = steps.filter((s) => !s[1]).length;
  const name = firstName(A.auth.user.name) || A.auth.user.username;

  ctx.render(`
    ${
      st.storage === 'missing'
        ? `<div class="alert warn">${icon('alert')}<span>Falta conectar <strong>Vercel Blob</strong> para poder subir archivos. <a href="#/ajustes"><strong>Ver estado del sistema</strong></a></span></div>`
        : ''
    }
    ${
      st.must_change_password
        ? `<div class="alert warn">${icon('alert')}<span>Estás usando la contraseña inicial del administrador. <a href="#/ajustes"><strong>Cámbiala ahora</strong></a> para proteger el portal.</span></div>`
        : ''
    }
    <section class="hero">
      <div class="hero-grid">
        <div>
          <span class="eyebrow">${icon('sparkles')}Panel de administración</span>
          <h2>¡Hola, ${esc(name)}!</h2>
          <p>Desde aquí gestionas las materias, los materiales de apoyo, el calendario de evaluaciones y quién puede entrar al portal.</p>
        </div>
        <div class="hero-next">
          ${
            pending
              ? `<div class="lbl">Primeros pasos · ${steps.length - pending}/${steps.length}</div>
                 <div class="stack-sm" style="margin-top:12px">${steps
                   .map(
                     ([t, done, href]) =>
                       `<a href="${href}" class="row" style="color:#fff;text-decoration:none;gap:10px"><span style="display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:${done ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.2)'};color:${done ? '#5b4cf0' : '#fff'}">${icon(done ? 'check' : 'right')}</span><span style="${done ? 'opacity:.75;text-decoration:line-through' : 'font-weight:650'}">${t}</span></a>`
                   )
                   .join('')}</div>`
              : `<div class="lbl">Todo listo</div><h3>Tu portal está funcionando</h3><div class="sub">${st.faculties} facultad(es) · ${st.careers} carrera(s) · ${st.active_students} estudiante(s) con acceso</div>`
          }
        </div>
      </div>
    </section>

    <section class="stats admin-stats" style="--cols:4">
      <a class="stat" href="#/materias" style="--c:#6366f1"><span class="s-ico">${icon('book')}</span><div><b>${st.subjects}</b><span>Materias</span></div></a>
      <a class="stat" href="#/materiales" style="--c:#ec4899"><span class="s-ico">${icon('folder')}</span><div><b>${st.materials}</b><span>Materiales</span></div></a>
      <a class="stat" href="#/calendario" style="--c:#f97316"><span class="s-ico">${icon('calendar')}</span><div><b>${st.upcoming}</b><span>Evaluaciones próximas</span></div></a>
      <a class="stat" href="#/estudiantes" style="--c:#10b981"><span class="s-ico">${icon('users')}</span><div><b>${st.students}</b><span>Estudiantes</span></div></a>
    </section>

    <section class="quick-actions">
      <button class="quick" style="--c:#f97316" data-quick="event"><span class="q-ico">${icon('calendar-plus')}</span><strong>Programar evaluación</strong><span>Examen, parcial, quiz o entrega</span></button>
      <button class="quick" style="--c:#ec4899" data-quick="upload"><span class="q-ico">${icon('cloud-upload')}</span><strong>Subir material</strong><span>Archivos o enlaces de apoyo</span></button>
      <button class="quick" style="--c:#6366f1" data-quick="subject"><span class="q-ico">${icon('book')}</span><strong>Nueva materia</strong><span>Profesor, horario e información</span></button>
      <button class="quick" style="--c:#10b981" data-quick="students"><span class="q-ico">${icon('user-plus')}</span><strong>Agregar estudiantes</strong><span>Uno a uno o pegando una lista</span></button>
    </section>

    <section class="grid-main">
      <div class="card">
        <div class="card-head"><h3><span class="h-ico">${icon('calendar')}</span>Próximas evaluaciones</h3><a class="btn btn-ghost btn-sm" href="#/calendario">Calendario ${icon('arrow-right')}</a></div>
        <div class="card-body" data-events>
          ${st.upcoming_events.length ? `<div class="list">${st.upcoming_events.map((e) => eventItem(e)).join('')}</div>` : emptyState({ icon: 'calendar', title: 'Sin evaluaciones próximas', text: 'Programa la primera para que los estudiantes la vean en su calendario.', small: true })}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3><span class="h-ico">${icon('folder')}</span>Materiales recientes</h3><a class="btn btn-ghost btn-sm" href="#/materiales">Todos ${icon('arrow-right')}</a></div>
        <div class="card-body" data-materials>
          ${st.recent_materials.length ? `<div class="list">${st.recent_materials.map((m) => materialItem(m, { admin: true, showSubject: true, showClass: false })).join('')}</div>` : emptyState({ icon: 'folder', title: 'Aún no hay materiales', text: 'Sube guías, presentaciones o enlaces para cada materia.', small: true })}
        </div>
      </div>
    </section>
  `);

  const view = document.getElementById('view');
  bindEventItems(view.querySelector('[data-events]'), st.upcoming_events);
  bindMaterialActions(view.querySelector('[data-materials]'), st.recent_materials);
  view.querySelector('.quick-actions').addEventListener('click', (e) => {
    const q = e.target.closest('[data-quick]')?.dataset.quick;
    if (q === 'event') eventForm(null);
    if (q === 'upload') uploadModal();
    if (q === 'subject') subjectForm(null);
    if (q === 'students') location.hash = '#/estudiantes';
  });
}

async function pageStructure(ctx) {
  Shell.setTitle('Facultades', 'Estructura de la universidad');
  ctx.render(skeleton([['100%', '220px'], ['100%', '220px']]));
  await refreshRefs();
  if (!ctx.alive()) return;
  const careers = A.structure.reduce((n, f) => n + f.careers.length, 0);

  ctx.render(`
    <div class="section-title">
      <div><h2>${A.structure.length} facultad${A.structure.length === 1 ? '' : 'es'} · ${careers} carrera${careers === 1 ? '' : 's'}</h2>
        <p>Cada carrera tiene sus semestres, y cada semestre sus materias.</p></div>
      <div class="row wrap">
        <button class="btn btn-ghost" data-load-uc title="Agrega las 7 facultades y 47 carreras de la Universidad de Carabobo que falten">${icon('landmark')} Cargar facultades de la UC</button>
        <button class="btn btn-primary" data-add-faculty>${icon('plus')} Nueva facultad</button>
      </div>
    </div>
    ${
      A.structure.length
        ? `<div class="faculty-grid admin">${A.structure
            .map(
              (f) => `<section class="faculty-card" style="--c:${f.color || '#8b5cf6'}">
                <div class="faculty-head">
                  <div class="head-actions">
                    <button class="icon-btn sm" data-edit-faculty="${f.id}" aria-label="Editar facultad">${icon('edit')}</button>
                    <button class="icon-btn sm" data-del-faculty="${f.id}" aria-label="Eliminar facultad">${icon('trash')}</button>
                  </div>
                  <div class="f-ico">${icon('landmark')}</div>
                  ${f.code ? `<span class="badge">${esc(f.code)}</span>` : ''}
                  <h3 style="margin-top:8px">${esc(f.name)}</h3>
                  ${f.description ? `<p>${esc(f.description)}</p>` : ''}
                </div>
                <div class="career-list">
                  ${f.careers
                    .map(
                      (c) => `<div class="career-row" style="--c:${c.color || f.color || '#6366f1'}">
                        <span class="dot"></span>
                        <span class="info"><strong>${esc(c.name)}${c.code ? ` <small class="muted">(${esc(c.code)})</small>` : ''}</strong>
                          <span>${c.semester_count} semestre${c.semester_count === 1 ? '' : 's'} · ${c.subject_count} materia${c.subject_count === 1 ? '' : 's'} · ${c.student_count} estudiante${c.student_count === 1 ? '' : 's'}</span></span>
                        <button class="icon-btn sm" data-open-career="${c.id}" title="Ver semestres" aria-label="Ver semestres">${icon('layers')}</button>
                        <button class="icon-btn sm plain" data-edit-career="${c.id}" aria-label="Editar carrera">${icon('edit')}</button>
                        <button class="icon-btn sm plain danger" data-del-career="${c.id}" aria-label="Eliminar carrera">${icon('trash')}</button>
                      </div>`
                    )
                    .join('')}
                  <button class="btn btn-ghost btn-sm" style="margin:6px" data-add-career="${f.id}">${icon('plus')} Agregar carrera</button>
                </div>
              </section>`
            )
            .join('')}</div>`
        : `<div class="card">${emptyState({ icon: 'landmark', title: 'Crea la primera facultad', text: 'Luego agrégale sus carreras, y a cada carrera sus semestres y materias.', action: `<button class="btn btn-primary" data-add-faculty>${icon('plus')} Nueva facultad</button>` })}</div>`
    }
  `);

  const faculty = (id) => A.structure.find((f) => String(f.id) === id);
  const career = (id) => careerById(A.structure, id);
  document.getElementById('view').addEventListener('click', (e) => {
    const t = e.target.closest('[data-load-uc],[data-add-faculty],[data-edit-faculty],[data-del-faculty],[data-add-career],[data-edit-career],[data-del-career],[data-open-career]');
    if (!t) return;
    const d = t.dataset;
    const fail = (ex) => toast(ex.message, 'error');
    if ('loadUc' in d) {
      return confirmDialog({
        title: 'Cargar facultades de la UC',
        message:
          'Se agregarán las <strong>7 facultades</strong> y <strong>47 carreras</strong> de pregrado de la Universidad de Carabobo que todavía no existan. No se borra ni se cambia nada de lo que ya tienes.',
        confirmLabel: 'Cargar',
        danger: false,
      }).then(async (ok) => {
        if (!ok) return;
        try {
          const r = await api('/admin/structure/uc', { method: 'POST' });
          toast(r.faculties || r.careers ? `${r.faculties} facultades y ${r.careers} carreras agregadas` : 'Ya estaban todas cargadas');
          Router.refresh();
        } catch (ex) {
          fail(ex);
        }
      });
    }
    if ('addFaculty' in d) facultyForm(null);
    else if (d.editFaculty) facultyForm(faculty(d.editFaculty));
    else if (d.delFaculty) deleteFaculty(faculty(d.delFaculty)).catch(fail);
    else if (d.addCareer) careerForm(null, d.addCareer);
    else if (d.editCareer) careerForm(career(d.editCareer));
    else if (d.delCareer) deleteCareer(career(d.delCareer)).catch(fail);
    else if (d.openCareer) {
      setAdminCareer(d.openCareer);
      location.hash = '#/semestres';
    }
  });
}

async function pageSemesters(ctx) {
  Shell.setTitle('Semestres', 'Los semestres de cada carrera');
  await refreshRefs();
  if (!ctx.alive()) return;
  if (!A.structure.some((f) => f.careers.length)) {
    return ctx.render(`<div class="card">${emptyState({ icon: 'landmark', title: 'Primero crea una facultad y una carrera', text: 'Cada semestre pertenece a una carrera.', action: `<a class="btn btn-primary" href="#/facultades">${icon('plus')} Crear facultad</a>` })}</div>`);
  }
  let career = adminCareer();

  ctx.render(`
    <section class="toolbar">
      ${careerPicker(A.structure, career)}
      <span class="spacer"></span>
      <button class="btn btn-primary" data-add>${icon('plus')} Nuevo semestre</button>
    </section>
    <section data-list></section>
  `);
  const view = document.getElementById('view');
  const draw = () => {
    const list = semestersOfCareer(career);
    view.querySelector('[data-list]').innerHTML = list.length
      ? `<div class="list">${list
          .map((sm, i) => {
            const c = careerById(A.structure, sm.career_id);
            return `<div class="admin-row">
              <div class="color-tile" style="--c:${(c && c.color) || SUBJECT_COLORS[i % SUBJECT_COLORS.length]}">${sm.number || i + 1}</div>
              <div class="info"><strong>${esc(sm.name)}</strong><span>${[c && c.name, sm.period, `${sm.subject_count} materia${sm.subject_count === 1 ? '' : 's'}`, sm.description].filter(Boolean).map(esc).join(' · ')}</span></div>
              <button class="btn btn-soft btn-sm hide-mobile" data-open="${sm.id}">${icon('book')} Materias</button>
              <button class="icon-btn sm plain" data-edit="${sm.id}" aria-label="Editar">${icon('edit')}</button>
              <button class="icon-btn sm plain danger" data-del="${sm.id}" aria-label="Eliminar">${icon('trash')}</button>
            </div>`;
          })
          .join('')}</div>`
      : `<div class="card">${emptyState({ icon: 'layers', title: 'Esta carrera aún no tiene semestres', text: 'Crea “Semestre I”, “Semestre II”… y luego agrega sus materias.', action: `<button class="btn btn-primary" data-add>${icon('plus')} Nuevo semestre</button>` })}</div>`;
  };

  view.querySelector('[data-career]').addEventListener('change', (e) => {
    career = e.target.value;
    setAdminCareer(career);
    draw();
  });
  view.addEventListener('click', (e) => {
    const find = (id) => A.semesters.find((x) => String(x.id) === id);
    const t = e.target.closest('[data-add],[data-edit],[data-del],[data-open]');
    if (!t) return;
    if ('add' in t.dataset) semesterForm(null);
    else if (t.dataset.edit) semesterForm(find(t.dataset.edit));
    else if (t.dataset.del) deleteSemester(find(t.dataset.del)).catch((ex) => toast(ex.message, 'error'));
    else if (t.dataset.open) {
      const sm = find(t.dataset.open);
      if (sm && sm.career_id) setAdminCareer(String(sm.career_id));
      sessionStorage.setItem('admin-semester', t.dataset.open);
      location.hash = '#/materias';
    }
  });
  draw();
}

async function pageSubjectsAdmin(ctx) {
  Shell.setTitle('Materias', 'Información, clases, materiales y evaluaciones');
  ctx.render(skeleton([['60%', '40px'], ['100%', '300px']]));
  await refreshRefs();
  if (!ctx.alive()) return;

  if (!A.semesters.length) {
    return ctx.render(`<div class="card">${emptyState({ icon: 'layers', title: 'Primero crea un semestre', text: 'Las materias se organizan por carrera y semestre.', action: `<a class="btn btn-primary" href="#/semestres">${icon('plus')} Crear semestre</a>` })}</div>`);
  }

  let career = adminCareer();
  let current = adminSemester(career);
  let q = '';
  ctx.render(`
    <section class="filters">
      <div class="toolbar">${careerPicker(A.structure, career)}</div>
      <div data-semchips>${adminSemChips(career, current)}</div>
      <div class="toolbar">
        <div class="input-icon search">${icon('search')}<input class="input" type="search" placeholder="Buscar materia…" data-search></div>
        <span class="spacer"></span>
        <button class="btn btn-primary" data-add>${icon('plus')} Nueva materia</button>
      </div>
    </section>
    <section data-list></section>
  `);

  const view = document.getElementById('view');
  const draw = () => {
    const term = q.trim().toLowerCase();
    const list = A.subjects.filter(
      (s) =>
        (current === 'all' ? career === 'all' || String(s.career_id) === String(career) : String(s.semester_id) === current) &&
        (!term || [s.name, s.professor, s.code].some((v) => (v || '').toLowerCase().includes(term)))
    );
    view.querySelector('[data-list]').innerHTML = list.length
      ? `<div class="list">${list
          .map(
            (s) => `<div class="admin-row" style="cursor:pointer" data-open="${s.id}">
              <div class="color-tile" style="--c:${s.color || '#6366f1'}">${esc(initials(s.name))}</div>
              <div class="info"><strong>${esc(s.name)}</strong><span>${[career === 'all' ? s.career_name : '', s.semester_name, s.professor, s.schedule].filter(Boolean).map(esc).join(' · ')}</span></div>
              <span class="badge neutral hide-mobile">${icon('book')}${s.class_count} clases</span>
              <span class="badge neutral hide-mobile">${icon('folder')}${s.material_count} materiales</span>
              <button class="icon-btn sm plain" data-edit="${s.id}" aria-label="Editar">${icon('edit')}</button>
              <button class="icon-btn sm plain danger" data-del="${s.id}" aria-label="Eliminar">${icon('trash')}</button>
              <span class="muted">${icon('right')}</span>
            </div>`
          )
          .join('')}</div>`
      : `<div class="card">${emptyState({ icon: 'book', title: term ? 'Sin resultados' : 'No hay materias aquí todavía', text: term ? 'Prueba con otro nombre.' : 'Agrega la primera materia de este semestre.', action: term ? '' : `<button class="btn btn-primary" data-add>${icon('plus')} Nueva materia</button>` })}</div>`;
  };

  view.addEventListener('click', (e) => {
    const find = (id) => A.subjects.find((s) => String(s.id) === id);
    const sem = e.target.closest('[data-sem]');
    if (sem) {
      current = sem.dataset.sem;
      sessionStorage.setItem('admin-semester', current);
      view.querySelectorAll('[data-sem]').forEach((x) => x.classList.toggle('active', x === sem));
      return draw();
    }
    const t = e.target.closest('[data-add],[data-edit],[data-del],[data-open]');
    if (!t) return;
    if ('add' in t.dataset) subjectForm(null, { semesterId: current !== 'all' ? current : (semestersOfCareer(career)[0] || {}).id });
    else if (t.dataset.edit) subjectForm(find(t.dataset.edit));
    else if (t.dataset.del) deleteSubject(find(t.dataset.del)).catch((ex) => toast(ex.message, 'error'));
    else if (t.dataset.open) location.hash = `#/materias/${t.dataset.open}`;
  });
  view.querySelector('[data-career]').addEventListener('change', (e) => {
    career = e.target.value;
    setAdminCareer(career);
    current = 'all';
    view.querySelector('[data-semchips]').innerHTML = adminSemChips(career, current);
    draw();
  });
  view.querySelector('[data-search]').addEventListener('input', (e) => {
    q = e.target.value;
    draw();
  });
  draw();
}

async function pageSubjectAdmin(ctx) {
  ctx.render(skeleton([['100%', '240px'], ['50%', '44px'], ['100%', '300px']]));
  const [s] = await Promise.all([api(`/subjects/${encodeURIComponent(ctx.params.id)}`), A.subjects.length ? null : refreshRefs()]);
  if (!ctx.alive()) return;
  Shell.setTitle(s.name, `${s.semester_name} · Gestión de la materia`);

  const tabs = [
    ['clases', 'Clases', 'book', s.classes.length],
    ['materiales', 'Materiales', 'folder', s.materials.length],
    ['evaluaciones', 'Evaluaciones', 'calendar', s.events.length],
  ];
  let tab = sessionStorage.getItem('admin-subject-tab') || 'clases';

  ctx.render(`
    ${subjectHero(s, {
      actions: `<a class="btn btn-ghost btn-sm" style="background:rgba(255,255,255,.18);color:#fff;border-color:transparent" href="/app#/materias/${s.id}" target="_blank" rel="noopener">${icon('eye')}<span class="hide-mobile">Ver como estudiante</span></a>
                <button class="btn btn-sm" style="background:#fff;color:#1e1b4b" data-edit-subject>${icon('edit')} Editar información</button>`,
    })}
    <section class="card card-pad">
      <div class="row" style="margin-bottom:10px"><h3 style="font-size:16px;display:flex;gap:8px;align-items:center;flex:1">${icon('info')} Información de la materia</h3><button class="btn btn-ghost btn-sm" data-edit-subject>${icon('edit')} Editar</button></div>
      ${s.description ? `<div class="rich">${linkify(s.description)}</div>` : `<p class="muted">Aún no has escrito información general. Agrega el programa, objetivos, bibliografía o forma de evaluación para que los estudiantes la vean.</p>`}
    </section>
    <section class="stack-sm">
      <div class="row wrap">
        <div class="tabs" role="tablist" style="max-width:100%">
          ${tabs.map(([k, l, ic, n]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}">${icon(ic)}${l}<span class="count">${n}</span></button>`).join('')}
        </div>
        <span class="spacer"></span>
        <button class="btn btn-primary" data-add></button>
      </div>
      <div data-panel></div>
    </section>
  `);

  const view = document.getElementById('view');
  const panel = view.querySelector('[data-panel]');
  const addBtn = view.querySelector('[data-add]');
  const draw = () => {
    addBtn.innerHTML =
      tab === 'clases' ? `${icon('plus')} Registrar clase` : tab === 'materiales' ? `${icon('upload')} Subir material` : `${icon('calendar-plus')} Programar evaluación`;
    if (tab === 'clases') {
      panel.innerHTML =
        classTimeline(s, { admin: true }) ||
        `<div class="card">${emptyState({ icon: 'book', title: 'Sin clases registradas', text: 'Registra cada clase con su tema y contenido. Luego podrás adjuntarle materiales.', action: `<button class="btn btn-primary" data-add-inline>${icon('plus')} Registrar clase</button>` })}</div>`;
    } else if (tab === 'materiales') {
      panel.innerHTML = s.materials.length
        ? `<div class="list">${s.materials.map((m) => materialItem(m, { admin: true })).join('')}</div>`
        : `<div class="card">${emptyState({ icon: 'folder', title: 'Sin materiales', text: 'Sube guías, lecturas, presentaciones o enlaces para esta materia.', action: `<button class="btn btn-primary" data-add-inline>${icon('upload')} Subir material</button>` })}</div>`;
    } else {
      panel.innerHTML = s.events.length
        ? `<div class="list">${s.events.map((e) => eventItem(e, { showSubject: false })).join('')}</div>`
        : `<div class="card">${emptyState({ icon: 'calendar', title: 'Sin evaluaciones', text: 'Programa exámenes, parciales o entregas de esta materia.', action: `<button class="btn btn-primary" data-add-inline>${icon('calendar-plus')} Programar evaluación</button>` })}</div>`;
    }
  };
  const add = () => {
    if (tab === 'clases') classForm(null, s.id, s.classes.length + 1);
    else if (tab === 'materiales') uploadModal({ subjectId: s.id });
    else eventForm(null, { subjectId: s.id });
  };

  view.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) {
      tab = t.dataset.tab;
      sessionStorage.setItem('admin-subject-tab', tab);
      view.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === t));
      return draw();
    }
    if (e.target.closest('[data-add],[data-add-inline]')) return add();
    if (e.target.closest('[data-edit-subject]')) return subjectForm(s);
    const ec = e.target.closest('[data-edit-class]');
    if (ec) return classForm(s.classes.find((c) => String(c.id) === ec.dataset.editClass), s.id);
    const dc = e.target.closest('[data-delete-class]');
    if (dc) return deleteClass(s.classes.find((c) => String(c.id) === dc.dataset.deleteClass)).catch((ex) => toast(ex.message, 'error'));
  });
  bindMaterialActions(panel, s.materials);
  bindEventItems(panel, s.events);
  draw();
}

async function pageCalendarAdmin(ctx) {
  Shell.setTitle('Calendario', 'Programa exámenes, parciales y entregas');
  await refreshRefs();
  if (!ctx.alive()) return;
  let career = adminCareer();
  let current = adminSemester(career);

  ctx.render(`
    <section class="filters">
      <div class="toolbar">
        ${careerPicker(A.structure, career)}
        <span class="spacer"></span>
        <button class="btn btn-ghost" data-schedule>${icon('clock')} Cargar horario de clases</button>
        <button class="btn btn-primary" data-new>${icon('calendar-plus')} Programar evaluación</button>
      </div>
      <div data-semchips>${adminSemChips(career, current)}</div>
    </section>
    <section data-calendar></section>
  `);

  const cal = new CalendarView(document.querySelector('[data-calendar]'), {
    load: (from, to) => api('/events', { query: { from, to, ...adminScope(career, current) } }),
    onEvent: openEvent,
    agendaActions: (date) => `<button class="btn btn-soft btn-block" data-add-date="${date}">${icon('plus')} Agregar en esta fecha</button>`,
  });
  const view = document.getElementById('view');
  view.addEventListener('click', (e) => {
    const sem = e.target.closest('[data-sem]');
    if (sem) {
      current = sem.dataset.sem;
      sessionStorage.setItem('admin-semester', current);
      view.querySelectorAll('[data-sem]').forEach((x) => x.classList.toggle('active', x === sem));
      return cal.reload();
    }
    if (e.target.closest('[data-new]')) return eventForm(null, { date: cal.selected });
    if (e.target.closest('[data-schedule]')) return scheduleForm();
    const ad = e.target.closest('[data-add-date]');
    if (ad) eventForm(null, { date: ad.dataset.addDate });
  });
  view.querySelector('[data-career]').addEventListener('change', (e) => {
    career = e.target.value;
    setAdminCareer(career);
    current = 'all';
    view.querySelector('[data-semchips]').innerHTML = adminSemChips(career, current);
    cal.reload();
  });
  await cal.reload();
}

async function pageMaterialsAdmin(ctx) {
  Shell.setTitle('Materiales', 'Archivos y enlaces de apoyo');
  ctx.render(skeleton([['100%', '50px'], ['100%', '400px']]));
  await refreshRefs();
  if (!ctx.alive()) return;

  let subjectId = sessionStorage.getItem('admin-material-subject') || '';
  if (subjectId && !A.subjects.some((s) => String(s.id) === subjectId)) subjectId = '';
  let q = '';
  let materials = [];

  ctx.render(`
    <section class="toolbar">
      <select class="select" style="max-width:280px" data-subject>${optionsHtml(subjectOptions('Todas las materias'), subjectId)}</select>
      <div class="input-icon search">${icon('search')}<input class="input" type="search" placeholder="Buscar material…" data-search></div>
      <span class="spacer"></span>
      <button class="btn btn-primary" data-upload>${icon('upload')} Subir material</button>
    </section>
    <section data-list></section>
  `);
  const view = document.getElementById('view');
  const listEl = view.querySelector('[data-list]');
  bindMaterialActions(listEl, () => materials);

  let timer;
  const load = async () => {
    materials = await api('/materials', { query: { subject_id: subjectId, q } });
    if (!ctx.alive()) return;
    listEl.innerHTML = materials.length
      ? `<p class="muted small" style="margin-bottom:10px">${materials.length} material${materials.length === 1 ? '' : 'es'}</p><div class="list">${materials.map((m) => materialItem(m, { admin: true, showSubject: true })).join('')}</div>`
      : `<div class="card">${emptyState({ icon: 'folder', title: q ? 'Sin resultados' : 'Aún no hay materiales', text: q ? 'Prueba con otra palabra.' : 'Sube el primer archivo o enlace de apoyo.', action: q ? '' : `<button class="btn btn-primary" data-upload>${icon('upload')} Subir material</button>` })}</div>`;
  };
  view.querySelector('[data-subject]').addEventListener('change', (e) => {
    subjectId = e.target.value;
    sessionStorage.setItem('admin-material-subject', subjectId);
    load();
  });
  view.querySelector('[data-search]').addEventListener('input', (e) => {
    q = e.target.value.trim();
    clearTimeout(timer);
    timer = setTimeout(load, 250);
  });
  view.addEventListener('click', (e) => {
    if (e.target.closest('[data-upload]')) uploadModal({ subjectId: subjectId || undefined });
  });
  await load();
}

async function pageStudents(ctx) {
  Shell.setTitle('Estudiantes', 'Quién puede entrar al portal');
  ctx.render(skeleton([['100%', '60px'], ['100%', '400px']]));
  await refreshRefs();
  let career = adminCareer();
  let students = await api('/admin/students', { query: { career_id: career === 'all' ? '' : career } });
  if (!ctx.alive()) return;
  const open = A.settings.allow_self_register === '1';
  let q = '';

  ctx.render(`
    <div class="alert ${open ? 'warn' : 'info'}">${icon(open ? 'alert' : 'lock')}<span>${
      open
        ? '<strong>Registro abierto:</strong> cualquier persona que escriba una cédula y un correo nuevos podrá entrar y quedará registrada aquí.'
        : '<strong>Acceso restringido:</strong> solo los estudiantes de esta lista pueden entrar, usando su cédula y el correo registrado.'
    } <a href="#/ajustes">Cambiar</a></span></div>
    <section class="toolbar">
      ${careerPicker(A.structure, career)}
      <div class="input-icon search">${icon('search')}<input class="input" type="search" placeholder="Buscar por nombre, cédula o correo…" data-search></div>
      <span class="spacer"></span>
      <button class="btn btn-ghost" data-import>${icon('upload')} Importar lista</button>
      <button class="btn btn-primary" data-add>${icon('user-plus')} Agregar</button>
    </section>
    <section class="card" data-table></section>
  `);

  const view = document.getElementById('view');
  const draw = () => {
    const term = q.trim().toLowerCase();
    const list = term ? students.filter((s) => [s.name, s.email, s.cedula].some((v) => (v || '').toLowerCase().includes(term))) : students;
    view.querySelector('[data-table]').innerHTML = list.length
      ? `<div class="table-wrap"><table class="table responsive">
          <thead><tr><th>Estudiante</th><th>Cédula</th><th>Carrera</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
          <tbody>${list
            .map(
              (s) => `<tr>
                <td class="c-main"><div class="person"><div class="avatar">${esc(initials(s.name || s.email))}</div><div style="min-width:0"><strong>${esc(s.name || 'Sin nombre')}</strong><span>${esc(s.email)}</span></div></div></td>
                <td class="c-extra">${icon('id')} ${esc(s.cedula)}</td>
                <td class="hide-mobile">${esc([s.career_name, s.semester_name].filter(Boolean).join(' · ') || '—')}</td>
                <td class="hide-mobile"><span class="status-dot" style="--c:${s.active ? 'var(--success)' : 'var(--text-3)'}">${s.active ? 'Activo' : 'Inactivo'}</span></td>
                <td class="hide-mobile muted">${s.last_login ? timeAgo(s.last_login) : 'Nunca'}</td>
                <td class="c-actions" style="text-align:right;white-space:nowrap">
                  <button class="icon-btn sm plain" data-edit="${s.id}" aria-label="Editar">${icon('edit')}</button>
                  <button class="icon-btn sm plain danger" data-del="${s.id}" aria-label="Eliminar">${icon('trash')}</button>
                </td>
              </tr>`
            )
            .join('')}</tbody></table></div>`
      : emptyState({
          icon: 'users',
          title: term ? 'Sin resultados' : 'Aún no hay estudiantes',
          text: term ? 'Prueba con otro dato.' : 'Agrégalos uno por uno o pega la lista completa desde Excel.',
          action: term ? '' : `<div class="row wrap" style="justify-content:center"><button class="btn btn-ghost" data-import>${icon('upload')} Importar lista</button><button class="btn btn-primary" data-add>${icon('user-plus')} Agregar</button></div>`,
        });
  };
  view.addEventListener('click', (e) => {
    const find = (id) => students.find((s) => String(s.id) === id);
    const t = e.target.closest('[data-add],[data-import],[data-edit],[data-del]');
    if (!t) return;
    if ('add' in t.dataset) studentForm(null);
    else if ('import' in t.dataset) importForm();
    else if (t.dataset.edit) studentForm(find(t.dataset.edit));
    else if (t.dataset.del) deleteStudent(find(t.dataset.del)).catch((ex) => toast(ex.message, 'error'));
  });
  view.querySelector('[data-search]').addEventListener('input', (e) => {
    q = e.target.value;
    draw();
  });
  view.querySelector('[data-career]').addEventListener('change', async (e) => {
    career = e.target.value;
    setAdminCareer(career);
    students = await api('/admin/students', { query: { career_id: career === 'all' ? '' : career } });
    draw();
  });
  draw();
}

/** Tarjeta "Estado del sistema": base de datos y almacenamiento de archivos. */
function systemCard(sys) {
  if (!sys) return '';
  const row = (ok, ic, title, value, help) => `
    <div class="admin-row" style="align-items:flex-start">
      <span class="t-ico" style="display:grid;place-items:center;width:38px;height:38px;border-radius:12px;flex:none;color:${ok ? 'var(--success)' : 'var(--warning)'};background:color-mix(in srgb, ${ok ? 'var(--success)' : 'var(--warning)'} 14%, transparent)">${icon(ic)}</span>
      <div class="info" style="white-space:normal">
        <strong>${esc(title)}</strong>
        <span style="white-space:normal">${esc(value)}</span>
        ${help ? `<p class="small muted" style="margin-top:6px">${help}</p>` : ''}
      </div>
      <span class="status-dot" style="--c:${ok ? 'var(--success)' : 'var(--warning)'}">${ok ? 'Conectado' : 'Pendiente'}</span>
    </div>`;
  const filesHelp = sys.archivos_ok
    ? ''
    : 'En Vercel: <b>Storage → Create → Blob</b> (acceso <b>Private</b>), conéctalo al proyecto y luego <b>Deployments → ⋯ → Redeploy</b>.';
  const dbHelp = sys.base_de_datos_ok ? '' : 'Revisa las variables <b>TURSO_DATABASE_URL</b> y <b>TURSO_AUTH_TOKEN</b> en Vercel y vuelve a desplegar.';
  return `<section class="card card-pad stack-sm">
    <div class="row"><h3 style="font-size:18px;flex:1">Estado del sistema</h3><button class="btn btn-ghost btn-sm" data-recheck>${icon('refresh')} Revisar de nuevo</button></div>
    ${row(sys.base_de_datos_ok, 'layers', 'Base de datos', sys.base_de_datos, dbHelp)}
    ${row(sys.archivos_ok, 'folder', 'Archivos (materiales)', sys.archivos, filesHelp)}
  </section>`;
}

async function pageSettings(ctx) {
  Shell.setTitle('Ajustes', 'Portal y cuenta de administrador');
  const [s, admins] = await Promise.all([api('/admin/settings'), api('/admin/admins')]);
  if (!ctx.alive()) return;

  const siteFields = [
    { name: 'site_name', label: 'Nombre del portal', required: true, placeholder: 'Ej: Economía 02' },
    { name: 'site_tagline', label: 'Subtítulo', placeholder: 'Ej: Portal académico' },
    { name: 'university', label: 'Universidad / facultad', placeholder: 'Ej: Facultad de Ciencias Económicas', full: true },
    { name: 'period', label: 'Período actual', placeholder: 'Ej: 2026-II' },
    { name: 'welcome_message', label: 'Mensaje de bienvenida', type: 'textarea', rows: 3, full: true },
    {
      name: 'allow_self_register',
      type: 'toggle',
      toggleLabel: 'Registro abierto: cualquiera con cédula y correo puede crear su acceso',
      full: true,
    },
  ];
  const accountFields = [
    { name: 'username', label: 'Usuario', required: true },
    { name: 'name', label: 'Tu nombre', placeholder: 'Ej: Ana Pérez' },
    { name: 'current_password', label: 'Contraseña actual', type: 'password', required: true, attrs: 'autocomplete="current-password"', full: true },
    { name: 'new_password', label: 'Nueva contraseña', type: 'password', attrs: 'autocomplete="new-password" minlength="8"', hint: 'Mínimo 8 caracteres. Déjala vacía para no cambiarla.' },
    { name: 'confirm_password', label: 'Repite la nueva contraseña', type: 'password', attrs: 'autocomplete="new-password"' },
  ];

  ctx.render(`
    ${systemCard(s.system)}
    <section class="grid-2" style="align-items:start">
      <form class="card card-pad stack" data-site novalidate>
        <div><h3 style="font-size:18px">Portal</h3><p class="muted small">Así se ve el portal para los estudiantes.</p></div>
        <div class="alert" data-error hidden></div>
        ${fieldsHtml(siteFields, { ...s, allow_self_register: s.allow_self_register === '1' })}
        <div><button class="btn btn-primary" type="submit">${icon('check')} Guardar ajustes</button></div>
      </form>
      <form class="card card-pad stack" data-account novalidate>
        <div><h3 style="font-size:18px">Tu cuenta de administrador</h3><p class="muted small">Cada administrador entra con su propio usuario y contraseña.</p></div>
        ${A.auth.user.must_change ? `<div class="alert warn">${icon('alert')}<span>Estás usando la contraseña inicial. Elige una nueva.</span></div>` : ''}
        <div class="alert" data-error hidden></div>
        ${fieldsHtml(accountFields, { username: s.admin.username, name: s.admin.name || '' })}
        <div><button class="btn btn-primary" type="submit">${icon('key')} Actualizar cuenta</button></div>
      </form>
    </section>
    <section class="card card-pad stack-sm" data-admins>
      <div class="row wrap">
        <div style="flex:1;min-width:200px"><h3 style="font-size:18px">Administradores</h3><p class="muted small">Personas que pueden entrar a este panel y cambiar el contenido del portal.</p></div>
        <button class="btn btn-primary" data-add-admin>${icon('user-plus')} Agregar administrador</button>
      </div>
      <div class="list">${admins
        .map(
          (a) => `<div class="admin-row">
            <div class="avatar">${esc(initials(a.name || a.username))}</div>
            <div class="info"><strong>${esc(a.name || a.username)}${a.me ? ' <span class="badge" style="display:inline-flex;margin-left:6px;vertical-align:middle">Tú</span>' : ''}</strong>
              <span>Usuario: ${esc(a.username)}${a.must_change ? ' · debe cambiar su contraseña al entrar' : ''}</span></div>
            ${
              a.me
                ? ''
                : `<button class="btn btn-ghost btn-sm" data-reset-admin="${a.id}" title="Poner una contraseña nueva">${icon('key')}<span class="hide-mobile">Nueva contraseña</span></button>
                   <button class="icon-btn sm plain danger" data-del-admin="${a.id}" aria-label="Eliminar administrador">${icon('trash')}</button>`
            }
          </div>`
        )
        .join('')}</div>
    </section>
  `);

  const passwordFields = (withUser) => [
    ...(withUser
      ? [
          { name: 'username', label: 'Usuario', required: true, placeholder: 'Ej: adminvictoria', attrs: 'autocomplete="off" autocapitalize="none"' },
          { name: 'name', label: 'Nombre', placeholder: 'Ej: Victoria' },
        ]
      : []),
    { name: 'password', label: 'Contraseña', type: 'password', required: true, attrs: 'autocomplete="new-password" minlength="8"', hint: 'Mínimo 8 caracteres.' },
    { name: 'confirm', label: 'Repite la contraseña', type: 'password', required: true, attrs: 'autocomplete="new-password"' },
    { name: 'must_change', type: 'toggle', toggleLabel: 'Pedirle que elija su propia contraseña al entrar por primera vez', full: true },
  ];
  const findAdmin = (adminId) => admins.find((a) => String(a.id) === adminId);

  document.querySelector('[data-admins]').addEventListener('click', async (e) => {
    if (e.target.closest('[data-add-admin]')) {
      return formModal({
        title: 'Agregar administrador',
        fields: passwordFields(true),
        values: { must_change: true },
        submitLabel: 'Crear acceso',
        onSubmit: async (v) => {
          if (v.password !== v.confirm) throw new Error('Las contraseñas no coinciden');
          await api('/admin/admins', { method: 'POST', body: v });
          toast(`Acceso creado para ${v.username}`);
          Router.refresh();
        },
      });
    }
    const reset = e.target.closest('[data-reset-admin]');
    if (reset) {
      const a = findAdmin(reset.dataset.resetAdmin);
      return formModal({
        title: `Nueva contraseña para ${a.username}`,
        intro: `<p class="muted small">Se cerrarán sus sesiones abiertas y deberá entrar con la contraseña nueva.</p>`,
        fields: passwordFields(false),
        values: { must_change: true },
        submitLabel: 'Guardar contraseña',
        onSubmit: async (v) => {
          if (v.password !== v.confirm) throw new Error('Las contraseñas no coinciden');
          await api(`/admin/admins/${a.id}/password`, { method: 'PUT', body: v });
          toast('Contraseña actualizada');
          Router.refresh();
        },
      });
    }
    const del = e.target.closest('[data-del-admin]');
    if (del) {
      const a = findAdmin(del.dataset.delAdmin);
      const ok = await confirmDialog({
        title: 'Eliminar administrador',
        message: `<strong>${esc(a.name || a.username)}</strong> ya no podrá entrar al panel. El contenido que creó se conserva.`,
      });
      if (!ok) return;
      try {
        await api(`/admin/admins/${a.id}`, { method: 'DELETE' });
        toast('Administrador eliminado');
        Router.refresh();
      } catch (ex) {
        toast(ex.message, 'error');
      }
    }
  });

  const wire = (form, fields, send) => {
    bindFields(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('[data-error]');
      err.hidden = true;
      const btn = form.querySelector('[type=submit]');
      setBusy(btn, true, 'Guardando…');
      try {
        await send(readFields(form, fields), form);
      } catch (ex) {
        err.innerHTML = `${icon('alert')}<span>${esc(ex.message)}</span>`;
        err.hidden = false;
      } finally {
        setBusy(btn, false);
      }
    });
  };

  document.querySelector('[data-recheck]')?.addEventListener('click', () => {
    toast('Revisando…');
    Router.refresh();
  });

  wire(document.querySelector('[data-site]'), siteFields, async (v) => {
    const saved = await api('/admin/settings', { method: 'PUT', body: v });
    A.settings = saved;
    document.querySelectorAll('[data-site-name]').forEach((el) => (el.textContent = saved.site_name));
    document.querySelectorAll('[data-site-tagline]').forEach((el) => (el.textContent = saved.site_tagline || saved.university || ''));
    Shell.siteName = saved.site_name;
    toast('Ajustes guardados');
  });

  wire(document.querySelector('[data-account]'), accountFields, async (v, form) => {
    if (v.new_password && v.new_password !== v.confirm_password) throw new Error('Las contraseñas nuevas no coinciden');
    await api('/admin/account', { method: 'PUT', body: v });
    toast('Cuenta actualizada');
    if (v.new_password) A.auth.user.must_change = 0;
    A.auth.user.username = v.username;
    A.auth.user.name = v.name;
    document.querySelectorAll('[data-user-name]').forEach((el) => (el.textContent = v.name || v.username));
    document.querySelectorAll('[data-user-avatar]').forEach((el) => (el.textContent = initials(v.name || v.username)));
    form.querySelectorAll('input[type=password]').forEach((i) => (i.value = ''));
    form.querySelector('.alert.warn')?.remove();
  });
}

/* ---------- menú "Más" (móvil) ---------- */

function moreMenu() {
  const m = openModal({
    title: 'Más opciones',
    size: 'sm',
    body: `<div class="sheet-menu">
      <a href="#/facultades" data-close><span class="m-ico">${icon('landmark')}</span>Facultades y carreras</a>
      <a href="#/semestres" data-close><span class="m-ico">${icon('layers')}</span>Semestres</a>
      <a href="#/estudiantes" data-close><span class="m-ico">${icon('users')}</span>Estudiantes</a>
      <a href="#/ajustes" data-close><span class="m-ico">${icon('settings')}</span>Ajustes</a>
      <a href="/app" target="_blank" rel="noopener" data-close><span class="m-ico">${icon('eye')}</span>Ver como estudiante</a>
      <button type="button" data-theme><span class="m-ico">${icon(currentTheme() === 'dark' ? 'sun' : 'moon')}</span>Cambiar tema</button>
      <button type="button" data-out><span class="m-ico" style="color:var(--danger);background:color-mix(in srgb,var(--danger) 12%,transparent)">${icon('logout')}</span>Cerrar sesión</button>
    </div>`,
  });
  m.el.querySelector('[data-theme]').onclick = () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    m.close();
  };
  m.el.querySelector('[data-out]').onclick = logout;
}

/* ---------- arranque ---------- */

(async function start() {
  let data;
  try {
    data = await api('/auth/me');
  } catch {
    location.href = '/';
    return;
  }
  if (!data.auth || data.auth.role !== 'admin') {
    location.href = '/';
    return;
  }
  A.auth = data.auth;
  A.settings = await api('/admin/settings');
  if (data.settings && data.settings.demo) {
    document.body.insertAdjacentHTML('afterbegin', `<div class="as-banner">${icon('sparkles')}<span>Versión de demostración: los datos son de ejemplo y se reinician solos. Nada de lo que hagas aquí afecta al portal real.</span></div>`);
  }

  const viewAs = document.getElementById('view-as-student');
  if (viewAs) viewAs.innerHTML = `${icon('eye')} Ver como estudiante`;

  Shell.init({
    role: 'Administrador',
    user: A.auth.user,
    settings: A.settings,
    nav: [
      { section: 'General' },
      { href: '#/resumen', icon: 'home', label: 'Resumen' },
      { href: '#/calendario', icon: 'calendar', label: 'Calendario' },
      { section: 'Contenido' },
      { href: '#/facultades', icon: 'landmark', label: 'Facultades' },
      { href: '#/semestres', icon: 'layers', label: 'Semestres' },
      { href: '#/materias', icon: 'book', label: 'Materias' },
      { href: '#/materiales', icon: 'folder', label: 'Materiales' },
      { section: 'Acceso' },
      { href: '#/estudiantes', icon: 'users', label: 'Estudiantes' },
      { href: '#/ajustes', icon: 'settings', label: 'Ajustes' },
    ],
    bottomNav: [
      { href: '#/resumen', icon: 'home', label: 'Resumen' },
      { href: '#/materias', icon: 'book', label: 'Materias' },
      { href: '#/calendario', icon: 'calendar', label: 'Calendario' },
      { href: '#/materiales', icon: 'folder', label: 'Materiales' },
      { action: 'more', icon: 'more', label: 'Más', matches: ['/facultades', '/semestres', '/estudiantes', '/ajustes'] },
    ],
    onMore: moreMenu,
  });

  await refreshRefs();
  Router.on('/resumen', pageOverview)
    .on('/facultades', pageStructure)
    .on('/semestres', pageSemesters)
    .on('/materias', pageSubjectsAdmin)
    .on('/materias/:id', pageSubjectAdmin)
    .on('/calendario', pageCalendarAdmin)
    .on('/materiales', pageMaterialsAdmin)
    .on('/estudiantes', pageStudents)
    .on('/ajustes', pageSettings)
    .start('/resumen');
})();
