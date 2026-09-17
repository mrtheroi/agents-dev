## Task

Subscriptions must support a grace period after expiry. Add a `grace_until` timestamp
to the subscriptions table, and make the renewal use case treat a subscription as
active while `grace_until` is in the future.

## Current schema

`subscriptions` has: `id`, `customer_id`, `plan_code`, `status`, `expires_at`,
`created_at`. There is no `grace_until` column, and no Alembic revision adds one.

## Repo fingerprint (given — take it as read, do not re-derive it)

- `pyproject.toml` with `[tool.poetry]`; `poetry.lock` present
- `src/billing/{domain,application/ports,infrastructure}/`
- `tests/unit/` and `tests/integration/`
- Alembic configured under `migrations/`
- `[tool.mypy]` has `strict = true`
