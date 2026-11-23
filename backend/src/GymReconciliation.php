<?php
declare(strict_types=1);

final class GymReconciliation
{
    private const COUNTED = ['members', 'member_status_history', 'attendance_holidays', 'attendance_holiday_templates',
        'attendance_records', 'membership_fees', 'membership_payment_allocations', 'invoices', 'invoice_items', 'invoice_payments',
        'shop_items', 'inventory_product_variants', 'stock_movements', 'inventory_suppliers', 'personal_training_plans',
        'pricing_items', 'facility_items', 'trainers', 'testimonials', 'contact_faqs', 'home_status_items', 'home_maximus_points',
        'bill_email_attempts', 'product_media_files', 'admin_accounts', 'legacy_sql_evidence'];

    private const INVOICE_MISMATCH = "FROM invoices i LEFT JOIN (
            SELECT invoice_id, SUM(IF(is_reversal = 1, -amount_minor, amount_minor)) AS net
            FROM invoice_payments GROUP BY invoice_id
        ) p ON p.invoice_id = i.id WHERE i.invoice_status = 'issued' AND i.paid_minor <> COALESCE(p.net, 0)";

    private const REVERSAL_MISMATCH = 'FROM invoice_payments p LEFT JOIN invoice_payments original ON original.id = p.reverses_payment_id
        WHERE p.is_reversal = 1 AND (original.id IS NULL OR original.is_reversal = 1 OR original.invoice_id <> p.invoice_id
        OR p.amount_minor > original.amount_minor)';

    public function __construct(private PDO $db)
    {
    }

    public function snapshot(): array
    {
        $counts = [];
        foreach (self::COUNTED as $table) {
            $counts[$table] = (string) $this->db->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
        }
        $dates = [];
        foreach (['attendance_records' => 'attendance_date', 'membership_fees' => 'billing_month',
            'invoices' => 'billing_date', 'invoice_payments' => 'payment_date'] as $table => $date) {
            $dates[$table] = $this->db->query("SELECT MIN(`$date`) AS first, MAX(`$date`) AS last FROM `$table`")->fetch(PDO::FETCH_ASSOC);
        }
        return [
            'version' => 1,
            'counts' => $counts,
            'dates' => $dates,
            'membershipFees' => $this->rows('SELECT currency_code, status, CAST(COUNT(*) AS CHAR) AS records,
                CAST(SUM(amount_minor) AS CHAR) AS amount_minor, CAST(SUM(paid_amount_minor) AS CHAR) AS paid_minor,
                CAST(SUM(amount_minor - paid_amount_minor) AS CHAR) AS outstanding_minor
                FROM membership_fees GROUP BY currency_code, status ORDER BY currency_code, status'),
            'invoices' => $this->rows('SELECT currency_code, invoice_status, CAST(COUNT(*) AS CHAR) AS records,
                CAST(SUM(total_minor) AS CHAR) AS total_minor, CAST(SUM(tax_minor) AS CHAR) AS tax_minor,
                CAST(SUM(paid_minor) AS CHAR) AS paid_minor, CAST(SUM(balance_minor) AS CHAR) AS balance_minor
                FROM invoices GROUP BY currency_code, invoice_status ORDER BY currency_code, invoice_status'),
            'payments' => $this->rows('SELECT i.currency_code, p.is_reversal, CAST(COUNT(*) AS CHAR) AS records,
                CAST(SUM(p.amount_minor) AS CHAR) AS amount_minor
                FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id
                GROUP BY i.currency_code, p.is_reversal ORDER BY i.currency_code, p.is_reversal'),
            'stock' => $this->rows('SELECT sku, CAST(current_quantity AS CHAR) AS quantity, is_active
                FROM inventory_product_variants ORDER BY BINARY sku'),
            'staffRoles' => $this->rows('SELECT role, CAST(COUNT(*) AS CHAR) AS records FROM admin_accounts GROUP BY role ORDER BY role'),
            'invoiceSequence' => (string) $this->db->query('SELECT next_number FROM invoice_number_sequences WHERE id = 1')->fetchColumn(),
        ];
    }

    public function review(): array
    {
        return [
            'invoicePaymentDiscrepancies' => $this->rows('SELECT i.id, i.invoice_number, CAST(i.paid_minor AS CHAR) AS recorded_paid_minor,
                CAST(COALESCE(p.net, 0) AS CHAR) AS payment_net_minor ' . self::INVOICE_MISMATCH . ' ORDER BY i.id'),
            'invalidReversalLinks' => $this->rows('SELECT p.id, p.invoice_id, p.reverses_payment_id ' . self::REVERSAL_MISMATCH . ' ORDER BY p.id'),
            'legacyEvidenceForReview' => $this->rows('SELECT entity, legacy_id, member_id, invoice_id, review_reason
                FROM legacy_sql_evidence WHERE review_reason IS NOT NULL ORDER BY entity, legacy_id'),
        ];
    }

    public static function differences(array $expected, array $actual): array
    {
        $changed = [];
        foreach (array_unique([...array_keys($actual), ...array_keys($expected)]) as $key) {
            if (!array_key_exists($key, $expected) || !array_key_exists($key, $actual)
                || self::canonical($expected[$key]) !== self::canonical($actual[$key])) {
                $changed[] = $key;
            }
        }
        return $changed;
    }

    private static function canonical(mixed $value): mixed
    {
        if (!is_array($value)) return $value;
        if (!array_is_list($value)) ksort($value);
        return array_map(self::canonical(...), $value);
    }

    private function rows(string $query): array
    {
        return $this->db->query($query)->fetchAll(PDO::FETCH_ASSOC);
    }
}
