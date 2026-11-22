CREATE TABLE IF NOT EXISTS members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id VARCHAR(255) NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NULL,
    phone TEXT NOT NULL,
    membership_type TEXT NOT NULL,
    membership_status VARCHAR(16) NOT NULL CHECK (membership_status IN ('active','paused','cancelled','expired')),
    start_date DATE NULL,
    end_date DATE NULL,
    last_visit_date DATE NULL,
    payment_status VARCHAR(16) NOT NULL CHECK (payment_status IN ('paid','unpaid','overdue')),
    payment_due_date DATE NULL,
    notes TEXT NULL,
    address TEXT NULL,
    photo_url TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    activated_at DATETIME(6) NULL,
    deactivated_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    INDEX (deleted_at, is_active, updated_at, id),
    INDEX (membership_status),
    INDEX (payment_status),
    INDEX (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS member_status_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    status VARCHAR(8) NOT NULL CHECK (status IN ('active','inactive')),
    changed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    notes TEXT NULL,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX (member_id, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance_holidays (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    name TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance_holiday_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    bs_month INT NOT NULL CHECK (bs_month BETWEEN 0 AND 11),
    bs_day INT NOT NULL CHECK (bs_day BETWEEN 1 AND 32),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE (name, bs_month, bs_day),
    INDEX (bs_month, bs_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS attendance_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_ref BIGINT NOT NULL,
    attendance_date DATE NOT NULL,
    status VARCHAR(8) NOT NULL CHECK (status IN ('present','late','absent','excused')),
    check_in_time TIME NULL,
    check_out_time TIME NULL,
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    CHECK (check_out_time >= check_in_time),
    FOREIGN KEY (member_ref) REFERENCES members(id) ON DELETE CASCADE,
    UNIQUE (member_ref, attendance_date),
    INDEX (attendance_date, deleted_at),
    INDEX (member_ref, deleted_at, attendance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS admin_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    gym_name VARCHAR(255) NOT NULL DEFAULT 'A&A Health Club',
    logo_url TEXT NULL,
    phone VARCHAR(255) NOT NULL DEFAULT '+977 98XXXXXXXX',
    email VARCHAR(255) NOT NULL DEFAULT 'info@aahealthclub.com',
    address VARCHAR(255) NOT NULL DEFAULT 'Butwal, Rupandehi, Nepal',
    operating_hours VARCHAR(255) NOT NULL DEFAULT 'Daily, 5:00 AM - 9:00 PM',
    weekly_closing_day INT NOT NULL DEFAULT 6 CHECK (weekly_closing_day BETWEEN 0 AND 6),
    expiry_warning_days INT NOT NULL DEFAULT 7 CHECK (expiry_warning_days IN (7,15,30)),
    absent_after_days INT NOT NULL DEFAULT 8 CHECK (absent_after_days BETWEEN 1 AND 60),
    default_membership_type VARCHAR(16) NOT NULL DEFAULT 'monthly' CHECK (default_membership_type IN ('monthly','quarterly','yearly','trial')),
    date_display_preference VARCHAR(4) NOT NULL DEFAULT 'bs' CHECK (date_display_preference IN ('bs','ad','both')),
    attendance_holiday_lock TINYINT(1) NOT NULL DEFAULT 1,
    invoice_prefix VARCHAR(12) NOT NULL DEFAULT 'GYM',
    currency_code CHAR(3) NOT NULL DEFAULT 'NPR',
    currency_minor_unit SMALLINT NOT NULL DEFAULT 2,
    tax_enabled TINYINT(1) NOT NULL DEFAULT 0,
    tax_label VARCHAR(255) NOT NULL DEFAULT 'Tax',
    tax_rate_basis_points INT NOT NULL DEFAULT 0 CHECK (tax_rate_basis_points BETWEEN 0 AND 10000),
    pan_vat_number TEXT NULL,
    receipt_footer VARCHAR(255) NOT NULL DEFAULT 'Thank you for choosing us.',
    allow_negative_stock TINYINT(1) NOT NULL DEFAULT 0,
    invoice_start_number BIGINT NOT NULL DEFAULT 1 CHECK (invoice_start_number BETWEEN 1 AND 9007199254740991),
    bill_sender_email TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT INTO admin_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id;
