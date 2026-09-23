---
triggers: [check-neutrality, neutrality-local, "git identity NOT checked", overlay]
covers: [scripts/check-neutrality.mjs, .neutrality-local.json]
verified: 2026-09-23
---

# Sin `.neutrality-local.json` la guarda no revisa la identidad de git

**What** — Los términos literales de organización viven en `.neutrality-local.json`,
**gitignoreado a propósito**: publicar la lista publicaría los nombres que la guarda
existe para proteger.

**Why** — El script busca *formas* de fuga (hostnames internos, IPs privadas,
credenciales) con patrones genéricos, pero una dirección de empresa y una personal tienen
la misma forma. Ninguna regex las distingue, así que esa capa **depende del overlay**.

**Learned** — Sin ese archivo la salida dice
`no local overlay — file shapes only, git identity NOT checked`. Es honesto, pero fácil
de pasar por alto. **En una máquina nueva hay que sembrarlo antes de cosechar nada de un
repo privado.**

Punto ciego conocido: la guarda escanea texto versionado. **No ve archivos binarios**
—un `.gz`, por ejemplo— ni nada fuera del árbol de git.
