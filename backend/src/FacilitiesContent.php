<?php
declare(strict_types=1);

final class FacilitiesContent
{
    private const PAGE_FIELDS = [
        'hero_badge', 'hero_title', 'hero_description', 'hero_primary_cta_text', 'hero_primary_cta_link',
        'hero_secondary_cta_text', 'hero_secondary_cta_link', 'zone_explorer_title', 'zone_explorer_description',
        'amenities_title', 'amenities_description', 'tour_title', 'tour_description', 'tour_primary_cta_text',
        'tour_primary_cta_link', 'tour_secondary_cta_text', 'tour_secondary_cta_link',
    ];

    public function __construct(private PDO $db)
    {
    }

    public function read(bool $editor): array
    {
        $json = $this->db->query('SELECT content FROM facilities_page_content WHERE id = 1')->fetchColumn();
        $filter = $editor ? '' : ' WHERE is_active = 1';
        $items = $this->db->query("SELECT id, kind, title, description, tag, image, sort_order, is_active
            FROM facility_items$filter ORDER BY kind, sort_order, id")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($items as &$item) $item['is_active'] = (bool) $item['is_active'];
        return ['content' => $json === false ? null : json_decode($json, true, flags: JSON_THROW_ON_ERROR), 'items' => $items];
    }

    public function save(array $input, string $actor): array
    {
        $action = $input['action'] ?? null;
        $id = $input['id'] ?? null;
        $image = null;
        if ($id !== null && (!is_int($id) || $id < 1)) return [422, ['error' => 'Invalid facility ID.']];
        if ($action === 'content') {
            $content = self::content($input['content'] ?? null);
            if ($content === null) return [422, ['error' => 'Enter valid facilities content, links and summary cards.']];
            $sql = 'INSERT INTO facilities_page_content (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)';
            $parameters = [json_encode($content, JSON_THROW_ON_ERROR)];
        } elseif ($action === 'item') {
            $item = $input['item'] ?? null;
            $data = WebsiteContentFields::text($item, ['kind', 'title', 'description', 'tag', 'image'], 4000);
            $sort = $item['sort_order'] ?? null;
            $active = $item['is_active'] ?? null;
            if ($data === null || !in_array($data['kind'], ['zone', 'amenity'], true) || trim($data['title']) === ''
                || !is_int($sort) || $sort < -2147483648 || $sort > 2147483647 || !is_bool($active)) {
                return [422, ['error' => 'Enter a facility type, title, order and visibility.']];
            }
            if ($data['kind'] === 'amenity') {
                $data['description'] = $data['tag'] = $data['image'] = '';
            }
            $image = $data['image'];
            $parameters = [...array_values($data), $sort, (int) $active];
            if ($id === null) {
                $sql = 'INSERT INTO facility_items (kind, title, description, tag, image, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)';
            } else {
                $sql = 'UPDATE facility_items SET kind = ?, title = ?, description = ?, tag = ?, image = ?, sort_order = ?, is_active = ? WHERE id = ?';
                $parameters[] = $id;
            }
        } elseif ($action === 'delete' && $id !== null) {
            $sql = 'DELETE FROM facility_items WHERE id = ?';
            $parameters = [$id];
        } else {
            return [422, ['error' => 'Invalid facilities action.']];
        }

        $this->db->beginTransaction();
        try {
            if ($image !== null && !(new ProductMedia($this->db))->validateReference($image)) {
                $this->db->rollBack();
                return [422, ['error' => 'Choose a valid facility image.']];
            }
            if ($id !== null && $action !== 'content') {
                $record = $this->db->prepare('SELECT id FROM facility_items WHERE id = ? FOR UPDATE');
                $record->execute([$id]);
                if ($record->fetchColumn() === false) {
                    $this->db->rollBack();
                    return [404, ['error' => 'Facility item not found.']];
                }
            }
            $this->db->prepare($sql)->execute($parameters);
            audit($this->db, 'studio.facilities.' . $action, $actor);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
        return [200, ['saved' => true]];
    }

    private static function content(mixed $input): ?array
    {
        $data = WebsiteContentFields::text($input, self::PAGE_FIELDS, 4000);
        if ($data === null) return null;
        foreach ($data as $field => $value) {
            if (str_ends_with($field, '_link') && !WebsiteContentFields::validLink($value)) return null;
        }
        $cards = $input['summary_cards'] ?? null;
        if (!is_array($cards) || !array_is_list($cards) || count($cards) > 30) return null;
        $data['summary_cards'] = [];
        foreach ($cards as $card) {
            $text = WebsiteContentFields::text($card, ['label', 'value', 'icon'], 500);
            if ($text === null) return null;
            $data['summary_cards'][] = $text;
        }
        return $data;
    }
}
