-- Fix membership fee generation for imported / inactive members.
--
-- Root problem:
--   * Members imported from a SQL dump are inserted with is_active = false.
--   * initialize_membership_fees() skips inactive members, so no fee rows exist.
--   * get_member_membership_fee_status() returns an empty payload for inactive
--     members, so the UI says "No outstanding membership fees / all payments are
--     up to date" even though members.payment_status is still 'unpaid'.
--   * Editing start_date / end_date on a member never re-ran fee generation.
--
-- This migration:
--   1. Adds sync_member_fee_state() to keep payment_due_date / payment_status
--      in step with the membership_fees rows.
--   2. Re-initialises fees when a member is activated or their dates change.
--   3. Activates members that were never deliberately deactivated and creates
--      any missing fee rows for active members.
--   4. Stops hiding real fee data for inactive members (they can still owe money).

-- 1. Keep member payment state in sync with membership fee rows
CREATE OR REPLACE FUNCTION public.sync_member_fee_state(p_member_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_next_due date;
    v_has_outstanding boolean;
    v_has_overdue boolean;
BEGIN
    SELECT
        MIN(due_date) FILTER (WHERE status IN ('unpaid', 'overdue', 'partial')),
        COALESCE(BOOL_OR(status IN ('unpaid', 'overdue', 'partial')), false),
        COALESCE(BOOL_OR(status = 'overdue'), false)
    INTO v_next_due, v_has_outstanding, v_has_overdue
    FROM public.membership_fees
    WHERE member_id = p_member_id;

    UPDATE public.members
    SET payment_due_date = v_next_due,
        payment_status = CASE
            WHEN v_has_overdue THEN 'overdue'
            WHEN v_has_outstanding THEN 'unpaid'
            ELSE 'paid'
        END,
        updated_at = now()
    WHERE id = p_member_id;
END $$;

-- 2. Generate fees when an inactive member becomes active
CREATE OR REPLACE FUNCTION public.on_member_activated_initialize_fees()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.initialize_membership_fees(NEW.id);
    PERFORM public.sync_member_fee_state(NEW.id);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS member_activated_initialize_fees ON public.members;
CREATE TRIGGER member_activated_initialize_fees
    AFTER UPDATE OF is_active ON public.members
    FOR EACH ROW
    WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active = true)
    EXECUTE FUNCTION public.on_member_activated_initialize_fees();

-- 3. Regenerate fees when start/end dates change on an active member
CREATE OR REPLACE FUNCTION public.on_member_dates_changed_initialize_fees()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.is_active THEN
        PERFORM public.initialize_membership_fees(NEW.id);
        PERFORM public.sync_member_fee_state(NEW.id);
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS member_dates_changed_initialize_fees ON public.members;
CREATE TRIGGER member_dates_changed_initialize_fees
    AFTER UPDATE OF start_date, end_date ON public.members
    FOR EACH ROW
    WHEN (OLD.start_date IS DISTINCT FROM NEW.start_date OR OLD.end_date IS DISTINCT FROM NEW.end_date)
    EXECUTE FUNCTION public.on_member_dates_changed_initialize_fees();

-- 4. Activate members that were never deliberately deactivated, then create
--    any missing fee rows for every active member.
UPDATE public.members
SET is_active = true,
    activated_at = COALESCE(activated_at, now()),
    updated_at = now()
WHERE deleted_at IS NULL
  AND is_active = false
  AND deactivated_at IS NULL
  AND membership_status <> 'cancelled';

DO $$
DECLARE
    v_member RECORD;
BEGIN
    -- Run for every active member (not only members with zero fee rows) so
    -- partially imported histories also get their missing months filled in.
    FOR v_member IN
        SELECT m.id
        FROM public.members m
        WHERE m.deleted_at IS NULL
          AND m.is_active = true
    LOOP
        PERFORM public.initialize_membership_fees(v_member.id);
        PERFORM public.sync_member_fee_state(v_member.id);
    END LOOP;
END $$;

-- Mark past-due fee periods as overdue and refresh every member's payment state
UPDATE public.membership_fees
SET status = 'overdue',
    updated_at = now()
WHERE status IN ('unpaid', 'partial')
  AND due_date < public.get_nepal_today_ad();

DO $$
DECLARE
    v_member RECORD;
BEGIN
    FOR v_member IN
        SELECT id FROM public.members
        WHERE deleted_at IS NULL AND is_active = true
    LOOP
        PERFORM public.sync_member_fee_state(v_member.id);
    END LOOP;
END $$;

-- 5. Show actual fee data for inactive members too (they can still owe money)
CREATE OR REPLACE FUNCTION public.get_member_membership_fee_status(p_member_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_result jsonb;
    v_member RECORD;
BEGIN
    SELECT * INTO v_member FROM public.members WHERE id = p_member_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Member not found';
    END IF;

    SELECT jsonb_build_object(
        'has_outstanding', EXISTS (
            SELECT 1 FROM public.membership_fees
            WHERE member_id = p_member_id AND status IN ('unpaid', 'overdue', 'partial')
        ),
        'outstanding_fees', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'billing_month', billing_month,
                    'amount_minor', amount_minor,
                    'paid_amount_minor', paid_amount_minor,
                    'outstanding_minor', amount_minor - paid_amount_minor,
                    'status', status,
                    'due_date', due_date,
                    'paid_at', paid_at,
                    'invoice_id', invoice_id
                ) ORDER BY billing_month
            ) FROM public.membership_fees
            WHERE member_id = p_member_id AND status IN ('unpaid', 'overdue', 'partial')
        ),
        'paid_fees', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'billing_month', billing_month,
                    'amount_minor', amount_minor,
                    'paid_amount_minor', paid_amount_minor,
                    'status', status,
                    'due_date', due_date,
                    'paid_at', paid_at
                ) ORDER BY billing_month DESC
            ) FROM public.membership_fees
            WHERE member_id = p_member_id AND status = 'paid'
            LIMIT 12
        ),
        'summary', public.get_membership_fee_summary(p_member_id)
    ) INTO v_result;

    RETURN v_result;
END $$;

-- 6. Grants
GRANT EXECUTE ON FUNCTION public.sync_member_fee_state(bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_member_activated_initialize_fees() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_member_dates_changed_initialize_fees() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_member_membership_fee_status(bigint) TO anon, authenticated, service_role;
