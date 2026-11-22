CREATE TABLE IF NOT EXISTS invoice_balance_payment_requests (
    request_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payment_id BIGINT NULL UNIQUE,
    FOREIGN KEY (payment_id) REFERENCES invoice_payments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
