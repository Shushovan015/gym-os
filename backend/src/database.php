<?php
declare(strict_types=1);

function database(?string $configPath = null): PDO
{
    $dsn = getenv('GYM_DB_DSN');
    $user = getenv('GYM_DB_USER');
    $password = getenv('GYM_DB_PASSWORD');
    if ($configPath !== null) {
        if (!is_file($configPath) || !is_readable($configPath)) {
            throw new RuntimeException('The private CLI configuration is unreadable.');
        }
        $config = require $configPath;
        if (!is_array($config)) {
            throw new RuntimeException('The private CLI configuration is invalid.');
        }
        $dsn = $config['GYM_DB_DSN'] ?? null;
        $user = $config['GYM_DB_USER'] ?? null;
        $password = $config['GYM_DB_PASSWORD'] ?? null;
    }
    if (!is_string($dsn) || !str_starts_with($dsn, 'mysql:') || !is_string($user) || $user === '' || !is_string($password)) {
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
