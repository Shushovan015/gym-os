<?php
declare(strict_types=1);

final class Catalog
{
    private const ENTITIES = [
        'product' => ['shop_items', [
            'title' => 'required', 'category' => 'required', 'sku' => 'short', 'barcode' => 'short',
            'brand' => 'short', 'unit' => 'required', 'supplier_id' => 'id', 'price' => 'text',
            'description' => 'text', 'image' => 'text', 'badge' => 'text', 'inquire_link' => 'text',
            'sort_order' => 'order', 'is_featured' => 'bool', 'is_active' => 'bool', 'inventory_enabled' => 'bool',
            'cost_price_minor' => 'money', 'selling_price_minor' => 'money', 'wholesale_price_minor' => 'money',
            'low_stock_threshold' => 'quantity', 'inventory_notes' => 'nullable',
        ], ['title', 'category']],
        'variant' => ['inventory_product_variants', [
            'product_id' => 'required_id', 'name' => 'required', 'sku' => 'required', 'barcode' => 'short',
            'size' => 'short', 'color' => 'short', 'flavour' => 'short', 'package_size' => 'short',
            'cost_price_minor' => 'nullable_money', 'selling_price_minor' => 'nullable_money',
            'wholesale_price_minor' => 'nullable_money', 'low_stock_threshold' => 'nullable_quantity', 'is_active' => 'bool',
        ], ['product_id', 'sku']],
        'supplier' => ['inventory_suppliers', [
            'name' => 'required', 'contact_person' => 'short', 'phone' => 'short', 'email' => 'short',
            'address' => 'nullable', 'notes' => 'nullable', 'is_active' => 'bool',
        ], ['name']],
    ];

    public function __construct(private PDO $db)
    {
    }

    public function listing(array $input): array
    {
        $search = $input['search'] ?? '';
        $category = $input['category'] ?? 'all';
        $active = $input['active'] ?? 'all';
        $stock = $input['stock'] ?? 'all';
        $sort = $input['sort'] ?? 'title';
        $tracked = $input['tracked'] ?? 'all';
        $offset = filter_var($input['offset'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        $limit = filter_var($input['limit'] ?? 50, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 200]]);
        $orders = ['title' => 'title, id', 'recent' => 'updated_at DESC, id DESC', 'stock' => 'quantity, id', 'catalog' => 'sort_order, id'];
        if (!is_string($search) || strlen($search) > 255 || !is_string($category) || strlen($category) > 255 ||
            !in_array($active, ['all', 'active', 'inactive'], true) ||
            !in_array($stock, ['all', 'low', 'out', 'in'], true) ||
            !in_array($tracked, ['all', 'yes', 'no'], true) ||
            !is_string($sort) || !isset($orders[$sort]) || $offset === false || $limit === false) {
            return [422, ['error' => 'Invalid inventory filters.']];
        }
        $conditions = ['1 = 1'];
        $parameters = [];
        if ($search !== '') {
            $conditions[] = 'EXISTS (SELECT 1 FROM shop_items x WHERE x.id = i.id AND (
                LOCATE(LOWER(?), LOWER(x.title)) > 0 OR LOCATE(LOWER(?), LOWER(x.sku)) > 0 OR x.barcode = ?
                OR EXISTS (SELECT 1 FROM inventory_product_variants v WHERE v.product_id = x.id AND
                    (LOCATE(LOWER(?), LOWER(v.sku)) > 0 OR v.barcode = ?))))';
            $parameters = array_fill(0, 5, trim($search));
        }
        if ($category !== 'all') {
            $conditions[] = 'category = ?';
            $parameters[] = $category;
        }
        if ($active !== 'all') {
            $conditions[] = 'is_active = ?';
            $parameters[] = (int) ($active === 'active');
        }
        if ($tracked !== 'all') {
            $conditions[] = 'inventory_enabled = ?';
            $parameters[] = (int) ($tracked === 'yes');
        }
        $conditions[] = match ($stock) {
            'low' => 'inventory_enabled = 1 AND quantity > 0 AND low_stock = 1',
            'out' => 'inventory_enabled = 1 AND quantity <= 0',
            'in' => 'inventory_enabled = 1 AND quantity > 0',
            default => '1 = 1',
        };
        $from = "FROM (
            SELECT p.*, COALESCE(t.quantity, 0) AS quantity, COALESCE(t.low_stock, 0) AS low_stock,
                COALESCE(t.value_minor, 0) AS value_minor,
                CASE WHEN NOT p.inventory_enabled THEN 'not_tracked'
                     WHEN COALESCE(t.quantity, 0) <= 0 THEN 'out_of_stock' ELSE 'in_stock' END AS availability
            FROM shop_items p LEFT JOIN (
                SELECT v.product_id, SUM(v.current_quantity) AS quantity,
                    MAX(v.current_quantity <= COALESCE(v.low_stock_threshold, p.low_stock_threshold)) AS low_stock,
                    SUM(ROUND(v.current_quantity * COALESCE(v.cost_price_minor, p.cost_price_minor))) AS value_minor
                FROM inventory_product_variants v JOIN shop_items p ON p.id = v.product_id
                WHERE v.is_active = 1 GROUP BY v.product_id
            ) t ON t.product_id = p.id
        ) i WHERE " . implode(' AND ', $conditions);
        $this->db->beginTransaction();
        try {
            $summary = $this->db->prepare("SELECT COUNT(*) AS count, COALESCE(SUM(IF(inventory_enabled, value_minor, 0)), 0) AS value_minor,
                COALESCE(SUM(inventory_enabled AND low_stock), 0) AS low_stock_count $from");
            $summary->execute($parameters);
            $totals = $summary->fetch(PDO::FETCH_ASSOC);
            $statement = $this->db->prepare("SELECT * $from ORDER BY {$orders[$sort]} LIMIT $limit OFFSET $offset");
            $statement->execute($parameters);
            $products = $statement->fetchAll(PDO::FETCH_ASSOC);
            if ($products !== []) {
                $markers = implode(',', array_fill(0, count($products), '?'));
                $variants = $this->db->prepare("SELECT v.*, COALESCE(v.low_stock_threshold, p.low_stock_threshold) AS effective_low_stock_threshold
                    FROM inventory_product_variants v JOIN shop_items p ON p.id = v.product_id
                    WHERE v.product_id IN ($markers) ORDER BY v.product_id, v.name, v.id");
                $variants->execute(array_column($products, 'id'));
                $groups = [];
                foreach ($variants->fetchAll(PDO::FETCH_ASSOC) as $variant) {
                    $groups[$variant['product_id']][] = $variant;
                }
                foreach ($products as &$product) {
                    $product['variants'] = $groups[$product['id']] ?? [];
                }
                unset($product);
            }
            $categories = $this->db->query('SELECT DISTINCT category FROM shop_items ORDER BY category')->fetchAll(PDO::FETCH_COLUMN);
            $this->db->commit();
            return [200, ['products' => $products, 'categories' => $categories, 'summary' => $totals]];
        } catch (Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }

    public function suppliers(): array
    {
        return [200, ['suppliers' => $this->db->query('SELECT * FROM inventory_suppliers ORDER BY name, id')->fetchAll(PDO::FETCH_ASSOC)]];
    }

    public function save(array $input, string $actor): array
    {
        $entity = $input['entity'] ?? null;
        $id = $input['id'] ?? null;
        $fields = $input['fields'] ?? null;
        if (!is_string($entity) || !isset(self::ENTITIES[$entity]) ||
            ($id !== null && (!is_int($id) || $id < 1)) || !is_array($fields) || $fields === []) {
            return [422, ['error' => 'Invalid catalog change.']];
        }
        [$table, $rules, $required] = self::ENTITIES[$entity];
        foreach ($fields as $field => &$value) {
            $rule = $rules[$field] ?? '';
            if ($id !== null && $entity === 'variant' && $field === 'product_id') {
                return [422, ['error' => 'A saved variant cannot move to another product.']];
            }
            if (!self::valid($rule, $value)) {
                return [422, ['error' => "Invalid catalog field: $field."]];
            }
            if (is_string($value)) {
                $value = trim($value);
                if ($rule === 'short' && $value === '') {
                    $value = null;
                }
            }
            if (is_bool($value)) {
                $value = (int) $value;
            }
        }
        unset($value);
        if ($id === null && array_diff($required, array_keys($fields)) !== []) {
            return [422, ['error' => 'Required catalog fields are missing.']];
        }
        if ($id === null && $entity === 'product') {
            $fields['wholesale_price_minor'] ??= $fields['selling_price_minor'] ?? 0;
        }
        if ($entity === 'product' && isset($fields['is_active'])) {
            $fields['deactivated_at'] = $fields['is_active'] ? null : gmdate('Y-m-d H:i:s');
        }
        return $this->mutate(function () use ($id, $entity, $table, $fields, $actor): array {
            if ($id === null) {
                $names = implode(', ', array_keys($fields));
                $markers = implode(', ', array_fill(0, count($fields), '?'));
                $this->db->prepare("INSERT INTO $table ($names) VALUES ($markers)")->execute(array_values($fields));
                $saved = (int) $this->db->lastInsertId();
            } else {
                $exists = $this->db->prepare("SELECT id FROM $table WHERE id = ? FOR UPDATE");
                $exists->execute([$id]);
                if ($exists->fetchColumn() === false) {
                    return [404, ['error' => 'Catalog record was not found.']];
                }
                $sets = implode(', ', array_map(static fn (string $field): string => "$field = ?", array_keys($fields)));
                $this->db->prepare("UPDATE $table SET $sets WHERE id = ?")->execute([...array_values($fields), $id]);
                $saved = $id;
            }
            audit($this->db, "catalog.$entity.save", $actor);
            return [$id === null ? 201 : 200, ['id' => $saved]];
        });
    }

    public function delete(array $input, string $actor): array
    {
        $entity = $input['entity'] ?? null;
        $id = $input['id'] ?? null;
        if (!is_string($entity) || !isset(self::ENTITIES[$entity]) || !is_int($id) || $id < 1) {
            return [422, ['error' => 'Invalid catalog record.']];
        }
        [$table] = self::ENTITIES[$entity];
        return $this->mutate(function () use ($table, $entity, $id, $actor): array {
            $statement = $this->db->prepare("DELETE FROM $table WHERE id = ?");
            $statement->execute([$id]);
            if ($statement->rowCount() === 0) {
                return [404, ['error' => 'Catalog record was not found.']];
            }
            audit($this->db, "catalog.$entity.delete", $actor);
            return [200, ['id' => $id]];
        });
    }

    private function mutate(Closure $operation): array
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
            if ($error instanceof PDOException && $error->getCode() === '23000') {
                return [409, ['error' => 'The catalog record conflicts with an existing SKU, barcode, or linked record.']];
            }
            throw $error;
        }
    }

    private static function valid(string $rule, mixed $value): bool
    {
        return match ($rule) {
            'required' => is_string($value) && trim($value) !== '' && strlen($value) <= 255,
            'short', 'nullable' => $value === null || (is_string($value) && strlen($value) <= ($rule === 'short' ? 255 : 4000)),
            'text' => is_string($value) && strlen($value) <= 4000,
            'id', 'required_id' => ($value === null && $rule === 'id') || (is_int($value) && $value > 0),
            'bool' => is_bool($value),
            'money', 'nullable_money' => ($value === null && $rule === 'nullable_money') ||
                (is_int($value) && $value >= 0 && $value <= 9007199254740991),
            'quantity', 'nullable_quantity' => ($value === null && $rule === 'nullable_quantity') ||
                (is_string($value) && preg_match('/^\d{1,11}(?:\.\d{1,3})?$/D', $value)),
            'order' => is_int($value) && $value >= -2147483648 && $value <= 2147483647,
            default => false,
        };
    }
}
