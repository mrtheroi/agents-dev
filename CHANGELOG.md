# Changelog

Todos los cambios notables de este marketplace se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
versionado sigue [Semantic Versioning](https://semver.org/lang/es/). La versión de
referencia de este archivo es el `version` de `.claude-plugin/marketplace.json`; cada
plugin versiona por separado en su propio `plugin.json`.

## [Unreleased]

### Added

- **Evals para los cinco subagentes** — cobertura 5/5, diez casos. Los tres nuevos
  (`pr-reviewer`, `python-task-builder`, `laravel-task-builder`) cubren lo que más
  importa que no se silencie: que un builder **pare y documente** ante una columna que
  no existe en vez de improvisar una migración, que no invente `app/Domain/` en un repo
  canónico, y que declare el RED antes de escribir producción.

  Dos arreglos al harness lo hicieron posible. La instrucción enviada con el fixture
  estaba **hardcodeada con forma de review**; un task-builder al que le pides «reportá
  hallazgos» responde como reviewer y su doctrina nunca se ejerce, así que cada caso
  puede ahora sobreescribirla con `instruction` (el default no cambia). Y la corrida
  pasa a ser **hermética** con `--tools Read Grep Glob`: el frontmatter se descarta
  antes de invocar, de modo que el `tools:` del agente no aplicaba y un caso que dijera
  «implementá esto» podía escribir en el repo que estaba evaluando.
- **`agent-memory.md`** en `common/standards/`, doctrina de memoria para el
  **orquestador**. Lo hereda `batch-review` vía `@include`, y lo heredará cualquier
  skill que coordine subagentes.

  Va como standard y no como skill a propósito: un skill se dispara cuando su
  descripción casa con la tarea, y «recordar» no es una tarea aparte — es una propiedad
  de cada workflow que orquesta. Suelto no se activaría durante un review.

  La regla que lo estructura: **el subagente nunca escribe en memoria, el orquestador
  sí.** Un subagente que declara una herramienta de memoria que su entorno no provee
  **no carga en absoluto** —no hay degradación elegante, el spawn falla—, así que en un
  marketplace que corre en repos ajenos ningún subagente puede cargar esa dependencia.
  Es la misma forma que la regla de fan-out: el subagente devuelve, tú registras.

  Cubre además qué vale la pena guardar (decisiones **con su porqué**, hallazgos
  descartados y por qué, qué ya se verificó — nunca transcripciones ni diffs enteros),
  qué no puede salir jamás del repo consumidor (secretos, PII, hosts internos: se
  registra **la forma, no el contenido** — «un literal de credencial en
  `src/config.py:42`», nunca la credencial), y que lo recuperado es **una afirmación, no
  un hecho**: era cierto cuando se escribió, así que ranquea por debajo del código y se
  verifica antes de actuar.
- **`security-checklist.md`** en `common/standards/`, cosechado del marketplace de origen
  y neutralizado. Veinte filas OWASP, cada una con una columna **"Applies when"** que se
  evalúa contra el cambio concreto, no en abstracto. Lo valioso no es la tabla sino el
  protocolo: al **construir** hay que recorrer cada fila y confirmarla o declarar por qué
  no aplica —saltarla en silencio está prohibido, porque una fila que no mencionas se lee
  como una fila que no miraste—; al **revisar**, una fila aplicable sin atender es un
  hallazgo. Todas sus filas son de nivel **defecto**, y el standard lo dice para que nadie
  las degrade a consecuencia o a gusto. Lo componen los cinco subagentes.
- **`db-change-request-template.md`** en `common/standards/`. Codifica una regla dura que
  ningún builder tenía: **nunca corres una migración ni aplicas DDL**; documentas la
  petición y paras. Un runner instalado y funcionando no es autorización para usarlo. En
  repos cuyo ORM versiona las migraciones (Eloquent, Alembic, Django, Rails) distingue
  **escribir el archivo de aplicarlo** —solo lo primero puede ser tuyo— y delega al
  `CLAUDE.md` del consumidor quién lo escribe. Lo componen los dos task-builders; los
  reviewers no, porque leen un diff y nunca necesitan cambiar un esquema.
- **`[Unreleased]` en este CHANGELOG.** La 0.1.0 quedó congelada en el tag `v0.1.0`; lo
  que venga se acumula aquí. Mientras no existió el tag, todo se fue acumulando dentro
  de la 0.1.0 y sus números de versión quedaron desincronizados más de una vez.

### Fixed

- **`check-version-bump.mjs` no veía los archivos nuevos sin rastrear.** `git diff` no
  los muestra, así que un agente o un eval recién creado dentro de un plugin se leía
  como «aquí no cambió nada» hasta que alguien lo stageara — y esta guarda se usa sobre
  todo **antes** del commit, que es justo donde fallaba. En CI no se notaba porque allí
  todo va commiteado.
- **`check-neutrality.mjs` escanea ahora la identidad de git**, no solo archivos. Era un
  punto ciego real: seis commits se publicaron con una dirección de empresa heredada del
  `~/.gitconfig` global mientras la guarda reportaba el árbol limpio. Revisa
  `user.name`/`user.email` y el autor, committer y tagger de los commits que la rama
  añade sobre la base.

  Dos límites deliberados, documentados en la salida del propio script: la identidad se
  coteja **solo contra los términos del overlay local**, porque una dirección de empresa
  y una personal tienen la misma forma y ninguna regex las distingue; y mira **solo los
  commits nuevos**, nunca la historia entera, porque una historia ya publicada es una
  decisión de su dueño y una guarda que falla para siempre sobre un pasado aceptado es
  una guarda que se apaga.

## [0.1.0] — 2026-09-16

Primera versión. El repo nace como hermano comunitario de un marketplace corporativo
previo, del que se heredan dos plugins ya maduros, desacoplados de cualquier empresa
o proyecto concreto, más un plugin nuevo escrito aquí.

### Added

- **Marketplace `claude-dev-agents`** con tres plugins: `common`, `python` y `laravel`.
- **`plugins/common` v1.6.0** — capa universal de standards (`code-review`,
  `engineering-principles`, `subagent-contract`, `orchestration`,
  `changelog-versioning`) más el agente agnóstico `pr-reviewer`, el comando
  `/batch-review` y su skill.
- **Nuevo standard `project-grounding.md`** en la capa `common`. Fija la precedencia
  **código > `CLAUDE.md` del proyecto > doctrina de stack > conocimiento genérico**, y
  obliga a los agentes a *detectar* las convenciones del repo consumidor en vez de
  llevar hechos de un proyecto grabados. Es la pieza que permite que estos agentes
  sirvan a cualquier repo. **Lo componen los cinco subagentes**: con él, un agente deja
  de suponer el layout y pasa a leer el `CLAUDE.md` del proyecto antes de tocar nada,
  anunciando en su primera línea sobre qué se fundó. En `python-task-builder` hubo que
  reconciliar el intro, que declaraba sus propias secciones «authoritative» y
  contradecía esa precedencia.
- **`plugins/python` v0.3.0** — `python-task-builder` (TDD estricto sobre arquitectura
  hexagonal) y `python-code-reviewer`.
- **`plugins/laravel` v0.1.1** — `laravel-task-builder` y `laravel-code-reviewer`.
  Laravel es en sí mismo una opinión, así que ambos agentes **detectan** el repo antes
  de actuar: el escalón arquitectónico (canónico / service layer / hexagonal, leído del
  `autoload.psr-4` de `composer.json`), la superficie (API-only / fullstack / híbrida) y
  el runner (Pest o PHPUnit). A diferencia del de Python, el builder **no crea
  estructura**: escribe dentro de la que encuentra, porque levantar un `app/Domain/` en
  un repo canónico sería justo el acoplamiento que prohíbe la regla de oro.
- **Neutralidad en tres niveles**, el principio que gobierna el plugin `laravel` y que
  puede generalizarse a cualquier framework opinionado: **defecto** (rompe en cualquier
  estilo — mass assignment, inyección SQL, `env()` fuera de `config/`, endpoint sin
  autorización) se marca; **consecuencia** (N+1, excepciones que escapan del formateador
  de errores, sobre JSON inconsistente) se reporta con su costo medible y **sin
  veredicto**; **gusto** (trait vs handler, Pest vs PHPUnit, forma del sobre) se calla.
  Cada regla del agente lleva su nivel etiquetado. Un hallazgo que dice qué *preferir*
  no enseña nada; uno que muestra lo que el código *cuesta* deja decidir.
- **Guardas de CI** en GitHub Actions: integridad del manifiesto, sincronía de la capa
  de dos niveles, integridad de evals, **neutralidad de proyecto**, **bump de versión**
  y frescura del catálogo.
- **Primeros evals** — `laravel-code-reviewer` (3 casos) y `python-code-reviewer`
  (2 casos), con fixtures propios en `plugins/<stack>/evals/fixtures/*.diff`. El caso
  más importante es el de Laravel que verifica lo que el agente **NO** debe hacer:
  ante un controlador canónico correcto —Eloquent llamado desde el controlador, con
  FormRequest, policy y eager loading— no puede reportar violación de capas ni exigir
  un service layer. Es el eval que protege la decisión de neutralidad.
- **`scripts/check-version-bump.mjs`** — sexta guarda. Falla si un `plugins/<stack>/`
  tiene contenido cambiado y su `plugin.json` no subió de versión. Tapa el agujero que
  abre el modelo de dos capas: `compose-agents` propaga un cambio de standard a varios
  plugins **en silencio**, y ninguna de las otras cinco guardas exige el bump — en esta
  misma versión se escapó el de `laravel` y lo detectó una persona, no CI. Sin base de
  comparación (clon shallow, primer commit) reporta **SKIP** en vez de un pase que no
  verificó; por eso el checkout de CI pasó a `fetch-depth: 0`.
- **`scripts/check-neutrality.mjs`** — quinta guarda. Detecta **formas** de fuga en vez
  de nombres (hostnames internos, IPs privadas, credenciales con valor real, contactos
  corporativos), de modo que protege contra organizaciones que este repo no conoce. Los
  nombres literales viven en un `.neutrality-local.json` **sin versionar**: ponerlos en
  el script publicaría la asociación que la guarda existe para evitar. Las coincidencias
  usan límite de palabra, para que un guardián ruidoso no acabe ignorado.
- **`CLAUDE.md`** con la guía de contribución, incluida la regla de neutralidad de
  proyecto.
- **Publicación bajo licencia MIT** en `https://github.com/mrtheroi/agents-dev`. El
  catálogo generado (`README.md`, `docs/marketplace.html`) ya emite los comandos de
  instalación reales en vez del placeholder `<GIT_REMOTE_URL>`.

### Changed

- Autoría de los `plugin.json` y del manifiesto: de una empresa concreta a
  `claude-dev-agents contributors`, sin correo de contacto corporativo.
- **`common` 1.4.0 → 1.5.0** (aditivo) por la fuente de versión PHP. Al recomponer, el
  bloque expandido dentro de `python-task-builder.md` cambia solo — el modelo de dos
  capas funcionando —, lo que obliga a **`python` 0.2.3 → 0.2.4** aunque su archivo no
  se tocara a mano.
- `scripts/build-catalog.mjs` y `scripts/new-plugin.mjs`: se retiró la identidad del
  marketplace anterior (remoto, organización, prefijos de nombre y bloques de features
  de plugins que no forman parte de este catálogo).

- **`changelog-versioning.md` aprende PHP.** Nueva fuente de versión #4:
  `composer.json`, con la trampa de que una aplicación normalmente **no** lleva campo
  `version` (Composer lo desaconseja fuera de paquetes publicados) — el estándar manda
  detectar el campo, y si no existe, tratar el **tag de git** como fuente y proponer
  `git tag`, nunca añadir un `version` artificial para tener algo que subir.

### Fixed

- **`project-grounding.md` estaba en español, y era el único standard que lo estaba.**
  Los dos agentes de `laravel` son los únicos que lo componen, así que salían mezclados
  (46 marcadores en español contra 80 en inglés) y **respondían en español**. Para un
  marketplace comunitario eso es un defecto: un agente que le contesta en español a un
  consumidor anglófono está roto. Traducido; ambos agentes quedan en inglés puro. Lo
  detectó el primer `run-evals.mjs --run`, no una lectura — que es justo para lo que
  sirven los evals. (`common` 1.5.0 → 1.5.1; al recomponer cambia el bloque dentro de
  los dos agentes de Laravel, de ahí `laravel` 0.1.0 → 0.1.1)

- **`.gitattributes` normaliza ahora todo el árbol con `* text=auto eol=lf`.** La regla
  estrecha heredada (solo `*.md` y `scripts/*.mjs`) dejaba fuera `.json`, `.js`, `.mjs`
  dentro de `plugins/`, `.html` y `.yml`; una escritura en masa desde una herramienta
  con default CRLF reescribía cada línea de esos archivos y rompía la guarda de frescura
  del catálogo en CI por puro ruido de fin de línea.

### Removed

- Los diecisiete plugins restantes del marketplace de origen, atados a stacks y
  productos internos (.NET corporativo, monolito Java, analista de negocio, atribución,
  observabilidad, reportes SSRS, integraciones con Confluence y Bitbucket).
- **`react-native`**, descartado junto con ellos: su CLI `figma.mjs` seguía resolviendo
  tokens de marca y catálogos de locales por rutas fijas de un proyecto concreto, así
  que no cumplía la regla de neutralidad aunque sus agentes ya fueran genéricos.

[Unreleased]: https://github.com/mrtheroi/agents-dev/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mrtheroi/agents-dev/releases/tag/v0.1.0
