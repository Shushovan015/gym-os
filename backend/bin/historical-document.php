<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(2);
require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/HistoricalDocuments.php';

$owner = $argv[1] ?? '';
$id = filter_var($argv[2] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$digest = $argv[4] ?? '';
if ($argc !== 5 || !in_array($owner, ['member', 'invoice'], true) || !$id || !preg_match('/^[a-f0-9]{64}$/D', $digest)
    || !preg_match('/^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_migration_rehearsal;charset=utf8mb4$/D', getenv('GYM_DB_DSN') ?: '')) {
    fwrite(STDERR, "Usage on the isolated rehearsal database: php historical-document.php member|invoice ID LOCAL_PDF VERIFIED_SHA256\n");
    exit(2);
}
try {
    $key = (new HistoricalDocuments(database()))->import($owner, $id, $argv[3], $digest);
    echo '/api/admin/historical-document?key=' . $key, PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, ($error instanceof DomainException ? $error->getMessage() : 'Could not store the document.') . PHP_EOL);
    exit(1);
}
