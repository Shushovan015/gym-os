<?php
declare(strict_types=1);

final class LegacySqlImport
{
    private const REGISTER = ['datebs', 'datead', 'name', 'sex', 'age', 'dob', 'nationality', 'occupation',
        'telephone', 'mobile', 'email', 'caddress', 'taddress'];
    private const OFFICE = ['regno', 'membershipno', 'issuedate', 'membershiptype', 'expdate', 'shift',
        'fitnessgoal', 'weight', 'registeredby', 'image'];
    private const BILL = ['billno', 'tobepaid', 'amount', 'narration', 'paiddate'];
    private const SOURCE = 'legacy_mysql';

    public function __construct(private PDO $db)
    {
    }

    public function run(array $input, string $actor): array
    {
        $dryRun = $input['dryRun'] ?? false;
        if (!is_bool($dryRun)) return [422, ['error' => 'Invalid legacy import mode.']];
        try {
            $register = self::batch($input['members'] ?? null, 'id', self::REGISTER, true);
            $office = self::batch($input['memberships'] ?? null, 'id', self::OFFICE, false, 'reg_id');
            $bills = self::batch($input['bills'] ?? null, 'bill_id', self::BILL, true, 'register_id');
        } catch (DomainException $error) {
            return [422, ['error' => $error->getMessage()]];
        }
        if ($register === [] && $office === [] && $bills === []) return [422, ['error' => 'There are no supported legacy records.']];

        $members = $evidence = $invoices = $payments = $skipped = 0;
        $review = [];
        $conflictingMembers = [];
        $this->db->beginTransaction();
        try {
            $this->db->query('SELECT id FROM member_write_lock WHERE id = 1 FOR UPDATE')->fetchColumn();
            $next = (int) $this->db->query('SELECT next_number FROM invoice_number_sequences WHERE id = 1 FOR UPDATE')->fetchColumn();
            if ($next < 1) throw new RuntimeException('Invoice numbering is unavailable.');
            $find = $this->db->prepare('SELECT fingerprint, member_id, review_reason FROM legacy_sql_evidence WHERE entity = ? AND legacy_id = ?');
            $insert = $this->db->prepare('INSERT INTO legacy_sql_evidence
                (entity, legacy_id, payload, fingerprint, member_id, invoice_id, review_reason, imported_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            foreach (['register' => $register, 'officeregister' => $office, 'bill' => $bills] as $entity => $rows) {
                foreach ($rows as $id => $record) {
                    $payload = json_encode($record, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
                    $hash = hash('sha256', $payload);
                    $find->execute([$entity, $id]);
                    $prior = $find->fetch(PDO::FETCH_ASSOC);
                    $find->closeCursor();
                    if ($prior !== false) {
                        $skipped++;
                        $unchanged = hash_equals($prior['fingerprint'], $hash);
                        if ($entity === 'register' && !$unchanged) $conflictingMembers[$id] = true;
                        $reason = $unchanged ? $prior['review_reason'] : 'Source data differs from the earlier import.';
                        if ($reason !== null) $review[] = compact('entity', 'id', 'reason');
                        continue;
                    }
                    $invoice = $member = $reason = null;
                    if ($entity === 'register') {
                        [$member, $reason] = $this->insertMember($id, $record);
                        if ($member !== null) $members++;
                    } else {
                        $parent = $record['source']['reg_id'] ?? $record['source']['register_id'] ?? null;
                        if ($parent !== null && !isset($conflictingMembers[$parent])) {
                            $find->execute(['register', $parent]);
                            $parentRecord = $find->fetch(PDO::FETCH_ASSOC);
                            $find->closeCursor();
                            $member = $parentRecord === false ? null : $parentRecord['member_id'];
                        }
                        if ($member === null) $reason = 'The original member link could not be resolved.';
                        elseif ($entity === 'officeregister') $reason = 'Membership history has no recorded fee amount.';
                        else {
                            [$invoice, $reason] = $this->insertBill((int) $id, (int) $member, $record, $actor, $next);
                            if ($invoice !== null) {
                                $invoices++;
                                $payments++;
                            }
                        }
                    }
                    $insert->execute([$entity, $id, $payload, $hash, $member, $invoice, $reason, $actor]);
                    if ($reason !== null) $review[] = compact('entity', 'id', 'reason');
                    $evidence++;
                }
            }
            if ($dryRun) {
                $this->db->rollBack();
            } else {
                $this->db->prepare('UPDATE invoice_number_sequences SET next_number = GREATEST(next_number, ?) WHERE id = 1')->execute([$next]);
                audit($this->db, 'admin.legacy_sql.import', $actor);
                $this->db->commit();
            }
            return [200, compact('members', 'evidence', 'invoices', 'payments', 'skipped', 'review')];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function insertMember(int $id, array $record): array
    {
        $profile = $record['profile'];
        if ($profile === null) return [null, 'Member name or normalized registration fields require review.'];
        $memberCode = 'LEG-' . str_pad((string) $id, 6, '0', STR_PAD_LEFT);
        $match = $this->db->prepare('SELECT id FROM members WHERE member_id = ? OR
            (deleted_at IS NULL AND LOWER(TRIM(full_name)) = LOWER(?) AND
             ((? <> \'\' AND phone = ?) OR (? IS NOT NULL AND LOWER(email) = LOWER(?)))) LIMIT 1');
        $match->execute([$memberCode, $profile['full_name'], $profile['phone'], $profile['phone'], $profile['email'], $profile['email']]);
        if ($match->fetchColumn() !== false) return [null, 'A member with a matching identity already exists.'];
        $this->db->prepare("INSERT INTO members (member_id, full_name, phone, email, address, notes, membership_type,
            membership_status, start_date, payment_status, is_active, activated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'monthly', 'active', ?, 'unpaid', 1, CURRENT_TIMESTAMP(6))")
            ->execute([$memberCode, $profile['full_name'], $profile['phone'], $profile['email'], $profile['address'],
                $profile['notes'], $profile['start_date']]);
        return [(int) $this->db->lastInsertId(), null];
    }

    private function insertBill(int $id, int $member, array $record, string $actor, int &$next): array
    {
        $source = $record['source'];
        $date = $record['date'];
        $amount = self::minor($source['amount']);
        $total = self::minor($source['tobepaid']);
        $number = trim($source['billno'] ?? '');
        $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Kathmandu'));
        if ($date === null || $date > $today->format('Y-m-d') || trim($source['paiddate'] ?? '') === '' || $amount === null || $amount < 1
            || $amount !== $total || $number === '' || strlen($number) > 255 || preg_match('/[\x00-\x1f\x7f]/', $number)) {
            return [null, 'The original bill number, date or payment amounts need reconciliation.'];
        }
        $existing = $this->db->prepare('SELECT id FROM invoices WHERE invoice_number = ? OR (legacy_source = ? AND legacy_bill_id = ?) LIMIT 1');
        $existing->execute([$number, self::SOURCE, $id]);
        if ($existing->fetchColumn() !== false) return [null, 'The bill number or source bill is already linked to an invoice.'];
        $write = $this->db->prepare("INSERT INTO invoices (invoice_number, member_ref, customer_name, customer_phone, customer_email,
            billing_date, due_date, invoice_status, payment_status, currency_code, subtotal_minor, total_minor, paid_minor,
            balance_minor, notes, legacy_bill_id, legacy_source, created_by, updated_by)
            SELECT ?, id, full_name, phone, email, ?, ?, 'issued', 'paid', 'NPR', ?, ?, ?, 0, ?, ?, ?, ?, ? FROM members WHERE id = ?");
        $write->execute([$number, $date, $date, $amount, $amount, $amount, $source['narration'], $id, self::SOURCE, $actor, $actor, $member]);
        $invoice = (int) $this->db->lastInsertId();
        if ($write->rowCount() !== 1 || $invoice < 1) throw new RuntimeException('The mapped member is unavailable.');
        $this->db->prepare("INSERT INTO invoice_payments (invoice_id, amount_minor, payment_method, payment_date, reference,
            notes, legacy_bill_id, legacy_source, received_by) VALUES (?, ?, 'other', ?, ?, ?, ?, ?, ?)")
            ->execute([$invoice, $amount, $date, $number, $source['narration'], $id, self::SOURCE, $actor]);
        if (preg_match('/^[0-9]{1,16}$/D', $number) && (int) $number <= 9007199254740991) {
            $next = max($next, (int) $number + 1);
        }
        return [$invoice, null];
    }

    private static function batch(mixed $batch, string $idField, array $fields, bool $wrapped, ?string $parentField = null): array
    {
        if (!is_array($batch) || !array_is_list($batch) || count($batch) > 10000) {
            throw new DomainException('Supply at most 10,000 records per legacy table.');
        }
        $rows = [];
        foreach ($batch as $record) {
            $source = $wrapped ? ($record['source'] ?? null) : $record;
            $id = $source[$idField] ?? null;
            if (!is_array($source) || !is_int($id) || $id < 1 || $id > 9007199254740991 || isset($rows[$id])) {
                throw new DomainException('Legacy source IDs must be positive, safe, and unique within each table.');
            }
            $copy = [$idField => $id];
            if ($parentField !== null) {
                $parent = $source[$parentField] ?? null;
                if ($parent !== null && (!is_int($parent) || $parent < 0 || $parent > 9007199254740991)) {
                    throw new DomainException('Invalid legacy member reference.');
                }
                $copy[$parentField] = $parent;
            }
            foreach ($fields as $field) {
                $value = $source[$field] ?? null;
                if ($value !== null && (!is_string($value) || strlen($value) > 12000)) throw new DomainException('Invalid legacy source field.');
                $copy[$field] = $value;
            }
            $rows[$id] = ['source' => $copy];
            if ($idField === 'bill_id') $rows[$id]['date'] = self::date($record['date'] ?? null);
            elseif ($wrapped) $rows[$id]['profile'] = self::profile($record['profile'] ?? null);
        }
        ksort($rows, SORT_NUMERIC);
        return $rows;
    }

    private static function profile(mixed $source): ?array
    {
        if (!is_array($source)) return null;
        $fields = ['full_name', 'phone', 'email', 'address', 'notes', 'start_date'];
        $result = [];
        foreach ($fields as $field) {
            $value = $source[$field] ?? null;
            if ($value !== null && (!is_string($value) || strlen($value) > 12000)) return null;
            $result[$field] = $value !== null ? trim($value) : null;
        }
        if (strlen($result['full_name'] ?? '') < 2 || $result['phone'] === null
            || ($result['email'] !== null && !filter_var($result['email'], FILTER_VALIDATE_EMAIL))) return null;
        $result['start_date'] = self::date($result['start_date']);
        return $result;
    }

    private static function date(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $value, $parts)
            && checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]) ? $value : null;
    }

    private static function minor(?string $value): ?int
    {
        if ($value === null || !preg_match('/^([0-9]{1,13})(?:\.([0-9]{1,2}))?$/D', trim($value), $parts)) return null;
        return (int) $parts[1] * 100 + (int) str_pad($parts[2] ?? '', 2, '0');
    }
}
