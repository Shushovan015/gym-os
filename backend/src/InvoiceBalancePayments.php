<?php
declare(strict_types=1);

final class InvoiceBalancePayments
{
    public function __construct(private PDO $db)
    {
    }

    public function record(array $input, mixed $key, string $actor): array
    {
        $invoice = $input['invoiceId'] ?? null;
        $amount = $input['amountMinor'] ?? null;
        $method = $input['paymentMethod'] ?? null;
        if (!is_string($key) || !preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key) ||
            !is_int($invoice) || $invoice < 1 || !is_int($amount) || $amount < 1 || $amount > 9007199254740991 ||
            !in_array($method, ['cash', 'card', 'bank_transfer', 'digital_wallet', 'other'], true)) {
            return [422, ['error' => 'Invalid invoice payment or idempotency key.']];
        }
        $fingerprint = hash('sha256', json_encode([$actor, $invoice, $amount, $method], JSON_THROW_ON_ERROR));
        $this->db->beginTransaction();
        try {
            $this->db->prepare('INSERT INTO invoice_balance_payment_requests (request_key, fingerprint) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE request_key = request_key')->execute([$key, $fingerprint]);
            $lookup = $this->db->prepare('SELECT fingerprint, payment_id FROM invoice_balance_payment_requests WHERE request_key = ? FOR UPDATE');
            $lookup->execute([$key]);
            $request = $lookup->fetch(PDO::FETCH_ASSOC);
            if (!hash_equals($request['fingerprint'], $fingerprint)) {
                throw new DomainException('This idempotency key was already used for a different payment.');
            }
            if ($request['payment_id'] !== null) {
                $this->db->commit();
                return [200, ['invoice_id' => $invoice, 'payment_id' => $request['payment_id']]];
            }
            $query = $this->db->prepare('SELECT invoice_status, balance_minor, paid_minor FROM invoices WHERE id = ? FOR UPDATE');
            $query->execute([$invoice]);
            $bill = $query->fetch(PDO::FETCH_ASSOC);
            if (!$bill || $bill['invoice_status'] !== 'issued' || $amount > $bill['balance_minor']) {
                throw new DomainException('The invoice is unavailable or payment exceeds the outstanding balance.');
            }
            $date = (new DateTimeImmutable('today', new DateTimeZone('Asia/Kathmandu')))->format('Y-m-d');
            $this->db->prepare('INSERT INTO invoice_payments (invoice_id, amount_minor, payment_method, payment_date, received_by)
                VALUES (?, ?, ?, ?, ?)')->execute([$invoice, $amount, $method, $date, $actor]);
            $payment = (int) $this->db->lastInsertId();
            $remaining = $bill['balance_minor'] - $amount;
            $this->db->prepare('UPDATE invoices SET balance_minor = ?, paid_minor = ?, payment_status = ?, updated_by = ? WHERE id = ?')
                ->execute([$remaining, $bill['paid_minor'] + $amount, $remaining === 0 ? 'paid' : 'partially_paid', $actor, $invoice]);
            $this->db->prepare('UPDATE invoice_balance_payment_requests SET payment_id = ? WHERE request_key = ?')->execute([$payment, $key]);
            audit($this->db, 'invoice.payment', $actor);
            $this->db->commit();
            return [201, ['invoice_id' => $invoice, 'payment_id' => $payment]];
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
}
