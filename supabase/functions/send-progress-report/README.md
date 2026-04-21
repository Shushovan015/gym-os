# send-progress-report

Supabase Edge Function to generate a member progress report payload from measurement history + transformation milestones.

## Required env vars

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REPORT_GYM_NAME` (optional, default: `Gym`)

## Deploy

```bash
supabase functions deploy send-progress-report
```

## Notes

- This function checks the caller's JWT and allows only admin users (`profiles.role = 'admin'`).
- It writes generation status to `member_report_logs`.
- It no longer generates PDF or sends emails.
- Frontend invokes via:
  - `supabase.functions.invoke("send-progress-report", { body: { member_id } })`
