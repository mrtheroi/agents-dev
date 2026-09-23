---
triggers: [compose-agents, "@include", check-version-bump, bump, standards]
covers: [plugins/common/standards/**, scripts/compose-agents.mjs, scripts/check-version-bump.mjs]
verified: 2026-09-23
---

# Editar un standard cambia varios plugins en silencio

**What** — `compose-agents` expande cada `@include` en todos los agentes que lo
componen. Al editar un archivo de `common/standards/`, cambian agentes de **varios
plugins a la vez**, y el comando no lo destaca.

**Why** — Es el modelo de dos capas funcionando: lo universal se escribe una vez. El
costo es que la propagación no se ve.

**Learned** — Cada plugin afectado necesita **su propio bump**, o sus consumidores nunca
reciben el cambio. `check-version-bump.mjs` existe por esto y aun así atrapó al autor
**tres veces** — siempre antes del commit, que es donde sirve.

Ejemplo real: enseñarle Java a `changelog-versioning.md` reescribió los task-builders de
`python`, `laravel` y `nodejs`. Tres bumps por editar un archivo.
