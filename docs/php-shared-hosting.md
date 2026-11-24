# A&A Health Club on Apache shared hosting

The package uses React static assets, PHP 8.2 or later and MariaDB. Use MariaDB 10.11 for the first rehearsal. This repository's migrations and integration suite are verified on MariaDB, so a provider offering MySQL needs a separate compatibility rehearsal.

## Build and layout

Install frontend dependencies and install locked production Composer dependencies under `backend`. Run `npm run package:php` locally. The command prints a release directory under `.runtime`. It contains the public assets and a separate `gym-private` directory. The PHP build excludes the Supabase client and ignores legacy frontend credentials.

Place the contents of `public_html` in the chosen Apache document root, including the hidden `.htaccess` file. Keep `gym-private` outside all document roots. The public API script looks for `gym-private/config.php` beside the document root. If the account has a different layout, set `GYM_CONFIG_FILE` in the hosting PHP environment to the absolute path of the private configuration file. Keep the private `backend` directory beside that file. Use owner-only permissions where compatible with the PHP service account.

Configure Apache to read the supplied `.htaccess` file. The root setup uses `mod_rewrite`, the per-directory `END` flag, and a redirect to `index.html` for client-side routes. Enable `mod_headers` for the provided browser connection policy. Use the panel's HTTPS redirect and verify that PHP receives a trusted `HTTPS=on` for HTTPS requests. [Apache rewrite documentation](https://httpd.apache.org/docs/2.4/rewrite/htaccess.html) · [DirectAdmin HTTPS setup](https://docs.directadmin.com/webservices/ssl/ssl-and-letsencrypt-for-domains.html)

## Private server setup

Copy `config.example.php` to `config.php` on the host and fill in the database connection, separate media and archive directories, and optional SMTP and member-webhook settings. Give PHP write access to the media directories. Give web PHP read access to published, encrypted archives. Keep the CLI backup password separate from the web configuration and the archives.

Use the same MariaDB version, PHP CLI version and deployment files in staging and production. With the database settings exported to CLI PHP, run `php backend/bin/migrate.php apply` and `php backend/bin/migrate.php verify` against the intended staging database. Use `php backend/bin/account.php create` or `reset` for staff account bootstrap and recovery. Pass account passwords through the command's standard-input interface.

Use PDO MySQL, GD with JPEG/PNG/WebP, Fileinfo, OpenSSL, sessions and Zip with AES-256. Upload settings need room for a 5 MiB image and its multipart overhead. The legacy import reads a JSON body of up to 8 MiB. Keep PHP errors in protected server logs and verify private paths are permitted by `open_basedir`, if enabled.

Historical PDFs use the private MariaDB database and encrypted backup archive. Check an 8 MiB or larger `max_allowed_packet`, available database disk quota, and backup and restore performance with representative documents.

## Provider checks

Himalayan Host advertises DirectAdmin hosting with PHP 8.2 and MariaDB/MySQL. Confirm the actual database version and PHP extensions for the selected account, whether Apache honors the package directives, CLI PHP and SFTP availability, private storage access, SMTP egress, archive disk quota and time limits. Confirm independent off-server transfer and restore access before relying on the provider's backup service. [Himalayan Host DirectAdmin plan](https://www.himalayanhost.com/store/directadmin-hosting-nepal)

## Staging and rollback

Record the provider account's PHP web and CLI versions, loaded extensions, database engine and version, database and disk quotas, and upload, request-body, memory and execution limits. Exercise a representative upload and restore within those limits. Confirm that Apache applies the rewrite rules, HTTPS redirects, and permissions on public and private paths. Verify that PHP errors go to a private log. Confirm whether cron is available, which CLI executable it uses, and how failed jobs are reported. Check SMTP egress with the configured TLS mode and a staging mailbox, and verify receipt before entering live sender settings.

Rehearse on an isolated database and separate media directories. Verify anonymous pages, administrator sign-in, deep links, member and holiday changes, inventory images, checkout and reversals, reports, SMTP, the backup download, and a separate restore. Follow the encrypted backup procedure before migrating real data. [PHP backup and recovery instructions](../backend/README.md#encrypted-backup-and-restore)

Keep the prior application release, a verified encrypted archive and its separate recovery password. At cutover, pause writes and reconcile the final source and target snapshots before switching traffic. If rollback is needed after new writes, preserve the new database and uploaded files and reconcile those writes before switching back. Recover into an empty database with the matching app release.
