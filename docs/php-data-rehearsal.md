# PostgreSQL to MariaDB rehearsal

## Prepare the offline source

Restore a verified Supabase PostgreSQL backup into a local database named `gym_supabase_migration`. Keep the source offline and keep its database and Storage export in protected storage. Preserve the original backup for comparison. The SQL exporter requires the local database name and runs inside a read-only snapshot.

Run with the local PostgreSQL connection settings and save output in an access-restricted directory.

```sh
psql -X -qAt -v ON_ERROR_STOP=1 -d gym_supabase_migration -f scripts/export-supabase-migration.sql > gym-source.ndjson
```

Check the command exit status and require both the format and end markers before using the export. Each named table has a count or a missing marker. Rows retain their original identifiers and values. The Auth export contains recovery identities only. It excludes credentials, hashes, tokens and sessions. The Storage export inventories object paths. Obtain and checksum the corresponding binary files separately.

## Map and load an isolated target

The source export needs a mapping step before it can be loaded into MariaDB. The current Legacy SQL Import wizard handles the older MySQL register and bills dump. The MariaDB restore command handles archives created by the PHP backend.

1. Derive a reviewed target dataset from the protected source export and retain a source-to-target ID map. Keep attendance dates as Gregorian dates with the original Bikram Sambat values where available. Convert timestamp instants to UTC.
2. Preserve member IDs, approved staff roles, invoices, items, payments, reversals and allocations. Bootstrap approved staff with fresh credentials through the PHP account command. Keep disabled accounts disabled and verify recovery on the isolated target.
3. Compare stored minor units and outstanding amounts by currency. Preserve invoice numbers and advance the sequence beyond the largest eligible numeric number. Hold discrepancies for review and preserve original evidence before adjusting any financial state.
4. Restore variant IDs, stock movements, catalog items and CMS records. Copy the referenced media into private PHP storage and verify file digests and publication permissions. Retain an explicit record of each replaced legacy URL.
5. Map historical invoice email statuses conservatively. Review outcomes with missing or contradictory evidence before allowing an operator to retry delivery.
6. Run `php backend/bin/reconcile.php compare EXPECTED_JSON` against the isolated target and inspect `php backend/bin/reconcile.php review`. Derive the expected counts and totals independently from the source export, with documented exclusions for unresolved rows. Reconcile names and identifiers by the private ID map and spot-check archived dates and media. Save the approved difference report with the recovery release.

An actual Supabase export, the production field mapping and a complete transfer rehearsal remain required before cutover.
