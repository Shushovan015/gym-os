<?php
declare(strict_types=1);

require_once __DIR__ . '/InvoiceNumbers.php';

final class MembershipBilling
{
    private const MAX_AMOUNT = 9007199254740991;

    public function __construct(private PDO $db)
    {
    }

    public function history(mixed $member): array
    {
        $id = filter_var($member, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) {
            return [422, ['error' => 'Invalid member ID.']];
        }
        $query = $this->db->prepare('SELECT p.*, i.invoice_number, i.currency_code, i.invoice_status
            FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.member_ref = ?
            ORDER BY p.payment_date DESC, p.id DESC LIMIT 200');
        $query->execute([$id]);
        $payments = $query->fetchAll(PDO::FETCH_ASSOC);
        foreach ($payments as &$payment) {
            $payment['is_reversal'] = (bool) $payment['is_reversal'];
        }
        unset($payment);
        return [200, ['payments' => $payments]];
    }

    public function receipt(mixed $invoice): array
    {
        $id = filter_var($invoice, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) {
            return [422, ['error' => 'Invalid invoice ID.']];
        }
        $this->db->beginTransaction();
        try {
            $query = $this->db->prepare("SELECT * FROM invoices WHERE id = ? AND invoice_status <> 'draft'");
            $query->execute([$id]);
            $header = $query->fetch(PDO::FETCH_ASSOC);
            if (!$header) {
                $this->db->commit();
                return [404, ['error' => 'Invoice was not found.']];
            }
            $items = $this->db->prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id');
            $items->execute([$id]);
            $payments = $this->db->prepare('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY id');
            $payments->execute([$id]);
            $result = ['invoice' => $header, 'items' => $items->fetchAll(PDO::FETCH_ASSOC), 'payments' => $payments->fetchAll(PDO::FETCH_ASSOC)];
            $this->db->commit();
            return [200, $result];
        } catch (Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }

    public function cancel(array $input, string $actor): array
    {
        $invoice = $input['invoiceId'] ?? null;
        $reason = $input['reason'] ?? null;
        if (!is_int($invoice) || $invoice < 1 || !is_string($reason) || trim($reason) === '' || strlen($reason) > 2000) {
            return [422, ['error' => 'An invoice ID and cancellation reason are required.']];
        }
        $lookup = $this->db->prepare('SELECT member_ref FROM invoices WHERE id = ?');
        $lookup->execute([$invoice]);
        $member = $lookup->fetchColumn();
        if ($member === false || $member === null) {
            return [404, ['error' => 'Membership invoice was not found.']];
        }
        $this->db->beginTransaction();
        try {
            // Match the payment flow by locking the member before touching dependent records.
            $lock = $this->db->prepare('SELECT id FROM members WHERE id = ? FOR UPDATE');
            $lock->execute([$member]);
            $query = $this->db->prepare('SELECT i.invoice_status, p.* FROM invoices i
                JOIN invoice_payments p ON p.invoice_id = i.id
                JOIN membership_payment_requests r ON r.payment_id = p.id
                WHERE i.id = ? AND i.member_ref = ? FOR UPDATE');
            $query->execute([$invoice, $member]);
            $payment = $query->fetch(PDO::FETCH_ASSOC);
            if (!$payment) {
                throw new DomainException('The invoice has no tracked membership payment.');
            }
            $replay = $this->db->prepare('SELECT id FROM invoice_payments WHERE reverses_payment_id = ?');
            $replay->execute([$payment['id']]);
            $existing = $replay->fetchColumn();
            if ($payment['invoice_status'] === 'cancelled' && $existing !== false) {
                $this->db->commit();
                return [200, ['invoice_id' => $invoice, 'reversal_payment_id' => $existing]];
            }
            if ($payment['invoice_status'] !== 'issued' || $existing !== false) {
                throw new DomainException('The membership invoice cannot be cancelled in its current state.');
            }
            $allocation = $this->db->prepare('SELECT a.fee_id, a.amount_minor, f.paid_amount_minor, f.amount_minor AS fee_amount,
                f.due_date FROM membership_payment_allocations a JOIN membership_fees f ON f.id = a.fee_id
                WHERE a.payment_id = ? AND f.member_id = ? ORDER BY a.fee_id FOR UPDATE');
            $allocation->execute([$payment['id'], $member]);
            $fees = $allocation->fetchAll(PDO::FETCH_ASSOC);
            if ($fees === []) {
                throw new DomainException('The membership payment has no fee allocations to reverse.');
            }

            $today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Kathmandu')))->format('Y-m-d');
            $reason = trim($reason);
            $this->db->prepare('INSERT INTO invoice_payments (invoice_id, amount_minor, payment_method, payment_date,
                notes, is_reversal, reverses_payment_id, received_by) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
                ->execute([$invoice, $payment['amount_minor'], $payment['payment_method'], $today, $reason, $payment['id'], $actor]);
            $reversal = (int) $this->db->lastInsertId();
            $this->reverseFees($fees, $today);
            $this->db->prepare("UPDATE invoices SET invoice_status = 'cancelled', payment_status = 'unpaid',
                paid_minor = 0, balance_minor = total_minor, cancelled_at = CURRENT_TIMESTAMP(6), cancelled_by = ?,
                cancellation_reason = ?, updated_by = ? WHERE id = ?")->execute([$actor, $reason, $actor, $invoice]);
            $this->updateMemberDue((int) $member, $today);
            $this->db->prepare("INSERT INTO payment_audit_events (payment_id, member_id, actor_id, action)
                VALUES (?, ?, ?, 'membership.reversal')")->execute([$reversal, $member, $actor]);
            $this->db->commit();
            return [200, ['invoice_id' => $invoice, 'reversal_payment_id' => $reversal]];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if ($error instanceof DomainException) {
                return [409, ['error' => $error->getMessage()]];
            }
            throw $error;
        }
    }

    private function reverseFees(array $fees, string $today): void
    {
        $latest = $this->db->prepare('SELECT p.invoice_id FROM membership_payment_allocations a
            JOIN invoice_payments p ON p.id = a.payment_id WHERE a.fee_id = ? AND NOT EXISTS (
                SELECT 1 FROM invoice_payments r WHERE r.reverses_payment_id = p.id
            ) ORDER BY a.payment_id DESC LIMIT 1');
        $original = $this->db->prepare('SELECT previous_invoice_id FROM membership_payment_allocations
            WHERE fee_id = ? ORDER BY payment_id LIMIT 1');
        $update = $this->db->prepare('UPDATE membership_fees SET paid_amount_minor = ?, status = ?,
            invoice_id = ?, paid_at = NULL, paid_by = NULL WHERE id = ?');
        foreach ($fees as $fee) {
            $paid = $fee['paid_amount_minor'] - $fee['amount_minor'];
            if ($paid < 0 || $paid >= $fee['fee_amount']) {
                throw new DomainException('Fee balances must be reconciled before this payment can be reversed.');
            }
            $invoice = null;
            if ($paid > 0) {
                $latest->execute([$fee['fee_id']]);
                $invoice = $latest->fetchColumn();
                if ($invoice === false) {
                    $original->execute([$fee['fee_id']]);
                    $invoice = $original->fetchColumn();
                }
            }
            $status = $paid > 0 ? 'partial' : ($fee['due_date'] < $today ? 'overdue' : 'unpaid');
            $update->execute([$paid, $status, $invoice ?: null, $fee['fee_id']]);
        }
    }

    public function pay(array $input, mixed $key, string $actor): array
    {
        $member = $input['memberId'] ?? null;
        $ids = $input['feeIds'] ?? null;
        $amount = $input['amountMinor'] ?? null;
        $method = $input['paymentMethod'] ?? null;
        $date = $input['paymentDate'] ?? null;
        $reference = $input['reference'] ?? null;
        $notes = $input['notes'] ?? null;
        if (!is_string($key) || !preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key) ||
            !is_int($member) || $member < 1 || !is_array($ids) || !array_is_list($ids) || count($ids) < 1 || count($ids) > 120 ||
            ($amount !== null && (!is_int($amount) || $amount < 1 || $amount > self::MAX_AMOUNT)) ||
            !in_array($method, ['cash','card','bank_transfer','digital_wallet','other'], true) ||
            ($date !== null && (!is_string($date) || !preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $date, $parts) ||
                !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]))) ||
            ($reference !== null && (!is_string($reference) || strlen($reference) > 255)) ||
            ($notes !== null && (!is_string($notes) || strlen($notes) > 2000))) {
            return [422, ['error' => 'Invalid membership payment or idempotency key.']];
        }
        foreach ($ids as $id) {
            if (!is_int($id) || $id < 1) {
                return [422, ['error' => 'Invalid fee period ID.']];
            }
        }
        if (count(array_unique($ids)) !== count($ids)) {
            return [422, ['error' => 'Fee period IDs must be unique.']];
        }
        sort($ids, SORT_REGULAR);
        $fingerprint = hash('sha256', json_encode([$actor, $member, $ids, $amount, $method, $date, $reference, $notes], JSON_THROW_ON_ERROR));
        $today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Kathmandu')))->format('Y-m-d');

        $this->db->beginTransaction();
        try {
            $this->db->prepare('INSERT INTO membership_payment_requests (request_key, fingerprint) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE request_key = request_key')->execute([$key, $fingerprint]);
            $query = $this->db->prepare('SELECT fingerprint, response_json FROM membership_payment_requests WHERE request_key = ? FOR UPDATE');
            $query->execute([$key]);
            $request = $query->fetch(PDO::FETCH_ASSOC);
            if (!hash_equals($request['fingerprint'], $fingerprint)) {
                throw new DomainException('The idempotency key was already used for another payment.');
            }
            if ($request['response_json'] !== null) {
                $result = json_decode($request['response_json'], true, flags: JSON_THROW_ON_ERROR);
                $this->db->commit();
                return [200, $result];
            }
            $result = $this->record($member, $ids, $amount, $method, $date ?? $today, $today, $reference, $notes, $actor);
            $this->db->prepare('UPDATE membership_payment_requests SET response_json = ?, payment_id = ? WHERE request_key = ?')
                ->execute([json_encode($result, JSON_THROW_ON_ERROR), $result['payment_id'], $key]);
            $this->db->commit();
            return [201, $result];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if ($error instanceof DomainException) {
                return [409, ['error' => $error->getMessage()]];
            }
            throw $error;
        }
    }

    private function record(
        int $member, array $ids, ?int $amount, string $method, string $date, string $today,
        ?string $reference, ?string $notes, string $actor
    ): array {
        // Lock order is request key, member, fee rows, settings, then invoice sequence.
        $lookup = $this->db->prepare('SELECT full_name, phone, email, deleted_at, is_active FROM members WHERE id = ? FOR UPDATE');
        $lookup->execute([$member]);
        $profile = $lookup->fetch(PDO::FETCH_ASSOC);
        if (!$profile || !$profile['is_active'] || $profile['deleted_at'] !== null) {
            throw new DomainException('Payment requires an active member.');
        }
        $markers = implode(',', array_fill(0, count($ids), '?'));
        $query = $this->db->prepare("SELECT * FROM membership_fees WHERE member_id = ? AND id IN ($markers) ORDER BY id FOR UPDATE");
        $query->execute([$member, ...$ids]);
        $fees = $query->fetchAll(PDO::FETCH_ASSOC);
        if (count($fees) !== count($ids)) {
            throw new DomainException('All selected fee periods must belong to the member.');
        }
        usort($fees, static fn (array $a, array $b): int => $a['billing_month'] <=> $b['billing_month']);
        $settings = $this->db->query('SELECT currency_code, tax_enabled, tax_label, tax_rate_basis_points, invoice_start_number
            FROM admin_settings WHERE id = 1 LOCK IN SHARE MODE')->fetch(PDO::FETCH_ASSOC);
        if (!$settings) {
            throw new RuntimeException('Billing settings are missing.');
        }
        $due = 0;
        foreach ($fees as $fee) {
            $balance = $fee['amount_minor'] - $fee['paid_amount_minor'];
            if ($fee['status'] === 'paid' || $balance <= 0 || $fee['currency_code'] !== $settings['currency_code']) {
                throw new DomainException('A selected fee is paid, has no outstanding amount, or uses a different currency.');
            }
            $due = self::add($due, $balance);
        }
        $subtotal = $amount ?? $due;
        if ($subtotal > $due) {
            throw new DomainException('Payment exceeds the selected outstanding balance.');
        }
        $rate = $settings['tax_enabled'] ? (int) $settings['tax_rate_basis_points'] : 0;
        $tax = intdiv($subtotal, 10000) * $rate + intdiv(($subtotal % 10000) * $rate + 5000, 10000);
        $total = self::add($subtotal, $tax);
        $number = InvoiceNumbers::allocate($this->db, (int) $settings['invoice_start_number']);
        $this->db->prepare("INSERT INTO invoices (
            invoice_number, member_ref, customer_name, customer_phone, customer_email, billing_date, due_date,
            invoice_status, payment_status, currency_code, subtotal_minor, tax_minor, total_minor, paid_minor,
            tax_enabled, tax_label, tax_rate_basis_points, notes, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'issued', 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([$number, $member, $profile['full_name'], $profile['phone'], $profile['email'], $today, $today,
                $settings['currency_code'], $subtotal, $tax, $total, $total, $settings['tax_enabled'], $settings['tax_label'],
                $settings['tax_rate_basis_points'], $notes, $actor, $actor]);
        $invoice = (int) $this->db->lastInsertId();
        $this->db->prepare('INSERT INTO invoice_payments (invoice_id, amount_minor, payment_method, payment_date, reference, notes, received_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$invoice, $total, $method, $date, $reference, $notes, $actor]);
        $payment = (int) $this->db->lastInsertId();
        $allocations = $this->allocate($fees, $subtotal, $tax, $invoice, $payment, $actor);
        $nextDue = $this->updateMemberDue($member, $today);
        $this->db->prepare("INSERT INTO payment_audit_events (payment_id, member_id, actor_id, action)
            VALUES (?, ?, ?, 'membership.payment')")->execute([$payment, $member, $actor]);
        return [
            'member_id' => $member, 'invoice_id' => $invoice, 'invoice_number' => $number, 'payment_id' => $payment,
            'subtotal_minor' => $subtotal, 'tax_minor' => $tax, 'total_amount_minor' => $total,
            'allocations' => $allocations, 'next_due_date' => $nextDue,
        ];
    }

    private static function add(int $left, int $right): int
    {
        if ($right > self::MAX_AMOUNT - $left) {
            throw new DomainException('The amount is outside the supported currency range.');
        }
        return $left + $right;
    }

    private function allocate(array $fees, int $subtotal, int $tax, int $invoice, int $payment, string $actor): array
    {
        $line = $this->db->prepare("INSERT INTO invoice_items (
            invoice_id, item_type, description, quantity, unit_price_minor, tax_minor, line_total_minor,
            membership_period_start, membership_period_end, sort_order
        ) VALUES (?, 'membership', ?, 1, ?, ?, ?, ?, ?, ?)");
        $allocation = $this->db->prepare('INSERT INTO membership_payment_allocations
            (payment_id, fee_id, invoice_item_id, amount_minor, previous_invoice_id) VALUES (?, ?, ?, ?, ?)');
        $feeUpdate = $this->db->prepare('UPDATE membership_fees SET paid_amount_minor = ?, status = ?,
            paid_at = IF(? = 1, CURRENT_TIMESTAMP(6), NULL), paid_by = IF(? = 1, ?, NULL), invoice_id = ? WHERE id = ?');
        $remaining = $subtotal;
        $result = [];
        foreach ($fees as $fee) {
            $applied = min($remaining, $fee['amount_minor'] - $fee['paid_amount_minor']);
            $remaining -= $applied;
            $lineTax = $remaining === 0 ? $tax : 0;
            $month = new DateTimeImmutable($fee['billing_month']);
            $line->execute([$invoice, $month->format('F Y') . ' Membership Fee', $applied, $lineTax, self::add($applied, $lineTax),
                $month->format('Y-m-01'), $month->format('Y-m-t'), count($result)]);
            $allocation->execute([$payment, $fee['id'], (int) $this->db->lastInsertId(), $applied, $fee['invoice_id']]);
            $paid = $fee['paid_amount_minor'] + $applied;
            $complete = (int) ($paid === $fee['amount_minor']);
            $status = $complete ? 'paid' : 'partial';
            $feeUpdate->execute([$paid, $status, $complete, $complete, $actor, $invoice, $fee['id']]);
            $result[] = ['fee_id' => $fee['id'], 'billing_month' => $fee['billing_month'], 'amount_minor' => $applied, 'status' => $status];
            if ($remaining === 0) {
                break;
            }
        }
        return $result;
    }

    private function updateMemberDue(int $member, string $today): ?string
    {
        $query = $this->db->prepare("SELECT
            MIN(CASE WHEN status <> 'paid' AND amount_minor > paid_amount_minor THEN due_date END) AS outstanding,
            MAX(CASE WHEN status = 'paid' THEN due_date END) AS last_paid
            FROM membership_fees WHERE member_id = ?");
        $query->execute([$member]);
        $dates = $query->fetch(PDO::FETCH_ASSOC);
        $next = $dates['outstanding'];
        $status = $next === null ? 'paid' : ($next < $today ? 'overdue' : 'unpaid');
        if ($next === null && $dates['last_paid'] !== null) {
            $last = new DateTimeImmutable($dates['last_paid']);
            $month = $last->modify('first day of next month');
            $next = $month->format('Y-m-') . sprintf('%02d', min((int) $last->format('d'), (int) $month->format('t')));
        }
        $this->db->prepare('UPDATE members SET payment_due_date = ?, payment_status = ? WHERE id = ?')
            ->execute([$next, $status, $member]);
        return $next;
    }
}
