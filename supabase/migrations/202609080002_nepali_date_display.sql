alter table public.admin_settings
  alter column date_display_preference set default 'bs';

update public.admin_settings
set date_display_preference = 'bs'
where date_display_preference is distinct from 'bs';
