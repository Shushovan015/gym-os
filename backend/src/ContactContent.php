<?php
declare(strict_types=1);

final class ContactContent
{
    private const FIELDS = [
        'hero_badge', 'hero_title', 'hero_description', 'hero_image', 'cta_primary_text', 'cta_primary_link',
        'cta_secondary_text', 'cta_secondary_link', 'phone', 'email', 'hours', 'location', 'map_embed_url',
        'visit_text', 'form_note', 'info_title', 'info_description', 'form_title', 'form_description',
        'form_button_text', 'faq_title', 'faq_description', 'bottom_cta_title', 'bottom_cta_description',
        'bottom_primary_cta_text', 'bottom_primary_cta_link', 'bottom_secondary_cta_text', 'bottom_secondary_cta_link',
    ];

    public function __construct(private PDO $db)
    {
    }

    public function read(bool $includeInactive): array
    {
        $json = $this->db->query('SELECT content FROM contact_content WHERE id = 1')->fetchColumn();
        $filter = $includeInactive ? '' : ' WHERE is_active = 1';
        $faqs = $this->db->query('SELECT id, question, answer, sort_order, is_active FROM contact_faqs'
            . $filter . ' ORDER BY sort_order, id')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($faqs as &$faq) $faq['is_active'] = (bool) $faq['is_active'];
        return ['content' => $json === false ? null : json_decode($json, true, flags: JSON_THROW_ON_ERROR), 'faqs' => $faqs];
    }

    public function save(array $input, string $actor): array
    {
        $action = $input['action'] ?? null;
        $id = $input['id'] ?? null;
        if ($id !== null && (!is_int($id) || $id < 1)) return [422, ['error' => 'Invalid FAQ ID.']];

        if ($action === 'content') {
            $data = self::fields($input['content'] ?? null, self::FIELDS, 4000);
            $cards = $input['content']['summary_cards'] ?? null;
            if ($data === null || !is_array($cards) || !array_is_list($cards) || count($cards) > 30) {
                return [422, ['error' => 'Invalid contact content or summary cards.']];
            }
            foreach ($data as $key => $value) {
                if (($key === 'hero_image' || $key === 'map_embed_url' || str_ends_with($key, '_link'))
                    && !self::validLink($value, $key === 'map_embed_url')) {
                    return [422, ['error' => 'Use a valid contact link or image URL and an HTTPS map embed.']];
                }
            }
            $data['summary_cards'] = [];
            foreach ($cards as $card) {
                $card = self::fields($card, ['label', 'value', 'icon'], 500);
                if ($card === null) return [422, ['error' => 'Invalid contact summary card.']];
                $data['summary_cards'][] = $card;
            }
            $sql = 'INSERT INTO contact_content (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)';
            $parameters = [json_encode($data, JSON_THROW_ON_ERROR)];
        } elseif ($action === 'faq') {
            $faq = $input['faq'] ?? null;
            $text = self::fields($faq, ['question', 'answer'], 4000);
            $sort = $faq['sort_order'] ?? null;
            $active = $faq['is_active'] ?? null;
            if ($text === null || trim($text['question']) === '' || strlen($text['question']) > 500
                || trim($text['answer']) === '' || !is_int($sort) || $sort < -2147483648 || $sort > 2147483647 || !is_bool($active)) {
                return [422, ['error' => 'Enter a question, answer and valid FAQ order.']];
            }
            $parameters = [$text['question'], $text['answer'], $sort, (int) $active];
            $sql = 'INSERT INTO contact_faqs (question, answer, sort_order, is_active) VALUES (?, ?, ?, ?)';
            if ($id !== null) {
                $sql = 'UPDATE contact_faqs SET question = ?, answer = ?, sort_order = ?, is_active = ? WHERE id = ?';
                $parameters[] = $id;
            }
        } elseif ($action === 'delete-faq' && $id !== null) {
            $sql = 'DELETE FROM contact_faqs WHERE id = ?';
            $parameters = [$id];
        } else {
            return [422, ['error' => 'Invalid contact action.']];
        }

        $this->db->beginTransaction();
        try {
            if ($id !== null && $action !== 'content') {
                $record = $this->db->prepare('SELECT id FROM contact_faqs WHERE id = ? FOR UPDATE');
                $record->execute([$id]);
                if ($record->fetchColumn() === false) {
                    $this->db->rollBack();
                    return [404, ['error' => 'FAQ not found.']];
                }
            }
            $this->db->prepare($sql)->execute($parameters);
            audit($this->db, 'studio.contact.' . $action, $actor);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
        return [200, ['saved' => true]];
    }

    private static function fields(mixed $input, array $keys, int $maxBytes): ?array
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

    private static function validLink(string $value, bool $isEmbed): bool
    {
        if ($value === '') return true;
        if (preg_match('/[\x00-\x20\x7f]/', $value) || str_contains($value, chr(92))) return false;
        if (!$isEmbed && preg_match('~^(/[A-Za-z0-9_?\#-]|/$|\#|mailto:|tel:)~i', $value)) return true;
        $url = parse_url($value);
        return is_array($url) && isset($url['host']) && !isset($url['user']) && !isset($url['pass'])
            && in_array(strtolower($url['scheme'] ?? ''), $isEmbed ? ['https'] : ['http', 'https'], true);
    }
}
