CREATE TABLE IF NOT EXISTS inventory_suppliers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT NULL,
    phone TEXT NULL,
    email TEXT NULL,
    address TEXT NULL,
    notes TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS shop_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    price TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    badge TEXT NOT NULL DEFAULT '',
    inquire_link TEXT NOT NULL DEFAULT '/contact',
    sort_order INT NOT NULL DEFAULT 0,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    sku VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL UNIQUE,
    brand TEXT NULL,
    unit TEXT NOT NULL DEFAULT 'piece',
    barcode VARCHAR(255) NULL UNIQUE,
    supplier_id BIGINT NULL,
    inventory_enabled TINYINT(1) NOT NULL DEFAULT 0,
    cost_price_minor BIGINT NOT NULL DEFAULT 0 CHECK (cost_price_minor >= 0),
    selling_price_minor BIGINT NOT NULL DEFAULT 0 CHECK (selling_price_minor >= 0),
    wholesale_price_minor BIGINT NOT NULL DEFAULT 0 CHECK (wholesale_price_minor BETWEEN 0 AND 9007199254740991),
    low_stock_threshold DECIMAL(14,3) NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
    inventory_notes TEXT NULL,
    deactivated_at DATETIME(6) NULL,
    FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL,
    INDEX (is_active, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS inventory_product_variants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Default',
    sku VARCHAR(255) NOT NULL UNIQUE,
    barcode VARCHAR(255) NULL UNIQUE,
    size TEXT NULL,
    color TEXT NULL,
    flavour TEXT NULL,
    package_size TEXT NULL,
    cost_price_minor BIGINT NULL CHECK (cost_price_minor >= 0),
    selling_price_minor BIGINT NULL CHECK (selling_price_minor >= 0),
    wholesale_price_minor BIGINT NULL CHECK (wholesale_price_minor BETWEEN 0 AND 9007199254740991),
    current_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
    low_stock_threshold DECIMAL(14,3) NULL CHECK (low_stock_threshold >= 0),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    FOREIGN KEY (product_id) REFERENCES shop_items(id) ON DELETE RESTRICT,
    INDEX (product_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    variant_id BIGINT NOT NULL,
    movement_type VARCHAR(24) NOT NULL CHECK (movement_type IN
        ('opening','purchase','sale','manual_increase','manual_decrease','damaged','return','correction','cancellation_reversal')),
    quantity_delta DECIMAL(14,3) NOT NULL CHECK (quantity_delta <> 0),
    previous_quantity DECIMAL(14,3) NOT NULL,
    resulting_quantity DECIMAL(14,3) NOT NULL,
    supplier_id BIGINT NULL,
    invoice_id BIGINT NULL,
    reference TEXT NULL,
    notes TEXT NULL,
    created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (variant_id) REFERENCES inventory_product_variants(id) ON DELETE RESTRICT,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL,
    INDEX (variant_id, id),
    INDEX (invoice_id, movement_type, variant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

ALTER TABLE invoice_items
    ADD FOREIGN KEY IF NOT EXISTS invoice_items_product_fk (product_id) REFERENCES shop_items(id) ON DELETE RESTRICT,
    ADD FOREIGN KEY IF NOT EXISTS invoice_items_variant_fk (variant_id) REFERENCES inventory_product_variants(id) ON DELETE RESTRICT;
