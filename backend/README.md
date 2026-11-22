# PHP migration development

The PHP API currently implements authentication, attendance, member records and private portraits. The React app still uses Supabase. Use a separate development database for this branch.

## Windows

Install PHP 8.2 or newer and enable `pdo_mysql` in the active `php.ini`. Install MariaDB or MySQL locally. Create a blank database and a database user with access to it. Set `GYM_DB_DSN`, `GYM_DB_USER` and `GYM_DB_PASSWORD` in the PowerShell process that runs PHP. The example environment file lists the variables. PHP reads the process environment.

```powershell
php -m
php backend/bin/migrate.php apply
php backend/bin/migrate.php verify
```

Use a separate migration user with DDL privileges. The online PHP user needs only the DML permissions used by the application. The verify command checks migration versions and checksums, InnoDB engines, and member foreign keys.

Provision accounts with `php backend/bin/account.php create UUID EMAIL admin`. Reuse existing administrator UUIDs only after verifying the account and its role with a trusted operator. The command reads a password of 15–72 bytes from standard input. On Windows, pass it via a secret prompt and a pipe, keeping it out of shell history and the argument list. Use `php backend/bin/account.php reset UUID` with the same input method to reset a password and revoke existing sessions. Account provisioning and resets are restricted to the CLI.

The integration suite requires a disposable loopback database named `gym_migration_test`. It creates fixture records. Run `node --test backend/tests/auth.integration.mjs`. For a portable PHP install without an active `php.ini`, set `GYM_PHP_EXTENSION_DIR` to the PHP extension directory so the test runner can load `pdo_mysql`.

## API

Use HTTPS. Load `GET /api/auth/session` to obtain the anonymous session cookie and CSRF token. Send JSON with `X-CSRF-Token` to `POST /api/auth/login`, then retain the returned session cookie and token. `GET /api/auth/admin` verifies the administrator role and `POST /api/auth/logout` clears the authenticated session. `POST /api/attendance/change` requires an administrator session and accepts `memberId`, `date` in ISO format, and `action` of `mark`, `remove` or `restore`. `GET /api/attendance/history?memberId=123` returns the 60 latest attendance records for the member, including soft-deleted rows, and also requires administrator access.

Keep backend source, SQL, tests and credentials outside the document root. A production web entry point must expose only the API entry script and route through it. The test router emulates HTTPS on the loopback PHP development server. Use the hosting web server's HTTPS integration for deployment.

### Member endpoints

| Endpoint | Request |
| --- | --- |
| `GET /api/members` | `offset`, `limit`, `search`, `deleted`, `enabled`, `sort`, `membership_type`, `membership_status`, `payment_status` |
| `GET /api/members/details?id=123` | Member and recent activation history |
| `POST /api/members/save` | Profile fields, with numeric `id` for edits |
| `POST /api/members/change` | `action` and `ids`, or explicit `all: true` for bulk activation, deactivation or deletion |
| `POST /api/members/upload-photo` | Multipart `memberId` and `photo` |
| `GET /api/members/photo?key=…` | The private image returned by the upload endpoint |

All endpoints require an administrator session. Writes require the CSRF header. Configure `GYM_PRIVATE_MEDIA_DIR` as an existing writable directory outside the document root. Allow 5 MiB for `upload_max_filesize` and at least 6 MiB for `post_max_size`. Only JPEG, PNG, and WebP are accepted. Replaced images remain on disk and only the current portrait URL is served. Existing external image URLs still require a verified object migration.
