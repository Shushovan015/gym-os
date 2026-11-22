<?php
declare(strict_types=1);

require __DIR__ . '/../src/database.php';

if (PHP_SAPI !== 'cli' || !preg_match('/^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_migration_test;charset=utf8mb4$/D', getenv('GYM_DB_DSN') ?: '')) {
    exit(2);
}
$member = filter_var($argv[1] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($member === false) {
    exit(2);
}
$db = database();
$insert = $db->prepare('INSERT INTO membership_fees (member_id, billing_month, amount_minor, status, paid_amount_minor, due_date)
    VALUES (?, ?, 50000, ?, ?, ?)');
$insert->execute([$member, '2024-01-01', 'paid', 50000, '2024-01-31']);
$insert->execute([$member, '2024-02-01', 'partial', 20000, '2024-02-29']);
$insert->execute([$member, '2024-03-01', 'unpaid', 0, '2024-03-31']);
