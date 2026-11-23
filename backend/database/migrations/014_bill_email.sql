CREATE TABLE IF NOT EXISTS bill_email_attempts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    recipient VARCHAR(254) NOT NULL,
    message_token CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    status VARCHAR(12) NOT NULL CHECK (status IN ('sending','sent','failed','uncertain')),
    reconciliation_note VARCHAR(500) NULL,
    reconciled_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    finished_at DATETIME(6) NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    INDEX (invoice_id, id),
    INDEX (actor_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
