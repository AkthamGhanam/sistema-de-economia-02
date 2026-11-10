/* =========================================================================
   Portal del estudiante
   ========================================================================= */
'use strict';

const S = { auth: null, settings: null, semesters: null, structure: null };

const isStudent = () => S.auth.role === 'student';
const me = () => S.auth.user;

async function getSemesters(force = false) {
  if (!S.semesters || force) S.semesters = await api('/semesters');
  return S.semesters;
}

async function getStructure(force = false) {
  if (!S.structure || force) S.structure = await api('/structure');
  return S.structure;
}

/** Carrera elegida en los filtros: la recordada en la sesión o la del estudiante. */
function chosenCareer(structure) {
  const saved = sessionStorage.getItem('career');
  if (saved === 'all') return 'all';
  if (saved && careerById(structure, saved)) return saved;
  if (isStudent() && me().career_id && careerById(structure, me().career_id)) return String(me().career_id);
  const first = structure.find((f) => f.careers.length);
  return first ? String(first.careers[0].id) : 'all';
}

function setCareer(value) {
  sessionStorage.setItem('career', value);
  sessionStorage.removeItem('semester');
}

const semestersOf = (career) => api('/semesters', { query: { career_id: career === 'all' ? '' : career } });

/** Consulta de materias/eventos según carrera y semestre elegidos. */
const scopeQuery = (career, semester) => ({
  semester_id: semester && semester !== 'all' ? semester : '',
  career_id: (!semester || semester === 'all') && career !== 'all' ? career : '',
});

/** Semestre elegido en los filtros (se recuerda durante la sesión). */
function chosenSemester(semesters) {
  const saved = sessionStorage.getItem('semester');
  if (saved === 'all') return 'all';
  if (saved && semesters.some((s) => String(s.id) === saved)) return saved;
  // El semestre del estudiante solo aplica si es de la carrera que se está viendo.
  if (isStudent() && me().semester_id && semesters.some((s) => s.id === me().semester_id)) return String(me().semester_id);
  return semesters[0] ? String(semesters[0].id) : 'all';
}

function bindEventClicks(root, events) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('.event[data-event-id], .hero-next[data-event-id]');
    if (!el) return;
    const ev = events.find((x) => String(x.id) === el.dataset.eventId);
    if (ev) showEventDetail(ev);
  });
}

/* ---------- Inicio ---------- */

function countdownHtml(e) {
  const target = new Date(`${e.date}T${e.start_time || '00:00'}:00`);
  const ms = Math.max(0, target - Date.now());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `<div><b>${d}</b><span>${d === 1 ? 'día' : 'días'}</span></div><div><b>${h}</b><span>${h === 1 ? 'hora' : 'horas'}</span></div><div><b>${m}</b><span>min</span></div>`;
}

async function pageHome(ctx) {
  Shell.setTitle('Inicio', S.settings.period ? `Período ${S.settings.period}` : '');
  ctx.render(skeleton());
  const d = await api('/dashboard', { query: { today: todayISO() } });
  if (!ctx.alive()) return;
  const where = [d.career && d.career.name, d.semester && d.semester.name].filter(Boolean).join(' · ');

  const name = firstName(me().name) || (isStudent() ? 'estudiante' : 'admin');
  const next = d.upcoming[0];
  const nt = next && (EVENT_TYPES[next.type] || EVENT_TYPES.otro);
  const semLabel = where || 'Todas las carreras';

  ctx.render(`
    <section class="hero">
      <div class="hero-grid">
        <div>
          <span class="eyebrow">${icon('cap')}${esc(semLabel)}</span>
          ${d.career ? `<div style="margin-top:8px;opacity:.85;font-size:13px">${icon('landmark')} ${esc(d.career.faculty_name)}</div>` : ''}
          <h2>¡Hola, ${esc(name)}!</h2>
          <p>${esc(S.settings.welcome_message || '')}</p>
        </div>
        ${
          next
            ? `<button type="button" class="hero-next" data-event-id="${next.id}">
                <div class="lbl">Próxima evaluación · ${relDay(next.date)}</div>
                <h3>${esc(next.title)}</h3>
                <div class="sub">${icon(nt.icon)} ${nt.label}${next.subject_name ? ` · ${esc(next.subject_name)}` : ''}</div>
                <div class="countdown" data-countdown>${countdownHtml(next)}</div>
              </button>`
            : `<div class="hero-next"><div class="lbl">Próximas evaluaciones</div><h3>No tienes evaluaciones pendientes</h3><div class="sub">Disfruta el respiro. Te avisaremos aquí cuando haya nuevas fechas.</div></div>`
        }
      </div>
    </section>

    <section class="stats" style="--cols:3">
      <a class="stat" href="#/materias" style="--c:#6366f1"><span class="s-ico">${icon('book')}</span><div><b>${d.counts.subjects}</b><span>Materias</span></div></a>
      <a class="stat" href="#/materias" style="--c:#ec4899"><span class="s-ico">${icon('folder')}</span><div><b>${d.counts.materials}</b><span>Materiales</span></div></a>
      <a class="stat" href="#/calendario" style="--c:#f97316"><span class="s-ico">${icon('calendar')}</span><div><b>${d.counts.upcoming30}</b><span>Evaluaciones (30 días)</span></div></a>
    </section>

    <section class="grid-main">
      <div class="card">
        <div class="card-head"><h3><span class="h-ico">${icon('calendar')}</span>Próximas evaluaciones</h3><a class="btn btn-ghost btn-sm" href="#/calendario">Calendario ${icon('arrow-right')}</a></div>
        <div class="card-body">
          ${d.upcoming.length ? `<div class="list" data-events>${d.upcoming.map((e) => eventItem(e)).join('')}</div>` : emptyState({ icon: 'check-circle', title: 'Todo al día', text: 'No hay evaluaciones programadas por ahora.', small: true })}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3><span class="h-ico">${icon('folder')}</span>Materiales recientes</h3></div>
        <div class="card-body">
          ${d.recentMaterials.length ? `<div class="list">${d.recentMaterials.map((m) => materialItem(m, { showSubject: true, showClass: false })).join('')}</div>` : emptyState({ icon: 'folder', title: 'Aún no hay materiales', text: 'Cuando se suban guías o presentaciones aparecerán aquí.', small: true })}
        </div>
      </div>
    </section>

    <section class="stack-sm">
      <div class="section-title"><div><h2>Tus materias</h2><p>${esc(semLabel)}</p></div><a class="btn btn-ghost btn-sm" href="#/materias">Ver todas ${icon('arrow-right')}</a></div>
      ${d.subjects.length ? `<div class="subject-grid">${d.subjects.map(subjectCard).join('')}</div>` : `<div class="card">${emptyState({ icon: 'book', title: 'Todavía no hay materias', text: 'El administrador aún no ha cargado las materias de este semestre.' })}</div>`}
    </section>
  `);

  bindEventClicks(document.getElementById('view'), d.upcoming);
  if (next) {
    Router.interval(() => {
      const el = document.querySelector('[data-countdown]');
      if (el) el.innerHTML = countdownHtml(next);
    }, 30000);
  }
  maybeAskProfile();
}

/* ---------- Materias ---------- */

async function pageSubjects(ctx) {
  Shell.setTitle('Materias', 'Por carrera y semestre');
  ctx.render(skeleton([['60%', '40px'], ['100%', '260px']]));
  const structure = await getStructure();
  if (!ctx.alive()) return;
  if (!structure.some((f) => f.careers.length)) {
    return ctx.render(`<div class="card">${emptyState({ icon: 'landmark', title: 'Aún no hay carreras', text: 'El administrador todavía no ha creado las facultades y carreras.' })}</div>`);
  }

  let career = chosenCareer(structure);
  let semesters = [];
  let current = 'all';
  let subjects = [];
  let q = '';

  ctx.render(`
    <section class="filters">
      <div class="toolbar">
        ${careerPicker(structure, career)}
        <div class="input-icon search">${icon('search')}<input class="input" type="search" placeholder="Buscar materia o profesor…" data-search></div>
        <span class="muted small" data-count></span>
      </div>
      <div data-semchips></div>
    </section>
    <section data-semester-info></section>
    <section data-list></section>
  `);
  const view = document.getElementById('view');

  const draw = () => {
    const term = q.trim().toLowerCase();
    const list = term ? subjects.filter((s) => [s.name, s.professor, s.code].some((v) => (v || '').toLowerCase().includes(term))) : subjects;
    view.querySelector('[data-count]').textContent = `${list.length} materia${list.length === 1 ? '' : 's'}`;
    const sem = semesters.find((s) => String(s.id) === current);
    view.querySelector('[data-semester-info]').innerHTML =
      sem && (sem.description || sem.period)
        ? `<div class="alert info">${icon('info')}<span><strong>${esc(sem.name)}</strong>${sem.period ? ` · ${esc(sem.period)}` : ''}${sem.description ? ` — ${esc(sem.description)}` : ''}</span></div>`
        : '';
    view.querySelector('[data-list]').innerHTML = list.length
      ? `<div class="subject-grid">${list.map((x) => subjectCard(x, { showCareer: career === 'all' })).join('')}</div>`
      : `<div class="card">${emptyState({ icon: term ? 'search' : 'book', title: term ? 'Sin resultados' : 'No hay materias aquí todavía', text: term ? 'Prueba con otro nombre.' : 'Pronto se agregarán las materias.' })}</div>`;
  };

  const loadSubjects = async () => {
    view.querySelector('[data-list]').innerHTML = `<div class="subject-grid">${'<div class="skeleton" style="height:250px"></div>'.repeat(3)}</div>`;
    subjects = await api('/subjects', { query: { ...scopeQuery(career, current), today: todayISO() } });
    if (ctx.alive()) draw();
  };

  const loadSemesters = async () => {
    semesters = career === 'all' ? [] : await semestersOf(career);
    current = semesters.length ? chosenSemester(semesters) : 'all';
    view.querySelector('[data-semchips]').innerHTML = semesters.length ? semesterChips(semesters, current) : '';
    await loadSubjects();
  };

  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sem]');
    if (!b) return;
    current = b.dataset.sem;
    sessionStorage.setItem('semester', current);
    view.querySelectorAll('[data-sem]').forEach((x) => x.classList.toggle('active', x === b));
    loadSubjects();
  });
  view.querySelector('[data-career]').addEventListener('change', (e) => {
    career = e.target.value;
    setCareer(career);
    loadSemesters();
  });
  view.querySelector('[data-search]').addEventListener('input', (e) => {
    q = e.target.value;
    draw();
  });
  await loadSemesters();
}

/* ---------- Facultades ---------- */

async function pageFaculties(ctx) {
  Shell.setTitle('Facultades', 'Explora las carreras de la universidad');
  ctx.render(skeleton([['100%', '220px'], ['100%', '220px']]));
  const structure = await getStructure(true);
  if (!ctx.alive()) return;
  const mine = isStudent() ? String(me().career_id || '') : '';

  ctx.render(`
    <div class="section-title"><div><h2>${structure.length} facultad${structure.length === 1 ? '' : 'es'}</h2>
      <p>Toca una carrera para ver sus semestres y materias.</p></div></div>
    ${
      structure.length
        ? `<div class="faculty-grid">${structure
            .map(
              (f) => `<section class="faculty-card" style="--c:${f.color || '#8b5cf6'}">
                <div class="faculty-head">
                  <div class="f-ico">${icon('landmark')}</div>
                  ${f.code ? `<span class="badge">${esc(f.code)}</span>` : ''}
                  <h3 style="margin-top:8px">${esc(f.name)}</h3>
                  ${f.description ? `<p>${esc(f.description)}</p>` : ''}
                </div>
                <div class="career-list">${
                  f.careers.length
                    ? f.careers
                        .map(
                          (c) => `<button type="button" class="career-row" style="--c:${c.color || f.color || '#6366f1'}" data-career-id="${c.id}">
                            <span class="dot"></span>
                            <span class="info"><strong>${esc(c.name)}</strong><span>${c.semester_count} semestre${c.semester_count === 1 ? '' : 's'} · ${c.subject_count} materia${c.subject_count === 1 ? '' : 's'}</span></span>
                            ${String(c.id) === mine ? '<span class="badge" style="display:inline-flex">Tu carrera</span>' : ''}
                            <span class="muted">${icon('right')}</span>
                          </button>`
                        )
                        .join('')
                    : emptyState({ icon: 'landmark', title: 'Sin carreras todavía', small: true })
                }</div>
              </section>`
            )
            .join('')}</div>`
        : `<div class="card">${emptyState({ icon: 'landmark', title: 'Aún no hay facultades', text: 'El administrador todavía no ha creado la estructura de la universidad.' })}</div>`
    }
  `);
  document.getElementById('view').addEventListener('click', (e) => {
    const b = e.target.closest('[data-career-id]');
    if (!b) return;
    setCareer(b.dataset.careerId);
    location.hash = '#/materias';
  });
}

/* ---------- Detalle de materia ---------- */

async function pageSubject(ctx) {
  ctx.render(skeleton([['100%', '240px'], ['50%', '44px'], ['100%', '300px']]));
  const s = await api(`/subjects/${encodeURIComponent(ctx.params.id)}`);
  if (!ctx.alive()) return;
  Shell.setTitle(s.name, s.semester_name);

  const t = todayISO();
  const upcoming = s.events.filter((e) => e.date >= t);
  const past = s.events.filter((e) => e.date < t).reverse();
  const tabs = [
    ['materiales', 'Materiales', 'folder', s.materials.length],
    ['clases', 'Clases', 'book', s.classes.length],
    ['evaluaciones', 'Evaluaciones', 'calendar', s.events.length],
  ];
  let tab = sessionStorage.getItem('subject-tab') || 'materiales';
  if (!tabs.some(([k]) => k === tab)) tab = 'materiales';

  ctx.render(`
    ${subjectHero(s)}
    ${s.description ? `<section class="card card-pad"><h3 style="font-size:16px;margin-bottom:10px;display:flex;gap:8px;align-items:center">${icon('info')} Sobre la materia</h3><div class="rich">${linkify(s.description)}</div></section>` : ''}
    <section class="stack-sm">
      <div class="tabs" role="tablist" style="align-self:flex-start;max-width:100%">
        ${tabs.map(([k, l, ic, n]) => `<button class="tab ${k === tab ? 'active' : ''}" data-tab="${k}" role="tab">${icon(ic)}${l}<span class="count">${n}</span></button>`).join('')}
      </div>
      <div data-panel></div>
    </section>
  `);

  const view = document.getElementById('view');
  const panel = view.querySelector('[data-panel]');
  const draw = () => {
    if (tab === 'materiales') {
      panel.innerHTML = s.materials.length
        ? `<div class="list">${s.materials.map((m) => materialItem(m)).join('')}</div>`
        : `<div class="card">${emptyState({ icon: 'folder', title: 'Sin materiales todavía', text: 'Aquí aparecerán guías, lecturas, presentaciones y enlaces de la materia.' })}</div>`;
    } else if (tab === 'clases') {
      panel.innerHTML = classTimeline(s) || `<div class="card">${emptyState({ icon: 'book', title: 'Sin clases registradas', text: 'Aquí verás los temas de cada clase y sus materiales.' })}</div>`;
    } else {
      panel.innerHTML = s.events.length
        ? `<div class="stack">
            ${upcoming.length ? `<div class="month-group"><h4>Próximas</h4><div class="list">${upcoming.map((e) => eventItem(e, { showSubject: false })).join('')}</div></div>` : ''}
            ${past.length ? `<div class="month-group" style="opacity:.75"><h4>Anteriores</h4><div class="list">${past.map((e) => eventItem(e, { showSubject: false })).join('')}</div></div>` : ''}
          </div>`
        : `<div class="card">${emptyState({ icon: 'calendar', title: 'Sin evaluaciones programadas', text: 'Cuando se fijen fechas de exámenes aparecerán aquí.' })}</div>`;
    }
  };
  view.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    sessionStorage.setItem('subject-tab', tab);
    view.querySelectorAll('.tabs [data-tab]').forEach((x) => x.classList.toggle('active', x === b));
    draw();
  });
  bindEventClicks(panel, s.events);
  draw();
}

/* ---------- Calendario ---------- */

async function pageCalendar(ctx) {
  Shell.setTitle('Calendario', 'Exámenes, parciales y entregas');
  ctx.render(skeleton([['60%', '40px'], ['100%', '520px']]));
  const structure = await getStructure();
  if (!ctx.alive()) return;
  let career = chosenCareer(structure);
  let current = 'all';

  ctx.render(`
    <section class="filters">
      <div class="toolbar">${careerPicker(structure, career)}</div>
      <div data-semchips></div>
      <div class="legend">${Object.values(EVENT_TYPES)
        .map((t) => `<span><span class="badge" style="--c:${t.color}">${icon(t.icon)}${t.label}</span></span>`)
        .join('')}</div>
    </section>
    <section data-calendar></section>
  `);
  const view = document.getElementById('view');

  const cal = new CalendarView(view.querySelector('[data-calendar]'), {
    load: (from, to) => api('/events', { query: { from, to, ...scopeQuery(career, current) } }),
    onEvent: (e) => showEventDetail(e),
  });
  const loadSemesters = async () => {
    const semesters = career === 'all' ? [] : await semestersOf(career);
    current = semesters.length ? chosenSemester(semesters) : 'all';
    view.querySelector('[data-semchips]').innerHTML = semesters.length ? semesterChips(semesters, current) : '';
  };
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sem]');
    if (!b) return;
    current = b.dataset.sem;
    sessionStorage.setItem('semester', current);
    view.querySelectorAll('[data-sem]').forEach((x) => x.classList.toggle('active', x === b));
    cal.reload();
  });
  view.querySelector('[data-career]').addEventListener('change', async (e) => {
    career = e.target.value;
    setCareer(career);
    await loadSemesters();
    cal.reload();
  });
  await loadSemesters();
  await cal.reload();
}

/* ---------- Perfil ---------- */

function profileFields(structure, semesters) {
  return [
    { name: 'name', label: 'Nombre y apellido', placeholder: 'Ej: María Pérez', full: true, required: true },
    {
      name: 'career_id',
      label: 'Carrera',
      type: 'select',
      full: true,
      required: true,
      options: [{ value: '', label: 'Elige tu carrera' }, ...careerFieldOptions(structure)],
    },
    {
      name: 'semester_id',
      label: 'Semestre que cursas',
      type: 'select',
      full: true,
      options: [{ value: '', label: 'Sin definir' }, ...semesters.map((s) => ({ value: s.id, label: s.name + (s.period ? ` (${s.period})` : '') }))],
      hint: 'Lo usamos para mostrarte primero tus materias y evaluaciones.',
    },
  ];
}

/** El semestre depende de la carrera elegida. */
function wireCareerSemester(form) {
  const careerSel = form.querySelector('[name=career_id]');
  const semSel = form.querySelector('[name=semester_id]');
  careerSel.addEventListener('change', async () => {
    semSel.disabled = true;
    const list = careerSel.value ? await semestersOf(careerSel.value) : [];
    semSel.innerHTML = optionsHtml([{ value: '', label: 'Sin definir' }, ...list.map((x) => ({ value: x.id, label: x.name + (x.period ? ` (${x.period})` : '') }))], '');
    semSel.disabled = false;
  });
}

async function saveProfile(values) {
  await api('/me', { method: 'PUT', body: values });
  const fresh = await api('/auth/me');
  if (fresh.auth) S.auth = fresh.auth;
  sessionStorage.removeItem('semester');
  sessionStorage.removeItem('career');
  document.querySelectorAll('[data-user-name]').forEach((el) => (el.textContent = me().name));
  document.querySelectorAll('[data-user-avatar]').forEach((el) => (el.textContent = initials(me().name)));
  document.querySelectorAll('[data-user-role]').forEach((el) => (el.textContent = me().career_name || 'Estudiante'));
}

async function maybeAskProfile() {
  if (!isStudent() || (me().name && me().career_id) || sessionStorage.getItem('asked-profile')) return;
  sessionStorage.setItem('asked-profile', '1');
  const structure = await getStructure();
  const semesters = me().career_id ? await semestersOf(me().career_id) : [];
  formModal({
    title: 'Completa tu perfil',
    intro: `<p class="muted">¡Bienvenido/a! Cuéntanos cómo te llamas, qué carrera estudias y qué semestre cursas.</p>`,
    fields: profileFields(structure, semesters),
    values: { name: me().name || '', career_id: me().career_id || '', semester_id: me().semester_id || '' },
    submitLabel: 'Guardar',
    onMount: wireCareerSemester,
    onSubmit: async (v) => {
      await saveProfile(v);
      toast('¡Perfil actualizado!');
      Router.refresh();
    },
  });
}

async function pageProfile(ctx) {
  Shell.setTitle('Mi perfil');
  if (!isStudent()) {
    return ctx.render(`<div class="card">${emptyState({ icon: 'user', title: 'Estás viendo el portal como administrador', text: 'El perfil solo aplica para estudiantes.', action: `<a class="btn btn-primary" href="/admin">${icon('arrow-left')} Volver al panel</a>` })}</div>`);
  }
  const structure = await getStructure();
  const semesters = me().career_id ? await semestersOf(me().career_id) : [];
  if (!ctx.alive()) return;
  const u = me();
  const fields = profileFields(structure, semesters);

  ctx.render(`
    <section class="grid-main">
      <div class="card card-pad stack">
        <div class="row" style="gap:18px">
          <div class="avatar lg" data-user-avatar>${esc(initials(u.name || 'E'))}</div>
          <div style="min-width:0">
            <h2 style="font-size:22px" data-user-name>${esc(u.name || 'Estudiante')}</h2>
            <p class="muted">${esc([u.career_name || 'Carrera sin definir', u.semester_name].filter(Boolean).join(' · '))}</p>
            ${u.faculty_name ? `<p class="small muted">${icon('landmark')} ${esc(u.faculty_name)}</p>` : ''}
          </div>
        </div>
        <div class="detail-list">
          <div class="d"><span class="t-ico">${icon('id')}</span><div><small>Cédula</small><strong>${esc(u.cedula)}</strong></div></div>
          <div class="d"><span class="t-ico">${icon('mail')}</span><div style="min-width:0"><small>Correo</small><strong style="word-break:break-all">${esc(u.email)}</strong></div></div>
        </div>
        <p class="small muted">Tu cédula y correo los gestiona el administrador. Si hay un error, escríbele para corregirlo.</p>
      </div>
      <form class="card card-pad stack" data-profile novalidate>
        <h3 style="font-size:17px">Editar datos</h3>
        <div class="alert" data-error hidden></div>
        ${fieldsHtml(fields, { name: u.name || '', career_id: u.career_id || '', semester_id: u.semester_id || '' })}
        <div class="row wrap">
          <button type="submit" class="btn btn-primary">${icon('check')} Guardar cambios</button>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-theme-btn>${icon('moon')} Cambiar tema</button>
          <button type="button" class="btn btn-danger-soft" data-logout-btn>${icon('logout')} Cerrar sesión</button>
        </div>
      </form>
    </section>
  `);

  const form = document.querySelector('[data-profile]');
  wireCareerSemester(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('[data-error]');
    err.hidden = true;
    const v = readFields(form, fields);
    if (!v.name.trim()) {
      err.innerHTML = `${icon('alert')}<span>Escribe tu nombre</span>`;
      err.hidden = false;
      return;
    }
    const btn = form.querySelector('[type=submit]');
    setBusy(btn, true, 'Guardando…');
    try {
      await saveProfile(v);
      toast('Cambios guardados');
      Router.refresh();
    } catch (ex) {
      err.innerHTML = `${icon('alert')}<span>${esc(ex.message)}</span>`;
      err.hidden = false;
      setBusy(btn, false);
    }
  });
  form.querySelector('[data-theme-btn]').onclick = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  form.querySelector('[data-logout-btn]').onclick = logout;
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
  if (!data.auth) {
    location.href = '/';
    return;
  }
  S.auth = data.auth;
  S.settings = data.settings;

  if (S.settings.demo) {
    document.getElementById('as-banner').insertAdjacentHTML('beforeend', `<div class="as-banner">${icon('sparkles')}<span>Versión de demostración: los datos son de ejemplo y se reinician solos.</span></div>`);
  }
  if (!isStudent()) {
    document.getElementById('as-banner').innerHTML += `<div class="as-banner">${icon('eye')} Estás viendo el portal como lo ven los estudiantes. <a href="/admin">Volver al panel de administración</a></div>`;
  }

  Shell.init({
    role: isStudent() ? me().career_name || 'Estudiante' : 'Administrador',
    user: me(),
    settings: S.settings,
    nav: [
      { section: 'Menú' },
      { href: '#/inicio', icon: 'home', label: 'Inicio' },
      { href: '#/materias', icon: 'book', label: 'Materias' },
      { href: '#/facultades', icon: 'landmark', label: 'Facultades' },
      { href: '#/calendario', icon: 'calendar', label: 'Calendario' },
      { href: '#/perfil', icon: 'user', label: 'Mi perfil' },
    ],
    bottomNav: [
      { href: '#/inicio', icon: 'home', label: 'Inicio' },
      { href: '#/materias', icon: 'book', label: 'Materias' },
      { href: '#/facultades', icon: 'landmark', label: 'Facultades' },
      { href: '#/calendario', icon: 'calendar', label: 'Calendario' },
      { href: '#/perfil', icon: 'user', label: 'Perfil' },
    ],
  });

  Router.on('/inicio', pageHome)
    .on('/materias', pageSubjects)
    .on('/materias/:id', pageSubject)
    .on('/facultades', pageFaculties)
    .on('/calendario', pageCalendar)
    .on('/perfil', pageProfile)
    .start('/inicio');
})();
