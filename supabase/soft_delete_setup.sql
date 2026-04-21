-- Soft-delete support for members and attendance records.
alter table public.members
  add column if not exists deleted_at timestamptz;

alter table public.attendance_records
  add column if not exists deleted_at timestamptz;

create index if not exists members_deleted_at_idx on public.members (deleted_at);
create index if not exists attendance_records_deleted_at_idx on public.attendance_records (deleted_at);
