CREATE TABLE IF NOT EXISTS admin_accounts (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    role VARCHAR(16) NOT NULL CHECK (role IN ('admin', 'viewer')),
    password_hash VARCHAR(255) NOT NULL,
    session_version INT UNSIGNED NOT NULL DEFAULT 1,
    enabled TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_limits (
    scope_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    window_started BIGINT UNSIGNED NOT NULL,
    attempts INT UNSIGNED NOT NULL,
    INDEX (window_started)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    action VARCHAR(80) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX (actor_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
