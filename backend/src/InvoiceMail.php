<?php
declare(strict_types=1);

final class InvoiceMail
{
    private InvoiceMailTransport $transport;

    public function __construct(private PDO $db)
    {
        $this->transport = new InvoiceMailTransport();
    }

    public function status(mixed $invoice): array
    {
        $id = filter_var($invoice, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $bill = $id ? $this->bill((int) $id) : false;
        if (!$bill) {
            return [404, ['error' => 'Invoice not found.']];
        }
        $config = $this->transport->config();
        return [200, ['delivery' => $this->latest((int) $id) ?: null, 'sender' => $config['from'] ?? null,
            'recipient' => $bill['invoice_status'] === 'issued' ? $this->recipient($bill) : null]];
    }

    public function send(array $input, string $actor): array
    {
        $id = $input['invoiceId'] ?? null;
        $expected = $input['expectedEmail'] ?? null;
        $retry = $input['retryId'] ?? null;
        if (!is_int($id) || $id < 1 || !is_string($expected) || !filter_var($expected, FILTER_VALIDATE_EMAIL)
            || ($retry !== null && (!is_int($retry) || $retry < 1))) {
            return [422, ['error' => 'Invalid invoice or delivery address.']];
        }
        $config = $this->transport->config();
        if (!$config) {
            return [503, ['error' => 'Invoice email is not configured.']];
        }
        $lockName = hash('sha256', 'gym-mail-rate:' . $actor);
        $lock = $this->db->prepare('SELECT GET_LOCK(?, 3)');
        $lock->execute([$lockName]);
        if ((int) $lock->fetchColumn() !== 1) {
            return [429, ['error' => 'Another email request is in progress.']];
        }
        try {
            [$status, $attempt] = $this->claim($id, $expected, $actor, $retry);
        } finally {
            $this->db->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]);
        }
        if ($status !== 201) {
            return [$status, $attempt];
        }
        [$receiptStatus, $receipt] = (new MembershipBilling($this->db))->receipt($id);
        $settings = $this->db->query('SELECT * FROM admin_settings WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
        $bill = $this->bill($id);
        $result = $receiptStatus === 200 && $settings && $bill && $bill['invoice_status'] === 'issued'
            && $this->recipient($bill) === $attempt['recipient']
            ? $this->transport->send($config, $attempt, $receipt, $settings)
            : 'failed';
        $this->db->prepare("UPDATE bill_email_attempts SET status = ?, finished_at = CURRENT_TIMESTAMP(6)
            WHERE id = ? AND status = 'sending'")->execute([$result, $attempt['id']]);
        audit($this->db, 'invoice.email.' . $result, $actor);
        return [200, ['delivery' => $this->latest($id)]];
    }

    private function claim(int $id, string $expected, string $actor, ?int $retry): array
    {
        $this->db->beginTransaction();
        try {
            $bill = $this->bill($id, true);
            $recipient = $bill ? $this->recipient($bill) : null;
            if (!$bill || $bill['invoice_status'] !== 'issued' || $recipient !== $expected) {
                return [409, ['error' => 'The invoice is ineligible or its verified address has changed.']];
            }
            $last = $this->latest($id);
            if ($last && ($last['status'] !== 'failed' || $retry !== (int) $last['id'])) {
                return [200, ['delivery' => $last]];
            }
            if (!$last && $retry !== null) return [409, ['error' => 'Refresh the delivery status before retrying.']];
            $rate = $this->db->prepare('SELECT COUNT(*) FROM bill_email_attempts
                WHERE actor_id = ? AND created_at >= CURRENT_TIMESTAMP(6) - INTERVAL 15 MINUTE');
            $rate->execute([$actor]);
            if ((int) $rate->fetchColumn() >= 10) {
                return [429, ['error' => 'Email limit reached. Wait 15 minutes before retrying.']];
            }
            $token = bin2hex(random_bytes(16));
            $this->db->prepare("INSERT INTO bill_email_attempts (invoice_id, actor_id, recipient, message_token, status)
                VALUES (?, ?, ?, ?, 'sending')")->execute([$id, $actor, $recipient, $token]);
            $attempt = ['id' => (int) $this->db->lastInsertId(), 'recipient' => $recipient, 'message_token' => $token];
            audit($this->db, 'invoice.email.claim', $actor);
            $this->db->commit();
            return [201, $attempt];
        } finally {
            if ($this->db->inTransaction()) $this->db->rollBack();
        }
    }

    public function reconcile(array $input, string $actor): array
    {
        $id = $input['invoiceId'] ?? null;
        $note = $input['evidence'] ?? null;
        if (!is_int($id) || $id < 1 || !is_string($note) || strlen(trim($note)) < 8 || strlen($note) > 500) {
            return [422, ['error' => 'Provide evidence that the SMTP provider accepted the invoice.']];
        }
        $this->db->beginTransaction();
        try {
            $this->bill($id, true);
            $last = $this->latest($id);
            if (!$last || $last['status'] !== 'uncertain') return [409, ['error' => 'This delivery is not awaiting reconciliation.']];
            $update = $this->db->prepare("UPDATE bill_email_attempts SET status = 'sent', reconciliation_note = ?, reconciled_by = ?,
                finished_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND status IN ('sending','uncertain')");
            $update->execute([trim($note), $actor, $last['id']]);
            if ($update->rowCount() !== 1) return [409, ['error' => 'The delivery status changed. Refresh before reconciling.']];
            audit($this->db, 'invoice.email.reconciled', $actor);
            $this->db->commit();
            return [200, ['delivery' => $this->latest($id)]];
        } finally {
            if ($this->db->inTransaction()) $this->db->rollBack();
        }
    }

    private function bill(int $id, bool $lock = false): array|false
    {
        $query = $this->db->prepare('SELECT invoice_status, member_ref FROM invoices WHERE id = ?' . ($lock ? ' FOR UPDATE' : ''));
        $query->execute([$id]);
        return $query->fetch(PDO::FETCH_ASSOC);
    }

    private function recipient(array $bill): ?string
    {
        if (!$bill['member_ref']) return null;
        $query = $this->db->prepare('SELECT email FROM members WHERE id = ? AND deleted_at IS NULL');
        $query->execute([$bill['member_ref']]);
        $email = trim((string) $query->fetchColumn());
        return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }

    private function latest(int $invoice): array|false
    {
        $query = $this->db->prepare("SELECT id, invoice_id, recipient, message_token,
            CASE WHEN status = 'sending' AND created_at < CURRENT_TIMESTAMP(6) - INTERVAL 5 MINUTE THEN 'uncertain' ELSE status END AS status
            FROM bill_email_attempts WHERE invoice_id = ? ORDER BY id DESC LIMIT 1");
        $query->execute([$invoice]);
        return $query->fetch(PDO::FETCH_ASSOC);
    }
}
