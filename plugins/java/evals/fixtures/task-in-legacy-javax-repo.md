## Task

Add an endpoint that returns the 10 most active customers of the current month, with
how many orders each placed.

## Repo fingerprint (given — take it as read, do not re-derive it)

- `pom.xml`, Maven, single module
- `spring-boot-starter-parent` **2.7.x**; sources import **`javax.persistence`** and
  **`javax.validation`**
- `maven.compiler.source`/`target` is **8**
- Spring Data JPA; controllers delegate to `@Service` beans, which use repositories
- JUnit 5 with Mockito
- Packages: `com.acme.customers.{web,service,repository}`. There is no `domain`
  package and no hexagonal layering
- Every needed column already exists.
