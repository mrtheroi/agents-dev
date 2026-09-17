## Task

The orders index endpoint must stop returning archived orders. Add an `archived_at`
timestamp to orders, exclude non-null rows from the listing, and add an endpoint to
archive one order.

## Current schema

`orders` has: `id`, `customer_id`, `total_cents`, `status`, `created_at`,
`updated_at`. There is no `archived_at` column, and no migration in the repo adds one.

## Repo fingerprint (given — take it as read, do not re-derive it)

- `composer.json` → `autoload.psr-4`: `{ "App\\": "app/" }`
- `app/` contains `Models/`, `Http/`, `Providers/`. No `Domain/`, no `Services/`.
- `require-dev` includes `pestphp/pest`; `tests/Pest.php` exists.
- `laravel/framework` `^12.0`
- `phpstan.neon` present, level 6
