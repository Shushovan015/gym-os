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

    public function change(array $input, string $actor): array
    {
        $member = $input['memberId'] ?? null;
        $date = $input['date'] ?? null;
        $action = $input['action'] ?? null;
        if (!is_int($member) || $member < 1 || !is_string($date) ||
            !preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $date, $parts) ||
            !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]) ||
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
