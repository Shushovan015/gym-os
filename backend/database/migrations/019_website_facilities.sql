CREATE TABLE IF NOT EXISTS facilities_page_content (
    id TINYINT UNSIGNED PRIMARY KEY CHECK (id = 1),
    content JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE facility_items ADD INDEX IF NOT EXISTS facility_image (image(191), is_active);
