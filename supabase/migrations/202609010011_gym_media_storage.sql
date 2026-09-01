-- The frontend reads public media and authenticated admins manage uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gym-media',
  'gym-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gym_media_public_read on storage.objects;
create policy gym_media_public_read
on storage.objects for select
to public
using (bucket_id = 'gym-media');

drop policy if exists gym_media_admin_insert on storage.objects;
create policy gym_media_admin_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'gym-media' and public.is_admin());

drop policy if exists gym_media_admin_update on storage.objects;
create policy gym_media_admin_update
on storage.objects for update
to authenticated
using (bucket_id = 'gym-media' and public.is_admin())
with check (bucket_id = 'gym-media' and public.is_admin());

drop policy if exists gym_media_admin_delete on storage.objects;
create policy gym_media_admin_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'gym-media' and public.is_admin());
