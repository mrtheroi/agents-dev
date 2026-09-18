## Task

Add an endpoint that returns the 10 most active customers of the current month, with
how many orders each placed.

## Repo fingerprint (given — take it as read, do not re-derive it)

- `package.json`: `fastify`, `drizzle-orm`, `zod`; devDeps `vitest`, `typescript`
- `"type": "module"` is set
- `tsconfig.json` with `"strict": true`
- `src/routes/` holds route files that query the database directly. There is no
  `src/services/`, no `src/domain/`, no dependency-injection container
- `scripts`: `test` → `vitest run`
- Lockfile: `package-lock.json`
- Every needed column already exists.
