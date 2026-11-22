<?php
declare(strict_types=1);

final class BillingOverview
{
    public function __construct(private PDO $db)
    {
    }

    public function invoices(array $input): array
    {
        $offset = filter_var($input['offset'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        $limit = filter_var($input['limit'] ?? 10, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100]]);
        $search = $input['search'] ?? '';
        $payment = $input['paymentStatus'] ?? 'all';
        $status = $input['invoiceStatus'] ?? 'all';
        $from = $input['from'] ?? '';
        $to = $input['to'] ?? '';
        if ($offset === false || $limit === false || !is_string($search) || strlen($search) > 255 ||
            !in_array($payment, ['all', 'unpaid', 'partially_paid', 'paid'], true) ||
            !in_array($status, ['all', 'draft', 'issued', 'cancelled'], true) ||
            !self::validDate($from) || !self::validDate($to) || ($from !== '' && $to !== '' && $from > $to)) {
            return [422, ['error' => 'Invalid invoice filters.']];
        }
        $term = preg_replace('/\s+/u', ' ', trim($search));
        if ($term === null) {
            return [422, ['error' => 'Invalid customer name.']];
        }
        $conditions = ['1 = 1'];
        $arguments = [];
        if ($term !== '') {
            $literal = str_replace(' ', '[[:space:]]+', preg_quote($term));
            $conditions[] = 'LOWER(customer_name) REGEXP LOWER(?)';
            $arguments[] = str_contains($term, ' ') ? "^[[:space:]]*$literal"
                : "(^[[:space:]]*$literal|[[:space:]]+$literal" . '[^[:space:]]*[[:space:]]*$)';
        }
        foreach ([
            ['payment_status = ?', $payment, 'all'], ['invoice_status = ?', $status, 'all'],
            ['billing_date >= ?', $from, ''], ['billing_date <= ?', $to, ''],
        ] as [$condition, $value, $empty]) {
            if ($value !== $empty) {
                $conditions[] = $condition;
                $arguments[] = $value;
            }
        }
        $where = implode(' AND ', $conditions);
        $this->db->beginTransaction();
        try {
            $count = $this->db->prepare("SELECT COUNT(*) FROM invoices WHERE $where");
            $count->execute($arguments);
            $total = (int) $count->fetchColumn();
            $rows = $this->db->prepare("SELECT *,
                EXISTS (SELECT 1 FROM product_invoice_requests p WHERE p.invoice_id = invoices.id) AS php_product,
                EXISTS (SELECT 1 FROM invoice_payments p JOIN membership_payment_requests m ON m.payment_id = p.id
                    WHERE p.invoice_id = invoices.id) AS php_membership
                FROM invoices WHERE $where ORDER BY created_at DESC, id DESC LIMIT $limit OFFSET $offset");
            $rows->execute($arguments);
            $invoices = $rows->fetchAll(PDO::FETCH_ASSOC);
            foreach ($invoices as &$invoice) {
                $invoice['tax_enabled'] = (bool) $invoice['tax_enabled'];
                $invoice['php_product'] = (bool) $invoice['php_product'];
                $invoice['php_membership'] = (bool) $invoice['php_membership'];
            }
            unset($invoice);
            $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Kathmandu'));
            $summary = $this->db->prepare("SELECT
                COALESCE(SUM(CASE WHEN invoice_status = 'issued' AND billing_date = ? THEN paid_minor END), 0) AS revenue_today,
                COALESCE(SUM(CASE WHEN invoice_status = 'issued' AND billing_date >= ? THEN paid_minor END), 0) AS revenue_month,
                COUNT(CASE WHEN invoice_status <> 'draft' AND billing_date = ? THEN 1 END) AS invoices_today,
                COUNT(CASE WHEN invoice_status = 'issued' AND payment_status = 'unpaid' THEN 1 END) AS unpaid,
                COUNT(CASE WHEN invoice_status = 'issued' AND payment_status = 'partially_paid' THEN 1 END) AS partially_paid,
                COALESCE(SUM(CASE WHEN invoice_status = 'issued' THEN balance_minor END), 0) AS outstanding
                FROM invoices");
            $summary->execute([$today->format('Y-m-d'), $today->format('Y-m-01'), $today->format('Y-m-d')]);
            $result = ['invoices' => $invoices, 'count' => $total, 'summary' => array_map('intval', $summary->fetch(PDO::FETCH_ASSOC))];
            $this->db->commit();
            return [200, $result];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    private static function validDate(mixed $value): bool
    {
        return $value === '' || (is_string($value) &&
            preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $value, $parts) &&
            checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]));
    }
}
