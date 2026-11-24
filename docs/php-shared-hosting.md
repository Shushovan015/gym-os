# A&A Health Club on Apache shared hosting

The package uses React static assets, PHP 8.2 or later and MariaDB. Use MariaDB 10.11 for the first rehearsal. This repository's migrations and integration suite are verified on MariaDB, so a provider offering MySQL needs a separate compatibility rehearsal.

## Build and layout

Install frontend dependencies and install locked production Composer dependencies under `backend`. Run `npm run package:php` locally. The command prints a release directory under `.runtime`. It contains the public assets and a separate `gym-private` directory. The PHP build excludes the Supabase client and ignores legacy frontend credentials.

Place the contents of `public_html` in the chosen Apache document root, including the hidden `.htaccess` file. Keep `gym-private` outside all document roots. The public API script looks for `gym-private/config.php` beside the document root. If the account has a different layout, set `GYM_CONFIG_FILE` in the hosting PHP environment to the absolute path of the private configuration file. Keep the private `backend` directory beside that file. Use owner-only permissions where compatible with the PHP service account.

Configure Apache to read the supplied `.htaccess` file. The root setup uses `mod_rewrite`, the per-directory `END` flag, and a redirect to `index.html` for client-side routes. Enable `mod_headers` for the provided browser connection policy. Use the panel's HTTPS redirect and verify that PHP receives a trusted `HTTPS=on` for HTTPS requests. [Apache rewrite documentation](https://httpd.apache.org/docs/2.4/rewrite/htaccess.html) · [DirectAdmin HTTPS setup](https://docs.directadmin.com/webservices/ssl/ssl-and-letsencrypt-for-domains.html)

## Private server setup

Copy `config.example.php` to `config.php` on the host and fill in the database connection, separate media and archive directories, and optional SMTP and member-webhook settings. Give PHP write access to the media directories. Give web PHP read access to published, encrypted archives. Keep the CLI backup password separate from the web configuration and the archives.

### Install a fresh database and create the first administrator

In DirectAdmin on the staging account, create a new empty MariaDB database and assign a dedicated database user scoped to that database. Confirm that the private `config.php` names that exact database. Run the following in the hosting shell. Replace the private directory and administrator email.

```bash
set -e
set +x
cd /home/ACCOUNT/gym-private
export GYM_CONFIG_FILE="$PWD/config.php"
php backend/bin/migrate.php install
php backend/bin/migrate.php verify
admin_id=$(php -r '$s=bin2hex(random_bytes(16)); printf("%s-%s-4%s-8%s-%s",substr($s,0,8),substr($s,8,4),substr($s,13,3),substr($s,17,3),substr($s,20,12));')
read -rsp 'New administrator password (15 to 72 bytes): ' gym_first_password
printf '\n'
printf '%s\n' "$gym_first_password" | php backend/bin/account.php create "$admin_id" 'ADMIN_EMAIL' admin
unset gym_first_password GYM_CONFIG_FILE
```

Installation refuses a database that already contains tables, views, routines, or events. The installer applies all migrations, including indexes, relationships and required settings seeds. It leaves members, attendance, invoices, payments, stock and accounts empty until added. If the initial install fails partway, preserve the error and use a new empty database after resolving it. Save the administrator UUID in the private operator records. Sign in at `https://STAGING_HOST/admin/login`. Use `account.php reset UUID` with the same private configuration and a password on stdin for recovery. For reviewed release upgrades, use the separate `migrate.php apply` command after taking a verified backup.

Use PDO MySQL, GD with JPEG/PNG/WebP, Fileinfo, OpenSSL, sessions and Zip with AES-256. Upload settings need room for a 5 MiB image and its multipart overhead. The legacy import reads a JSON body of up to 8 MiB. Keep PHP errors in protected server logs and verify private paths are permitted by `open_basedir`, if enabled.

Historical PDFs use the private MariaDB database and encrypted backup archive. Check an 8 MiB or larger `max_allowed_packet`, available database disk quota, and backup and restore performance with representative documents.

## Provider checks

Himalayan Host advertises DirectAdmin hosting with PHP 8.2 and MariaDB/MySQL. Confirm the actual database version and PHP extensions for the selected account, whether Apache honors the package directives, CLI PHP and SFTP availability, private storage access, SMTP egress, archive disk quota and time limits. Confirm independent off-server transfer and restore access before relying on the provider's backup service. [Himalayan Host DirectAdmin plan](https://www.himalayanhost.com/store/directadmin-hosting-nepal)

## Staging and rollback

Record the provider account's PHP web and CLI versions, loaded extensions, database engine and version, database and disk quotas, and upload, request-body, memory and execution limits. Exercise a representative upload and restore within those limits. Confirm that Apache applies the rewrite rules, HTTPS redirects, and permissions on public and private paths. Verify that PHP errors go to a private log. Confirm whether cron is available, which CLI executable it uses, and how failed jobs are reported. Check SMTP egress with the configured TLS mode and a staging mailbox, and verify receipt before entering live sender settings.

Rehearse on an isolated database and separate media directories. Verify anonymous pages, administrator sign-in, deep links, member and holiday changes, inventory images, checkout and reversals, reports, SMTP, the backup download, and a separate restore. Use synthetic records on staging. Install a separate empty database for the public release. [PHP backup and recovery instructions](../backend/README.md#encrypted-backup-and-restore)

Keep the prior application release and the new site's verified encrypted backup and separate recovery password. If rollback is needed after new writes, preserve the new database and uploaded files before switching traffic back. Recover archives into an empty database with the matching app release.

## Optional later data import through phpMyAdmin

1. Obtain a trusted, reviewed MariaDB SQL file from the same application schema version. Check its provenance and checksum. Review the entire file before using phpMyAdmin. Use data-only `INSERT` statements with explicit column lists, in foreign-key order. Exclude schema changes, cross-database identifiers, account and session records, migration and seed rows, and any statements that bypass checks or replace existing rows. Keep the file private.
2. Create a separate empty candidate database, with a database user that has access only to that database. Initialize it with `migrate.php install` and verify it. In phpMyAdmin select the candidate database, open **Import**, choose SQL, and upload the reviewed file. Keep foreign-key checks enabled. For an import failure, preserve the output, fix the reviewed file, and use a new empty candidate. A SQL error may leave preceding rows applied.
3. Verify database relationships, expected row counts, payment and invoice totals, balances, invoice numbers and the next counter, stock history, and uploaded media references. Test application reads and writes against the candidate over staging HTTPS. Reconcile any earlier application data before switching databases. If the running site already has records, keep it pointed at its current database until the owner approves the reconciled replacement and verifies an encrypted backup. [phpMyAdmin import and export](https://docs.phpmyadmin.net/en/latest/import_export.html)
