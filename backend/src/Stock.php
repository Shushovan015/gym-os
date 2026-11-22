<?php
declare(strict_types=1);

final class Stock
{
    public function __construct(private PDO $db)
    {
    }

    public function history(mixed $variant): array
    {
        $id = filter_var($variant, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) {
            return [422, ['error' => 'Invalid variant ID.']];
        }
        $query = $this->db->prepare('SELECT * FROM stock_movements WHERE variant_id = ? ORDER BY id DESC LIMIT 200');
        $query->execute([$id]);
        return [200, ['movements' => $query->fetchAll(PDO::FETCH_ASSOC)]];
    }

    public function adjust(array $input, string $actor): array
    {
        $variant = $input['variantId'] ?? null;
        $type = $input['type'] ?? null;
        $delta = $input['quantityDelta'] ?? null;
        $supplier = $input['supplierId'] ?? null;
        $reference = $input['reference'] ?? null;
        $notes = $input['notes'] ?? null;
        if (!is_int($variant) || $variant < 1 || !is_string($delta) ||
            !preg_match('/^-?\d{1,11}(?:\.\d{1,3})?$/D', $delta) ||
            !in_array($type, ['opening','purchase','manual_increase','manual_decrease','damaged','return','correction'], true) ||
            ($supplier !== null && (!is_int($supplier) || $supplier < 1)) ||
            ($reference !== null && (!is_string($reference) || strlen($reference) > 255)) ||
            ($notes !== null && (!is_string($notes) || strlen($notes) > 2000))) {
            return [422, ['error' => 'Invalid stock movement.']];
        }
        $change = self::thousandths($delta);
        if ($change === 0) {
            return [422, ['error' => 'Quantity change cannot be zero.']];
        }
        $this->db->beginTransaction();
        try {
            $lookup = $this->db->prepare('SELECT current_quantity FROM inventory_product_variants WHERE id = ? FOR UPDATE');
            $lookup->execute([$variant]);
            $before = $lookup->fetchColumn();
            if ($before === false) {
                $this->db->rollBack();
                return [404, ['error' => 'Variant was not found.']];
            }
            $after = self::thousandths($before) + $change;
            $allowNegative = $this->db->query('SELECT allow_negative_stock FROM admin_settings WHERE id = 1 LOCK IN SHARE MODE')
                ->fetchColumn();
            if (($after < 0 && !$allowNegative) || abs($after) > 99999999999999) {
                $this->db->rollBack();
                return [409, ['error' => 'The adjustment would put stock outside the allowed range.']];
            }
            if ($supplier !== null) {
                $check = $this->db->prepare('SELECT id FROM inventory_suppliers WHERE id = ? LOCK IN SHARE MODE');
                $check->execute([$supplier]);
                if ($check->fetchColumn() === false) {
                    $this->db->rollBack();
                    return [422, ['error' => 'Supplier was not found.']];
                }
            }
            $quantity = self::decimal($after);
            $this->db->prepare('UPDATE inventory_product_variants SET current_quantity = ? WHERE id = ?')
                ->execute([$quantity, $variant]);
            $this->db->prepare('INSERT INTO stock_movements
                (variant_id, movement_type, quantity_delta, previous_quantity, resulting_quantity, supplier_id, reference, notes, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$variant, $type, $delta, $before, $quantity, $supplier, $reference, $notes, $actor]);
            $id = (int) $this->db->lastInsertId();
            audit($this->db, 'stock.adjust', $actor);
            $this->db->commit();
            return [201, ['movement_id' => $id, 'current_quantity' => $quantity]];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    private static function thousandths(string $quantity): int
    {
        [$whole, $fraction] = array_pad(explode('.', ltrim($quantity, '-'), 2), 2, '');
        $value = (int) $whole * 1000 + (int) str_pad($fraction, 3, '0');
        return str_starts_with($quantity, '-') ? -$value : $value;
    }

    private static function decimal(int $quantity): string
    {
        return ($quantity < 0 ? '-' : '') . intdiv(abs($quantity), 1000) . '.' . sprintf('%03d', abs($quantity) % 1000);
    }
}
