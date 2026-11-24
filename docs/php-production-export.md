# Operator approval and production export

Approval is required before running any command that connects to the live project. Confirm the exact project reference and database endpoint from the existing Supabase project, the approved operator, export window, and an empty directory on an encrypted local volume outside the repository. Rehearsal import uses a separate approval after the real PLAN is reviewed.

The operator needs a preconfigured libpq service named `gym_export` with TLS certificate verification and separately stored credentials. The database role needs read access to the approved public tables and the projected columns of `auth.users`, `storage.buckets`, and `storage.objects`. It also needs to be able to see all approved rows. If row-level security filters the results, stop and have the project owner verify the scope. For Storage configure an AWS CLI profile named `gym-export` and use the dashboard S3 endpoint. Prefer credentials restricted to listing and reading the approved buckets. Supabase project S3 access keys can have broader access and bypass RLS. If those are the only option, explicitly approve their use and run the download-only command below. [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication)

## Prepare the dedicated export service offline

Use the Dashboard-confirmed Session pooler host and port. For a dedicated PostgreSQL role, the pooler login has the form `ROLE.PROJECT_REF`. Ask the project owner to confirm an existing, approved export role and its effective privileges, including inherited grants, role memberships, object ownership and privileges from `PUBLIC`. The Dashboard's `postgres.PROJECT_REF` login is an administrative login. A read-only transaction setting is an additional guard and leaves the account's grants intact. If no approved restricted role exists, pause for separate authorization before any role, grant or RLS policy change. [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)

| Source | Minimum access needed |
| --- | --- |
| Database and schemas | `CONNECT` on the project database and `USAGE` on `public`, `auth`, and `storage`. |
| Approved application tables | `SELECT` on each reviewed, whole-table export. If only certain columns are approved, use an explicit `SELECT` projection. Grant sequence read access only for specifically approved sequence metadata if the chosen dump requires it. |
| Staff projection | Column-level `SELECT` on `public.profiles(id, role)` and `auth.users(id, email, email_confirmed_at, banned_until, deleted_at)`. Verify the eligible staff scope locally before handoff. |
| Storage inventory | Column-level `SELECT` on `storage.buckets(id, public)` and `storage.objects(bucket_id, name, metadata, updated_at)`. |
| Storage file download | Approved list/read access for the selected buckets, including object metadata and object contents. Keep these credentials separate from the database login. |

The role should have no ownership, administrative role membership, global RLS bypass, application writes, DDL, or access to Auth password hashes, tokens or sessions. Have the owner verify exact coverage for approved tables, staff identities and Storage objects using independent counts. The default `pg_dump` fails if RLS would filter rows. If that happens, stop the whole-table dump. An approved table-specific read policy and explicit read-only projection can be reviewed separately with independently checked counts. [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)

The inventory script selects every visible profile with a role. If the project uses profiles for ordinary users as well as staff, use a separately reviewed staff-only projection based on approved UUIDs before running the inventory. If bucket metadata is visible beyond the approved scope, limit the Storage queries to the approved buckets before exporting them.

Copy the password-free service template to a protected local configuration directory outside the repository. Replace the role and CA path with the approved values. Use a CA bundle that validates the Session pooler's certificate and hostname with `sslmode=verify-full`. If verification fails, check the CA and host with the operator. Keep the password in a protected local libpq password file or enter it privately at the local prompt. For an explicitly chosen service file, set `$env:PGSERVICEFILE` to its absolute path in the authorized export shell. [PostgreSQL TLS verification](https://www.postgresql.org/docs/current/libpq-ssl.html)

## Source inventory and schema

Run in PowerShell after approval. Replace both placeholders and use a directory that already exists and is empty.

```powershell
$repo = 'D:\React\gym-app'
$out = 'X:\Encrypted\GymExport\APPROVED_NEW_DIRECTORY'
$projectRef = 'APPROVED_PROJECT_REF'
if ($projectRef -cnotmatch '^[a-z0-9]{20}$') { throw 'Enter the approved Supabase project reference.' }
$endpoint = "https://${projectRef}.storage.supabase.co/storage/v1/s3"
if (!(Test-Path -LiteralPath $out -PathType Container) -or (Get-ChildItem -Force -LiteralPath $out)) { throw 'Use an empty approved export directory.' }
$env:PGSERVICE = 'gym_export'
$env:PGOPTIONS = '-c default_transaction_read_only=on'
Push-Location -LiteralPath $out
try {
  psql -X -q -v ON_ERROR_STOP=1 -v approved_export=on -f "$repo/scripts/export-gym-source-inventory.sql"
  if ($LASTEXITCODE) { throw 'Source inventory failed. Keep the directory private.' }
  pg_dump --schema-only --schema=public --quote-all-identifiers --no-owner --no-privileges --file=public_schema.sql
  if ($LASTEXITCODE) { throw 'Public schema export failed.' }
} finally { Pop-Location }
```

The inventory includes current public tables, restricted Auth identities and roles, Storage buckets and object metadata. It excludes passwords, tokens and Auth sessions. Compare the current table list to the November 22 schema using the following local commands. Review newly found tables, columns, types and ownership before approving their row export.

```powershell
$old = Select-String -LiteralPath 'C:\Users\shush\gym-cloud-backup\public_schema.sql' -Pattern '^CREATE TABLE (?:IF NOT EXISTS )?"public"\."([^"]+)"' |
  ForEach-Object { $_.Matches[0].Groups[1].Value }
$now = (Import-Csv -LiteralPath "$out/public-tables.csv").table_name
Compare-Object -ReferenceObject ($old | Sort-Object) -DifferenceObject ($now | Sort-Object)
```

## Approved table rows and Storage files

Create `approved-tables.txt` in the export directory with one reviewed public table name per line. Include members and status history, attendance, fees and allocations, invoices, items and payments, inventory and stock, website content, invoice counters, and historical email evidence wherever they exist. Review columns for credentials and unrelated data first. If a table contains secrets, use an independently reviewed column projection instead of dumping that table. Record exclusions. Every table absent from the scope needs a recorded disposition.

```powershell
$tables = @(Get-Content -LiteralPath "$out/approved-tables.txt")
if (!$tables.Count -or ($tables | Where-Object { $_ -cnotmatch '^[a-z][a-z0-9_]*$' -or $_ -cnotin $now })) {
  throw 'Use reviewed public table names from the source inventory.'
}
$tableArgs = @($tables | ForEach-Object { "--table=public.$_" })
pg_dump --data-only --strict-names --format=custom --no-owner --no-privileges --file="$out/public_data.dump" @tableArgs
if ($LASTEXITCODE) { throw 'Public data export failed.' }
New-Item -ItemType Directory -Path "$out/objects" | Out-Null
foreach ($bucket in (Import-Csv -LiteralPath "$out/storage-buckets.csv").id) {
  if ($bucket -cnotmatch '^[a-zA-Z0-9][a-zA-Z0-9_-]*$') { throw 'Review an unsupported bucket name.' }
  aws --profile gym-export --endpoint-url $endpoint --no-cli-pager s3 sync "s3://$bucket/" "$out/objects/$bucket/" --only-show-errors 2>> "$out/storage-export.log"
  if ($LASTEXITCODE) { throw 'Storage export failed. Review the protected log.' }
}
```

Before downloading to Windows, review object names in the private inventory for traversal, reserved names and case collisions. Use an isolated case-sensitive filesystem if names cannot be represented safely on Windows. Compare the files to the database inventory by path and size. Record missing, changed and unexpected objects. PostgreSQL exports are individual consistent snapshots, while Storage downloads run separately. Record their times. Obtain an approved quiet window or repeat the inventories and resolve changes before treating the export as a coherent snapshot. [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) · [Supabase Storage downloads](https://supabase.com/docs/guides/storage/management/download-objects)

## Manifest and offline handoff

After verification, build the file manifest and have an authorized operator sign off its hash through a separate protected channel.

```powershell
$root = (Get-Item -LiteralPath $out).FullName.TrimEnd('\')
if (Test-Path -LiteralPath "$root/export-manifest.json") { throw 'Use a fresh export directory for the manifest.' }
$created = [DateTime]::UtcNow.ToString('o')
$files = @(Get-ChildItem -LiteralPath $root -File -Recurse | Sort-Object FullName | ForEach-Object {
  [ordered]@{
    filename = $_.FullName.Substring($root.Length + 1).Replace('\','/')
    bytes = $_.Length
    sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
})
$manifest = [ordered]@{ version = 1; source = "supabase:$projectRef"; exportedAtUtc = $created; files = $files } |
  ConvertTo-Json -Depth 5
[IO.File]::WriteAllText("$root/export-manifest.json", $manifest)
(Get-FileHash -LiteralPath "$root/export-manifest.json" -Algorithm SHA256).Hash.ToLowerInvariant()
```

Keep the manifest and all files encrypted and access-restricted. Give the rehearsal operator the directory location and independently approved manifest checksum. Use the provider's restorable backup for the isolated PostgreSQL exporter where public schema objects depend on Supabase extensions or functions. The public dumps and restricted projections above provide an independently reviewable export and do not recreate a complete Supabase installation. Follow the offline export and PLAN procedure, and compare the independent source totals before asking for approval to apply. [Supabase backups](https://supabase.com/docs/guides/platform/backups) · [Data rehearsal](php-data-rehearsal.md)

The November 22 schema comparison found no explicit tables for membership status history, holiday templates, membership fees, payment allocations, import logs, or historical email delivery. Auth identities and Storage metadata are separate projections. Member measurements, report logs and transformations are archive-only in the current importer. The old schema also has an unmapped FAQ creation timestamp and annual counter metadata that stays in the archive. Rerun the schema comparison against the current authorized export before deciding which gaps still apply.
