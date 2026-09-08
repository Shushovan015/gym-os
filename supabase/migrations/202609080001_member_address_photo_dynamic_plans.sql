alter table public.members
  add column if not exists address text,
  add column if not exists photo_url text;

-- Membership plan names are managed in pricing_items and may change over time.
-- Keep the selected plan name on the member as a historical snapshot.
alter table public.members
  drop constraint if exists members_membership_type_check;
