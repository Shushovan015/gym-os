ALTER TABLE membership_payment_allocations
    ADD COLUMN IF NOT EXISTS previous_invoice_id BIGINT NULL;
