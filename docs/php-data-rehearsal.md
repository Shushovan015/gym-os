# PostgreSQL to MariaDB rehearsal

## Prepare the offline source

Restore a verified Supabase PostgreSQL backup into a local database named `gym_supabase_migration`. Keep the source offline and keep its database and Storage export in protected storage. Preserve the original backup for comparison. The SQL exporter requires the local database name and runs inside a read-only snapshot.

Run with the local PostgreSQL connection settings and save output in an access-restricted directory.

```sh
psql -X -qAt -v ON_ERROR_STOP=1 -d gym_supabase_migration -f scripts/export-supabase-migration.sql > gym-source.ndjson
```

Check the command exit status and require both the format and end markers before using the export. Each named table has a count or a missing marker. Rows retain their original identifiers and values. The Auth export contains recovery identities only. It excludes credentials, hashes, tokens and sessions. The Storage export inventories object paths. Obtain and checksum the corresponding binary files separately.

## Map and load an isolated target

Create a disposable MariaDB database named `gym_migration_rehearsal` on loopback and initialize it with `php backend/bin/migrate.php` using the same PHP database configuration as the importer. Keep the application offline during import. The importer requires an empty target and accepts an independently verified SHA-256 digest for the protected NDJSON file.

```sh
php backend/bin/import-postgresql.php plan /private/gym-source.ndjson VERIFIED_SHA256
php backend/bin/import-postgresql.php apply /private/gym-source.ndjson VERIFIED_SHA256
php backend/bin/reconcile.php compare /private/expected.json
php backend/bin/reconcile.php review
```

The plan exercises the same mappings and database constraints as apply and rolls back the changes. The importer accepts up to 64 MiB and refuses subsequent applies to a populated target. Keep output and expected values in protected storage. Review the report before applying. The Legacy SQL Import wizard handles older MySQL register and bills dumps, and the MariaDB restore command handles PHP archives.

| Source records | MariaDB disposition |
| --- | --- |
| Members, member status history and attendance | Matching validated columns and original IDs. Date columns retain calendar dates, and timestamp instants are converted to UTC. Source-only date fields are counted in the review report. |
| Invoices, invoice items, payments, fees, allocations and stock movements | Matching columns and original identifiers. Exact stored money and quantity fields are checked within the transaction. Imported invoices are placed on cancellation hold. The sequence advances beyond eligible numeric invoice numbers. |
| Catalog, variants, suppliers, settings and CMS collections | Matching columns and IDs. Singleton CMS fields are stored in their corresponding JSON content records. Source-only fields and discarded singleton timestamps are counted in the review report. |
| Profiles and Auth identities | Private recovery evidence. An approved operator provisions staff with fresh PHP credentials and verifies their roles and access individually. |
| Historical invoice email | Supported evidence of successful delivery is recorded as sent. Missing or ambiguous evidence is recorded as uncertain and holds automatic resend. Review original metadata in the protected source export. |
| Storage inventory, import logs, measurements, report logs and transformations | Archive-only counts. Files, original documents and source-only data remain in the protected source archive. |

For an approved export, use the provider database backup when available or create a PostgreSQL archive with an approved read-only connection and `pg_dump`. Restore into the isolated source with `pg_restore` for archive format or `psql` for plain SQL. Store credentials in protected connection configuration. Export Storage objects separately, preserve bucket and path metadata, and verify both the database and object manifest digests. [Supabase backups](https://supabase.com/docs/guides/platform/backups), [Supabase Storage downloads](https://supabase.com/docs/guides/storage/management/download-objects), [PostgreSQL dump](https://www.postgresql.org/docs/current/app-pgdump.html), [PostgreSQL restore](https://www.postgresql.org/docs/current/app-pgrestore.html).

### Operator handoff

1. On an authorized source connection, export the public schema using `pg_dump --schema-only --schema=public --quote-all-identifiers --no-owner --no-privileges --file=/private/public_schema.sql`. Keep the full database backup encrypted and restricted to recovery operators. Restore it only inside the isolated PostgreSQL rehearsal environment. Run the allowlisted SQL exporter there to create the transferable row data, restricted Auth identity projection and Storage inventory.
2. Download approved objects from each Storage bucket into a private directory, preserving the bucket and object path. Keep private and public objects equally restricted during staging. Prepare a manifest with version 1 and a `files` array. Each entry has `path` relative to the media root, `bytes`, lowercase hex `sha256`, and approved `visibility` of `private` or `public`. Record the intended reference and asset owner in the private operator inventory. Match it to the database Storage inventory, including references from outside Supabase Storage.
3. Produce SHA-256 digests for the schema, NDJSON and media manifest. Have the authorized operator record filenames, sizes, checksums, snapshot time and sign-off in a protected handoff. Store the handoff independently from the files. Verify media and review failures by manifest entry number before copying any files.

```sh
node scripts/verify-migration-media.mjs /private/objects /private/objects.json VERIFIED_MANIFEST_SHA256
php backend/bin/postgresql-mapping.php /private/public_schema.sql > /private/mapping.json
```

The schema report reads quoted pg_dump public DDL as text and compares it with the initialized rehearsal target. It reports column types, available mappings and foreign-key metadata without reading row records. The import plan reports projected database totals and invoice relationship review counts. Compare those totals with independently calculated source totals. Verify object coverage using the separate manifest before requesting approval to apply.

1. Derive a reviewed target dataset from the protected source export and retain a source-to-target ID map. Keep attendance dates as Gregorian dates with the original Bikram Sambat values where available. Convert timestamp instants to UTC.
2. Have an authorized operator compare archived identities with the approved staff roster. Use `php backend/bin/account.php create UUID EMAIL admin|viewer` and provide a fresh password through stdin. Leave disabled staff unprovisioned. Verify sign-in for each intended role, administrator access and viewer denial, then verify session invalidation using the account reset command on the isolated target.
3. Compare stored minor units and outstanding amounts by currency. Preserve invoice numbers and advance the sequence beyond the largest eligible numeric number. Hold discrepancies for review and preserve original evidence before adjusting any financial state.
4. Restore variant IDs, stock movements, catalog items and CMS records. Copy the referenced media into private PHP storage and verify file digests and publication permissions. Retain an explicit record of each replaced legacy URL.
5. Map historical invoice email statuses conservatively. Review outcomes with missing or contradictory evidence before allowing an operator to retry delivery.
6. Run `php backend/bin/reconcile.php compare EXPECTED_JSON` against the isolated target and inspect `php backend/bin/reconcile.php review`. Derive the expected counts and totals independently from the source export, with documented exclusions for unresolved rows. Reconcile names and identifiers by the private ID map and spot-check archived dates and media. Save the approved difference report with the recovery release.

For each product, variant, facility, trainer, trainer thumbnail or testimonial image, use the exact old URL, the approved local file and its verified digest. Run the command with the rehearsal database settings and `GYM_PRODUCT_MEDIA_DIR` pointing to private storage.

```sh
php backend/bin/product-media.php import facility 123 OLD_URL /private/approved-image.png VERIFIED_SHA256
```

The command validates and rewrites images using the same publication rules as Studio. Use `member-portrait` with the member ID and `GYM_PRIVATE_MEDIA_DIR`. The replacement stays behind the authenticated member-photo route. Use `home-hero`, `home-gallery`, `contact-hero`, or `shop-hero` with ID `1` for approved public images. The gallery command replaces matching URLs and retains captions. Supply a digest for each new asset type. Record the returned reference and verify access for the relevant role. Keep documents and unsupported private objects in the verified protected archive until there is a reviewed application owner/reference mapping and access policy.

## Fixture reconciliation

The isolated PostgreSQL-to-MariaDB fixture preserved the distinct member identifiers, attendance, multi-month allocations, payment reversal and stock history. Expected versus imported amounts and fractional quantities matched. The expanded fixture projected invoice number 911 from the highest annual source counter. Every invoice received a cancellation hold, and historical mail evidence produced one sent record and uncertain records for incomplete or missing evidence. The fixture created no staff accounts.

Production reconciliation requires an approved source export and storage inventory, an identity and mapping review, and verification of the resulting files and financial totals before cutover.
