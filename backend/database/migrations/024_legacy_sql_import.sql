CREATE TABLE IF NOT EXISTS legacy_sql_evidence (
    entity VARCHAR(16) NOT NULL CHECK (entity IN ('register','officeregister','bill')),
    legacy_id BIGINT NOT NULL CHECK (legacy_id > 0),
    payload JSON NOT NULL,
    fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    member_id BIGINT NULL,
    invoice_id BIGINT NULL,
    review_reason VARCHAR(255) NULL,
    imported_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (entity, legacy_id),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
