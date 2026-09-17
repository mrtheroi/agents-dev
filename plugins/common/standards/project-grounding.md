# Grounding — el CLAUDE.md del proyecto manda, el código decide

Este plugin sirve a **varios** proyectos del mismo stack. Nada de lo que sabes sobre
uno aplica automáticamente a otro: rutas, guards, nombres de marca, endpoints,
namespaces de i18n, convenciones de test y comandos **cambian por proyecto**. Por eso
**no** llevas hechos de proyecto grabados: los **lees del repo en el que corres**, en
este orden.

## Orden de precedencia (memorízalo)

1. **El código** — es la única fuente que no puede estar desactualizada.
2. **El `CLAUDE.md` del proyecto** (y los `CLAUDE.md` anidados por carpeta, que
   aplican a su subárbol) — la doctrina que el equipo escribió: convenciones,
   comandos, trampas, decisiones.
3. **La doctrina de stack de este plugin** — lo que es cierto del stack en general.
4. **Conocimiento genérico del lenguaje/framework** — el último recurso.

**Cuando (1) y (2) se contradicen, gana (1) y lo dices en voz alta.** Un `CLAUDE.md`
que describe algo que ya no existe es un hallazgo reportable, no una excusa para
equivocarte: nómbralo con `file:line` como *doc drift*.

**Cuando (2) contradice a (3), gana (2).** El equipo tiene razones que tú no ves; la
doctrina de stack es el default para lo que el proyecto no dice.

## Primer paso obligatorio: leer antes de tocar

**Antes** de analizar código, generar un componente o abrir un diff:

1. **Lee el `CLAUDE.md` de la raíz del repo, completo.** No lo escanees por keywords.
2. Lee los `CLAUDE.md` anidados que cubran el área en la que vas a trabajar.
3. Mira si hay un `.claude/` con standards o skills propios del repo — si el proyecto
   trae su propia doctrina local, respétala por encima de la de este plugin.

De esa lectura extrae, y **anótalo como los hechos con los que vas a trabajar**:

| Qué extraer | Por qué te importa |
|---|---|
| **Identidad** — nombre real del proyecto, qué hace, qué **no** es | Evita dar consejo de otro producto |
| **Comandos y la puerta real de PR** | Nunca inventes el comando de test/typecheck/lint; el proyecto puede tener uno roto o uno extra |
| **Capas y estructura de carpetas** con los nombres que usa este repo | Cada arquitectura tiene variantes; usa las suyas |
| **Ruteo / navegación y guards** — dónde vive el árbol, qué protege qué | Es de lo más específico de cada proyecto |
| **Reglas de estado** — qué es estado de sesión vs cache de servidor vs local | Colocarlo mal es un bug de arquitectura |
| **Capa de API** — cliente(s), headers, tipos de error | No inventes un stack HTTP nuevo |
| **Marca / theming** — tokens, cuántas marcas, cómo se seleccionan | Un valor hardcodeado rompe el white-label |
| **i18n** — rutas de los catálogos, API (`t()` propio vs librería), namespaces | Las rutas cambian por proyecto |
| **Convenciones de nombres, tests y formato** | Es lo que un reviewer debe exigir |
| **Trampas conocidas** | Suelen ser cosas que parecen bugs y no lo son (typos que son contrato, código muerto, etc.) |
| **Idioma de comentarios vs documentación** | Muchos repos separan uno del otro |

## Verifica, no confíes

Cada hecho del `CLAUDE.md` que vaya a cambiar tu output, **compruébalo en el código**
con el mínimo de lecturas: `Glob` la ruta que menciona, `Grep` el símbolo, lee el
archivo. Basta una sonda por hecho.

Verifica **siempre** estos cuatro, porque son los que más se desactualizan y los que
más daño hacen si están mal:

- La **puerta de PR** (¿existe el script en el manifiesto de dependencias? ¿el lint
  está de verdad configurado, o solo instalado?).
- El **árbol de rutas/navegación y sus guards** (léelo; no copies la tabla del doc).
- Las **rutas de los catálogos de i18n** y su simetría.
- Qué dependencias declaradas **de verdad se importan** desde el código fuente — los
  repos acumulan dependencias muertas y docs que las describen como si se usaran.

## Anuncia con qué te fundaste

**Primera línea de contenido de tu output**, siempre, para que el dev vea qué asumiste
antes de leer el resto:

```
Proyecto: <nombre real> · stack: <huella detectada> · grounding: CLAUDE.md ✓ · desvíos: <lista o ninguno>
```

Si no hay `CLAUDE.md`, dilo (`grounding: sin CLAUDE.md — derivado del código`), trabaja
solo desde el código con la doctrina de stack, marca tus conclusiones como inferidas, y
sugiere al final que el equipo siembre uno con `/init`. **No inventes convenciones para
llenar el hueco.**

## Prohibido

- **Arrastrar hechos de otro proyecto.** Nada de nombres de rutas, features, marcas,
  endpoints o env vars que no hayas visto en *este* repo.
- **Tratar los ejemplos de la doctrina de stack como si fueran este proyecto.** Son
  ilustraciones del patrón, no rutas reales.
- **Rellenar con lo "típico".** Si no lo encontraste, escribe
  **"No determinado — inspecciona: `<dónde miraría>`"**. Un hueco honesto es útil; un
  detalle inventado envenena todo lo que venga después.
