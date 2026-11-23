<?php
declare(strict_types=1);

final class WebsiteContentFields
{
    public static function text(mixed $input, array $keys, int $maxBytes): ?array
    {
        if (!is_array($input)) return null;
        $result = [];
        foreach ($keys as $key) {
            $value = $input[$key] ?? null;
            if (!is_string($value) || strlen($value) > $maxBytes) return null;
            $result[$key] = $value;
        }
        return $result;
    }

    public static function validLink(string $value, bool $isEmbed = false): bool
    {
        if ($value === '') return true;
        if (preg_match('/[\x00-\x20\x7f]/', $value) || str_contains($value, chr(92))) return false;
        if (!$isEmbed && preg_match('~^(/[A-Za-z0-9_?\#-]|/$|\#|mailto:|tel:)~i', $value)) return true;
        $url = parse_url($value);
        return is_array($url) && isset($url['host']) && !isset($url['user']) && !isset($url['pass'])
            && in_array(strtolower($url['scheme'] ?? ''), $isEmbed ? ['https'] : ['http', 'https'], true);
    }
}
