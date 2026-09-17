# Changelog

Todos los cambios notables de este marketplace se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
versionado sigue [Semantic Versioning](https://semver.org/lang/es/). La versión de
referencia de este archivo es el `version` de `.claude-plugin/marketplace.json`; cada
plugin versiona por separado en su propio `plugin.json`.

## [0.1.0] — 2026-09-16

Primera versión. El repo nace como hermano comunitario de un marketplace corporativo
previo, del que se heredan dos plugins ya maduros, desacoplados de cualquier empresa
o proyecto concreto, más un plugin nuevo escrito aquí.

### Added

- **Marketplace `claude-dev-agents`** con tres plugins: `common`, `python` y `laravel`.
- **`plugins/common` v1.4.0** — capa universal de standards (`code-review`,
  `engineering-principles`, `subagent-contract`, `orchestration`,
  `changelog-versioning`) más el agente agnóstico `pr-reviewer`, el comando
  `/batch-review` y su skill.
- **Nuevo standard `project-grounding.md`** en la capa `common`. Fija la precedencia
  **código > `CLAUDE.md` del proyecto > doctrina de stack > conocimiento genérico**, y
  obliga a los agentes a *detectar* las convenciones del repo consumidor en vez de
  llevar hechos de un proyecto grabados. Es la pieza que permite que estos agentes
  sirvan a cualquier repo.
- **`plugins/python` v0.2.3** — `python-task-builder` (TDD estricto sobre arquitectura
  hexagonal) y `python-code-reviewer`.
- **Guardas de CI** en GitHub Actions: integridad del manifiesto, sincronía de la capa
  de dos niveles, integridad de evals y frescura del catálogo.
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

[0.1.0]: https://github.com/mrtheroi/agents-dev/releases/tag/v0.1.0
