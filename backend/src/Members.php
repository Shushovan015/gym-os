<?php
declare(strict_types=1);

final class Members
{
    private const PROFILE_FIELDS = [
        'member_id', 'full_name', 'phone', 'email', 'address', 'notes', 'membership_type',
        'membership_status', 'start_date', 'end_date', 'last_visit_date',
    ];

    public function __construct(private PDO $db)
    {
    }

    public function list(array $input, bool $includeSummary = true): array
    {
        $offset = filter_var($input['offset'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        $limit = filter_var($input['limit'] ?? 50, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 200]]);
        $search = $input['search'] ?? '';
        $deleted = $input['deleted'] ?? 'active';
        $enabled = $input['enabled'] ?? 'all';
        $sort = $input['sort'] ?? 'updated_desc';
        $created = $input['createdSince'] ?? '';
        $absent = filter_var($input['absentDays'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 3650]]);
        $orders = [
            'updated_desc' => 'updated_at DESC, id DESC',
            'created_desc' => 'created_at DESC, id',
            'name_asc' => 'full_name, id',
            'end_date_asc' => 'end_date IS NULL, end_date, id',
        ];
        if ($offset === false || $limit === false || !is_string($search) || strlen($search) > 255 ||
            !in_array($deleted, ['active', 'deleted', 'all'], true) ||
            !in_array($enabled, ['active', 'inactive', 'all'], true) || !is_string($sort) || !isset($orders[$sort]) ||
            $absent === false || !is_string($created) || ($created !== '' &&
                (!preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $created, $parts) ||
                    !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])))) {
            return [422, ['error' => 'Invalid member filters.']];
        }
        $filters = ['1 = 1'];
        $parameters = [];
        if ($deleted !== 'all') {
            $filters[] = $deleted === 'active' ? 'deleted_at IS NULL' : 'deleted_at IS NOT NULL';
        }
        if ($enabled !== 'all') {
            $filters[] = 'is_active = ?';
            $parameters[] = (int) ($enabled === 'active');
        }
        $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Kathmandu'));
        if ($created !== '') {
            $filters[] = 'created_at >= ?';
            $parameters[] = $created . ' 00:00:00';
        }
        if ($absent > 0) {
            $filters[] = "membership_status = 'active' AND (last_visit_date IS NULL OR last_visit_date < ?)";
            $parameters[] = $today->modify("-$absent days")->format('Y-m-d');
        }
        $membership = $input['membership_status'] ?? null;
        if ($membership === 'expired' || $membership === 'expiring') {
            if ($membership === 'expired') {
                $filters[] = "(membership_status = 'expired' OR end_date < ?)";
                $parameters[] = $today->format('Y-m-d');
            } else {
                $warning = (int) $this->db->query('SELECT expiry_warning_days FROM admin_settings WHERE id = 1')->fetchColumn();
                $filters[] = 'end_date BETWEEN ? AND ?';
                $parameters[] = $today->format('Y-m-d');
                $parameters[] = $today->modify("+$warning days")->format('Y-m-d');
            }
            unset($input['membership_status']);
        }
        foreach (['membership_type', 'membership_status', 'payment_status'] as $field) {
            if (isset($input[$field]) && $input[$field] !== 'all') {
                if (!is_string($input[$field]) || strlen($input[$field]) > 255) {
                    return [422, ['error' => 'Invalid member filters.']];
                }
                $filters[] = "$field = ?";
                $parameters[] = $input[$field];
            }
        }
        $search = preg_replace('/\s+/u', ' ', trim($search));
        if ($search === null) {
            return [422, ['error' => 'Invalid member search.']];
        }
        if ($search !== '') {
            $literal = str_replace(' ', '[[:space:]]+', preg_quote($search));
            $filters[] = 'LOWER(full_name) REGEXP LOWER(?)';
            $parameters[] = str_contains($search, ' ')
                ? "^[[:space:]]*$literal"
                : "(^[[:space:]]*$literal|[[:space:]]+$literal" . '[^[:space:]]*[[:space:]]*$)';
        }
        $where = implode(' AND ', $filters);
        $ownsTransaction = !$this->db->inTransaction();
        if ($ownsTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $count = $this->db->prepare("SELECT COUNT(*) FROM members WHERE $where");
            $count->execute($parameters);
            $rows = $this->db->prepare("SELECT * FROM members WHERE $where ORDER BY {$orders[$sort]} LIMIT $limit OFFSET $offset");
            $rows->execute($parameters);
            $result = ['members' => array_map(self::present(...), $rows->fetchAll(PDO::FETCH_ASSOC)),
                'count' => (int) $count->fetchColumn()];
            if ($includeSummary) {
                $summary = $this->db->prepare("SELECT
                COUNT(CASE WHEN deleted_at IS NULL AND membership_status = 'active' AND (end_date IS NULL OR end_date >= ?) THEN 1 END) AS active,
                COUNT(CASE WHEN deleted_at IS NULL AND is_active = 1 THEN 1 END) AS enabled,
                COUNT(CASE WHEN deleted_at IS NULL AND payment_status <> 'paid' THEN 1 END) AS payment_follow_up,
                COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) AS deleted FROM members");
                $summary->execute([$today->format('Y-m-d')]);
                $result['summary'] = $summary->fetch(PDO::FETCH_ASSOC);
            }
            if ($ownsTransaction) {
                $this->db->commit();
            }
            return [200, $result];
        } catch (Throwable $error) {
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function details(mixed $id): array
    {
        $id = filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) {
            return [422, ['error' => 'Invalid member ID.']];
        }
        $member = $this->find($id, false);
        if (!$member) {
            return [404, ['error' => 'Member was not found.']];
        }
        $history = $this->db->prepare('SELECT * FROM member_status_history WHERE member_id = ? ORDER BY changed_at DESC, id DESC LIMIT 100');
        $history->execute([$id]);
        return [200, ['member' => self::present($member), 'statusHistory' => $history->fetchAll(PDO::FETCH_ASSOC)]];
    }

    public function save(array $input, string $actor): array
    {
        $id = $input['id'] ?? null;
        if ($id !== null && (!is_int($id) || $id < 1)) {
            return [422, ['error' => 'Invalid member ID.']];
        }
        $profile = array_intersect_key($input, array_flip(self::PROFILE_FIELDS));
        if ($profile === [] || count($profile) !== count($input) - (int) array_key_exists('id', $input)) {
            return [422, ['error' => 'Invalid member fields.']];
        }
        $this->db->beginTransaction();
        try {
            $this->lockIdentity();
            $current = $id === null ? null : $this->find($id, true);
            $result = $id !== null && !$current
                ? [404, ['error' => 'Member was not found.']]
                : $this->saveLocked($id, $profile, $current, $actor);
            $this->db->commit();
            return $result;
        } catch (Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }

    private function saveLocked(?int $id, array $profile, ?array $current, string $actor): array
    {
        foreach ($profile as $field => &$value) {
            $nullable = in_array($field, ['email', 'notes', 'address', 'start_date', 'end_date', 'last_visit_date'], true);
            if ($value === null && $nullable) {
                continue;
            }
            if (!is_string($value) || strlen($value) > (in_array($field, ['notes', 'address'], true) ? 4000 : 255)) {
                return [422, ['error' => "Invalid $field."]];
            }
            $value = trim($value);
            if ($value === '' && $nullable) {
                $value = null;
            }
            if ($value !== null && str_ends_with($field, '_date') &&
                (!preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $value, $parts) ||
                    !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]))) {
                return [422, ['error' => "Invalid $field."]];
            }
        }
        unset($value);
        if (isset($profile['email']) && !filter_var($profile['email'], FILTER_VALIDATE_EMAIL)) {
            return [422, ['error' => 'Invalid email.']];
        }
        $merged = array_replace($current ?? [], $profile);
        foreach (['member_id', 'full_name', 'phone', 'membership_type'] as $required) {
            if (($merged[$required] ?? '') === '') {
                return [422, ['error' => "Missing $required."]];
            }
        }
        if (!in_array($merged['membership_status'] ?? null, ['active', 'paused', 'cancelled', 'expired'], true) ||
            (isset($merged['start_date'], $merged['end_date']) && $merged['start_date'] > $merged['end_date'])) {
            return [422, ['error' => 'Invalid membership status or dates.']];
        }
        if ($this->identityExists($profile, $current, $id ?? 0)) {
            return [409, ['error' => 'Member ID, phone or email is already in use.']];
        }
        if ($id === null) {
            $profile['is_active'] = 1;
            $profile['payment_status'] = 'unpaid';
            $fields = implode(', ', array_keys($profile));
            $placeholders = implode(', ', array_fill(0, count($profile), '?'));
            $this->db->prepare("INSERT INTO members ($fields) VALUES ($placeholders)")->execute(array_values($profile));
            $id = (int) $this->db->lastInsertId();
        } else {
            if (array_key_exists('last_visit_date', $profile)) {
                $query = $this->db->prepare("SELECT MAX(attendance_date) FROM attendance_records
                    WHERE member_ref = ? AND deleted_at IS NULL AND status IN ('present', 'late')");
                $query->execute([$id]);
                $profile['last_visit_date'] = max($profile['last_visit_date'], $query->fetchColumn());
            }
            $sets = implode(', ', array_map(static fn (string $field): string => "$field = ?", array_keys($profile)));
            $this->db->prepare("UPDATE members SET $sets WHERE id = ?")->execute([...array_values($profile), $id]);
        }
        audit($this->db, $current ? 'member.update' : 'member.create', $actor);
        return [$current ? 200 : 201, ['member' => self::present($this->find($id, false))]];
    }

    private function identityExists(array $profile, ?array $current, int $id): bool
    {
        foreach (['member_id', 'phone', 'email'] as $field) {
            if (!isset($profile[$field]) || $profile[$field] === ($current[$field] ?? null)) {
                continue;
            }
            $condition = match ($field) {
                'member_id' => 'member_id = ?',
                'phone' => 'deleted_at IS NULL AND phone = ?',
                'email' => 'deleted_at IS NULL AND LOWER(email) = LOWER(?)',
            };
            $check = $this->db->prepare("SELECT 1 FROM members WHERE id <> ? AND $condition LIMIT 1");
            $check->execute([$id, $profile[$field]]);
            if ($check->fetchColumn() !== false) {
                return true;
            }
        }
        return false;
    }

    public function change(array $input, string $actor): array
    {
        $action = $input['action'] ?? null;
        $ids = $input['ids'] ?? null;
        $notes = $input['notes'] ?? null;
        if (!in_array($action, ['activate', 'deactivate', 'delete', 'restore'], true) ||
            ($ids !== null && (!is_array($ids) || !array_is_list($ids) || count($ids) < 1 || count($ids) > 500)) ||
            ($ids === null && ($action === 'restore' || ($input['all'] ?? false) !== true)) ||
            ($notes !== null && (!is_string($notes) || strlen($notes) > 2000))) {
            return [422, ['error' => 'Invalid member action.']];
        }
        foreach ($ids ?? [] as $id) {
            if (!is_int($id) || $id < 1) {
                return [422, ['error' => 'Invalid member ID.']];
            }
        }
        $this->db->beginTransaction();
        try {
            $this->lockIdentity();
            $conditions = $action === 'restore' ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL';
            if (in_array($action, ['activate', 'deactivate'], true)) {
                $conditions .= $action === 'activate' ? ' AND is_active = 0' : ' AND is_active = 1';
            }
            $ids = $ids === null ? null : array_values(array_unique($ids));
            if ($ids !== null) {
                $conditions .= ' AND id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')';
            }
            $select = $this->db->prepare("SELECT id FROM members WHERE $conditions ORDER BY id FOR UPDATE");
            $select->execute($ids ?? []);
            $targetIds = $select->fetchAll(PDO::FETCH_COLUMN);
            $update = match ($action) {
                'activate' => 'is_active = 1, activated_at = CURRENT_TIMESTAMP(6), deactivated_at = NULL',
                'deactivate' => 'is_active = 0, activated_at = NULL, deactivated_at = CURRENT_TIMESTAMP(6)',
                'delete' => 'deleted_at = CURRENT_TIMESTAMP(6)',
                'restore' => 'deleted_at = NULL',
            };
            $write = $this->db->prepare("UPDATE members SET $update WHERE id = ?");
            $history = $this->db->prepare('INSERT INTO member_status_history (member_id, status, changed_by, notes) VALUES (?, ?, ?, ?)');
            foreach ($targetIds as $id) {
                $write->execute([$id]);
                if ($action === 'activate' || $action === 'deactivate') {
                    $history->execute([$id, $action === 'activate' ? 'active' : 'inactive', $actor, $notes]);
                }
            }
            if ($targetIds !== []) {
                audit($this->db, 'member.' . $action, $actor);
            }
            $this->db->commit();
            return [200, ['affected' => count($targetIds)]];
        } catch (Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }

    private function lockIdentity(): void
    {
        if ((int) $this->db->query('SELECT id FROM member_write_lock WHERE id = 1 FOR UPDATE')->fetchColumn() !== 1) {
            throw new RuntimeException('Member write lock is missing.');
        }
    }

    private function find(int $id, bool $lock): array|false
    {
        $query = $this->db->prepare('SELECT * FROM members WHERE id = ?' . ($lock ? ' FOR UPDATE' : ''));
        $query->execute([$id]);
        return $query->fetch(PDO::FETCH_ASSOC);
    }

    private static function present(array $member): array
    {
        $member['is_active'] = (bool) $member['is_active'];
        foreach (['activated_at', 'deactivated_at', 'created_at', 'updated_at', 'deleted_at'] as $field) {
            if ($member[$field] !== null) {
                $member[$field] = str_replace(' ', 'T', $member[$field]) . 'Z';
            }
        }
        return $member;
    }
}
