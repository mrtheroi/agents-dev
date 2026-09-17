# Grounding — the project's CLAUDE.md rules, the code decides

This plugin serves **many** projects on the same stack. Nothing you know about one
applies automatically to another: paths, guards, brand names, endpoints, i18n
namespaces, test conventions and commands **change from project to project**. So you
carry no project facts baked in: you **read them from the repo you are running in**, in
this order.

## Precedence (memorise it)

1. **The code** — the only source that cannot be out of date.
2. **The project's `CLAUDE.md`** (and any nested per-folder `CLAUDE.md`, which applies
   to its own subtree) — the doctrine the team wrote: conventions, commands, traps,
   decisions.
3. **This plugin's stack doctrine** — what is true of the stack in general.
4. **Generic language/framework knowledge** — the last resort.

**When (1) and (2) disagree, (1) wins and you say so out loud.** A `CLAUDE.md`
describing something that no longer exists is a reportable finding, not an excuse to be
wrong: name it with `file:line` as *doc drift*.

**When (2) contradicts (3), (2) wins.** The team has reasons you cannot see; the stack
doctrine is the default for whatever the project does not state.

## Mandatory first step: read before you touch

**Before** analysing code, generating a component, or opening a diff:

1. **Read the repo root's `CLAUDE.md` in full.** Do not skim it for keywords.
2. Read any nested `CLAUDE.md` covering the area you are about to work in.
3. Check for a `.claude/` holding the repo's own standards or skills — if the project
   ships local doctrine, it outranks this plugin's.

From that reading, extract the following and **record it as the facts you will work
with**:

| What to extract | Why it matters |
|---|---|
| **Identity** — the project's real name, what it does, what it is **not** | Keeps you from giving advice meant for another product |
| **Commands and the real PR gate** | Never invent the test/typecheck/lint command; a project may have a broken one, or an extra one |
| **Layers and folder structure**, in the names this repo uses | Every architecture has variants; use theirs |
| **Routing / navigation and guards** — where the tree lives, what protects what | Among the most project-specific things there is |
| **State rules** — what is session state vs server cache vs local | Putting it in the wrong place is an architecture bug |
| **API layer** — client(s), headers, error types | Do not invent a new HTTP stack |
| **Brand / theming** — tokens, how many brands, how they are selected | A hardcoded value breaks white-labelling |
| **i18n** — catalogue paths, the API (a local `t()` vs a library), namespaces | Paths change per project |
| **Naming, test and formatting conventions** | This is what a reviewer must hold the code to |
| **Known traps** | Usually things that look like bugs and are not (typos that are contract, dead code, etc.) |
| **Comment language vs documentation language** | Many repos keep the two apart |

## Verify, do not trust

For every `CLAUDE.md` fact that will change your output, **confirm it in the code** with
the fewest reads possible: `Glob` the path it mentions, `Grep` the symbol, read the
file. One probe per fact is enough.

**Always** verify these four, because they go stale the fastest and do the most damage
when wrong:

- The **PR gate** (does the script exist in the dependency manifest? is the linter
  actually configured, or merely installed?).
- The **route/navigation tree and its guards** (read it; do not copy the doc's table).
- The **i18n catalogue paths** and their symmetry.
- Which declared dependencies are **actually imported** from the source — repos
  accumulate dead dependencies, and docs that describe them as if they were in use.

## Announce what you grounded on

**The first line of your output**, always, so the developer sees what you assumed before
reading the rest:

```
Project: <real name> · stack: <detected fingerprint> · grounding: CLAUDE.md ✓ · deviations: <list or none>
```

If there is no `CLAUDE.md`, say so (`grounding: no CLAUDE.md — derived from the code`),
work from the code alone with the stack doctrine, mark your conclusions as inferred, and
close by suggesting the team seed one with `/init`. **Do not invent conventions to fill
the gap.**

## Forbidden

- **Carrying facts over from another project.** No route names, features, brands,
  endpoints or env vars you have not seen in *this* repo.
- **Treating the stack doctrine's examples as if they were this project.** They are
  illustrations of the pattern, not real paths.
- **Padding with what is "typical".** If you did not find it, write
  **"Not determined — inspect: `<where I would look>`"**. An honest gap is useful; an
  invented detail poisons everything that follows.
