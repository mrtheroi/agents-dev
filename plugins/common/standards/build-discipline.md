## Build discipline (universal)

How to work when you are the one writing code. Language and framework specifics belong
in your stack section; this is the part that does not change.

### Strict TDD — Red, Green, Refactor

One behavior at a time, with the runner the repo already uses:

1. **RED** — write ONE failing test. Run it. It MUST fail, and fail **for the right
   reason**: the behavior is missing, not a typo, a missing import, or a harness that
   will not start. **State the failure before writing any production code.** If the test
   passes before the code exists, the test is wrong — fix the test first.
2. **GREEN** — the minimum production code that makes that one test pass. Nothing more:
   no extra features, no speculative abstractions, no handling of cases no test demands.
3. **REFACTOR** — remove duplication and improve names, with the tests green throughout.

Never write production code before its failing test exists. Never batch several tests
and then implement them together. **A bugfix STARTS with a test that reproduces the
bug** — if it passes on the unfixed code, it is not reproducing anything.

Prefer the narrowest test that can fail for the right reason: a unit test over an
integration test, an integration test over one that boots everything. A suite slow
enough that people stop running it protects nothing.

### What stops you, and what does not

**Stop only for genuine ambiguity** — when two reasonable readings of the task produce
different code and building the wrong one wastes the work. Say which readings you see
and ask. Do not guess and do not pick silently.

**A behavior you cannot test does not stop you.** Write it, and say so plainly in your
report: what is not covered, why it resists testing, and what would make it testable — a
seam, an injected clock, a fake for the third-party call. A declared gap is useful
information. A silent gap reads as coverage that does not exist, which is worse than no
test at all.

The same applies to anything you had to assume: state the assumption where the reader
will see it, rather than burying it in the code.

### Think before you write

- **State your assumptions explicitly** before implementing. If you are uncertain, say
  so rather than choosing quietly.
- **If a simpler approach exists, say so** — even when the task asked for the complex
  one. Push back once, with the reason; then do what was asked.
- If something is genuinely unclear, name **what** is unclear. "I need more context" is
  not a question anyone can answer.

### Simplicity first

The minimum code that solves the problem, and nothing speculative.

- No features beyond what was asked.
- No abstraction for a single use. Two call sites are not a pattern.
- No configurability, flexibility or extension point nobody requested.
- No error handling for scenarios that cannot occur — it reads as though they can, and
  the next reader will preserve it forever.

Before you finish, read your own diff and ask: **would an experienced engineer on this
team call this overcomplicated?** If yes, simplify it now, while it is still cheap.

### Surgical changes

Touch only what the task requires.

- **Every changed line must trace to the request.** If you cannot say which part of the
  task a line serves, it does not belong in this change.
- Do not "improve" adjacent code, comments or formatting, and do not refactor what is
  not broken. Both bury the real change in noise and make review harder.
- **Match the surrounding style** even where you would write it differently. Consistency
  inside a file beats your preference.
- Remove imports, variables or functions **your** change orphaned. Leave pre-existing
  dead code alone — **mention it** in your report instead of deleting it.

### Define done before you start

Turn a vague task into something checkable, and say what the check is:

| Vague | Verifiable |
|---|---|
| "add validation" | tests for each invalid input, currently failing, then passing |
| "fix the bug" | a test that reproduces it, failing now, passing after |
| "refactor X" | the existing tests pass before and after, with no behavior change |

The check does not have to be a test — a build that passes, a typecheck, a command with
an expected output all count. The rule is only that **you decide how you will know you
are done before you begin**, and report the result you actually observed. Never report
a passing check you did not run.
