-- Safe local-development seed file.
-- No users, passwords, production member records, or other personal data are seeded.
-- Create a local Auth user in Studio (Authentication → Users → Add user), then run the SQL below to make them admin.

-- Ensure admin_settings exists for membership fee system
INSERT INTO public.admin_settings (id, gym_name, currency_code)
VALUES (1, 'A&A Health Club', 'NPR')
ON CONFLICT (id) DO NOTHING;

-- Ensure at least one active membership plan exists for fee calculation
INSERT INTO public.pricing_items (kind, title, price, is_active, sort_order)
VALUES ('plan', 'Monthly', '2500', true, 1)
ON CONFLICT DO NOTHING;

-- Initialize membership fees for existing members (safe to run multiple times)
DO $$
DECLARE
    v_member RECORD;
BEGIN
    FOR v_member IN
        SELECT id FROM public.members WHERE deleted_at IS NULL
    LOOP
        PERFORM public.initialize_membership_fees(v_member.id);
    END LOOP;
END $$;

-- AFTER creating an auth user in Studio (Authentication → Users → Add user),
-- copy their User UUID and run this to make them admin:
-- INSERT INTO public.profiles (id, email, role)
-- VALUES ('PASTE_USER_UUID_HERE', 'their-email@example.com', 'admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';