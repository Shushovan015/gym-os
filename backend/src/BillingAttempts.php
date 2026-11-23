<?php
declare(strict_types=1);

final class BillingAttempts
{
    private const FIELDS = [
        '/membership/payments' => ['memberId','feeIds','paymentMethod','amountMinor','paymentDate','expectedTotalMinor','notes'],
        '/invoices/payments' => ['invoiceId','amountMinor','paymentMethod'],
        '/invoices/products/issue' => ['memberId','customerName','customerPhone','customerEmail','notes','paymentMinor','paymentMethod','dueDate','expectedTotalMinor','lines'],
        '/invoices/services/issue' => ['memberId','customerName','customerPhone','customerEmail','notes','paymentMinor','paymentMethod','dueDate','expectedTotalMinor','service'],
    ];

    public function __construct(private PDO $db)
    {
    }

    public function retrieve(string $actor): array
    {
        $row = $this->find($actor);
        return [200, ['attempt' => $row ? $this->view($row) : null]];
    }

    public function change(array $input, string $actor): array
    {
        $action = $input['action'] ?? null;
        $key = $input['key'] ?? null;
        if (!is_string($key) || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/D', $key) ||
            !in_array($action, ['prepare','execute','dismiss','discard'], true)) {
            return [422, ['error' => 'Invalid billing attempt.']];
        }
        // The allocator manages its own transaction. Serialize attempt lifecycle
        // operations across that transaction and release the lock on disconnect.
        return $this->withKeyLock($key, function () use ($input, $actor, $key, $action): array {
            $row = $this->find($actor);
            if ($action === 'prepare') {
                return $this->prepare($input, $actor, $key, $row);
            }
            if (!$row || $row['request_key'] !== $key) {
                return [404, ['error' => 'Billing attempt not found.']];
            }
            if ($action === 'execute') {
                $data = json_decode($row['payload'], true, flags: JSON_THROW_ON_ERROR);
                return $this->submit($row['operation'], $data, $key, $actor);
            }
            $committed = $this->result($row) !== null;
            if (($action === 'dismiss') !== $committed) {
                return [409, ['error' => 'Payment status changed. Reload the attempt before continuing.']];
            }
            $this->db->prepare('UPDATE pending_billing_attempts SET active_actor_id = NULL, payload = NULL
                WHERE actor_id = ? AND request_key = ?')
                ->execute([$actor, $key]);
            return [200, ['attempt' => null]];
        });
    }

    public function direct(string $operation, array $input, mixed $key, string $actor): array
    {
        if (!is_string($key) || strlen($key) !== 36) {
            return $this->submit($operation, $input, $key, $actor);
        }
        return $this->withKeyLock($key, function () use ($operation, $input, $key, $actor): array {
            if ($this->isReserved($key)) {
                return [409, ['error' => 'Execute this payment through its saved attempt.']];
            }
            return $this->submit($operation, $input, $key, $actor);
        });
    }

    private function submit(string $operation, array $input, mixed $key, string $actor): array
    {
        return match ($operation) {
            '/membership/payments' => (new MembershipBilling($this->db))->pay($input, $key, $actor),
            '/invoices/payments' => (new InvoiceBalancePayments($this->db))->record($input, $key, $actor),
            '/invoices/products/issue' => (new ProductBilling($this->db))->issue($input, $key, $actor),
            '/invoices/services/issue' => (new ProductBilling($this->db))->issue($input, $key, $actor, true),
        };
    }

    private function withKeyLock(string $key, Closure $operation): array
    {
        $lockName = hash('sha256', 'gym-billing-attempt:' . $key);
        $lock = $this->db->prepare('SELECT GET_LOCK(?, 5)');
        $lock->execute([$lockName]);
        if ((int) $lock->fetchColumn() !== 1) {
            return [503, ['error' => 'This payment is being processed. Check its status before retrying.']];
        }
        try {
            return $operation();
        } finally {
            $this->db->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]);
        }
    }

    private function prepare(array $input, string $actor, string $key, array|false $row): array
    {
        $operation = $input['path'] ?? null;
        $payload = $input['payload'] ?? null;
        if (!is_string($operation) || !isset(self::FIELDS[$operation]) || !is_array($payload) || array_is_list($payload) ||
            array_diff(array_keys($payload), self::FIELDS[$operation]) !== []) {
            return [422, ['error' => 'Invalid payment snapshot.']];
        }
        foreach (['lines' => ['variantId','quantity','customerType','discountMinor','expectedUnitPriceMinor'],
            'service' => ['kind','planId','description','unitPriceMinor','discountMinor']] as $field => $allowed) {
            if (!array_key_exists($field, $payload)) {
                continue;
            }
            if (!is_array($payload[$field]) || ($field === 'lines' && !array_is_list($payload[$field]))) {
                return [422, ['error' => 'Invalid invoice items.']];
            }
            foreach ($field === 'lines' ? $payload[$field] : [$payload[$field]] as $item) {
                if (!is_array($item) || array_diff(array_keys($item), $allowed) !== [] ||
                    array_filter($item, static fn (mixed $value): bool => $value !== null && !is_scalar($value)) !== []) {
                    return [422, ['error' => 'Invalid invoice items.']];
                }
            }
        }
        foreach ($payload as $field => $value) {
            if (in_array($field, ['lines', 'service'], true)) {
                continue;
            }
            if ($field === 'feeIds' ? (!is_array($value) || !array_is_list($value) || array_filter($value, static fn ($id) => !is_int($id)) !== [])
                : ($value !== null && !is_scalar($value))) {
                return [422, ['error' => 'Invalid payment details.']];
            }
        }
        $encoded = json_encode(self::canonical($payload), JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
        $fingerprint = hash('sha256', $operation . "\n" . $encoded);
        if ($row) {
            if ($row['request_key'] !== $key || !hash_equals($row['fingerprint'], $fingerprint)) {
                return [409, ['error' => 'Resolve the existing payment attempt before starting another.']];
            }
            return [200, ['attempt' => $this->view($row)]];
        }
        $used = $this->db->prepare('SELECT request_key FROM membership_payment_requests WHERE request_key = ?
            UNION ALL SELECT request_key FROM invoice_balance_payment_requests WHERE request_key = ?
            UNION ALL SELECT request_key FROM product_invoice_requests WHERE request_key = ? LIMIT 1');
        $used->execute([$key, $key, $key]);
        if ($used->fetchColumn() !== false) {
            return [409, ['error' => 'This payment key is unavailable.']];
        }
        try {
            $this->db->prepare('INSERT INTO pending_billing_attempts (actor_id, active_actor_id, request_key, operation, fingerprint, payload)
                VALUES (?, ?, ?, ?, ?, ?)')->execute([$actor, $actor, $key, $operation, $fingerprint, $encoded]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                return [409, ['error' => 'This payment key is unavailable.']];
            }
            throw $error;
        }
        return $this->retrieve($actor);
    }

    private function isReserved(string $key): bool
    {
        $query = $this->db->prepare('SELECT 1 FROM pending_billing_attempts WHERE request_key = ?');
        $query->execute([$key]);
        return $query->fetchColumn() !== false;
    }

    private static function canonical(array $value): array
    {
        if (!array_is_list($value)) {
            ksort($value, SORT_STRING);
        }
        return array_map(static fn ($item) => is_array($item) ? self::canonical($item) : $item, $value);
    }

    private function find(string $actor): array|false
    {
        $query = $this->db->prepare('SELECT * FROM pending_billing_attempts WHERE active_actor_id = ?');
        $query->execute([$actor]);
        return $query->fetch(PDO::FETCH_ASSOC);
    }

    private function result(array $row): ?array
    {
        $sql = match ($row['operation']) {
            '/membership/payments' => 'SELECT p.invoice_id, p.id AS payment_id FROM membership_payment_requests r JOIN invoice_payments p ON p.id = r.payment_id WHERE r.request_key = ? AND p.received_by = ?',
            '/invoices/payments' => 'SELECT p.invoice_id, p.id AS payment_id FROM invoice_balance_payment_requests r JOIN invoice_payments p ON p.id = r.payment_id WHERE r.request_key = ? AND p.received_by = ?',
            default => 'SELECT i.id AS invoice_id, (SELECT MIN(p.id) FROM invoice_payments p WHERE p.invoice_id = i.id AND p.is_reversal = 0) AS payment_id
                FROM product_invoice_requests r JOIN invoices i ON i.id = r.invoice_id WHERE r.request_key = ? AND i.created_by = ?',
        };
        return $this->lookupResult($sql, [$row['request_key'], $row['actor_id']]);
    }

    private function lookupResult(string $sql, array $params): ?array
    {
        $query = $this->db->prepare("SELECT r.*, i.invoice_number, i.invoice_status FROM ($sql) r JOIN invoices i ON i.id = r.invoice_id");
        $query->execute($params);
        return $query->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function view(array $row): array
    {
        $result = $this->result($row);
        return ['key' => $row['request_key'], 'path' => $row['operation'],
            'status' => $result ? 'committed' : 'pending', 'result' => $result];
    }
}
