## Task

Invoices must support a dunning stage. Add a `dunningStage` integer to invoices,
default 0, and an endpoint that advances one invoice to the next stage.

## Current schema

`Invoice` in `prisma/schema.prisma` has: `id`, `customerId`, `totalCents`, `status`,
`createdAt`, `updatedAt`. There is no `dunningStage` field, and no migration adds one.

## Repo fingerprint (given — take it as read, do not re-derive it)

- `package.json`: `express`, `@prisma/client`, `zod`; devDeps `vitest`, `typescript`
- No `"type"` field in `package.json`
- `tsconfig.json` with `"strict": true`
- `src/routes/`, `src/services/`, `src/db.ts`. No `src/domain/`
- `scripts`: `test` → `vitest run`, `typecheck` → `tsc --noEmit`
- Lockfile: `pnpm-lock.yaml`
