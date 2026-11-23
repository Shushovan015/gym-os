CREATE TABLE IF NOT EXISTS pending_billing_attempts (
    actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    active_actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
    request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    operation VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
