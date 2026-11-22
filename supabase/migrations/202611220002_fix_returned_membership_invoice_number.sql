-- Production reviewed migration: return the invoice number after issue trigger has assigned it.
-- Replaces the function definition, does not update existing invoice rows.

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
    v_original_subtotal bigint := 0;
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
        SELECT mf.*, m.full_name, m.phone, m.email
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

    v_original_subtotal := v_total_amount;

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

    -- The tax was already added to v_total_amount above. Re-use that amount;
    -- never calculate tax again on the tax-inclusive total.
    -- subtotal_minor is the sum of membership periods before tax.
    -- v_original_subtotal is captured before the tax is added.
    UPDATE public.invoices
    SET subtotal_minor = v_original_subtotal,
        tax_minor = v_total_amount - v_original_subtotal,
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

    -- The number is assigned by the invoice trigger when the draft is issued.
    -- Re-read it after the UPDATE; the number returned on initial INSERT was NULL.
    SELECT invoice_number INTO v_number
    FROM public.invoices WHERE id = v_invoice_id;
    IF v_number IS NULL OR btrim(v_number) = '' THEN
        RAISE EXCEPTION 'Issued membership invoice has no invoice number';
    END IF;

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
