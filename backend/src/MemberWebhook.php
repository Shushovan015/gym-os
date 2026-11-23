<?php
declare(strict_types=1);

final class MemberWebhook
{
    private static function config(): ?array
    {
        $url = getenv('GYM_MEMBERS_WEBHOOK_URL');
        $secret = getenv('GYM_MEMBERS_WEBHOOK_SECRET') ?: '';
        if (!$url || !filter_var($url, FILTER_VALIDATE_URL) || preg_match('/[\x00-\x20\x7f]/', $secret) || !ini_get('allow_url_fopen')) return null;
        $parts = parse_url($url);
        if (!$parts || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])) return null;
        $test = PHP_SAPI === 'cli-server' && getenv('GYM_AUTH_TEST') === '1'
            && $parts['scheme'] === 'http' && $parts['host'] === '127.0.0.1';
        if (!$test && ($parts['scheme'] !== 'https' || !extension_loaded('openssl'))) return null;
        return [$url, $secret];
    }

    public static function configured(): bool
    {
        return self::config() !== null;
    }

    public static function notify(string $event, string $source, array $ids): string
    {
        $config = self::config();
        if ($config === null) return 'unconfigured';
        [$url, $secret] = $config;
        $headers = ['Content-Type: application/json'];
        if ($secret !== '') $headers[] = 'x-gym-secret: ' . $secret;
        $body = json_encode(['event_type' => $event, 'source' => $source, 'member_ids' => $ids,
            'count' => count($ids), 'occurred_at' => gmdate(DATE_ATOM)], JSON_THROW_ON_ERROR);
        $context = stream_context_create(['http' => ['method' => 'POST', 'header' => $headers, 'content' => $body,
            'timeout' => 3, 'follow_location' => 0, 'ignore_errors' => true]]);
        $response = @fopen($url, 'rb', false, $context);
        if ($response === false) return 'failed';
        fclose($response);
        return preg_match('/^HTTP\/\S+ 2[0-9]{2}\b/', $http_response_header[0] ?? '') ? 'delivered' : 'failed';
    }
}
