<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(2);
require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/PostgresImport.php';

$path = $argv[1] ?? '';
if ($argc !== 2 || !is_file($path) || is_link($path) || filesize($path) > 8 * 1024 * 1024) {
    fwrite(STDERR, "Usage: php postgresql-mapping.php PUBLIC_PG_DUMP_SCHEMA.sql\n");
    exit(2);
}
try {
    if (!preg_match('/^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_migration_rehearsal;charset=utf8mb4$/D', getenv('GYM_DB_DSN') ?: '')) {
        throw new DomainException('Use the isolated loopback rehearsal database.');
    }
    $sql = file_get_contents($path);
    preg_match_all('/^CREATE TABLE (?:IF NOT EXISTS )?"public"\."([a-z0-9_]+)" \(\R(.*?)^\);/ms', $sql, $tables, PREG_SET_ORDER);
    $fields = [];
    foreach ($tables as [, $table, $body]) {
        preg_match_all('/^\h+"([a-z0-9_]+)"\h+((?:"[a-z0-9_]+"\.)?"?[a-z][a-z0-9_ ]*?"?(?:\(\d+(?:,\s*\d+)?\))?(?:\[\])?)(?=\h+(?:NOT NULL|DEFAULT|COLLATE|GENERATED|CONSTRAINT)\b|\h*,?\h*$)/mi',
            $body, $columns, PREG_SET_ORDER);
        preg_match_all('/^\h+"[a-z0-9_]+"\h+/mi', $body, $declared);
        if (!$columns || count($columns) !== count($declared[0])) {
            throw new DomainException("The quoted pg_dump column format for $table needs review.");
        }
        $fields[$table] = array_column($columns, 2, 1);
    }
    if (!$fields) throw new DomainException('No tables found in the quoted public pg_dump schema.');
    preg_match_all('/^ALTER TABLE ONLY "public"\."([a-z0-9_]+)"\s+ADD CONSTRAINT "[a-z0-9_]+" FOREIGN KEY \(([^\r\n]+?)\) REFERENCES "(public|auth)"\."([a-z0-9_]+)"\(([^\r\n]+?)\)/m',
        $sql, $relations, PREG_SET_ORDER);
    $report = (new PostgresImport(database()))->schemaMapping($fields);
    $report['sourceSha256'] = hash('sha256', $sql);
    $report['sourceForeignKeys'] = array_map(static fn (array $row): array => [
        'table' => $row[1], 'columns' => str_replace('"', '', $row[2]), 'parentSchema' => $row[3],
        'parentTable' => $row[4], 'parentColumns' => str_replace('"', '', $row[5]),
    ], $relations);
    echo json_encode($report, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT), PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, ($error instanceof DomainException ? $error->getMessage() : 'Could not read schema metadata.') . PHP_EOL);
    exit(1);
}
