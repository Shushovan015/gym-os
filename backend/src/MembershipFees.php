<?php
declare(strict_types=1);

final class MembershipFees
{
    public function __construct(private PDO $db)
    {
    }

    public function status(mixed $member): array
    {
        $id = filter_var($member, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) {
            return [422, ['error' => 'Invalid member ID.']];
        }
        $query = $this->db->prepare('SELECT f.*, s.currency_code AS default_currency
            FROM members m
            JOIN admin_settings s ON s.id = 1
            LEFT JOIN membership_fees f ON f.member_id = m.id
            WHERE m.id = ? ORDER BY f.billing_month, f.id');
        $query->execute([$id]);
        $first = $query->fetch(PDO::FETCH_ASSOC);
        if ($first === false) {
            return [404, ['error' => 'Member was not found.']];
        }
        $summary = [
            'total_due' => 0, 'total_paid' => 0, 'overdue_count' => 0, 'unpaid_count' => 0, 'partial_count' => 0,
            'paid_count' => 0, 'next_due_date' => null, 'next_due_amount' => null, 'next_due_month' => null,
            'currency_code' => $first['currency_code'] ?? $first['default_currency'],
        ];
        $paid = [];
        $outstanding = [];
        $fee = $first;
        while ($fee && $fee['id'] !== null) {
            unset($fee['default_currency']);
            foreach (['created_at', 'updated_at', 'paid_at'] as $field) {
                if ($fee[$field] !== null) {
                    $fee[$field] = str_replace(' ', 'T', $fee[$field]) . 'Z';
                }
            }
            $summary[$fee['status'] . '_count']++;
            $summary['total_paid'] += $fee['paid_amount_minor'];
            $fee['outstanding_minor'] = $fee['amount_minor'] - $fee['paid_amount_minor'];
            if ($fee['status'] === 'paid') {
                $paid[] = $fee;
            } else {
                $summary['total_due'] += $fee['outstanding_minor'];
                if ($summary['next_due_date'] === null || $fee['due_date'] < $summary['next_due_date']) {
                    $summary['next_due_date'] = $fee['due_date'];
                    $summary['next_due_month'] = $fee['billing_month'];
                    $summary['next_due_amount'] = $fee['outstanding_minor'];
                }
                $outstanding[] = $fee;
            }
            $fee = $query->fetch(PDO::FETCH_ASSOC);
        }
        return [200, [
            'has_outstanding' => $outstanding !== [],
            'outstanding_fees' => $outstanding ?: null,
            'paid_fees' => array_slice(array_reverse($paid), 0, 12) ?: null,
            'summary' => $summary,
        ]];
    }
}
