-- The trigger lives on auth.users and is not included by a public-only dump.
-- Reconnect local Auth signup to the existing public.handle_new_user function.
-- The exported function used the obsolete role value "member", while the
-- current profiles constraint allows only "user" and "admin".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
