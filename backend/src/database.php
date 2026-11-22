<?php
declare(strict_types=1);

function database(): PDO
{
    $dsn = getenv('GYM_DB_DSN');
    $user = getenv('GYM_DB_USER');
    $password = getenv('GYM_DB_PASSWORD');
    if (!$dsn || !str_starts_with($dsn, 'mysql:') || !$user || $password === false) {
        throw new RuntimeException('Target database configuration is missing.');
    }
    $db = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_MULTI_STATEMENTS => false,
    ]);
    $db->exec("SET time_zone = '+00:00'");
    return $db;
}

function audit(PDO $db, string $action, ?string $actor): void
{
    $db->prepare('INSERT INTO audit_events (actor_id, action) VALUES (?, ?)')
        ->execute([$actor, $action]);
}
