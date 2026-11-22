CREATE TABLE IF NOT EXISTS pricing_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    kind VARCHAR(8) NOT NULL CHECK (kind IN ('plan', 'perk')),
    title TEXT NOT NULL,
    price TEXT NOT NULL DEFAULT '',
    cadence TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    is_highlighted TINYINT(1) NOT NULL DEFAULT 0,
    features JSON NOT NULL DEFAULT ('[]') CHECK (JSON_TYPE(features) = 'ARRAY'),
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX (kind, is_active, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
