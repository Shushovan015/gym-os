<?php
declare(strict_types=1);

final class PricingContent
{
    private const PAGE_FIELDS = [
        'hero_badge', 'hero_title', 'hero_description', 'hero_primary_cta_text', 'hero_primary_cta_link',
        'hero_secondary_cta_text', 'hero_secondary_cta_link', 'benefits_title', 'benefits_description',
        'advisor_title', 'advisor_description', 'advisor_cta_text', 'advisor_cta_link', 'popular_badge_text',
        'bottom_cta_title', 'bottom_cta_description', 'bottom_primary_cta_text', 'bottom_primary_cta_link',
        'bottom_secondary_cta_text', 'bottom_secondary_cta_link',
    ];

    public function __construct(private PDO $db)
    {
    }

    public function read(bool $editor): array
    {
        $json = $this->db->query('SELECT content FROM pricing_page_content WHERE id = 1')->fetchColumn();
        $filter = $editor ? '' : ' WHERE is_active = 1';
        $items = $this->db->query("SELECT id, kind, title, price, cadence, subtitle, is_highlighted, features, sort_order, is_active
            FROM pricing_items$filter ORDER BY sort_order, id")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($items as &$item) {
            $item['features'] = json_decode($item['features'], true, flags: JSON_THROW_ON_ERROR);
            $item['is_active'] = (bool) $item['is_active'];
            $item['is_highlighted'] = (bool) $item['is_highlighted'];
        }
        return ['content' => $json === false ? null : json_decode($json, true, flags: JSON_THROW_ON_ERROR), 'items' => $items];
    }

    public function save(array $input, string $actor): array
    {
        $action = $input['action'] ?? null;
        $id = $input['id'] ?? null;
        if ($id !== null && (!is_int($id) || $id < 1)) return [422, ['error' => 'Invalid pricing item ID.']];
        if ($action === 'content') {
            $content = WebsiteContentFields::pageWithSummary($input['content'] ?? null, self::PAGE_FIELDS);
            if ($content === null) return [422, ['error' => 'Enter valid pricing content, links and summary cards.']];
            $sql = 'INSERT INTO pricing_page_content (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)';
            $parameters = [json_encode($content, JSON_THROW_ON_ERROR)];
        } elseif ($action === 'item') {
            $item = $input['item'] ?? null;
            $data = WebsiteContentFields::text($item, ['kind', 'title', 'price', 'cadence', 'subtitle'], 4000);
            $sort = $item['sort_order'] ?? null;
            $active = $item['is_active'] ?? null;
            $highlight = $item['is_highlighted'] ?? null;
            $features = $item['features'] ?? null;
            if ($data === null || !in_array($data['kind'], ['plan', 'perk'], true) || trim($data['title']) === ''
                || !is_int($sort) || $sort < -2147483648 || $sort > 2147483647 || !is_bool($active) || !is_bool($highlight)
                || !is_array($features) || !array_is_list($features) || count($features) > 50) {
                return [422, ['error' => 'Enter a pricing type, title, order, visibility and valid features.']];
            }
            foreach ($features as $feature) {
                if (!is_string($feature) || strlen($feature) > 1000) return [422, ['error' => 'Enter valid plan features.']];
            }
            if ($data['kind'] === 'perk') {
                $data['price'] = $data['cadence'] = $data['subtitle'] = '';
                $highlight = false;
                $features = [];
            }
            $parameters = [...array_values($data), (int) $highlight, json_encode($features, JSON_THROW_ON_ERROR), $sort, (int) $active];
            if ($id === null) {
                $sql = 'INSERT INTO pricing_items (kind, title, price, cadence, subtitle, is_highlighted, features, sort_order, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            } else {
                $sql = 'UPDATE pricing_items SET kind = ?, title = ?, price = ?, cadence = ?, subtitle = ?, is_highlighted = ?,
                    features = ?, sort_order = ?, is_active = ? WHERE id = ?';
                $parameters[] = $id;
            }
        } elseif ($action === 'delete' && $id !== null) {
            $sql = 'DELETE FROM pricing_items WHERE id = ?';
            $parameters = [$id];
        } else {
            return [422, ['error' => 'Invalid pricing action.']];
        }

        $this->db->beginTransaction();
        try {
            if ($id !== null && $action !== 'content') {
                $record = $this->db->prepare('SELECT id FROM pricing_items WHERE id = ? FOR UPDATE');
                $record->execute([$id]);
                if ($record->fetchColumn() === false) {
                    $this->db->rollBack();
                    return [404, ['error' => 'Pricing item not found.']];
                }
            }
            $this->db->prepare($sql)->execute($parameters);
            audit($this->db, 'studio.pricing.' . $action, $actor);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
        return [200, ['saved' => true]];
    }
}
