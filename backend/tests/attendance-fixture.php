<?php
declare(strict_types=1);

require __DIR__ . '/../src/database.php';

if (PHP_SAPI !== 'cli' || !preg_match('/^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_migration_test;charset=utf8mb4$/D', getenv('GYM_DB_DSN') ?: '')) {
    exit(2);
}
$db = database();
$db->prepare("INSERT INTO members (member_id, full_name, phone, membership_type, membership_status, payment_status, is_active)
    VALUES (?, 'Test member', '', 'monthly', 'active', 'paid', 1)")->execute([bin2hex(random_bytes(16))]);
$id = (int) $db->lastInsertId();
$db->exec("INSERT INTO attendance_holidays (holiday_date, name) VALUES ('2024-03-01', 'Test holiday')
    ON DUPLICATE KEY UPDATE name = VALUES(name)");
echo $id;
