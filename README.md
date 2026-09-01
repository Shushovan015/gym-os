# Gym application

React, TypeScript, and Vite frontend backed by Supabase (PostgreSQL, Auth,
Storage, RLS, RPCs, and one Edge Function).

## Local Development

### Requirements

- Node.js 20 or newer
- Docker Desktop, running with Linux containers
- PowerShell on Windows

The official Supabase CLI is installed in the project; no global CLI is needed.

### Install and configure

```powershell
npm install
Copy-Item .env.example .env.local
npm run supabase:start
npm run supabase:status
```

Copy the reported local anon/publishable key into
`VITE_SUPABASE_ANON_KEY` in `.env.local`. Keep
`VITE_SUPABASE_URL=http://127.0.0.1:54321`.

Never put a service-role key in a `VITE_*` variable; Vite variables are public.

```powershell
npm run dev
```

Or start/check Supabase and then start Vite:

```powershell
npm run dev:local
```

### Recreate the local schema

The checked-in baseline is a schema-only, read-only export of the existing
Cloud `public` schema. It contains no production rows or Auth users. Recreate
the local database at any time with:

```powershell
npm run db:reset
```

Never run `db reset --linked`; the project command always includes `--local`.
Treat any future production-data migration as a separate, encrypted,
privacy-sensitive task.

### Authentication

Local email confirmation is disabled. Emails are captured by the local mail
viewer instead of delivered. Create a local user in Studio Authentication,
then create its matching `profiles` row with `role = 'admin'`. Local users are
separate from Cloud users.

Admin routes restore sessions and check the `profiles` role. The report Edge
Function also validates the caller and admin role before using its server-side
service-role client.

### Studio and PostgreSQL tools

Run `npm run supabase:status` for authoritative addresses and credentials.
With the checked-in default ports these are normally:

- Studio: `http://127.0.0.1:54323`
- PostgreSQL host: `127.0.0.1`
- PostgreSQL port: `54322`
- Database: `postgres`
- Username: `postgres`

The status output provides current credentials. Do not commit passwords. These
settings also work with pgAdmin.

### Database commands

```powershell
npm run supabase:start
npm run supabase:status
npm run db:reset
npm run db:backup
npm run db:restore -- backups/gym-management-YYYY-MM-DD-HHMMSS.dump
npm run supabase:stop
```

`db:backup` runs `pg_dump` inside the verified local Supabase PostgreSQL
container, creates a timestamped custom-format dump under `backups/`, and never
deletes older backups.

`db:restore` requires an explicit non-empty `.dump`, accepts only this project's
exact local Docker container, and requires typing `RESTORE LOCAL`. It cannot
target a URL or remote/production database.

Schedule `npm run db:backup` with Windows Task Scheduler or cron if desired.
Docker Desktop and local Supabase must be running.

### Moving to another computer

1. Copy/clone the project and copy the desired `.dump` separately.
2. Install Node.js and Docker Desktop.
3. Run `npm install`, then `npm run supabase:start`.
4. Configure `.env.local` from that machine's status output.
5. Run `npm run db:restore -- path/to/backup.dump`.
6. Run `npm run dev`.

### Production later

Application code is environment-independent. A future frontend can point
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to self-hosted Supabase on a
VPS. Server-only secrets remain in the Supabase/Edge Function environment. Do
not reuse local keys or database credentials in production.
