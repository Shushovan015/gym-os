<?php
declare(strict_types=1);

require_once __DIR__ . '/InvoiceNumbers.php';
require_once __DIR__ . '/Stock.php';

final class ProductBilling
{
    private const MAX_MONEY = 9007199254740991;
    private const MAX_QUANTITY = 99999999999999;

    public function __construct(private PDO $db)
    {
    }

    public function issue(array $input, mixed $key, string $actor, bool $serviceInvoice = false): array
    {
        $lines = $serviceInvoice ? [] : ($input['lines'] ?? null);
        $service = $serviceInvoice ? ($input['service'] ?? null) : null;
        $name = $input['customerName'] ?? null;
        $member = $input['memberId'] ?? null;
        $payment = $input['paymentMinor'] ?? null;
        $method = $input['paymentMethod'] ?? 'cash';
        $due = $input['dueDate'] ?? null;
        $phone = $input['customerPhone'] ?? null;
        $email = $input['customerEmail'] ?? null;
        $notes = $input['notes'] ?? null;
        $expectedTotal = $input['expectedTotalMinor'] ?? null;
        if (!is_string($key) || !preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key) ||
            !is_array($lines) || !array_is_list($lines) || (!$serviceInvoice && count($lines) < 1) || count($lines) > 100 ||
            ($serviceInvoice && !is_array($service)) ||
            ($member !== null && (!is_int($member) || $member < 1)) ||
            ($name !== null && (!is_string($name) || strlen($name) > 255)) ||
            ($member === null && (!is_string($name) || trim($name) === '')) ||
            ($payment !== null && !self::money($payment)) ||
            ($expectedTotal !== null && !self::money($expectedTotal)) ||
            ($phone !== null && (!is_string($phone) || strlen($phone) > 255)) ||
            ($email !== null && (!is_string($email) || strlen($email) > 255)) ||
            ($notes !== null && (!is_string($notes) || strlen($notes) > 2000)) ||
            !in_array($method, ['cash','card','bank_transfer','digital_wallet','other'], true) ||
            ($due !== null && (!is_string($due) || !preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $due, $parts) ||
                !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])))) {
            return [422, ['error' => 'Invalid invoice or idempotency key.']];
        }
        $items = [];
        $quantities = [];
        foreach ($lines as $line) {
            $id = $line['variantId'] ?? null;
            $type = $line['customerType'] ?? 'general';
            $quantity = $line['quantity'] ?? null;
            $discount = $line['discountMinor'] ?? 0;
            $expected = $line['expectedUnitPriceMinor'] ?? null;
            if (!is_int($id) || $id < 1 || !in_array($type, ['general','wholesale'], true) ||
                !is_string($quantity) || !preg_match('/^\d{1,11}(?:\.\d{1,3})?$/D', $quantity) ||
                !self::money($discount) || ($expected !== null && !self::money($expected)) || ($units = Stock::thousandths($quantity)) <= 0) {
                return [422, ['error' => 'Invalid product invoice line.']];
            }
            $quantities[$id] = ($quantities[$id] ?? 0) + $units;
            if ($quantities[$id] > self::MAX_QUANTITY) {
                return [422, ['error' => 'Combined quantity exceeds the supported range.']];
            }
            $items[] = [$id, $type, $units, $discount, $expected];
        }
        ksort($quantities, SORT_NUMERIC);
        if ($serviceInvoice) {
            $kind = $service['kind'] ?? null;
            $description = $service['description'] ?? null;
            $price = $service['unitPriceMinor'] ?? null;
            $discount = $service['discountMinor'] ?? 0;
            $plan = $service['planId'] ?? null;
            if (!in_array($kind, ['personal_training', 'miscellaneous'], true) ||
                ($kind === 'personal_training' && (!is_int($plan) || $plan < 1)) ||
                ($kind === 'miscellaneous' && (!is_string($description) || trim($description) === '' || strlen($description) > 1000)) ||
                !self::money($price) || $price === 0 || !self::money($discount) || $discount > $price) {
                return [422, ['error' => 'Invalid training or miscellaneous charge.']];
            }
            $service = [$kind, $kind === 'personal_training' ? $plan : trim($description), $price, $discount];
        }
        $customer = ['full_name' => $name === null ? null : trim($name), 'phone' => $phone ?: null, 'email' => $email ?: null];
        $terms = [$actor, $customer['full_name'], $member, $payment, $method, $due,
            array_map(static fn (array $item): array => $item[4] === null ? array_slice($item, 0, 4) : $item, $items)];
        if ($customer['phone'] !== null || $customer['email'] !== null || $notes !== null || $expectedTotal !== null) {
            $terms[] = [$customer['phone'], $customer['email'], $notes, $expectedTotal];
        }
        if ($service !== null) {
            $terms[] = $service;
        }
        $fingerprint = hash('sha256', json_encode($terms, JSON_THROW_ON_ERROR));
        return $this->transact(function () use ($key, $fingerprint, $customer, $member, $payment, $method, $due, $items, $quantities, $actor, $notes, $expectedTotal, $service): array {
            $this->db->prepare('INSERT INTO product_invoice_requests (request_key, fingerprint) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE request_key = request_key')->execute([$key, $fingerprint]);
            $query = $this->db->prepare('SELECT fingerprint, response_json FROM product_invoice_requests WHERE request_key = ? FOR UPDATE');
            $query->execute([$key]);
            $request = $query->fetch(PDO::FETCH_ASSOC);
            if (!hash_equals($request['fingerprint'], $fingerprint)) {
                throw new DomainException('The idempotency key was already used for a different invoice.');
            }
            if ($request['response_json'] !== null) {
                return [200, json_decode($request['response_json'], true, flags: JSON_THROW_ON_ERROR)];
            }
            $result = $this->record($customer, $member, $payment, $method, $due, $items, $quantities, $actor, $notes, $expectedTotal, $service);
            $this->db->prepare('UPDATE product_invoice_requests SET invoice_id = ?, response_json = ? WHERE request_key = ?')
                ->execute([$result['invoice_id'], json_encode($result, JSON_THROW_ON_ERROR), $key]);
            return [201, $result];
        });
    }

    private function record(array $customer, ?int $member, ?int $payment, string $method, ?string $due, array $items, array $quantities, string $actor, ?string $notes, ?int $expectedTotal, ?array $service): array
    {
        if ($member !== null) {
            $query = $this->db->prepare('SELECT full_name, phone, email FROM members WHERE id = ? AND deleted_at IS NULL FOR UPDATE');
            $query->execute([$member]);
            $customer = $query->fetch(PDO::FETCH_ASSOC);
            if (!$customer) {
                throw new DomainException('The selected member is unavailable.');
            }
        }
        $variants = [];
        $variantQuery = $this->db->prepare('SELECT * FROM inventory_product_variants WHERE id = ? FOR UPDATE');
        $productQuery = $this->db->prepare('SELECT * FROM shop_items WHERE id = ? LOCK IN SHARE MODE');
        foreach ($quantities as $id => $units) {
            $variantQuery->execute([$id]);
            $variant = $variantQuery->fetch(PDO::FETCH_ASSOC);
            if (!$variant || !$variant['is_active']) {
                throw new DomainException('A selected product variant is unavailable.');
            }
            $productQuery->execute([$variant['product_id']]);
            $product = $productQuery->fetch(PDO::FETCH_ASSOC);
            if (!$product || !$product['is_active'] || !$product['inventory_enabled']) {
                throw new DomainException('A selected product is unavailable for inventory sales.');
            }
            $after = Stock::thousandths($variant['current_quantity']) - $units;
            $variants[$id] = [$variant, $product, $after];
        }
        $settings = $this->db->query('SELECT * FROM admin_settings WHERE id = 1 LOCK IN SHARE MODE')->fetch(PDO::FETCH_ASSOC);
        if (!$settings) {
            throw new RuntimeException('Billing settings are missing.');
        }
        foreach ($variants as [, , $after]) {
            if ((!$settings['allow_negative_stock'] && $after < 0) || abs($after) > self::MAX_QUANTITY) {
                throw new DomainException('Insufficient stock for the combined invoice quantity.');
            }
        }

        $subtotal = 0;
        $discountTotal = 0;
        $snapshots = [];
        foreach ($items as [$id, $type, $units, $discount, $expected]) {
            [$variant, $product] = $variants[$id];
            $field = $type === 'wholesale' ? 'wholesale_price_minor' : 'selling_price_minor';
            $price = $variant[$field] ?? $product[$field];
            if ($expected !== null && $expected !== $price) {
                throw new DomainException('A product price changed. Remove and re-add the affected product before issuing the invoice.');
            }
            $line = self::scale($price, $units, 1000);
            if ($discount > $line) {
                throw new DomainException('A line discount exceeds its price.');
            }
            $subtotal = self::add($subtotal, $line);
            $discountTotal = self::add($discountTotal, $discount);
            $description = $product['title'] . ($variant['name'] === 'Default' ? '' : ' - ' . $variant['name']);
            $snapshots[] = ['product', $type, $product['id'], $id, $description, Stock::decimal($units),
                $price, $variant['cost_price_minor'] ?? $product['cost_price_minor'], $discount, $line - $discount];
        }
        if ($service !== null) {
            [$kind, $description, $subtotal, $discountTotal] = $service;
            if ($kind === 'personal_training') {
                $plan = $this->db->prepare('SELECT name FROM personal_training_plans WHERE id = ? AND is_active = 1 LOCK IN SHARE MODE');
                $plan->execute([$description]);
                $description = $plan->fetchColumn();
                if ($description === false) {
                    throw new DomainException('The selected training plan is unavailable.');
                }
            }
            $snapshots[] = [$kind, null, null, null, $description, '1', $subtotal, null, $discountTotal, $subtotal - $discountTotal];
        }
        $net = $subtotal - $discountTotal;
        $tax = $settings['tax_enabled'] ? self::scale($net, (int) $settings['tax_rate_basis_points'], 10000) : 0;
        $total = self::add($net, $tax);
        if ($expectedTotal !== null && $total !== $expectedTotal) {
            throw new DomainException('The invoice total changed. Reload billing and confirm the current total.');
        }
        $payment ??= $total;
        if ($payment > $total || ($payment < $total && $due === null)) {
            throw new DomainException('Payment exceeds the invoice total or a balance is missing its due date.');
        }
        $today = self::today();
        $number = InvoiceNumbers::allocate($this->db, (int) $settings['invoice_start_number']);
        $paymentStatus = $payment === $total ? 'paid' : ($payment > 0 ? 'partially_paid' : 'unpaid');
        $this->db->prepare("INSERT INTO invoices (
            invoice_number, member_ref, customer_name, customer_phone, customer_email, billing_date, due_date,
            invoice_status, payment_status, currency_code, subtotal_minor, discount_minor, tax_minor, total_minor,
            paid_minor, balance_minor, tax_enabled, tax_label, tax_rate_basis_points, inventory_applied_at, notes, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6), ?, ?, ?)")
            ->execute([$number, $member, $customer['full_name'], $customer['phone'], $customer['email'], $today, $due,
                $paymentStatus, $settings['currency_code'], $subtotal, $discountTotal, $tax, $total, $payment, $total - $payment,
                $settings['tax_enabled'], $settings['tax_label'], $settings['tax_rate_basis_points'], $notes, $actor, $actor]);
        $invoice = (int) $this->db->lastInsertId();
        $insert = $this->db->prepare("INSERT INTO invoice_items (invoice_id, item_type, customer_type, product_id, variant_id,
            description, quantity, unit_price_minor, unit_cost_minor, discount_minor, tax_minor, line_total_minor, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        foreach ($snapshots as $index => $snapshot) {
            $lineNet = array_pop($snapshot);
            $lineTax = $index === count($snapshots) - 1 ? $tax : 0;
            $insert->execute([$invoice, ...$snapshot, $lineTax, $lineNet + $lineTax, $index]);
        }
        foreach ($variants as $id => [$variant, , $after]) {
            $this->move($invoice, $id, 'sale', $variant['current_quantity'], $after, $actor);
        }
        $paymentId = null;
        if ($payment > 0) {
            $this->db->prepare('INSERT INTO invoice_payments (invoice_id, amount_minor, payment_method, payment_date, received_by)
                VALUES (?, ?, ?, ?, ?)')->execute([$invoice, $payment, $method, $today, $actor]);
            $paymentId = (int) $this->db->lastInsertId();
        }
        audit($this->db, $service === null ? 'product_invoice.issue' : 'service_invoice.issue', $actor);
        return ['invoice_id' => $invoice, 'invoice_number' => $number, 'payment_id' => $paymentId,
            'total_minor' => $total, 'paid_minor' => $payment, 'balance_minor' => $total - $payment];
    }

    public function cancel(array $input, string $actor): array
    {
        $id = $input['invoiceId'] ?? null;
        $reason = $input['reason'] ?? null;
        if (!is_int($id) || $id < 1 || !is_string($reason) || trim($reason) === '' || strlen($reason) > 2000) {
            return [422, ['error' => 'An invoice ID and cancellation reason are required.']];
        }
        return $this->transact(function () use ($id, $reason, $actor): array {
            $invoice = $this->db->prepare('SELECT invoice_status, legacy_source, paid_minor, member_ref FROM invoices WHERE id = ? FOR UPDATE');
            $invoice->execute([$id]);
            $bill = $invoice->fetch(PDO::FETCH_ASSOC);
            $registered = $this->db->prepare('SELECT invoice_id FROM product_invoice_requests WHERE invoice_id = ?');
            $registered->execute([$id]);
            $legacy = $registered->fetchColumn() === false;
            if (!$bill || ($legacy && !$bill['legacy_source'])) {
                return [404, ['error' => 'An eligible invoice was not found.']];
            }
            $status = $bill['invoice_status'];
            if ($status === 'cancelled') {
                return [200, ['invoice_id' => $id, 'invoice_status' => 'cancelled']];
            }
            if ($status !== 'issued') {
                throw new DomainException('Only issued product or service invoices can be cancelled.');
            }
            $sales = $this->db->prepare("SELECT variant_id, SUM(-quantity_delta) AS restored FROM stock_movements
                WHERE invoice_id = ? AND movement_type = 'sale' GROUP BY variant_id ORDER BY variant_id");
            $sales->execute([$id]);
            $rows = $sales->fetchAll(PDO::FETCH_ASSOC);
            if ($legacy) {
                $this->checkLegacyCancellation($id, (int) $bill['paid_minor'], $bill['member_ref'] !== null, $rows);
            }
            if ($rows === []) {
                $productItems = $this->db->prepare("SELECT 1 FROM invoice_items WHERE invoice_id = ? AND item_type = 'product' LIMIT 1");
                $productItems->execute([$id]);
                if ($productItems->fetchColumn() !== false) {
                    throw new DomainException('Stock movements must be reconciled before cancellation.');
                }
            }
            $variant = $this->db->prepare('SELECT current_quantity FROM inventory_product_variants WHERE id = ? FOR UPDATE');
            foreach ($rows as $row) {
                $variant->execute([$row['variant_id']]);
                $before = $variant->fetchColumn();
                $restored = Stock::thousandths($row['restored']);
                if ($before === false || $restored <= 0 || ($after = Stock::thousandths($before) + $restored) > self::MAX_QUANTITY) {
                    throw new DomainException('Cannot restore the recorded stock quantity.');
                }
                $this->move($id, (int) $row['variant_id'], 'cancellation_reversal', $before, $after, $actor);
            }
            $payments = $this->db->prepare('SELECT * FROM invoice_payments WHERE invoice_id = ? AND is_reversal = 0 ORDER BY id FOR UPDATE');
            $payments->execute([$id]);
            $reverse = $this->db->prepare('INSERT INTO invoice_payments (invoice_id, amount_minor, payment_method,
                payment_date, notes, is_reversal, reverses_payment_id, received_by) VALUES (?, ?, ?, ?, ?, 1, ?, ?)');
            foreach ($payments->fetchAll(PDO::FETCH_ASSOC) as $payment) {
                $reverse->execute([$id, $payment['amount_minor'], $payment['payment_method'], self::today(), trim($reason), $payment['id'], $actor]);
            }
            $this->db->prepare("UPDATE invoices SET invoice_status = 'cancelled', payment_status = 'unpaid', paid_minor = 0,
                balance_minor = total_minor, cancelled_at = CURRENT_TIMESTAMP(6), cancelled_by = ?, cancellation_reason = ?, updated_by = ?
                WHERE id = ?")->execute([$actor, trim($reason), $actor, $id]);
            audit($this->db, $legacy ? 'legacy_invoice.cancel' : 'product_invoice.cancel', $actor);
            return [200, ['invoice_id' => $id, 'invoice_status' => 'cancelled']];
        });
    }

    private function checkLegacyCancellation(int $invoice, int $paid, bool $hasMember, array $sales): void
    {
        $fees = $this->db->prepare("SELECT EXISTS(SELECT 1 FROM membership_fees WHERE invoice_id = ?)
            OR EXISTS(SELECT 1 FROM invoice_items WHERE invoice_id = ? AND item_type = 'membership')
            OR (? = 1 AND NOT EXISTS(SELECT 1 FROM invoice_items WHERE invoice_id = ?))");
        $fees->execute([$invoice, $invoice, (int) $hasMember, $invoice]);
        if ($fees->fetchColumn()) {
            throw new DomainException('Historical membership allocations must be reconciled before cancellation.');
        }
        $payments = $this->db->prepare('SELECT COALESCE(SUM(amount_minor), 0) AS total, COALESCE(MAX(is_reversal), 0) AS reversed
            FROM invoice_payments WHERE invoice_id = ?');
        $payments->execute([$invoice]);
        $record = $payments->fetch(PDO::FETCH_ASSOC);
        if ($record['reversed'] || (int) $record['total'] !== $paid) {
            throw new DomainException('Historical payments must reconcile with the invoice before cancellation.');
        }
        $stock = $this->db->prepare("SELECT EXISTS(SELECT 1 FROM stock_movements
            WHERE invoice_id = ? AND (movement_type = 'cancellation_reversal' OR (movement_type = 'sale' AND quantity_delta >= 0)))");
        $stock->execute([$invoice]);
        if ($stock->fetchColumn()) {
            throw new DomainException('Historical stock movements must be reconciled before cancellation.');
        }
        $items = $this->db->prepare("SELECT variant_id, SUM(quantity) AS quantity FROM invoice_items
            WHERE invoice_id = ? AND item_type = 'product' GROUP BY variant_id ORDER BY variant_id");
        $items->execute([$invoice]);
        $expected = array_column($items->fetchAll(PDO::FETCH_ASSOC), 'quantity', 'variant_id');
        $recorded = array_column($sales, 'restored', 'variant_id');
        if ($expected !== $recorded) {
            throw new DomainException('Historical product quantities must reconcile with recorded sales before cancellation.');
        }
    }

    private function move(int $invoice, int $variant, string $type, string $before, int $after, string $actor): void
    {
        $quantity = Stock::decimal($after);
        $this->db->prepare('UPDATE inventory_product_variants SET current_quantity = ? WHERE id = ?')->execute([$quantity, $variant]);
        $this->db->prepare('INSERT INTO stock_movements (variant_id, movement_type, quantity_delta, previous_quantity,
            resulting_quantity, invoice_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$variant, $type, Stock::decimal($after - Stock::thousandths($before)), $before, $quantity, $invoice, $actor]);
    }

    private function transact(Closure $operation): array
    {
        $this->db->beginTransaction();
        try {
            $result = $operation();
            $this->db->commit();
            return $result;
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

    private static function money(mixed $amount): bool
    {
        return is_int($amount) && $amount >= 0 && $amount <= self::MAX_MONEY;
    }

    private static function add(int $a, int $b): int
    {
        if ($b > self::MAX_MONEY - $a) {
            throw new DomainException('Invoice amount exceeds the supported range.');
        }
        return $a + $b;
    }

    private static function scale(int $amount, int $multiplier, int $divisor): int
    {
        $whole = intdiv($amount, $divisor);
        if ($multiplier !== 0 && $whole > intdiv(self::MAX_MONEY, $multiplier)) {
            throw new DomainException('Invoice amount exceeds the supported range.');
        }
        return self::add($whole * $multiplier, intdiv(($amount % $divisor) * $multiplier + intdiv($divisor, 2), $divisor));
    }

    private static function today(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone('Asia/Kathmandu')))->format('Y-m-d');
    }
}
