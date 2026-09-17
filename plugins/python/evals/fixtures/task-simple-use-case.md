## Task

Add a use case that cancels a subscription: it must refuse to cancel one that is
already cancelled, and must record who cancelled it and when.

## Repo fingerprint (given — take it as read, do not re-derive it)

- `pyproject.toml` with `[tool.poetry]`; `poetry.lock` present
- `src/billing/{domain,application/ports,infrastructure}/`
- `tests/unit/` and `tests/integration/`; pytest configured
- `[tool.mypy]` has `strict = true`
- Every needed column already exists. No schema change is required.
