<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(2);

require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/GymReconciliation.php';

$mode = $argv[1] ?? '';
if (!in_array($mode, ['snapshot', 'review', 'compare'], true) || $argc !== ($mode === 'compare' ? 3 : 2)) {
    fwrite(STDERR, "Usage: php reconcile.php snapshot | review | compare EXPECTED_JSON\n");
    exit(2);
}
try {
    $db = database();
    $report = new GymReconciliation($db);
    $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $db->beginTransaction();
    $current = $mode === 'review' ? $report->review() : $report->snapshot();
    $db->rollBack();
    if ($mode === 'compare') {
        $expectedFile = $argv[2];
        if (!is_file($expectedFile) || filesize($expectedFile) > 32 * 1024 * 1024) {
            throw new RuntimeException('Use a reconciliation JSON file of at most 32 MiB.');
        }
        $expected = json_decode(file_get_contents($expectedFile), true, flags: JSON_THROW_ON_ERROR);
        if (!is_array($expected) || ($expected['version'] ?? null) !== 1) {
            throw new RuntimeException('The expected snapshot format is invalid.');
        }
        $differences = GymReconciliation::differences($expected, $current);
        echo json_encode(['match' => $differences === [], 'differences' => $differences], JSON_THROW_ON_ERROR), PHP_EOL;
        exit($differences === [] ? 0 : 1);
    }
    echo json_encode($current, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT), PHP_EOL;
} catch (PDOException | JsonException) {
    fwrite(STDERR, "Could not reconcile the configured database or read the expected JSON.\n");
    exit(1);
} catch (RuntimeException $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
