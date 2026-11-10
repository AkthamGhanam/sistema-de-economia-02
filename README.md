<p align="center"><img src="public/img/logo.svg" width="88" alt="Logo de Economía 02"></p>

# Economía 02 · Portal académico

Portal web para la universidad donde los estudiantes entran con su **cédula y correo** y encuentran:

- 📚 **Materias por semestre**: profesor, horario, aula, créditos e información general de cada materia.
- 🧑‍🏫 **Clases**: el tema y contenido de cada clase, con sus archivos adjuntos.
- 📁 **Materiales de apoyo**: PDF, Word, PowerPoint, Excel, imágenes, videos y enlaces (YouTube, Drive…), para ver o descargar.
- 🗓️ **Calendario de evaluaciones**: exámenes, parciales, quices, entregas y exposiciones, con cuenta regresiva para la próxima.

Y un **panel de administración** exclusivo para ti, donde cargas todo: semestres, materias, clases, materiales, fechas del calendario y la lista de estudiantes que pueden entrar.

Funciona en **teléfono y computadora** (diseño adaptable, menú inferior en el móvil) y tiene **modo claro y oscuro**.

| Inicio del estudiante (PC) | Teléfono |
| --- | --- |
| ![Inicio](docs/capturas/inicio-estudiante.jpg) | ![Inicio móvil](docs/capturas/movil-inicio.jpg) |

| Detalle de materia | Calendario |
| --- | --- |
| ![Materia](docs/capturas/materia.jpg) | ![Calendario](docs/capturas/calendario.jpg) |

| Panel de administración | Subir material |
| --- | --- |
| ![Admin](docs/capturas/admin-resumen.jpg) | ![Subir](docs/capturas/admin-subir-material.jpg) |

| Login (móvil, modo oscuro) | Calendario (móvil) | Detalle de evaluación |
| --- | --- | --- |
| ![Login](docs/capturas/movil-login.jpg) | ![Calendario móvil](docs/capturas/movil-calendario.jpg) | ![Evaluación](docs/capturas/movil-evaluacion.jpg) |

---

## Logo

![Concepto del logo](docs/logo/concepto.png)

Una línea de mercado que sube, corrige y alcanza su punto máximo. La pequeña caída ocupa el lugar de la barra horizontal de una **A** escondida: no se ve la letra, pero quien la busca la encuentra. Archivos en `public/img/`: `logo.svg` (con fondo), `logo-mark.svg` (solo el trazo), `favicon.svg` y los íconos para celular (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`).

---

## Identidad visual: BytesAcademy

El portal usa la identidad de **Bytes** (manual de identidad visual M.I.V.):

- **Colores:** verde `#19510A`, tinta `#101820` y gris `#D7D7D6`, en modo claro y oscuro.
- **Tipografía:** títulos en *Inter Black Italic* (versión web de Helvetica Now Text Black Italic) y textos en Inter.
- **Logo:** el isotipo de anillos y el logotipo "Bytes" están en `public/js/common.js` (`brandMark`, `brandLockup`) y en `public/img/` (favicon e íconos). Sin sombras ni contornos, como pide el manual.
- **Fondos:** patrón de código binario (`public/img/binary.svg`).
- **Movimiento:** el isotipo se dibuja al cargar y sus anillos giran en direcciones alternas; el título de la pantalla de ingreso se escribe solo y la luz del mouse descubre el código binario; las tarjetas aparecen escalonadas, los números cuentan desde cero y las materias se inclinan en 3D. Todo se apaga si el teléfono o la computadora tiene activado "reducir movimiento" (`Motion` en `public/js/common.js`).

El nombre del curso que eliges en **Ajustes** (por ejemplo "Economía 02") aparece debajo de BytesAcademy.

---

## 1. Ejecutarlo en tu computadora

Necesitas **Node.js 20.12 o superior** (recomendado la versión LTS de [nodejs.org](https://nodejs.org)) y **Git** ([git-scm.com](https://git-scm.com)). No hace falta instalar ninguna base de datos: en tu computadora se guarda todo en la carpeta `data/`.

Descarga el proyecto (solo la primera vez):

```bash
git clone https://github.com/CodeGenius-Aktham/sistema-de-economia-02.git
```

```bash
cd sistema-de-economia-02
```

Instala las dependencias:

```bash
npm install
```

(Opcional) Carga datos de ejemplo para ver el portal lleno:

```bash
npm run demo
```

Arranca el portal:

```bash
npm start
```

Abre <http://localhost:3000>. Para detenerlo presiona `Ctrl + C` en la terminal.

- **Administrador:** usuario `admin`, contraseña `admin123` (el panel te pedirá cambiarla en **Ajustes**).
- **Estudiante de prueba** (si cargaste el demo): cédula **12345678**, correo **estudiante@demo.com**.

Para traer la última versión más adelante:

```bash
git pull
```

```bash
npm install
```

`npm run demo` no hace nada si ya tienes materias cargadas; con `npm run demo -- --force` reemplaza todo el contenido por el de ejemplo.

---

## Cómo se usa

### Como administrador (tú)

Entra en la pestaña **Administrador** de la pantalla de inicio. En el **Resumen** verás una guía de primeros pasos:

1. **Semestres** → crea “Semestre I”, “Semestre II”…
2. **Materias** → agrega cada materia con su color, profesor y su teléfono (con botón de WhatsApp), horario, aula, créditos e información (programa, bibliografía, forma de evaluación…). Los enlaces que escribas se vuelven clicables.
3. Dentro de cada materia:
   - **Clases**: registra el tema y contenido de cada clase.
   - **Materiales**: sube varios archivos a la vez (arrastrando o eligiendo) o pega enlaces. Puedes asociarlos a una clase.
   - **Evaluaciones**: programa exámenes, parciales, quices, entregas o exposiciones.
4. **Calendario** → vista mensual o de lista; toca un día para agregar una evaluación en esa fecha o toca una evaluación para editarla.
5. **Estudiantes** → agrégalos uno por uno o **pega la lista completa** desde Excel/Google Sheets (una línea por estudiante con cédula, correo y nombre, en cualquier orden).
6. **Ajustes** → nombre del portal, universidad, período, mensaje de bienvenida y tu usuario/contraseña.

Con el botón **“Ver como estudiante”** puedes revisar cómo se ve todo desde el lado del estudiante.

### Como estudiante

Entra con su **cédula** y el **correo** que tiene registrado. La cédula se puede escribir con o sin puntos, guiones o la letra V/E (`V-12.345.678` = `12345678`).

- **Inicio**: saludo, cuenta regresiva de la próxima evaluación, próximas fechas, materiales recientes y sus materias.
- **Materias**: filtradas por semestre y con buscador. Cada materia tiene sus pestañas de Materiales, Clases y Evaluaciones.
- **Calendario**: mensual o en lista, filtrable por semestre.
- **Perfil**: su nombre y el semestre que cursa (se usa para mostrarle primero lo suyo).

### Acceso restringido o abierto

Por defecto **solo entran los estudiantes que tú registres**. Si prefieres que cualquiera se registre solo con su cédula y correo, activa **Registro abierto** en Ajustes. Puedes desactivar el acceso de un estudiante en cualquier momento desde su ficha (su sesión se cierra al instante).

---

## 2. Publicarlo en Vercel (gratis)

Vercel **no guarda archivos en su propio disco** (todo lo que se escribe ahí se borra), así que en la nube el portal usa dos servicios gratuitos:

- **Turso** → la base de datos (materias, clases, calendario, estudiantes…).
- **Vercel Blob (privado)** → los archivos de los materiales. Solo se descargan con la sesión iniciada.

El código detecta solo dónde está corriendo: en tu computadora usa la carpeta `data/`; en Vercel usa Turso y Blob.

### Paso 1 · Sube el código a la rama `main` de GitHub

Vercel publica la rama `main`. Si trabajas desde la rama de Claude, únela a `main`:

```bash
git fetch origin
```

```bash
git checkout main
```

```bash
git pull origin main
```

```bash
git merge origin/claude/ecstatic-ramanujan-ry9kwh
```

```bash
git push origin main
```

(También puedes hacerlo desde GitHub abriendo un *Pull request* de la rama hacia `main` y pulsando **Merge**.)

### Paso 2 · Crea la base de datos en Turso

1. Entra a <https://app.turso.tech> y regístrate con tu cuenta de GitHub.
2. Pulsa **Create Database**, ponle de nombre `economia02` y elige la región **AWS US East (Virginia)** (la más cercana a los servidores de Vercel por defecto).
3. Dentro de la base, copia la **URL** (empieza por `libsql://…`) → será `TURSO_DATABASE_URL`.
4. Crea un **token** (botón *Create Token* / *Generate Token*, con permiso de lectura y escritura) y cópialo → será `TURSO_AUTH_TOKEN`.

Guarda ambos valores; los pegarás en Vercel.

### Paso 3 · Importa el proyecto en Vercel

1. Entra a <https://vercel.com/signup> y regístrate con GitHub.
2. Pulsa **Add New… → Project** y elige el repositorio `sistema-de-economia-02` (si no aparece, pulsa *Adjust GitHub App Permissions* y dale acceso).
3. Vercel debería detectar **Express** automáticamente. No cambies los comandos de *Build* ni el *Output Directory*.
4. Abre **Environment Variables** y agrega:

   | Nombre | Valor |
   | --- | --- |
   | `TURSO_DATABASE_URL` | la URL `libsql://…` del paso 2 |
   | `TURSO_AUTH_TOKEN` | el token del paso 2 |
   | `ADMIN_USER` | el usuario que quieras para el panel (ej. `admin`) |
   | `ADMIN_PASSWORD` | una contraseña segura (mínimo 8 caracteres) |

5. Pulsa **Deploy** y espera a que termine (1–2 minutos).

### Paso 4 · Conecta el almacenamiento de archivos (Vercel Blob)

1. En tu proyecto de Vercel abre **Storage → Create Database/Storage → Blob**.
2. Ponle un nombre (ej. `materiales`) y en **Access** elige **Private**.
3. Conéctalo al proyecto en los entornos **Production**, **Preview** y **Development**. Vercel agrega sola la variable `BLOB_READ_WRITE_TOKEN`.
4. Ve a **Deployments**, abre el menú **⋯** del último despliegue y pulsa **Redeploy** para que tome la nueva variable.

### Paso 5 · ¡Listo!

Abre la dirección que te da Vercel (algo como `https://sistema-de-economia-02.vercel.app`), entra en la pestaña **Administrador** con el usuario y contraseña que pusiste en `ADMIN_USER` / `ADMIN_PASSWORD`, y empieza a cargar semestres, materias, materiales y estudiantes. Comparte esa dirección con tus compañeros.

- Cada vez que hagas `git push` a `main`, Vercel publica la nueva versión automáticamente.
- Si al abrir el sitio ves **“Falta un paso de configuración”**, revisa que las variables del paso 3 estén bien escritas y vuelve a desplegar.
- Si al subir un archivo aparece **“Falta conectar Vercel Blob”**, revisa el paso 4.
- Puedes poner un dominio propio en **Settings → Domains**.

**Alternativa por terminal (Vercel CLI):** con la base de Turso ya creada:

```bash
npm install -g vercel
```

```bash
vercel login
```

```bash
vercel link
```

```bash
vercel env add TURSO_DATABASE_URL production
```

```bash
vercel env add TURSO_AUTH_TOKEN production
```

```bash
vercel env add ADMIN_PASSWORD production
```

```bash
vercel blob create-store materiales --access private --yes
```

```bash
vercel --prod
```

### Otras opciones de hosting

Es una aplicación Node.js normal, así que también funciona en cualquier servidor con disco persistente (un VPS, Railway, Render con disco, Docker…), sin Turso ni Blob:

```bash
docker build -t portal-economia .
```

```bash
docker run -d -p 3000:3000 -v portal-datos:/data -e ADMIN_PASSWORD=tu-clave-segura -e TRUST_PROXY=1 portal-economia
```

| Variable | Para qué sirve | Valor por defecto |
| --- | --- | --- |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Administrador que se crea la primera vez | `admin` / `admin123` |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Base de datos en la nube (Turso) | — (usa `DATA_DIR`) |
| `BLOB_READ_WRITE_TOKEN` | Archivos en Vercel Blob privado | — (usa `DATA_DIR/uploads`) |
| `DATA_DIR` | Carpeta local de base de datos y archivos | `./data` |
| `MAX_UPLOAD_MB` | Tamaño máximo por archivo | `50` (local) / `100` (Blob) |
| `PORT` | Puerto del servidor | `3000` |
| `TRUST_PROXY` | Pon `1` si está detrás de un proxy (en Vercel es automático) | — |

**Copias de seguridad:** en local basta con copiar la carpeta `data/`. En Turso puedes exportar la base desde su panel.

---

## Seguridad

- La contraseña del administrador se guarda cifrada (scrypt) y las sesiones usan cookies `HttpOnly` / `SameSite`.
- Solo el administrador puede crear, editar o borrar contenido; los estudiantes únicamente leen y descargan.
- Los archivos solo se pueden descargar con una sesión iniciada (en Vercel se guardan en un Blob **privado** y el servidor los entrega tras comprobar la sesión).
- Hay un límite de intentos fallidos de inicio de sesión.
- **Importante:** la cédula y el correo no son secretos como una contraseña. Cualquiera que conozca la cédula y el correo de un estudiante registrado podría entrar como él. Para un portal de consulta de materiales suele ser suficiente, pero no publiques aquí información confidencial. Sirve el portal siempre con **HTTPS**.

---

## Para desarrolladores

```bash
npm run dev
```

```bash
npm test
```

```
server.js              Servidor Express, páginas y manejo de errores
src/db.js              Base de datos (archivo local o Turso) y esquema
src/storage.js         Archivos (disco local o Vercel Blob privado)
src/auth.js            Contraseñas, sesiones y límite de intentos
src/routes/auth.js     Inicio/cierre de sesión
src/routes/portal.js   API de lectura (estudiantes y admin) y descarga de archivos
src/routes/admin.js    API de administración (CRUD, subidas, importación)
views/                 login.html, app.html (estudiante), admin.html (panel)
public/css/styles.css  Sistema de diseño (claro/oscuro, adaptable)
public/js/             common.js (componentes), student.js, admin.js, login.js
public/js/vendor/      Cliente de subida de Vercel Blob (npm run build:vendor)
scripts/seed-demo.js   Datos de ejemplo
test/                  Pruebas de la API (node:test)
```

Sin compilación ni frameworks en el frontend: HTML, CSS y JavaScript puros. Dependencias del servidor: `express`, `multer`, `@libsql/client` y `@vercel/blob`.
