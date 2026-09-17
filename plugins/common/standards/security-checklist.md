## Security checklist — defect tier

Every change gets checked against this list — not as a document to skim once, but
as a set of conditions evaluated against the concrete change in front of you.
Grouped by OWASP category.

**Every row on this list is a defect.** It is wrong under any architecture, any
framework, any house style. Report it plainly, with the fix — never soften one
into a consequence ("this costs you…") and never demote one to taste ("the repo
seems to prefer…"). The inverse also holds: nothing here licenses a preference.
If a finding you are about to write is about what the author should *prefer*, you
have left this list.

The **Applies when** column is the test: evaluate it against *this* change, not in
the abstract. Most rows do not apply to most changes. Saying so explicitly, with
a reason, is as valid an outcome as fixing something.

The checks name mechanisms generically on purpose — "the repo's own authorization
mechanism", "the validator the repo already uses". Resolve each one by reading the
consumer repo, in the precedence the grounding standard sets. Do not import a
mechanism the repo does not have, and do not cite a static-analysis rule ID unless
you read it from the repo's own analyzer configuration.

| # | OWASP category | Check | Applies when |
|---|---|---|---|
| 1 | Broken Access Control (A01 / API1, API5) | Every new or changed route handler carries the repo's own authorization mechanism — middleware, guard, decorator, policy, whatever it already uses — or is deliberately public with a stated reason, and verifies the resource belongs to the authenticated caller, not merely that a caller is authenticated | A route/endpoint handler is added or modified |
| 2 | Mass assignment / excessive data exposure (API3) | The object exposed to clients is never the persistence entity, and the fields external input may write are enumerated explicitly on whatever input type the repo uses (request object, schema, DTO) — never a bind-everything call | An input type accepting external data is added or widened |
| 3 | Injection — raw queries (A03) | No query built by concatenating or interpolating external input, and no use of the ORM/driver's raw-SQL escape hatch with unparameterized input. Bindings and placeholders exist; use them | The change touches a query builder, repository, or raw SQL |
| 4 | Injection — dynamic filter/order | A filter, sort, or search built from a client-supplied field or column name validates that name against an allow-list before it reaches the query | The endpoint supports client-driven filtering, ordering, or search |
| 5 | SSRF (A10 / API7) | Any outbound URL derived from external input is normalized and validated — scheme, allowed host, no internal address ranges — before the request is made | The change makes an outbound request whose destination depends on external input (webhook, callback, importer, …) |
| 6 | Open redirect | No redirect target taken straight from unvalidated input; the destination is checked against an allow-list | The change can return or issue a redirect |
| 7 | Cross-site scripting | Output that a client renders as markup is escaped, or built through the templating engine's auto-escaping — and auto-escaping is not disabled to make the markup work | The change generates HTML, email, or other markup from external input |
| 8 | Insecure deserialization (A08) | No unsafe deserializer over external input, and no configuration allowing uncontrolled polymorphic type resolution. *Illustrations of the pattern, not a list to match literally:* language-native object deserializers, unsafe YAML loaders, type-name-driven JSON binding | The change deserializes an external payload outside the framework's own request binding |
| 9 | Cryptographic failures — hashing (A02) | No password or secret hashed with a fast or broken digest (MD5, SHA-1, unsalted SHA-2). Use the password-hashing mechanism already in force in the repo — *illustrations:* bcrypt, scrypt, Argon2, PBKDF2 | The change touches storage or verification of credentials or secrets |
| 10 | Cryptographic failures — transport/storage (A02) | Data the repo treats as sensitive (PII, financial, health) is encrypted at rest where the repo's standard requires it, never written or transmitted in clear text, and never sent over a plaintext transport | The change persists or transmits a field the repo marks sensitive |
| 11 | Identification and Authentication Failures (A07) | Token or session configuration — issuer, audience, lifetime, signing algorithm, cookie flags — is not weakened, and no development-only value can reach production | The change touches authentication configuration itself, not merely its use |
| 12 | Embedded secrets/credentials (A05) | No secret, connection-string password, API key, or private key literal in code or in a tracked configuration file — only the key **name**, with a placeholder, resolved through the repo's own secret mechanism | **Always** — evaluate on every change |
| 13 | PII/secrets in logs (A09) | Log statements never dump a whole request or response object, tokens, or credentials, never write unmasked PII, and never interpolate unsanitized external input into a log message (log forging, injected newlines) | A log statement is added or changed |
| 14 | Security Logging and Monitoring Failures (A09) | Operations that move money or change identity or permission data leave a distinguishable audit record — who, what, when — not just a debug-level log | The change implements an operation that mutates financial, identity, or permission data |
| 15 | Security Misconfiguration — verbose errors (A05) | Unhandled exceptions never leak a stack trace, query text, or internal path into the client-facing error contract; the repo's existing error handler maps them | **Always** — evaluate on every change |
| 16 | Security Misconfiguration — cross-origin (A05) | No cross-origin policy pairs a wildcard origin with credentialed requests, and no wildcard origin sits on an authenticated surface | The change touches CORS or another cross-origin configuration |
| 17 | Unrestricted Resource Consumption (API4) | List endpoints use the pagination the repo already has and never return an unbounded collection; payload size, upload size, and page-size limits are validated | The change exposes a listing, or accepts a file or variable-size payload |
| 18 | Vulnerable and Outdated Components (A06) | No dependency added, updated, or already present carries a known High/Critical advisory. Run the stack's own audit command — *illustrations:* `pip-audit`, `composer audit`, `npm audit`, `cargo audit`, `bundle audit` | The change adds or updates a dependency, or as a standing check on every invocation |
| 19 | Missing input validation (A04, Insecure Design) | Every entry point accepting external input validates it with the validation mechanism the repo already uses — request object, schema, validator class — before the value reaches domain logic. Listed here because it is a security control, not only a form concern | An entry point with external input is added or widened |
| 20 | Schema changes outside process (Insecure Design) | No database schema change is applied by the agent. A needed change is documented as a request for a human, and the work stops there | The change needs a column, table, or index that does not exist |

### How to use this list

- **Building** — before reporting done, walk **every** row and either confirm it is
  satisfied or state explicitly why it does not apply to this change. Do not
  silently skip a row. A row you never mention reads as a row you never checked.
- **Reviewing** — treat an applicable row that the change leaves unaddressed as a
  finding, at the severity its category implies: **Critical** for injection,
  secrets, and broken access control; **Major** for the rest, unless the specific
  finding warrants otherwise. Point at it with `file:line` like any other defect.
- **Declaring a row inapplicable** is a first-class outcome, but it needs the
  reason, in one clause: "row 5 — no outbound call in this change".
- **Dependency audit (row 18)** — run the audit command the repo's own dependency
  manager provides, from the repo root. Moderate and Low findings are
  informational. High and Critical findings are a blocking finding to report, not
  something to note and move past.
- **Resolving a mechanism** — when a row says "the mechanism the repo already
  uses" and you cannot find one, write **"not determined"** and say so. Never fill
  the gap with what is typical for the stack; an invented convention poisons every
  finding after it.
