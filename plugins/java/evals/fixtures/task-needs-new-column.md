## Task

Orders must support a dunning stage. Add a `dunning_stage` integer column to orders,
defaulting to 0, and an endpoint that advances one order to the next stage.

## Current schema

The `orders` table has: `id`, `customer_id`, `total_cents`, `status`, `created_at`,
`updated_at`. There is no `dunning_stage` column, and no Flyway migration adds one.

## Repo fingerprint (given — take it as read, do not re-derive it)

- `pom.xml`, Maven, single module
- `spring-boot-starter-parent` 3.2.x; sources import `jakarta.*`
- `maven.compiler.release` is 17
- Spring Data JPA over PostgreSQL; Flyway under `src/main/resources/db/migration`
- JUnit 5, AssertJ, Testcontainers
- Packages: `com.acme.orders.{web,service,repository,domain}`
