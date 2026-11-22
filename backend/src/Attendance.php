<?php
declare(strict_types=1);

final class Attendance
{
    public function __construct(private PDO $db)
    {
    }

    public function history(mixed $member): array
    {
        $id = is_string($member) ? filter_var($member, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : false;
        if ($id === false) {
            return [422, ['error' => 'A valid member ID is required.']];
        }
        $query = $this->db->prepare("SELECT id, member_ref, attendance_date, status,
            DATE_FORMAT(deleted_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS deleted_at
            FROM attendance_records WHERE member_ref = ? ORDER BY attendance_date DESC, id DESC LIMIT 60");
        $query->execute([$id]);
        return [200, ['records' => $query->fetchAll(PDO::FETCH_ASSOC)]];
    }

    public function grid(array $input): array
    {
        $start = self::date($input['start'] ?? null);
        $end = self::date($input['end'] ?? null);
        $limit = filter_var($input['limit'] ?? 10, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 50]]);
        if (!$start || !$end || $end < $start || $start->diff($end)->days > 62 || $limit === false) {
            return [422, ['error' => 'Choose a valid date range of at most 63 days and a page size of 1 to 50.']];
        }
        $dates = [$start->format('Y-m-d'), $end->format('Y-m-d')];
        $this->db->beginTransaction();
        try {
            [$status, $result] = (new Members($this->db))->list([
                'limit' => $limit,
                'offset' => $input['offset'] ?? 0,
                'search' => $input['search'] ?? '',
                'enabled' => $input['enabled'] ?? 'active',
                'sort' => 'name_asc',
            ], false);
            if ($status !== 200) {
                $this->db->rollBack();
                return [$status, $result];
            }
            $holiday = $this->db->prepare('SELECT id, holiday_date, name FROM attendance_holidays
                WHERE holiday_date BETWEEN ? AND ? ORDER BY holiday_date');
            $holiday->execute($dates);
            $result['holidays'] = $holiday->fetchAll(PDO::FETCH_ASSOC);
            $result['records'] = [];
            $result['deletedRecords'] = [];
            $ids = array_column($result['members'], 'id');
            if ($ids !== []) {
                $markers = implode(',', array_fill(0, count($ids), '?'));
                $query = $this->db->prepare("SELECT id, member_ref, attendance_date, status,
                    DATE_FORMAT(deleted_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS deleted_at
                    FROM attendance_records WHERE member_ref IN ($markers) AND attendance_date BETWEEN ? AND ?
                    ORDER BY attendance_date DESC, id DESC");
                $query->execute([...$ids, ...$dates]);
                foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $record) {
                    $result[$record['deleted_at'] === null ? 'records' : 'deletedRecords'][] = $record;
                }
                usort($result['deletedRecords'], static fn (array $a, array $b): int =>
                    [$b['deleted_at'], $b['id']] <=> [$a['deleted_at'], $a['id']]);
                $result['deletedRecords'] = array_slice($result['deletedRecords'], 0, 10);
            }
            $this->db->commit();
            return [200, $result];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    public function holiday(array $input, string $actor): array
    {
        $date = self::date($input['date'] ?? null);
        $action = $input['action'] ?? null;
        $name = $input['name'] ?? null;
        if (!$date || !in_array($action, ['save', 'remove'], true)
            || ($action === 'save' && (!is_string($name) || trim($name) === '' || strlen($name) > 255))) {
            return [422, ['error' => 'Invalid holiday date, action or name.']];
        }
        $this->db->beginTransaction();
        try {
            if ($action === 'save') {
                $closing = $this->db->query('SELECT weekly_closing_day FROM admin_settings WHERE id = 1 LOCK IN SHARE MODE')->fetchColumn();
                if ($closing === false || (int) $closing === (int) $date->format('w')) {
                    $this->db->rollBack();
                    return [409, ['error' => 'A holiday cannot be added on the weekly closing day.']];
                }
                $query = $this->db->prepare('INSERT INTO attendance_holidays (holiday_date, name) VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE name = VALUES(name)');
                $query->execute([$date->format('Y-m-d'), trim($name)]);
            } else {
                $query = $this->db->prepare('DELETE FROM attendance_holidays WHERE holiday_date = ?');
                $query->execute([$date->format('Y-m-d')]);
            }
            if ($query->rowCount() > 0) {
                audit($this->db, 'attendance.holiday.' . $action, $actor);
            }
            $this->db->commit();
            return [200, ['date' => $date->format('Y-m-d')]];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }

    private static function date(mixed $value): ?DateTimeImmutable
    {
        if (!is_string($value) || !preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $value, $parts)
            || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) {
            return null;
        }
        return new DateTimeImmutable($value, new DateTimeZone('Asia/Kathmandu'));
    }

    public function change(array $input, string $actor): array
    {
        $member = $input['memberId'] ?? null;
        $date = $input['date'] ?? null;
        $action = $input['action'] ?? null;
        if (!is_int($member) || $member < 1 || !self::date($date) ||
            !in_array($action, ['mark', 'remove', 'restore'], true)) {
            return [422, ['error' => 'Invalid member, attendance date or action.']];
        }

        $this->db->beginTransaction();
        try {
            $result = $this->changeLocked($member, $date, $action, $actor);
            $this->db->commit();
            return $result;
        } catch (Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }

    private function changeLocked(int $member, string $date, string $action, string $actor): array
    {
        $lookup = $this->db->prepare('SELECT is_active, deleted_at, last_visit_date FROM members WHERE id = ? FOR UPDATE');
        $lookup->execute([$member]);
        $person = $lookup->fetch(PDO::FETCH_ASSOC);
        if (!$person) {
            return [404, ['error' => 'Member was not found.']];
        }
        if ($action === 'mark') {
            if (!$person['is_active'] || $person['deleted_at'] !== null) {
                return [409, ['error' => 'Attendance requires an active member.']];
            }
            $settings = $this->db->query('SELECT weekly_closing_day, attendance_holiday_lock FROM admin_settings WHERE id = 1 LOCK IN SHARE MODE')
                ->fetch(PDO::FETCH_ASSOC);
            if (!$settings) {
                throw new RuntimeException('Attendance settings are missing.');
            }
            $weekday = (int) (new DateTimeImmutable($date, new DateTimeZone('Asia/Kathmandu')))->format('w');
            $holiday = $this->db->prepare('SELECT id FROM attendance_holidays WHERE holiday_date = ? LOCK IN SHARE MODE');
            $holiday->execute([$date]);
            if ($weekday === (int) $settings['weekly_closing_day'] ||
                ($settings['attendance_holiday_lock'] && $holiday->fetchColumn() !== false)) {
                return [409, ['error' => 'Attendance is unavailable on this date.']];
            }
        }

        $query = $this->db->prepare('SELECT id, status, deleted_at FROM attendance_records WHERE member_ref = ? AND attendance_date = ? FOR UPDATE');
        $query->execute([$member, $date]);
        $record = $query->fetch(PDO::FETCH_ASSOC);
        if (!$record && $action !== 'mark') {
            return [404, ['error' => 'Attendance record was not found.']];
        }
        if ($record && (($action === 'remove' && $record['deleted_at'] !== null)
            || ($action === 'restore' && $record['deleted_at'] === null)
            || ($action === 'mark' && $record['deleted_at'] === null && $record['status'] === 'present'))) {
            return [200, ['lastVisitDate' => $person['last_visit_date']]];
        }
        $wasVisit = $record && $record['deleted_at'] === null && in_array($record['status'], ['present', 'late'], true);
        if ($action === 'mark') {
            $this->db->prepare("INSERT INTO attendance_records (member_ref, attendance_date, status)
                VALUES (?, ?, 'present') ON DUPLICATE KEY UPDATE status = 'present', deleted_at = NULL")
                ->execute([$member, $date]);
        } elseif ($action === 'remove') {
            $this->db->prepare('UPDATE attendance_records SET deleted_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND deleted_at IS NULL')
                ->execute([$record['id']]);
        } else {
            $this->db->prepare('UPDATE attendance_records SET deleted_at = NULL WHERE id = ?')->execute([$record['id']]);
        }

        $lastVisit = $person['last_visit_date'];
        if ($action === 'remove' && $wasVisit && $lastVisit === $date) {
            $latest = $this->db->prepare("SELECT MAX(attendance_date) FROM attendance_records
                WHERE member_ref = ? AND deleted_at IS NULL AND status IN ('present', 'late')");
            $latest->execute([$member]);
            $lastVisit = $latest->fetchColumn();
        }
        if (($action === 'mark' || ($action === 'restore' && in_array($record['status'], ['present', 'late'], true))) &&
            ($lastVisit === null || $date > $lastVisit)) {
            $lastVisit = $date;
        }
        if ($person['last_visit_date'] !== $lastVisit) {
            $this->db->prepare('UPDATE members SET last_visit_date = ? WHERE id = ?')->execute([$lastVisit, $member]);
        }
        audit($this->db, 'attendance.' . $action, $actor);
        return [200, ['lastVisitDate' => $lastVisit]];
    }
}
