-- Add admin RLS policies for public.membership_fees.
--
-- The table was created with RLS enabled but without any policies. Because of
-- that every direct client query (for example the "Collect Membership Fee"
-- screen in AdminBilling, which selects outstanding rows directly) silently
-- returned zero rows, even though membership_fees contained unpaid periods.
--
-- SECURITY DEFINER functions such as get_member_membership_fee_status() were
-- unaffected, which is why the member detail screen showed the fees while the
-- billing screen did not.

ALTER TABLE public.membership_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membership_fees_select_admin" ON public.membership_fees;
CREATE POLICY "membership_fees_select_admin" ON public.membership_fees
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "membership_fees_insert_admin" ON public.membership_fees;
CREATE POLICY "membership_fees_insert_admin" ON public.membership_fees
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "membership_fees_update_admin" ON public.membership_fees;
CREATE POLICY "membership_fees_update_admin" ON public.membership_fees
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "membership_fees_delete_admin" ON public.membership_fees;
CREATE POLICY "membership_fees_delete_admin" ON public.membership_fees
    FOR DELETE TO authenticated
    USING (public.is_admin());
