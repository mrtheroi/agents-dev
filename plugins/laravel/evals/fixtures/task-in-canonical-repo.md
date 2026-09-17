## Task

Add an endpoint that returns the 10 best-selling books of the current month, with the
author name for each.

## Repo fingerprint (given — take it as read, do not re-derive it)

- `composer.json` → `autoload.psr-4`: `{ "App\\": "app/" }`
- `app/` contains `Models/` (Book, Author, Sale), `Http/Controllers/`,
  `Http/Requests/`, `Http/Resources/`, `Providers/`. No `Domain/`, no `Services/`,
  no `Actions/`.
- Existing controllers call Eloquent directly and return API Resources.
- `require-dev` includes `phpunit/phpunit`. No Pest.
- `laravel/framework` `^11.0`
- Every needed column already exists.
