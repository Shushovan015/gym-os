CREATE TABLE IF NOT EXISTS invoice_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    item_type VARCHAR(24) NOT NULL CHECK (item_type IN ('membership','personal_training','product','miscellaneous')),
    customer_type VARCHAR(24) NULL,
    product_id BIGINT NULL,
    variant_id BIGINT NULL,
    source_item_id BIGINT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(14,3) NOT NULL CHECK (quantity > 0),
    unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
    unit_cost_minor BIGINT NULL CHECK (unit_cost_minor >= 0),
    discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
    tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
    line_total_minor BIGINT NOT NULL CHECK (line_total_minor >= 0),
    membership_period_start DATE NULL,
    membership_period_end DATE NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CHECK (item_type <> 'product' OR (product_id IS NOT NULL AND variant_id IS NOT NULL)),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX (invoice_id, sort_order, id),
    INDEX (variant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS invoice_number_sequences (
    id INT PRIMARY KEY CHECK (id = 1),
    next_number BIGINT NOT NULL CHECK (next_number BETWEEN 1 AND 9007199254740992)
) ENGINE=InnoDB;

INSERT INTO invoice_number_sequences (id, next_number)
SELECT 1, GREATEST(
    (SELECT invoice_start_number FROM admin_settings WHERE id = 1),
    COALESCE(MAX(CAST(CASE WHEN TRIM(invoice_number) REGEXP '^[0-9]{1,16}$' THEN TRIM(invoice_number) END AS UNSIGNED)), 0) + 1
)
FROM invoices WHERE invoice_number IS NULL OR
    CASE WHEN TRIM(invoice_number) REGEXP '^[0-9]{1,16}$' THEN CAST(TRIM(invoice_number) AS UNSIGNED) END <= 9007199254740991
ON DUPLICATE KEY UPDATE next_number = GREATEST(invoice_number_sequences.next_number, VALUES(next_number));

CREATE TABLE IF NOT EXISTS membership_payment_allocations (
    payment_id BIGINT NOT NULL,
    fee_id BIGINT NOT NULL,
    invoice_item_id BIGINT NOT NULL UNIQUE,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    PRIMARY KEY (payment_id, fee_id),
    FOREIGN KEY (payment_id) REFERENCES invoice_payments(id) ON DELETE RESTRICT,
    FOREIGN KEY (fee_id) REFERENCES membership_fees(id) ON DELETE RESTRICT,
    FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id) ON DELETE RESTRICT,
    INDEX (fee_id, payment_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_payment_requests (
    request_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    response_json JSON NULL,
    payment_id BIGINT NULL UNIQUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (payment_id) REFERENCES invoice_payments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_audit_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_id BIGINT NOT NULL UNIQUE,
    member_id BIGINT NOT NULL,
    actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (payment_id) REFERENCES invoice_payments(id) ON DELETE RESTRICT,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
    INDEX (member_id, created_at)
) ENGINE=InnoDB;
