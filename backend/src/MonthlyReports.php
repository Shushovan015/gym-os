<?php
declare(strict_types=1);

final class MonthlyReports
{
    public function __construct(private PDO $db)
    {
    }

    public function load(array $input): array
    {
        $zone = new DateTimeZone('Asia/Kathmandu');
        $start = self::parseDate($input['start'] ?? null, $zone);
        $end = self::parseDate($input['end'] ?? null, $zone);
        if (!$start || !$end || $end < $start || $start->diff($end)->days > 31 || $end > new DateTimeImmutable('today', $zone)) {
            return [422, ['error' => 'Select a valid report range of up to 32 days ending no later than today in Nepal.']];
        }
        $range = [$start->format('Y-m-d'), $end->format('Y-m-d')];
        $utc = new DateTimeZone('UTC');
        $this->db->beginTransaction();
        try {
            $settings = $this->db->query('SELECT gym_name, currency_code, currency_minor_unit FROM admin_settings WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
            if (!$settings) throw new RuntimeException('Report settings are missing.');
            $currency = $settings['currency_code'];
            // Collections follow the payment date. Sales follow the invoice date.
            $invoices = $this->rows("SELECT i.id, i.member_ref, i.billing_date, i.invoice_status, i.total_minor, i.balance_minor
                FROM invoices i WHERE i.invoice_status = 'issued' AND i.currency_code = ?
                AND (i.billing_date BETWEEN ? AND ? OR EXISTS(SELECT 1 FROM invoice_payments p
                    WHERE p.invoice_id = i.id AND p.payment_date BETWEEN ? AND ?)) ORDER BY i.billing_date, i.id",
                [$currency, ...$range, ...$range]);
            $items = $this->rows("SELECT d.id, d.invoice_id, d.item_type, d.description, d.product_id, d.variant_id,
                d.quantity + 0e0 AS quantity, d.unit_cost_minor, d.line_total_minor, d.tax_minor
                FROM invoice_items d JOIN invoices i ON i.id = d.invoice_id
                WHERE i.invoice_status = 'issued' AND i.currency_code = ? AND (i.billing_date BETWEEN ? AND ?
                OR (d.item_type = 'membership' AND EXISTS(SELECT 1 FROM invoice_payments p
                    WHERE p.invoice_id = i.id AND p.payment_date BETWEEN ? AND ?))) ORDER BY d.sort_order, d.id",
                [$currency, ...$range, ...$range]);
            $payments = $this->rows("SELECT p.id, p.invoice_id, p.amount_minor, p.payment_method, p.payment_date, p.is_reversal
                FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id
                WHERE p.payment_date BETWEEN ? AND ? AND i.invoice_status = 'issued' AND i.currency_code = ?
                ORDER BY p.payment_date, p.id", [...$range, $currency]);
            $members = $this->rows('SELECT id, created_at, deleted_at, membership_status FROM members
                WHERE created_at >= ? AND created_at < ? ORDER BY created_at, id',
                [$start->setTimezone($utc)->format('Y-m-d H:i:s'), $end->modify('+1 day')->setTimezone($utc)->format('Y-m-d H:i:s')]);
            $products = $this->rows('SELECT id, cost_price_minor, low_stock_threshold + 0e0 AS low_stock_threshold
                FROM shop_items WHERE inventory_enabled = 1 ORDER BY id');
            $variants = $this->rows('SELECT id, product_id, cost_price_minor, current_quantity + 0e0 AS current_quantity,
                low_stock_threshold + 0e0 AS low_stock_threshold FROM inventory_product_variants ORDER BY id');
            $this->db->commit();
            return [200, compact('settings', 'members', 'invoices', 'items', 'payments', 'products', 'variants')];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function rows(string $query, array $parameters = []): array
    {
        $statement = $this->db->prepare($query);
        $statement->execute($parameters);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    private static function parseDate(mixed $value, DateTimeZone $zone): ?DateTimeImmutable
    {
        if (!is_string($value) || !preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $value, $parts)
            || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) return null;
        return new DateTimeImmutable($value, $zone);
    }
}
