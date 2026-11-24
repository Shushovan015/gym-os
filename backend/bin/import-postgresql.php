<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(2);
require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/GymSchema.php';
require __DIR__ . '/../src/GymReconciliation.php';
require __DIR__ . '/../src/PostgresImport.php';

$mode = $argv[1] ?? '';
$file = $argv[2] ?? '';
$digest = $argv[3] ?? '';
if ($argc !== 4 || !in_array($mode, ['plan', 'apply'], true) || !preg_match('/^[a-f0-9]{64}$/D', $digest)
    || !is_file($file) || is_link($file)) {
    fwrite(STDERR, "Usage: php import-postgresql.php plan|apply EXPORT.ndjson VERIFIED_SHA256\n");
    exit(2);
}
try {
    if (!preg_match('/^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_migration_rehearsal;charset=utf8mb4$/D', getenv('GYM_DB_DSN') ?: '')) {
        throw new DomainException('Use the isolated loopback gym_migration_rehearsal database.');
    }
    $db = database();
    if ($db->query('SELECT DATABASE()')->fetchColumn() !== 'gym_migration_rehearsal') {
        throw new RuntimeException('Use an isolated database named gym_migration_rehearsal.');
    }
    $import = new PostgresImport($db);
    echo json_encode($import->run($file, $digest, $mode === 'apply'), JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, ($error instanceof DomainException ? $error->getMessage() : 'Import failed. Verify the input, target migrations and foreign keys.') . PHP_EOL);
    exit(1);
}
