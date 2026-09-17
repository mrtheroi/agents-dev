## Database change request

### The hard rule

**You never run a migration, apply DDL, or execute a schema-change script.** Not
against a local database, not against any other. When a change needs a column,
table, index, constraint, or type that does not exist, you **document the request
and stop**. A human decides whether, when, and how the schema moves.

This holds regardless of what tooling the repo has. A migration runner being
installed and working is not authorization to run it.

### When this applies

You reached a point where the code you are writing cannot work against the current
schema. Write the request, note it as **pending human action** in your report, and
either finish the parts of the change that do not depend on the schema or stop and
say what is blocked.

### In a repo whose ORM owns migrations

Many stacks keep schema changes in the repo as versioned migration files —
*illustrations of the pattern:* Eloquent migrations, Alembic revisions, Django
migrations, Rails migrations. In such a repo this request **describes the schema
change and its rationale; it does not replace the migration file.** Two things
follow:

- Whether you author the migration file itself is the repo's call, not this
  standard's. Read what the repo and its `CLAUDE.md` say about who writes and who
  applies migrations, and follow that.
- **Authoring a migration file is still not applying it.** The hard rule above is
  about execution. Writing the file and running it are separate acts, and only the
  first can ever be yours.

Where the database is owned outside the repo — a shared schema, a DBA-managed
instance, a service you only read from — this request is the whole deliverable.

### Where it goes

Write it in the **consumer repo**, not in the plugin or marketplace repo. If the
repo already has a place for change requests, decision records, or ADRs, use that
place and its naming convention. Absent one, this default works:

```
docs/db-change-requests/{identifier}-{slug}.md
```

where `{identifier}` is the source ticket id, or a `yyyyMMdd` date when there is
none, and `{slug}` is the requirement title in kebab-case. Leave **Status** as
`Pending`. Commit nothing on your own initiative — a human decides whether the file
gets committed, the same as any other file you leave in the working tree.

### Template

Replace every `{{placeholder}}`. Add one table row per object touched.

---

# Database change request — {{identifier}}

- **Requirement / ticket**: {{requirement_id_or_description}}
- **Requested by**: {{agent_name}}, {{date}}
- **Affected area**: {{feature_or_module}}
- **Status**: Pending

## What's needed

| Object | Change type | Detail |
|---|---|---|
| {{table_or_column}} | New table / New column / Altered column / New index / New constraint / Other | {{detail}} |

Be specific about nullability, default value, type and length, and any existing
rows that would need backfilling.

## Illustrative shape (not executable DDL)

```sql
-- Illustrative only, to communicate intent. A human writes and reviews the real
-- migration. This block is never executed by an agent, and never copied into a
-- migration file unreviewed.
{{illustrative_sql_sketch}}
```

## Why

{{business_reason}}

## Backward compatibility / rollback notes

{{compat_notes_or_none}}

Say whether the change is additive and safe to deploy ahead of the code, or
breaking and order-dependent. If it is destructive, say what a rollback cannot
restore.

## Blocking?

{{yes_no_and_what_it_blocks}}

*Illustrations of the two shapes:* "Yes — the handler cannot persist until the new
column exists" or "No — the column is optional and the change degrades gracefully
without it."
