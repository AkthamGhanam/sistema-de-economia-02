/* Pantalla de inicio de sesión */
'use strict';

(function () {
  const $ = (s) => document.querySelector(s);

  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      el.outerHTML = icon(el.dataset.icon);
    });
  }

  hydrateBrand();
  hydrateIcons();
  bindThemeToggles();
  $('#year').textContent = new Date().getFullYear();

  api('/auth/settings')
    .then((s) => {
      document.querySelectorAll('[data-s]').forEach((el) => {
        const v = s[el.dataset.s];
        if (v) el.textContent = v;
      });
      document.title = `Ingresar · ${BRAND_NAME}`;
      if (s.allow_self_register) {
        $('#register-note').textContent = '¿Primera vez? Escribe tu cédula y correo y tu cuenta se creará automáticamente.';
      }
    })
    .catch(() => {});

  /* ----- selector estudiante / admin ----- */
  const seg = $('.segmented');
  const indicator = seg.querySelector('.seg-indicator');
  const tabs = [...seg.querySelectorAll('[data-tab]')];

  function moveIndicator() {
    const active = seg.querySelector('[data-tab].active');
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft - 5}px)`;
  }

  function selectTab(name) {
    tabs.forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === name);
      t.setAttribute('aria-selected', String(t.dataset.tab === name));
    });
    $('#student-form').hidden = name !== 'student';
    $('#admin-form').hidden = name !== 'admin';
    $('#login-sub').textContent = name === 'student' ? 'Ingresa con tu cédula y tu correo.' : 'Ingresa con tu usuario y contraseña de administrador.';
    moveIndicator();
    history.replaceState(null, '', name === 'admin' ? '#admin' : location.pathname);
  }

  tabs.forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.tab)));
  window.addEventListener('resize', moveIndicator);
  selectTab(location.hash === '#admin' ? 'admin' : 'student');
  requestAnimationFrame(moveIndicator);
  document.fonts?.ready.then(moveIndicator);

  /* ----- mostrar contraseña ----- */
  const passBtn = $('#toggle-pass');
  const pass = $('#password');
  passBtn.innerHTML = icon('eye');
  passBtn.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    passBtn.innerHTML = icon(show ? 'eye-off' : 'eye');
    passBtn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  /* ----- envío ----- */
  function handle(form, endpoint, collect) {
    const err = form.querySelector('[data-error]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const data = collect();
      const missing = Object.entries(data).find(([, v]) => !String(v).trim());
      if (missing) {
        err.innerHTML = `${icon('alert')}<span>Completa todos los campos.</span>`;
        err.hidden = false;
        return;
      }
      const btn = form.querySelector('[type=submit]');
      setBusy(btn, true, 'Ingresando…');
      try {
        const res = await api(endpoint, { method: 'POST', body: data });
        location.href = res.redirect || '/';
      } catch (ex) {
        err.innerHTML = `${icon('alert')}<span>${esc(ex.message)}</span>`;
        err.hidden = false;
        setBusy(btn, false);
      }
    });
  }

  handle($('#student-form'), '/auth/login/student', () => ({ cedula: $('#cedula').value, email: $('#email').value }));
  handle($('#admin-form'), '/auth/login/admin', () => ({ username: $('#username').value, password: $('#password').value }));
})();
