-- Single-gym admin settings used by the operational admin interface.
-- This remains intentionally single-row and single-gym; it is not a tenant model.
create table if not exists public.admin_settings (
  id int primary key default 1 check (id = 1),
  gym_name text not null default 'A&A Health Club',
  logo_url text,
  phone text not null default '+977 98XXXXXXXX',
  email text not null default 'info@aahealthclub.com',
  address text not null default 'Butwal, Rupandehi, Nepal',
  operating_hours text not null default 'Daily, 5:00 AM - 9:00 PM',
  weekly_closing_day int not null default 6 check (weekly_closing_day between 0 and 6),
  expiry_warning_days int not null default 7 check (expiry_warning_days in (7, 15, 30)),
  absent_after_days int not null default 8 check (absent_after_days between 1 and 60),
  default_membership_type text not null default 'monthly'
    check (default_membership_type in ('monthly', 'quarterly', 'yearly', 'trial')),
  date_display_preference text not null default 'both'
    check (date_display_preference in ('bs', 'ad', 'both')),
  attendance_holiday_lock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.set_admin_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_settings_updated_at on public.admin_settings;
create trigger trg_admin_settings_updated_at
before update on public.admin_settings
for each row
execute function public.set_admin_settings_updated_at();

alter table public.admin_settings enable row level security;

drop policy if exists admin_settings_select_admin on public.admin_settings;
create policy admin_settings_select_admin
on public.admin_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists admin_settings_insert_admin on public.admin_settings;
create policy admin_settings_insert_admin
on public.admin_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists admin_settings_update_admin on public.admin_settings;
create policy admin_settings_update_admin
on public.admin_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
