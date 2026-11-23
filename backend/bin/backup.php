<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(2);

require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/GymSchema.php';
require __DIR__ . '/../src/GymBackup.php';

$action = $argv[1] ?? '';
if (!in_array($action, ['create', 'check', 'restore'], true) || $argc !== ['create' => 2, 'check' => 3, 'restore' => 4][$action]) {
    fwrite(STDERR, "Usage: php backup.php create | check ARCHIVE | restore ARCHIVE EMPTY_TARGET_DATABASE\n");
    exit(2);
}
ini_set('display_errors', '0');
set_error_handler(static function (int $severity): bool {
    if (error_reporting() & $severity) throw new RuntimeException('A backup file operation failed.');
    return true;
});
try {
    $backup = new GymBackup(database(), getenv('GYM_BACKUP_PASSWORD') ?: '');
    $result = match ($action) {
        'create' => ['archive' => $backup->create()],
        'check' => $backup->check($argv[2]),
        'restore' => $backup->restore($argv[2], $argv[3]),
    };
    echo json_encode($result, JSON_THROW_ON_ERROR), PHP_EOL;
} catch (PDOException | JsonException) {
    fwrite(STDERR, "The backup or restore failed during database or archive validation. Check the target schema and archive.\n");
    exit(1);
} catch (RuntimeException $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
