<?php
declare(strict_types=1);

final class PostgresImport
{
    private const DIRECT = [
        'admin_settings', 'members', 'member_status_history', 'attendance_holidays', 'attendance_holiday_templates',
        'attendance_records', 'inventory_suppliers', 'shop_items', 'inventory_product_variants', 'invoices',
        'invoice_items', 'invoice_payments', 'membership_fees', 'membership_payment_allocations', 'stock_movements',
        'pricing_items', 'personal_training_plans', 'facility_items', 'trainers', 'testimonials', 'home_status_items',
        'home_maximus_points', 'contact_faqs', 'invoice_number_sequences',
    ];
    private const CONTENT = ['home_content', 'contact_content', 'footer_content', 'facilities_page_content',
        'trainer_page_content', 'pricing_page_content', 'shop_page_content'];
    private const ARCHIVE = ['profiles', 'auth_identities', 'storage_objects', 'import_logs',
        'member_measurements', 'member_report_logs', 'member_transformations'];
    private const REQUIRED = ['members', 'invoices', 'invoice_payments', 'attendance_records', 'shop_items',
        'inventory_product_variants', 'profiles', 'auth_identities'];

    public function __construct(private PDO $db)
    {
    }

    public function schemaMapping(array $source): array
    {
        $columns = $this->db->query("SELECT table_name AS table_name, column_name AS name, column_type AS type,
            is_nullable AS nullable FROM information_schema.columns WHERE table_schema = DATABASE()
            ORDER BY table_name, ordinal_position")->fetchAll(PDO::FETCH_GROUP | PDO::FETCH_ASSOC);
        $foreignKeys = $this->db->query("SELECT table_name AS table_name, column_name AS column_name,
            referenced_table_name AS parent_table, referenced_column_name AS parent_column
            FROM information_schema.key_column_usage WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL
            ORDER BY table_name, column_name")->fetchAll(PDO::FETCH_ASSOC);
        $expected = [...self::DIRECT, ...self::CONTENT, ...self::ARCHIVE, 'invoice_email_deliveries'];
        $tables = [];
        foreach ($source as $table => $fields) {
            $kind = match (true) {
                in_array($table, self::DIRECT, true) => 'direct',
                in_array($table, self::CONTENT, true) => 'content',
                in_array($table, self::ARCHIVE, true) => 'private-archive',
                $table === 'invoice_email_deliveries' => 'historical-email',
                default => 'unsupported',
            };
            $destination = array_column($columns[$table] ?? [], null, 'name');
            foreach ($fields as $field => $type) {
                $target = match ($kind) {
                    'direct' => $table === 'invoice_number_sequences' && $field === 'last_number' ? 'next_number'
                        : (isset($destination[$field]) ? $field : null),
                    'content' => match ($field) { 'id' => 'id', 'created_at', 'updated_at' => null, default => 'content.' . $field },
                    default => null,
                };
                $tables[$table][$field] = ['sourceType' => $type, 'disposition' => $kind,
                    'targetColumn' => $target, 'targetType' => $destination[$target]['type'] ?? ($target && $kind === 'content' ? 'JSON' : null),
                    'targetNullable' => $destination[$target]['nullable'] ?? null];
            }
        }
        return ['version' => 1, 'tables' => $tables, 'missingSourceTables' => array_values(array_diff($expected, array_keys($source))),
            'missingTargetTables' => array_values(array_diff([...self::DIRECT, ...self::CONTENT], array_keys($columns))),
            'targetOnlyTables' => array_values(array_diff(array_keys($columns), array_keys($source))), 'targetForeignKeys' => $foreignKeys];
    }

    public function run(string $path, string $digest, bool $apply): array
    {
        $file = fopen($path, 'rb');
        if (!$file || !flock($file, LOCK_SH)) throw new DomainException('Could not lock the source export.');
        try {
            $hash = hash_init('sha256');
            hash_update_stream($hash, $file);
            if (!hash_equals($digest, hash_final($hash))) throw new DomainException('The export checksum does not match.');
            [$rows, $missing] = $this->read($file);
        } finally {
            fclose($file);
        }
        $fieldReview = $imported = $archived = [];
        $verifiedFinancialFields = 0;
        foreach (self::ARCHIVE as $name) $archived[$name] = count($rows[$name] ?? []);
        $this->db->beginTransaction();
        try {
            $this->db->query('SELECT id FROM member_write_lock WHERE id = 1 FOR UPDATE')->fetchColumn();
            foreach (GymSchema::TABLES as $table) {
                if (in_array($table, ['schema_migrations', 'invoice_number_sequences', 'admin_settings', 'member_write_lock'], true)) continue;
                if ($this->db->query("SELECT 1 FROM `$table` LIMIT 1 FOR UPDATE")->fetchColumn()) {
                    throw new DomainException("The rehearsal database is not empty ($table).");
                }
            }
            foreach ([...self::DIRECT, ...self::CONTENT] as $table) {
                $definitions = $this->db->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_ASSOC);
                $types = array_column($definitions, 'Type', 'Field');
                if ($table === 'invoice_payments') {
                    usort($rows[$table], static fn (array $a, array $b): int => (int) ($a['is_reversal'] ?? false) <=> (int) ($b['is_reversal'] ?? false));
                }
                foreach ($rows[$table] ?? [] as $index => $row) {
                    try {
                        $mapped = [];
                        if (in_array($table, self::CONTENT, true)) {
                            if ((string) ($row['id'] ?? '') !== '1') throw new DomainException('Unexpected content identifier.');
                            foreach (['created_at', 'updated_at'] as $field) {
                                if (array_key_exists($field, $row)) {
                                    $fieldReview[$table][$field] = ($fieldReview[$table][$field] ?? 0) + 1;
                                    unset($row[$field]);
                                }
                            }
                            unset($row['id']);
                            self::checkContent($row);
                            $mapped = ['id' => 1, 'content' => json_encode((object) $row, JSON_THROW_ON_ERROR)];
                        } elseif ($table === 'invoice_number_sequences' && array_key_exists('last_number', $row)) {
                            $last = filter_var($row['last_number'], FILTER_VALIDATE_INT,
                                ['options' => ['min_range' => 0, 'max_range' => 9007199254740990]]);
                            $year = filter_var($row['sequence_year'] ?? null, FILTER_VALIDATE_INT);
                            if ($last === false || $year === false) throw new DomainException('Invalid annual sequence.');
                            $this->db->prepare('UPDATE invoice_number_sequences SET next_number = GREATEST(next_number, ?) WHERE id = 1')
                                ->execute([$last + 1]);
                            foreach (array_diff(array_keys($row), ['last_number']) as $field) {
                                $fieldReview[$table][$field] = ($fieldReview[$table][$field] ?? 0) + 1;
                            }
                            $imported[$table] = ($imported[$table] ?? 0) + 1;
                            continue;
                        } else {
                            foreach ($row as $field => $value) {
                                if (!isset($types[$field])) {
                                    $fieldReview[$table][$field] = ($fieldReview[$table][$field] ?? 0) + 1;
                                    continue;
                                }
                                if (in_array($field, ['image', 'photo_url', 'inquire_link', 'intro_video_url', 'intro_video_thumb'], true)) {
                                    self::checkContent([$field => $value]);
                                }
                                $mapped[$field] = self::scalar($value, $types[$field]);
                            }
                            if (isset($types['id']) && !isset($mapped['id'])) throw new DomainException('Source row has no ID.');
                        }
                        $this->insert($table, $mapped);
                        $verifiedFinancialFields += $this->verifyFinancialFields($table, $mapped);
                        if ($table === 'invoices') {
                            $this->db->prepare('INSERT INTO pg_import_invoice_holds VALUES (?)')->execute([$mapped['id']]);
                        }
                        $imported[$table] = ($imported[$table] ?? 0) + 1;
                    } catch (PDOException | DomainException) {
                        throw new DomainException("Mapping or constraint failure in $table at row " . ($index + 1) . '. The target was rolled back.');
                    }
                }
            }
            $emailReview = $this->email($rows['invoice_email_deliveries'] ?? []);
            $this->db->exec("UPDATE invoice_number_sequences SET next_number = GREATEST(next_number,
                (SELECT invoice_start_number FROM admin_settings WHERE id = 1),
                COALESCE((SELECT MAX(CAST(TRIM(invoice_number) AS UNSIGNED)) FROM invoices
                    WHERE TRIM(invoice_number) REGEXP '^[0-9]{1,16}$'
                    AND CAST(TRIM(invoice_number) AS UNSIGNED) <= 9007199254740991), 0) + 1) WHERE id = 1");
            $this->db->prepare('INSERT INTO pg_import_runs (id, source_sha256) VALUES (1, ?)')->execute([$digest]);
            $report = ['applied' => $apply, 'sha256' => $digest, 'imported' => $imported, 'archiveOnly' => $archived,
                'missingTables' => $missing, 'unmappedFields' => $fieldReview, 'historicalEmail' => $emailReview,
                'invoiceCancellationHolds' => count($rows['invoices'] ?? []), 'verifiedFinancialFields' => $verifiedFinancialFields];
            $reconciliation = new GymReconciliation($this->db);
            $report['projectedReconciliation'] = $reconciliation->snapshot();
            $report['relationshipReviewCounts'] = array_map('count', $reconciliation->review());
            if ($apply) $this->db->commit();
            else $this->db->rollBack();
            return $report;
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function read($file): array
    {
        rewind($file);
        $counts = $rows = $missing = [];
        $format = $end = false;
        $allow = [...self::DIRECT, ...self::CONTENT, ...self::ARCHIVE, 'invoice_email_deliveries'];
        $bytes = 0;
        while (($line = fgets($file, 2 * 1024 * 1024)) !== false) {
            $bytes += strlen($line);
            if ($bytes > 64 * 1024 * 1024) throw new DomainException('The export exceeds this rehearsal tool’s 64 MiB limit.');
            $record = json_decode($line, true, flags: JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING);
            $kind = $record['kind'] ?? null;
            if (!$format && $kind === 'format' && ($record['version'] ?? null) === 1) {
                $format = true;
                continue;
            }
            if (!$format || $end) throw new DomainException('The export envelope is invalid.');
            if ($kind === 'end' && ($record['version'] ?? null) === 1) {
                $end = true;
                continue;
            }
            $table = $record['table'] ?? null;
            if (!in_array($table, $allow, true)) throw new DomainException('The export contains an unknown table.');
            if ($kind === 'count' && !isset($counts[$table]) && !isset($missing[$table])
                && is_string($record['records'] ?? null) && ctype_digit($record['records'])) {
                $counts[$table] = (int) $record['records'];
                $rows[$table] = [];
            } elseif ($kind === 'missing' && !isset($counts[$table]) && !isset($missing[$table])) {
                $missing[$table] = true;
            } elseif ($kind === 'record' && isset($counts[$table]) && is_array($record['row'] ?? null)) {
                $rows[$table][] = $record['row'];
            } else throw new DomainException('Invalid or duplicate table marker.');
        }
        if (!$end || array_diff(self::REQUIRED, array_keys($counts)) !== []) throw new DomainException('The export is incomplete.');
        foreach ($counts as $table => $count) {
            if (count($rows[$table]) !== $count) throw new DomainException("The row count for $table does not match the export.");
        }
        return [$rows, array_values(array_diff($allow, array_keys($counts)))];
    }

    private function insert(string $table, array $row): void
    {
        if ($row === []) throw new DomainException('Empty mapping.');
        $fields = array_map(static fn (string $key): string => "`$key`", array_keys($row));
        $columns = implode(', ', $fields);
        $parameters = implode(', ', array_fill(0, count($row), '?'));
        $updates = in_array($table, ['admin_settings', 'invoice_number_sequences'], true)
            ? ' ON DUPLICATE KEY UPDATE ' . implode(', ', array_map(static fn (string $field): string => "$field = VALUES($field)", $fields))
            : '';
        $this->db->prepare("INSERT INTO `$table` ($columns) VALUES ($parameters)$updates")->execute(array_values($row));
    }

    private function email(array $source): array
    {
        $history = [];
        foreach ($source as $item) {
            $id = $item['invoice_id'] ?? null;
            if ((!is_int($id) && (!is_string($id) || !ctype_digit($id))) || isset($history[$id])) {
                throw new DomainException('Invalid or duplicate historical email invoice reference.');
            }
            $history[$id] = $item;
        }
        $sent = $uncertain = 0;
        $insert = $this->db->prepare('INSERT INTO bill_email_attempts
            (invoice_id, actor_id, recipient, message_token, status, reconciliation_note) VALUES (?, ?, ?, ?, ?, ?)');
        foreach ($this->db->query('SELECT id FROM invoices')->fetchAll(PDO::FETCH_COLUMN) as $id) {
            $item = $history[$id] ?? [];
            $recipient = $item['recipient_email'] ?? '';
            if (!is_string($recipient) || !filter_var($recipient, FILTER_VALIDATE_EMAIL) || strlen($recipient) > 254) $recipient = '';
            $known = ($item['status'] ?? '') === 'sent' && $recipient !== '' && !empty($item['sent_at']);
            if ($known) $sent++;
            else $uncertain++;
            $insert->execute([$id, '00000000-0000-0000-0000-000000000000', $recipient, bin2hex(random_bytes(16)),
                $known ? 'sent' : 'uncertain', 'Historical delivery imported from the protected PostgreSQL export.']);
            unset($history[$id]);
        }
        if ($history !== []) throw new DomainException('Historical email references an invoice missing from the export.');
        return compact('sent', 'uncertain');
    }

    private function verifyFinancialFields(string $table, array $row): int
    {
        $fields = array_filter(array_keys($row), static fn (string $key): bool =>
            str_ends_with($key, '_minor') || in_array($key, ['quantity', 'current_quantity', 'quantity_delta', 'previous_quantity', 'resulting_quantity'], true));
        if ($fields === []) return 0;
        $keys = $table === 'membership_payment_allocations' ? ['payment_id', 'fee_id'] : ['id'];
        $where = implode(' AND ', array_map(static fn (string $key): string => "`$key` = ?", $keys));
        $columns = implode(', ', array_map(static fn (string $key): string => "`$key`", $fields));
        $query = $this->db->prepare("SELECT $columns FROM `$table` WHERE $where");
        $query->execute(array_map(static fn (string $key): mixed => $row[$key] ?? null, $keys));
        $stored = $query->fetch(PDO::FETCH_ASSOC);
        foreach ($fields as $key) {
            if (!$stored || self::numericText($stored[$key]) !== self::numericText($row[$key])) {
                throw new DomainException('A financial value changed during insertion.');
            }
        }
        return count($fields);
    }

    private static function numericText(mixed $value): ?string
    {
        if ($value === null) return null;
        $text = (string) $value;
        [$whole, $frac] = array_pad(explode('.', ltrim($text, '-'), 2), 2, '');
        $whole = ltrim($whole, '0') ?: '0';
        $frac = rtrim($frac, '0');
        return (str_starts_with($text, '-') && ($whole !== '0' || $frac !== '') ? '-' : '')
            . $whole . ($frac === '' ? '' : '.' . $frac);
    }

    private static function scalar(mixed $value, string $type): mixed
    {
        if ($value === null) return null;
        if (is_array($value)) {
            if (!str_starts_with($type, 'longtext')) throw new DomainException('Unexpected structured value.');
            return json_encode($value, JSON_THROW_ON_ERROR);
        }
        if (str_starts_with($type, 'datetime') && is_string($value)) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/D', $value)) {
                throw new DomainException('Invalid source timestamp.');
            }
            $date = new DateTimeImmutable($value, new DateTimeZone('UTC'));
            if (DateTimeImmutable::getLastErrors()) throw new DomainException('Invalid source calendar date.');
            return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
        }
        if (preg_match('/^decimal\((\d+),(\d+)\)/', $type, $size)
            && ((!is_string($value) && !is_int($value)) || !preg_match('/^-?\d+(?:\.(\d+))?$/D', (string) $value, $fraction)
                || strlen($fraction[1] ?? '') > (int) $size[2])) throw new DomainException('Use exact decimal strings.');
        if (preg_match('/^(?:tiny|small|medium|big)?int\b/', $type) && !is_int($value) && !is_bool($value)
            && (!is_string($value) || !preg_match('/^-?\d+$/D', $value))) throw new DomainException('Use exact integer values.');
        return is_bool($value) ? (int) $value : $value;
    }

    private static function checkContent(array $data): void
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) self::checkContent($value);
            if (is_string($value) && is_string($key) && preg_match('/(?:link|url|image|thumb)(?:_default)?$/D', $key)
                && (preg_match('/^(?:javascript|data|file|vbscript):/i', trim($value)) || preg_match('/[\x00-\x1f]/', $value))) {
                throw new DomainException('Invalid source content URL.');
            }
        }
    }
}
