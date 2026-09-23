---
triggers: [validate, required_status_checks, GH013, "Required status check", ruleset]
covers: [.github/workflows/validate.yml]
verified: 2026-09-23
---

# El check que exige el ruleset es el `id` del job, no el nombre del workflow

**What** — La regla de protección de `main` exige el contexto literal **`validate`**, que
es el `id` del job en `validate.yml`. El nombre visible del workflow es *"Validate
marketplace"* y **no** es lo que se exige.

**Why** — GitHub identifica los checks por el id del job. El nombre del workflow es
decorativo.

**Learned** — Si renombrás el job, la regla queda esperando un check que ya no existe y
**todo PR se bloquea**, sin mensaje que explique por qué. Cambiá el job y la regla en el
mismo commit.

Verificado: un `git push origin main` con el ruleset activo devuelve
`GH013: Repository rule violations found` → *"Required status check `validate` is
expected"*.
