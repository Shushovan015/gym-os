-- Fix membership fee initialization to preserve the exact start date day for due_date
-- The bug: date_trunc('month', v_start_date) was used for due_date, losing the day component
-- e.g., Bhadra 8 (2026-08-24) became due on Bhadra 1 (2026-08-01)

-- Drop and recreate the initialize_membership_fees function with the fix
DROP FUNCTION IF EXISTS public.initialize_membership_fees(bigint);

CREATE OR REPLACE FUNCTION public.initialize_membership_fees(p_member_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_member RECORD;
    v_start_date date;
    v_end_date date;
    v_current_month date;
    v_amount_minor bigint;
    v_plan_price text;
    v_currency_code text;
    v_month_diff integer;
BEGIN
    -- Get member details
    SELECT m.*, s.currency_code
    INTO v_member
    FROM public.members m
    CROSS JOIN public.admin_settings s
    WHERE m.id = p_member_id AND s.id = 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Member not found';
    END IF;

    -- Get plan price from pricing_items
    SELECT price INTO v_plan_price
    FROM public.pricing_items
    WHERE kind = 'plan' AND title ILIKE v_member.membership_type AND is_active = true
    ORDER BY sort_order LIMIT 1;

    IF v_plan_price IS NOT NULL THEN
        -- Parse price string to minor units (assuming format like "5000" or "5,000")
        v_amount_minor := regexp_replace(v_plan_price, '[^\d.]', '', 'g')::numeric * 100;
    ELSE
        v_amount_minor := 0;
    END IF;

    v_currency_code := v_member.currency_code;
    v_start_date := v_member.start_date;
    v_end_date := v_member.end_date;

    -- If no start_date, use created_at date
    IF v_start_date IS NULL THEN
        v_start_date := v_member.created_at::date;
    END IF;

    -- If no end_date, use current month
    IF v_end_date IS NULL THEN
        v_end_date := date_trunc('month', public.get_nepal_today_ad())::date;
    END IF;

    -- Start from first day of start_date's month for billing_month grouping
    v_current_month := date_trunc('month', v_start_date)::date;

    -- Create fee records for each month
    WHILE v_current_month <= date_trunc('month', v_end_date)::date LOOP
        -- Calculate how many months from start month to current month
        v_month_diff := (EXTRACT(YEAR FROM v_current_month) - EXTRACT(YEAR FROM v_start_date)) * 12
                        + (EXTRACT(MONTH FROM v_current_month) - EXTRACT(MONTH FROM v_start_date));
        
        -- Due date preserves the exact day from start_date, just shifted by month_diff
        -- e.g., if start_date is 2026-08-24 (Bhadra 8), due_date for each month will be the 24th
        INSERT INTO public.membership_fees (member_id, billing_month, amount_minor, currency_code, status, due_date)
        VALUES (
            p_member_id,
            v_current_month,
            v_amount_minor,
            v_currency_code,
            CASE WHEN v_current_month <= date_trunc('month', public.get_nepal_today_ad())::date THEN 'unpaid' ELSE 'unpaid' END,
            public.add_months_preserving_day(v_start_date, v_month_diff)
        )
        ON CONFLICT (member_id, billing_month) DO NOTHING;

        v_current_month := public.next_month_first_day(v_current_month);
    END LOOP;

    -- Update member's payment_due_date to the earliest unpaid fee's due_date
    UPDATE public.members
    SET payment_due_date = (
        SELECT MIN(due_date) FROM public.membership_fees
        WHERE member_id = p_member_id AND status IN ('unpaid', 'overdue', 'partial')
    )
    WHERE id = p_member_id;
END $$;

-- Also fix record_membership_fee_payment_multi to use the last paid fee's due_date
-- instead of billing_month (first day of month) for calculating next due date
DROP FUNCTION IF EXISTS public.record_membership_fee_payment_multi(bigint[], text, date, text, text);

CREATE OR REPLACE FUNCTION public.record_membership_fee_payment_multi(
    p_fee_ids bigint[],
    p_payment_method text,
    p_payment_date date DEFAULT NULL,
    p_reference text DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_fees RECORD;
    v_fee_ids bigint[];
    v_total_amount bigint := 0;
    v_total_paid bigint := 0;
    v_invoice_id bigint;
    v_member_id bigint;
    v_last_paid_due_date date;
    v_billing_months text[] := '{}';
    v_fee_data jsonb[] := '{}';
    v_settings RECORD;
    v_today date := public.get_nepal_today_ad();
    v_number text;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    IF p_fee_ids IS NULL OR array_length(p_fee_ids, 1) = 0 THEN
        RAISE EXCEPTION 'No fee periods selected';
    END IF;

    IF p_payment_method NOT IN ('cash','card','bank_transfer','digital_wallet','other') THEN
        RAISE EXCEPTION 'Invalid payment method';
    END IF;

    -- Get admin settings for tax
    SELECT * INTO v_settings FROM public.admin_settings WHERE id = 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admin settings not found';
    END IF;

    -- Get and lock the selected fees, verify they belong to same member and are unpaid/partial
    FOR v_fees IN
        SELECT mf.*, m.member_id, m.full_name, m.phone, m.email
        FROM public.membership_fees mf
        JOIN public.members m ON m.id = mf.member_id
        WHERE mf.id = ANY(p_fee_ids)
        FOR UPDATE
    LOOP
        IF v_member_id IS NULL THEN
            v_member_id := v_fees.member_id;
        ELSIF v_member_id != v_fees.member_id THEN
            RAISE EXCEPTION 'All selected fees must belong to the same member';
        END IF;

        IF v_fees.status NOT IN ('unpaid', 'overdue', 'partial') THEN
            RAISE EXCEPTION 'Fee for % is already paid and cannot be selected again', to_char(v_fees.billing_month, 'Month YYYY');
        END IF;

        v_total_amount := v_total_amount + (v_fees.amount_minor - v_fees.paid_amount_minor);
        v_fee_ids := v_fee_ids || v_fees.id;
        v_billing_months := v_billing_months || to_char(v_fees.billing_month, 'Month YYYY');

        -- Track the latest paid fee's due_date (not billing_month) to preserve the day
        IF v_last_paid_due_date IS NULL OR v_fees.due_date > v_last_paid_due_date THEN
            v_last_paid_due_date := v_fees.due_date;
        END IF;

        -- Build fee data for invoice description
        v_fee_data := v_fee_data || jsonb_build_object(
            'fee_id', v_fees.id,
            'billing_month', v_fees.billing_month,
            'amount_minor', v_fees.amount_minor,
            'paid_amount_minor', v_fees.paid_amount_minor,
            'outstanding_minor', v_fees.amount_minor - v_fees.paid_amount_minor
        );
    END LOOP;

    IF v_total_amount <= 0 THEN
        RAISE EXCEPTION 'No outstanding amount to pay';
    END IF;

    -- Create the invoice WITHOUT invoice_number (let trigger assign it)
    INSERT INTO public.invoices (
        member_ref,
        customer_name,
        customer_phone,
        customer_email,
        billing_date,
        due_date,
        currency_code,
        discount_minor,
        tax_enabled,
        tax_label,
        tax_rate_basis_points,
        notes
    ) VALUES (
        v_member_id,
        (SELECT full_name FROM public.members WHERE id = v_member_id),
        (SELECT phone FROM public.members WHERE id = v_member_id),
        (SELECT email FROM public.members WHERE id = v_member_id),
        v_today,
        v_today,
        v_settings.currency_code,
        0,
        v_settings.tax_enabled,
        v_settings.tax_label,
        v_settings.tax_rate_basis_points,
        p_notes
    ) RETURNING id, invoice_number INTO v_invoice_id, v_number;

    -- Create invoice items for each fee period
    FOR v_fees IN
        SELECT * FROM public.membership_fees WHERE id = ANY(p_fee_ids) ORDER BY billing_month
    LOOP
        INSERT INTO public.invoice_items (
            invoice_id,
            item_type,
            customer_type,
            product_id,
            variant_id,
            description,
            quantity,
            unit_price_minor,
            discount_minor,
            tax_minor,
            line_total_minor,
            sort_order
        ) VALUES (
            v_invoice_id,
            'membership',
            NULL,
            NULL,
            NULL,
            to_char(v_fees.billing_month, 'Month YYYY') || ' Membership Fee',
            1,
            v_fees.amount_minor - v_fees.paid_amount_minor,
            0,
            0,
            v_fees.amount_minor - v_fees.paid_amount_minor,
            0
        );
    END LOOP;

    -- Add tax to last item if tax enabled
    IF v_settings.tax_enabled AND v_settings.tax_rate_basis_points > 0 THEN
        UPDATE public.invoice_items
        SET tax_minor = round((v_total_amount::numeric * v_settings.tax_rate_basis_points) / 10000)::bigint,
            line_total_minor = line_total_minor + round((v_total_amount::numeric * v_settings.tax_rate_basis_points) / 10000)::bigint
        WHERE id = (
            SELECT id FROM public.invoice_items
            WHERE invoice_id = v_invoice_id
            ORDER BY sort_order DESC
            LIMIT 1
        );
        v_total_amount := v_total_amount + round((v_total_amount::numeric * v_settings.tax_rate_basis_points) / 10000)::bigint;
    END IF;

    -- Update invoice totals
    UPDATE public.invoices
    SET subtotal_minor = v_total_amount - CASE WHEN v_settings.tax_enabled THEN round((v_total_amount::numeric * v_settings.tax_rate_basis_points) / 10000)::bigint ELSE 0 END,
        tax_minor = CASE WHEN v_settings.tax_enabled THEN round((v_total_amount::numeric * v_settings.tax_rate_basis_points) / 10000)::bigint ELSE 0 END,
        total_minor = v_total_amount,
        balance_minor = v_total_amount
    WHERE id = v_invoice_id;

    -- Mark selected fees as paid
    UPDATE public.membership_fees
    SET paid_amount_minor = amount_minor,
        status = 'paid',
        paid_at = now(),
        paid_by = auth.uid(),
        invoice_id = v_invoice_id,
        updated_at = now()
    WHERE id = ANY(p_fee_ids);

    -- Record the payment
    INSERT INTO public.invoice_payments (
        invoice_id,
        amount_minor,
        payment_method,
        payment_date,
        reference,
        notes
    ) VALUES (
        v_invoice_id,
        v_total_amount,
        p_payment_method,
        COALESCE(p_payment_date, v_today),
        p_reference,
        p_notes
    );

    -- Update invoice as issued
    UPDATE public.invoices
    SET invoice_status = 'issued',
        payment_status = 'paid',
        paid_minor = v_total_amount,
        balance_minor = 0,
        inventory_applied_at = now(),
        updated_by = auth.uid()
    WHERE id = v_invoice_id;

    -- Update member's payment_due_date to next month after last paid fee's due_date
    -- This preserves the exact day (e.g., if due_date was 24th, next due_date will be 24th of next month)
    UPDATE public.members
    SET payment_due_date = public.add_months_preserving_day(v_last_paid_due_date, 1),
        payment_status = CASE
            WHEN EXISTS (
                SELECT 1 FROM public.membership_fees
                WHERE member_id = v_member_id AND status IN ('unpaid', 'overdue', 'partial')
            ) THEN 'unpaid'
            ELSE 'paid'
        END,
        updated_at = now()
    WHERE id = v_member_id;

    RETURN jsonb_build_object(
        'invoice_id', v_invoice_id,
        'invoice_number', v_number,
        'total_amount_minor', v_total_amount,
        'paid_months', v_billing_months,
        'next_due_date', public.add_months_preserving_day(v_last_paid_due_date, 1),
        'member_id', v_member_id
    );
END $$;