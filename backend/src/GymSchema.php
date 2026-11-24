<?php
declare(strict_types=1);

final class GymSchema
{
    public const TABLES = [
        'schema_migrations', 'admin_accounts', 'login_limits', 'audit_events',
        'members', 'member_status_history', 'attendance_holidays', 'attendance_holiday_templates',
        'attendance_records', 'admin_settings', 'member_write_lock', 'invoices', 'invoice_payments', 'membership_fees',
        'invoice_items', 'invoice_number_sequences', 'membership_payment_allocations', 'membership_payment_requests', 'payment_audit_events',
        'inventory_suppliers', 'shop_items', 'inventory_product_variants', 'stock_movements', 'product_invoice_requests', 'pricing_items',
        'invoice_balance_payment_requests', 'personal_training_plans', 'pending_billing_attempts', 'bill_email_attempts', 'product_media_files',
        'contact_content', 'contact_faqs', 'footer_content', 'home_content', 'home_status_items', 'home_maximus_points',
        'facility_items', 'facilities_page_content', 'trainers', 'trainer_page_content', 'testimonials',
        'pricing_page_content', 'shop_page_content', 'legacy_sql_evidence', 'pg_import_runs', 'pg_import_invoice_holds',
    ];
}
