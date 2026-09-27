INSERT INTO public.admin_settings (id, gym_name, currency_code)
VALUES (1, 'A&A Health Club', 'NPR')
ON CONFLICT (id) DO NOTHING;