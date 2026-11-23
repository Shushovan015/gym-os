CREATE TABLE IF NOT EXISTS product_media_files (
    file_key VARCHAR(55) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX (created_at)
) ENGINE=InnoDB;

ALTER TABLE inventory_product_variants ADD COLUMN IF NOT EXISTS image TEXT NULL;
CREATE INDEX IF NOT EXISTS shop_items_image ON shop_items (image(100));
CREATE INDEX IF NOT EXISTS inventory_variants_image ON inventory_product_variants (image(100));
