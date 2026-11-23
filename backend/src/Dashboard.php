<?php
declare(strict_types=1);

final class Dashboard
{
    public function __construct(private PDO $db)
    {
    }

    public function overview(array $input): array
    {
        $period = filter_var($input['period'] ?? 30, FILTER_VALIDATE_INT);
        $horizon = isset($input['horizon']) ? filter_var($input['horizon'], FILTER_VALIDATE_INT) : null;
        if (!in_array($period, [7, 30, 90], true) || ($horizon !== null && !in_array($horizon, [7, 15, 30], true))) {
            return [422, ['error' => 'Invalid dashboard period or expiry horizon.']];
        }
        $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Kathmandu'));
        $date = $today->format('Y-m-d');
        $start = $today->modify('-' . ($period - 1) . ' days');
        $this->db->beginTransaction();
        try {
            $settings = $this->db->query('SELECT * FROM admin_settings WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
            if (!$settings) {
                throw new RuntimeException('Gym settings are missing.');
            }
            $horizon ??= (int) $settings['expiry_warning_days'];
            $endOfHorizon = $today->modify("+$horizon days")->format('Y-m-d');
            $lifecycleActive = "m.membership_status NOT IN ('paused','cancelled','expired') AND (m.end_date IS NULL OR m.end_date > ?)";
            $expiring = "m.membership_status <> 'cancelled' AND m.end_date BETWEEN ? AND ?";
            $unpaid = "m.payment_status IN ('unpaid','overdue')";
            $counts = $this->rows("SELECT COUNT(CASE WHEN m.deleted_at IS NOT NULL THEN 1 END) AS deletedCount,
                COUNT(CASE WHEN m.deleted_at IS NULL THEN 1 END) AS liveCount,
                COUNT(CASE WHEN m.deleted_at IS NULL AND $lifecycleActive THEN 1 END) AS activeCount,
                COUNT(CASE WHEN m.deleted_at IS NULL AND m.created_at >= ? THEN 1 END) AS newCount,
                COUNT(CASE WHEN m.deleted_at IS NULL AND $expiring THEN 1 END) AS expiringCount,
                COUNT(CASE WHEN m.deleted_at IS NULL AND m.membership_status NOT IN ('paused','cancelled')
                    AND (m.membership_status = 'expired' OR m.end_date < ?) THEN 1 END) AS expiredCount,
                COUNT(CASE WHEN m.deleted_at IS NULL AND $unpaid THEN 1 END) AS unpaidCount FROM members m",
                [$today->modify('+7 days')->format('Y-m-d'), $start->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
                    $date, $endOfHorizon, $date])[0];
            $visits = "FROM attendance_records WHERE deleted_at IS NULL AND status IN ('present','late') AND attendance_date BETWEEN ? AND ?";
            $dates = [$start->format('Y-m-d'), $date];
            $trend = array_column($this->rows("SELECT attendance_date, COUNT(*) AS total $visits GROUP BY attendance_date", $dates), 'total', 'attendance_date');
            $absent = $this->rows("SELECT COUNT(*) AS total FROM members m LEFT JOIN
                (SELECT member_ref, MAX(attendance_date) AS last_attended $visits GROUP BY member_ref) a ON a.member_ref = m.id
                WHERE m.deleted_at IS NULL AND $lifecycleActive
                AND (COALESCE(a.last_attended, m.last_visit_date) IS NULL OR COALESCE(a.last_attended, m.last_visit_date) < ?)",
                [...$dates, $today->modify('+7 days')->format('Y-m-d'), $today->modify('-' . (int) $settings['absent_after_days'] . ' days')->format('Y-m-d')]);
            $stock = $this->rows('SELECT COUNT(CASE WHEN v.current_quantity <= 0 AND v.current_quantity <= COALESCE(v.low_stock_threshold, p.low_stock_threshold, 0) THEN 1 END) AS outCount,
                COUNT(CASE WHEN v.current_quantity > 0 AND v.current_quantity <= COALESCE(v.low_stock_threshold, p.low_stock_threshold, 0) THEN 1 END) AS lowCount
                FROM inventory_product_variants v LEFT JOIN shop_items p ON p.id = v.product_id AND p.is_active = 1 AND p.inventory_enabled = 1
                WHERE v.is_active = 1')[0];
            $revenue = $this->rows("SELECT COALESCE(SUM(CASE WHEN p.is_reversal THEN -p.amount_minor ELSE p.amount_minor END), 0) AS total
                FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id
                WHERE p.payment_date = ? AND i.invoice_status = 'issued' AND i.currency_code = ?", [$date, $settings['currency_code']])[0];
            $outstanding = $this->rows("SELECT COALESCE(SUM(balance_minor), 0) AS total FROM invoices
                WHERE invoice_status = 'issued' AND currency_code = ? AND billing_date BETWEEN ? AND ?",
                [$settings['currency_code'], ...$dates])[0];
            $expiries = $this->rows("SELECT m.id, m.full_name, m.member_id, m.end_date, DATEDIFF(m.end_date, ?) AS daysLeft
                FROM members m WHERE m.deleted_at IS NULL AND $expiring ORDER BY m.end_date, m.updated_at DESC, m.id DESC LIMIT 8",
                [$date, $date, $endOfHorizon]);
            $holidays = $this->rows('SELECT id, holiday_date, name FROM attendance_holidays
                WHERE holiday_date BETWEEN ? AND ? ORDER BY holiday_date LIMIT 5', [$date, $today->modify('+30 days')->format('Y-m-d')]);
            $metrics = array_map('intval', $counts + $stock) + [
                'attendanceTodayCount' => (int) ($trend[$date] ?? 0),
                'absentCount' => (int) $absent[0]['total'],
                'revenueToday' => (int) $revenue['total'],
                'outstanding' => (int) $outstanding['total'],
            ];
            $labels = [];
            $values = [];
            for ($i = 0; $i < $period; $i++) {
                $label = $start->modify("+$i days")->format('Y-m-d');
                $labels[] = $label;
                $values[] = (int) ($trend[$label] ?? 0);
            }
            $result = ['today' => $date, 'periodStart' => $dates[0], 'horizon' => $horizon, 'settings' => $settings, 'metrics' => $metrics,
                'attendanceLabels' => $labels, 'attendanceValues' => $values, 'upcomingHolidays' => $holidays,
                'expiringMembers' => array_map(static fn (array $row): array => ['member' => $row, 'daysLeft' => (int) $row['daysLeft']], $expiries),
                'unpaidMembers' => $this->rows("SELECT m.id, m.full_name, m.phone, m.payment_status, m.payment_due_date
                    FROM members m WHERE m.deleted_at IS NULL AND $unpaid ORDER BY m.updated_at DESC, m.id DESC LIMIT 8"),
                'recentMembers' => $this->rows('SELECT id, full_name, updated_at, deleted_at, membership_status FROM members ORDER BY updated_at DESC, id DESC LIMIT 6'),
                'planDistribution' => (object) array_map('intval', array_column($this->rows('SELECT membership_type, COUNT(*) AS total
                    FROM members WHERE deleted_at IS NULL GROUP BY membership_type ORDER BY membership_type'), 'total', 'membership_type'))];
            $this->db->commit();
            return [200, $result];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    private function rows(string $sql, array $parameters = []): array
    {
        $query = $this->db->prepare($sql);
        $query->execute($parameters);
        return $query->fetchAll(PDO::FETCH_ASSOC);
    }
}
