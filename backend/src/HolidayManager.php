<?php
declare(strict_types=1);

final class HolidayManager
{
    public function __construct(private PDO $db)
    {
    }

    public function month(array $input): array
    {
        $start = self::date($input['start'] ?? null);
        $end = self::date($input['end'] ?? null);
        if (!$start || !$end || $end < $start || $start->diff($end)->days > 31) {
            return [422, ['error' => 'Select a valid holiday range of up to 32 days.']];
        }
        $query = $this->db->prepare('SELECT id, holiday_date, name FROM attendance_holidays
            WHERE holiday_date BETWEEN ? AND ? ORDER BY holiday_date');
        $query->execute([$start->format('Y-m-d'), $end->format('Y-m-d')]);
        return [200, ['holidays' => $query->fetchAll(PDO::FETCH_ASSOC)]];
    }

    public function templates(): array
    {
        $records = $this->db->query('SELECT id, name, bs_month, bs_day, is_active FROM attendance_holiday_templates
            ORDER BY bs_month, bs_day, id')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($records as &$row) $row['is_active'] = (bool) $row['is_active'];
        return ['templates' => $records];
    }

    public function change(array $input, string $actor): array
    {
        $action = $input['action'] ?? null;
        if ($action === 'apply') return $this->applyTemplates($input, $actor);
        $name = is_string($input['name'] ?? null) ? trim($input['name']) : '';
        $validName = $name !== '' && strlen($name) <= 1020 && preg_match_all('/./us', $name) <= 255;
        $date = self::date($input['date'] ?? null);
        $month = $input['month'] ?? null;
        $day = $input['day'] ?? null;
        $id = $input['id'] ?? null;
        $validId = is_int($id) && $id > 0;
        $active = $input['active'] ?? null;
        if ($action === 'save' && $date && $validName) {
            $sql = 'INSERT INTO attendance_holidays (holiday_date, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)';
            $params = [$date->format('Y-m-d'), $name];
        } elseif ($action === 'remove' && $date) {
            $sql = 'DELETE FROM attendance_holidays WHERE holiday_date = ?';
            $params = [$date->format('Y-m-d')];
        } elseif ($action === 'create-template' && $validName && self::monthIndex($month) && is_int($day) && $day >= 1 && $day <= 32) {
            $sql = 'INSERT INTO attendance_holiday_templates (name, bs_month, bs_day) VALUES (?, ?, ?)';
            $params = [$name, $month, $day];
        } elseif ($action === 'toggle-template' && $validId && is_bool($active)) {
            $sql = 'UPDATE attendance_holiday_templates SET is_active = ? WHERE id = ?';
            $params = [(int) $active, $id];
        } elseif ($action === 'delete-template' && $validId) {
            $sql = 'DELETE FROM attendance_holiday_templates WHERE id = ?';
            $params = [$id];
        } else {
            return [422, ['error' => 'Enter a valid holiday or template.']];
        }
        return $this->transaction(function () use ($sql, $params, $action, $actor): array {
            $query = $this->db->prepare($sql);
            $query->execute($params);
            if ($query->rowCount()) audit($this->db, 'admin.holiday.' . $action, $actor);
            return [200, ['saved' => true]];
        });
    }

    private function applyTemplates(array $input, string $actor): array
    {
        $month = $input['month'] ?? null;
        $days = $input['days'] ?? null;
        if (!self::monthIndex($month) || !is_array($days) || !array_is_list($days) || count($days) < 29 || count($days) > 32) {
            return [422, ['error' => 'Select a valid Bikram Sambat month.']];
        }
        $first = self::date($days[0]);
        if (!$first) return [422, ['error' => 'Select valid holiday dates.']];
        foreach ($days as $index => $date) {
            if ($date !== $first->modify("+$index days")->format('Y-m-d')) {
                return [422, ['error' => 'The holiday dates must be consecutive.']];
            }
        }
        return $this->transaction(function () use ($days, $month, $actor): array {
            $read = $this->db->prepare('SELECT name, bs_day FROM attendance_holiday_templates
                WHERE is_active = 1 AND bs_month = ? AND bs_day <= ? ORDER BY bs_day, id LOCK IN SHARE MODE');
            $read->execute([$month, count($days)]);
            $templates = $read->fetchAll(PDO::FETCH_ASSOC);
            $indexes = array_column($templates, 'bs_day');
            if (count($indexes) !== count(array_unique($indexes))) {
                return [409, ['error' => 'More than one active template uses the same day. Disable the duplicate before applying templates.']];
            }
            $save = $this->db->prepare('INSERT INTO attendance_holidays (holiday_date, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)');
            foreach ($templates as $template) $save->execute([$days[$template['bs_day'] - 1], $template['name']]);
            if ($templates !== []) audit($this->db, 'admin.holiday.apply', $actor);
            return [200, ['applied' => count($templates)]];
        });
    }

    private function transaction(Closure $work): array
    {
        $this->db->beginTransaction();
        try {
            $result = $work();
            $this->db->commit();
            return $result;
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            if ($error instanceof PDOException && ($error->errorInfo[1] ?? null) === 1062) {
                return [409, ['error' => 'This holiday template already exists.']];
            }
            throw $error;
        }
    }

    private static function monthIndex(mixed $value): bool
    {
        return is_int($value) && $value >= 0 && $value <= 11;
    }

    private static function date(mixed $value): ?DateTimeImmutable
    {
        if (!is_string($value) || !preg_match('/^([1-9][0-9]{3})-([0-9]{2})-([0-9]{2})$/D', $value, $parts)
            || !checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) return null;
        return new DateTimeImmutable($value, new DateTimeZone('Asia/Kathmandu'));
    }
}
