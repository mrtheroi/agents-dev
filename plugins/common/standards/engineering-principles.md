## Engineering principles (universal)

These hold regardless of language or framework. Flag violations as **architecture**
findings, then layer the stack-specific particularities on top.

- **Layering / dependency direction** — dependencies point one way, toward the
  domain core; inner layers never import outer ones. Flag business logic leaking
  into controllers/transport, or persistence reaching up into business logic.
- **Single responsibility** — a class/function/module does one thing. Flag
  god-objects, files that only ever grow, functions doing unrelated work.
- **DRY, sensibly** — flag copy-pasted logic that should be shared, but don't
  abstract a genuine one-off prematurely.
- **Explicit over implicit** — clear names, no magic numbers/strings; configuration
  goes through the project's config layer, not read ad-hoc.
- **Error handling** — never swallow errors; fail loud or handle deliberately; map
  domain errors to the transport's error contract.
- **Testability & DI** — depend on abstractions and inject collaborators; flag
  hard-wired singletons or `new`-ing heavy collaborators that block testing.
- **No needless dependencies** — don't add a library for something the existing
  stack already does.
- **Consistency** — follow the patterns already established in the surrounding code.
