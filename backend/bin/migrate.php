<?php
declare(strict_types=1);

require __DIR__ . '/../src/database.php';

if (PHP_SAPI !== 'cli') {
    exit(1);
}

$mode = $argv[1] ?? '';
if (!in_array($mode, ['apply', 'verify'], true)) {
    fwrite(STDERR, "Usage: php backend/bin/migrate.php apply|verify\n");
    exit(2);
}

$db = database();
if ($mode === 'apply') {
    $db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB');
}
$lock = $db->query("SELECT GET_LOCK(CONCAT('gym-schema-', MD5(DATABASE())), 10)")->fetchColumn();
if ((int) $lock !== 1) {
    throw new RuntimeException('Could not lock the schema.');
}

$lookup = $db->prepare('SELECT checksum FROM schema_migrations WHERE version = ?');
$record = $db->prepare('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)');
foreach (glob(__DIR__ . '/../database/migrations/*.sql') as $path) {
    $version = basename($path);
    $sql = file_get_contents($path);
    if ($sql === false) {
        throw new RuntimeException('Could not read ' . $version);
    }
    $checksum = hash('sha256', str_replace("\r\n", "\n", $sql));
    $lookup->execute([$version]);
    $known = $lookup->fetchColumn();
    if ($known !== false && !hash_equals($known, $checksum)) {
        throw new RuntimeException('Migration checksum differs for ' . $version);
    }
    if ($known !== false) {
        continue;
    }
    if ($mode === 'verify') {
        throw new RuntimeException('Pending migration ' . $version);
    }
    // Migration files contain flat DDL statements. Use rerunnable DDL because MySQL commits schema changes implicitly.
    foreach (explode(';', $sql) as $statement) {
        if (trim($statement) !== '') {
            $db->exec($statement);
        }
    }
    $record->execute([$version, $checksum]);
}
$tables = [
    'schema_migrations', 'admin_accounts', 'login_limits', 'audit_events',
    'members', 'member_status_history', 'attendance_holidays', 'attendance_holiday_templates',
    'attendance_records', 'admin_settings', 'member_write_lock',
];
$engine = $db->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
foreach ($tables as $table) {
    $engine->execute([$table]);
    if ($engine->fetchColumn() !== 'InnoDB') {
        throw new RuntimeException("InnoDB table missing or invalid: $table");
    }
}
$foreignKeys = $db->query("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'members' AND REFERENCED_COLUMN_NAME = 'id'")
    ->fetchAll(PDO::FETCH_KEY_PAIR);
if (($foreignKeys['attendance_records'] ?? null) !== 'member_ref' ||
    ($foreignKeys['member_status_history'] ?? null) !== 'member_id') {
    throw new RuntimeException('Member foreign keys are missing.');
}
echo "Migration records, InnoDB tables and member foreign keys verified.\n";
