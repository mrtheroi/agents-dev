# CLAUDE.md — cómo contribuir a este repo

Guía para cualquiera (humano o IA) que edite este repositorio. Hay **una forma de
hacer las cosas** aquí; síguela para que tu cambio se acople a las convenciones.
Para *qué es* el marketplace y cómo se instala, ver [README.md](README.md) — no lo
repitas aquí.

## Qué es

`claude-dev-agents` es un **marketplace de plugins de Claude Code** comunitario:
subagentes, comandos, skills y standards compartidos, organizados por stack. Se
distribuyen por el sistema nativo de plugins; **nada se copia dentro de los repos de
proyecto**.

> **Regla de oro:** un cambio nunca debe ensuciar el repo del consumidor. El estado
> por proyecto vive en el repo del proyecto (`.claude/…`), nunca se mezcla entre clones.

## Neutralidad de proyecto — no negociable

Este es un marketplace **comunitario y agnóstico**. Un agente sirve a muchos repos que
no conoces.

- **Prohibido grabar hechos de un proyecto concreto** en un agente: rutas, nombres de
  marca, endpoints, env vars, namespaces de i18n o convenciones de una sola empresa.
- Donde tengas la tentación de escribir un hecho, escribe una **instrucción de
  detección**. El agente lee el repo consumidor; no arrastra memoria de otro.
- El standard [`project-grounding.md`](plugins/common/standards/project-grounding.md)
  es la doctrina que hace esto explícito (precedencia: **código > `CLAUDE.md` del
  proyecto > doctrina de stack > conocimiento genérico**). Los agentes que generan o
  revisan código de un repo ajeno **deben** incluirlo.
- Los ejemplos concretos son legítimos, pero preséntalos **marcados como
  ilustraciones del patrón**, nunca como hechos del proyecto.

## Modelo de dos capas — reusa, no copies

Las prácticas universales viven **una sola vez** en `plugins/common/standards/*.md`
(doctrina de review, principios de ingeniería, el contrato de subagente, la
orquestación, el grounding de proyecto). Un agente o skill las trae con una directiva,
en vez de copiar-pegar:

```
<!-- @include plugins/common/standards/code-review.md -->
```

- `node scripts/compose-agents.mjs` expande cada directiva en un bloque refrescable
  (`{{NAME}}` → el `name` del frontmatter) y es **idempotente**. Aplica a
  `plugins/<stack>/agents/*.md` **y** a `plugins/<stack>/skills/**/SKILL.md`.
- Editas un estándar **una vez** → recompones → todos los que lo heredan se actualizan.
  No hay drift. Mantén cada agent/skill en sus **particularidades**; no re-declares la
  capa universal.

## Al editar: el flujo obligatorio

**Después de tocar cualquier agente, skill, estándar o `plugin.json`, corre:**

```bash
node scripts/build-catalog.mjs
```

Esto **compone** los agentes/skills y **regenera** `README.md` + `docs/marketplace.html`.

- **`README.md` y `docs/marketplace.html` son GENERADOS** → nunca los edites a mano.
  Edita las fuentes (agentes, `plugin.json`, `marketplace.json`) y regenera.
- **Bump de versión obligatorio:** sube el `version` en
  `plugins/<stack>/.claude-plugin/plugin.json` del plugin que tocaste, o los consumidores
  no reciben la actualización. El versionado vive en `plugin.json`, **no** en el
  frontmatter del agente.

## Autoría de un subagente

1. Escribe **solo** lo específico del stack; trae lo universal con `@include`.
2. **Contrato de subagente obligatorio:** salida human-facing → incluye
   `<!-- @include plugins/common/standards/subagent-contract.md -->` (banner + footer
   de telemetría). Salida máquina (JSON para un orquestador) → **sin** banner; la
   provenance la emite el orquestador desde tu JSON y la tarjeta `Task(<name>)`.
3. Si el agente lee, genera o revisa código del repo consumidor, incluye también
   `project-grounding.md`. Sin excepciones.
4. Colócalo en `plugins/<stack>/agents/<name>.md` (`common` si es agnóstico).
5. **Plugin nuevo:** usa `node scripts/new-plugin.mjs` (o el Plugin Designer en
   `docs/plugin-designer.html`), no lo armes a mano — registra el plugin en
   `marketplace.json` y recompone por ti.

## Orquestación de subagentes

El modelo principal es el **orquestador**. La doctrina universal está en
[`plugins/common/standards/orchestration.md`](plugins/common/standards/orchestration.md)
y la heredan los skills que coordinan varios agentes:

- Delega por **contexto pesado / unidades independientes / paralelismo**; para trabajo
  trivial o secuencial, hazlo inline (más agentes = más tokens y latencia).
- **Fan-out paralelo, merge serial:** los subagentes en paralelo **nunca** escriben el
  mismo archivo compartido (i18n, navigator, manifest, índice); *devuelven* qué mezclar
  y el orquestador lo aplica serialmente.
- **Gates:** detente y espera aprobación explícita antes de una acción
  irreversible/externa (push, publish, delete). No auto-avances.

## Line endings

`.gitattributes` fuerza `* text=auto eol=lf` a propósito. Una regla estrecha (solo
`*.md`, solo `scripts/`) deja clases enteras de archivo fuera de la normalización; una
escritura en masa desde una herramienta con default CRLF reescribe entonces cada línea
de esos archivos y **rompe la guarda de frescura del catálogo en CI** (`git diff
--exit-code`) por puro ruido de fin de línea. No la angostes.

## Antes de abrir PR (guardas de CI)

[`.github/workflows/validate.yml`](.github/workflows/validate.yml) corre estas guardas
en cada PR y en `main` (sin tokens, sin red). Córrelas en local para no esperar al
pipeline:

```bash
node scripts/check-manifest.mjs          # marketplace.json + cada plugin.json válidos; sin plugins huérfanos
node scripts/compose-agents.mjs --check  # falla si algún agente/skill quedó desincronizado del estándar
node scripts/run-evals.mjs --check       # valida evals: agente existe, @include resuelve, fixtures presentes
node scripts/check-neutrality.mjs        # sin hechos privados de una organización
node scripts/build-catalog.mjs           # y confirma con `git diff` limpio: catálogo regenerado
```

### El guardián de neutralidad

`check-neutrality.mjs` busca **formas** de fuga, no nombres: hostnames bajo dominios
internos (`.local`, `.internal`, `.corp`, `.lan`), IPs privadas, credenciales con un
valor que parece real, y direcciones de contacto fuera de los dominios reservados para
documentación. Así protege contra organizaciones que este repo no conoce. Los patrones
exactos están comentados en la cabecera del script.

**Los nombres literales no están en el script a propósito** — escribirlos ahí
publicaría justo la asociación que el guardián existe para evitar. Van en un
`.neutrality-local.json` en la raíz, **sin versionar** (está en `.gitignore`), que el
script lee si existe:

```json
{ "terms": ["acme", "acmecorp"], "allow": ["falso-positivo-conocido"] }
```

Los términos usan límite de palabra: el término `acme` no marca *acmecorp*. Eso es
deliberado — un guardián con falsos positivos se vuelve ruido que la gente aprende a
saltarse.

Si cosechas material de un repo privado, siembra tu overlay **antes** de pegar nada: CI
solo corre los patrones genéricos, el filtro de nombres corre en tu máquina.

**No escribas un término real ni un hostname de ejemplo en esta guía.** Esta sección
también se escanea, y la guarda no distingue una ilustración de una fuga — con razón.

`run-evals.mjs --run` (gasta tokens, necesita el CLI `claude`) **no** es guarda de PR:
córrelo manual o en schedule. Evals nuevos van en `plugins/<stack>/evals/<agent>.eval.json`.
