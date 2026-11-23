CREATE TABLE IF NOT EXISTS personal_training_plans (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    points JSON NOT NULL DEFAULT ('[]') CHECK (JSON_TYPE(points) = 'ARRAY'),
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX (is_active, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
