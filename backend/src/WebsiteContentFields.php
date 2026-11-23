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

    public static function pageWithSummary(mixed $input, array $fields): ?array
    {
        $data = self::text($input, $fields, 4000);
        if ($data === null) return null;
        foreach ($data as $field => $value) {
            if (str_ends_with($field, '_link') && !self::validLink($value)) return null;
        }
        $cards = $input['summary_cards'] ?? null;
        if (!is_array($cards) || !array_is_list($cards) || count($cards) > 30) return null;
        $data['summary_cards'] = [];
        foreach ($cards as $card) {
            $text = self::text($card, ['label', 'value', 'icon'], 500);
            if ($text === null) return null;
            $data['summary_cards'][] = $text;
        }
        return $data;
    }
}
