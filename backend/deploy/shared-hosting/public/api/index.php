<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');

function hostingUnavailable(): never
{
    error_log('Gym API private hosting configuration is unavailable.');
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo '{"error":"The gym API is unavailable."}';
    exit;
}

$documentRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '');
$fallback = dirname(__DIR__, 2) . '/gym-private/config.php';
$configuration = realpath(getenv('GYM_CONFIG_FILE') ?: $fallback);
if (!$documentRoot || !$configuration || !is_file($configuration) || !is_readable($configuration)) hostingUnavailable();

$normalize = static function (string $path): string {
    $path = rtrim(str_replace(chr(92), '/', $path), '/');
    return PHP_OS_FAMILY === 'Windows' ? strtolower($path) : $path;
};
$publicPath = $normalize($documentRoot) . '/';
if (str_starts_with($normalize($configuration), $publicPath)) hostingUnavailable();
$entry = realpath(dirname($configuration) . '/backend/public/index.php');
if (!$entry || !is_file($entry) || str_starts_with($normalize($entry), $publicPath)) hostingUnavailable();

try {
    $values = require $configuration;
    $allowed = ['GYM_DB_DSN', 'GYM_DB_USER', 'GYM_DB_PASSWORD', 'GYM_PRIVATE_MEDIA_DIR', 'GYM_PRODUCT_MEDIA_DIR',
        'GYM_BACKUP_DIR', 'GYM_SMTP_HOST', 'GYM_SMTP_PORT', 'GYM_SMTP_ENCRYPTION', 'GYM_SMTP_FROM',
        'GYM_SMTP_USER', 'GYM_SMTP_PASSWORD', 'GYM_MEMBERS_WEBHOOK_URL', 'GYM_MEMBERS_WEBHOOK_SECRET'];
    if (!is_array($values) || !function_exists('putenv')) hostingUnavailable();
    foreach ($values as $name => $value) {
        if (!in_array($name, $allowed, true) || !is_string($value) || str_contains($value, chr(0))
            || !putenv($name . '=' . $value)) hostingUnavailable();
    }
} catch (Throwable) {
    hostingUnavailable();
}
require $entry;
