# Gym application

React, TypeScript, and Vite frontend backed by Supabase (PostgreSQL, Auth,
Storage, RLS, RPCs, and one Edge Function).

## Local Production Mode (daily gym use)

Development and daily use are intentionally separate:

- Development: `npm run dev` starts Vite with HMR on port 5173.
- Daily gym use: `OPEN GYM APP.bat` serves the compiled `dist` application on
  `http://127.0.0.1:4173` without Vite development mode or HMR.

The local production server binds only to this computer, serves only `dist`,
supports refreshed React routes through an SPA fallback, and records its own
PID under the ignored `.runtime` directory.

### First installation on a Windows computer

Install these prerequisites:

1. Git for Windows: <https://git-scm.com/download/win>
2. Node.js LTS (20 or newer): <https://nodejs.org/>
3. Docker Desktop with WSL 2/Linux containers:
   <https://www.docker.com/products/docker-desktop/>

Then open PowerShell in the project and run:

```powershell
npm install
Copy-Item .env.example .env.local
npm run supabase:start
npm run supabase:status
```

Put only the displayed local **Publishable** key in
`VITE_SUPABASE_ANON_KEY` inside `.env.local`. Never put the Secret,
service-role, JWT, database, or S3 secret keys in a `VITE_*` variable.

For a new empty local database, run `npm run db:reset`. To transfer an existing
installation instead, restore its backup and do not reset:

```powershell
npm run db:restore -- backups\your-backup.dump
```

Build and verify the installation:

```powershell
npm run setup:local
npm run supabase:verify
```

Create the local admin in Studio (`http://127.0.0.1:54323`): create an Auth
user, open `profiles`, and change that user's role from `user` to `admin`.

### Normal daily operation

Morning:

```text
Double-click OPEN GYM APP
```

It checks/starts Docker Desktop, waits for Docker, checks/starts Supabase,
builds only when `dist/index.html` is missing, starts the dedicated frontend if
needed, waits for its health response, and opens the browser. Repeated clicks
reuse the existing services instead of starting duplicate servers.

Evening:

```text
Double-click CLOSE GYM APP
```

It creates a PostgreSQL backup first. Only after a successful backup does it
verify and stop the exact PID belonging to `serve-local.mjs`, then stop local
Supabase. It never kills every `node.exe`. If backup fails, the database and
frontend remain running and the window tells the user to contact the
administrator.

### Desktop shortcuts and optional Windows startup

To create the two desktop shortcuts:

1. Right-click `OPEN GYM APP.bat`, choose Show more options, then Send to, then Desktop.
2. Rename that shortcut to `OPEN GYM APP`.
3. Repeat for `CLOSE GYM APP.bat` and name it `CLOSE GYM APP`.

Optional automatic opening after sign-in:

1. In Docker Desktop, enable Settings → General → Start Docker Desktop when
   you sign in.
2. Press `Win + R`, enter `shell:startup`, and press Enter.
3. Put a shortcut to `OPEN GYM APP.bat` in that folder.

No registry entries or Scheduled Tasks are created by this project.

### Updating the application safely

1. Double-click `CLOSE GYM APP` and confirm the backup succeeded.
2. Run `git pull`.
3. Run `npm install`.
4. Run `npm run setup:local` to rebuild `dist`.
5. Apply new migrations with `npx supabase migration up --local` if the update
   includes migrations. Never use `db:reset` on the real daily database.
6. Double-click `OPEN GYM APP`.
7. Verify login, members, attendance, inventory, and billing.

### Production-local commands

```powershell
npm run setup:local
npm run start:local
npm run build
npm run supabase:start
npm run supabase:stop
npm run db:backup
```

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
deletes older backups. It includes the complete application (`public`), Auth,
and Storage database schemas and data. Supabase's generated infrastructure
schemas (Realtime, GraphQL, analytics, extensions, and CLI metadata) are
recreated by the local stack and excluded so restores stay portable.

`db:restore` requires an explicit non-empty `.dump`, accepts only this project's
exact local Docker container, and requires typing `RESTORE LOCAL`. It cannot
target a URL or remote/production database. Local Supabase services restart
after restoration so Auth, REST, and Storage reconnect to the restored schema.

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
