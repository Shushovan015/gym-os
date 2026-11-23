<?php
declare(strict_types=1);

final class ShopContent
{
    private const ITEM_TEXT = ['title', 'category', 'price', 'description', 'image', 'badge', 'inquire_link'];
    private const PAGE_FIELDS = [
        'hero_badge', 'hero_title', 'hero_description', 'hero_image', 'hero_primary_cta_text', 'hero_primary_cta_link',
        'hero_secondary_cta_text', 'hero_secondary_cta_link', 'catalog_title', 'catalog_description',
        'inquiry_button_text', 'inquiry_link_default', 'bottom_cta_title', 'bottom_cta_description',
        'bottom_primary_cta_text', 'bottom_primary_cta_link', 'bottom_secondary_cta_text', 'bottom_secondary_cta_link',
    ];

    public function __construct(private PDO $db)
    {
    }

    public function read(bool $editor): array
    {
        $json = $this->db->query('SELECT content FROM shop_page_content WHERE id = 1')->fetchColumn();
        $columns = 'p.id, p.title, p.category, p.price, p.description, p.image, p.badge, p.inquire_link, p.sort_order, p.is_featured, p.is_active';
        $sql = $editor
            ? "SELECT $columns FROM shop_items p ORDER BY p.category, p.sort_order, p.id"
            : "SELECT $columns, CASE
                WHEN p.inventory_enabled = 0 THEN 'not_tracked'
                WHEN COALESCE((SELECT SUM(v.current_quantity) FROM inventory_product_variants v
                    WHERE v.product_id = p.id AND v.is_active = 1), 0) <= 0 THEN 'out_of_stock'
                ELSE 'available'
            END AS availability FROM shop_items p WHERE p.is_active = 1 ORDER BY p.sort_order, p.id";
        $items = $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        foreach ($items as &$item) {
            $item['is_active'] = (bool) $item['is_active'];
            $item['is_featured'] = (bool) $item['is_featured'];
        }
        return ['content' => $json === false ? null : json_decode($json, true, flags: JSON_THROW_ON_ERROR), 'items' => $items];
    }

    public function save(array $input, string $actor): array
    {
        $action = $input['action'] ?? null;
        if ($action === 'item') {
            $item = $input['item'] ?? null;
            $data = WebsiteContentFields::text($item, self::ITEM_TEXT, 4000);
            if ($data === null || !WebsiteContentFields::validLink($data['inquire_link'])
                || !is_int($item['sort_order'] ?? null) || !is_bool($item['is_active'] ?? null)
                || !is_bool($item['is_featured'] ?? null)) return [422, ['error' => 'Enter valid product details and inquiry link.']];
            return (new Catalog($this->db))->save([
                'entity' => 'product', 'id' => $input['id'] ?? null,
                'fields' => $data + ['sort_order' => $item['sort_order'], 'is_active' => $item['is_active'], 'is_featured' => $item['is_featured']],
            ], $actor);
        }
        if ($action === 'delete') {
            [$status, $result] = (new Catalog($this->db))->delete(['entity' => 'product', 'id' => $input['id'] ?? null], $actor);
            if ($status === 409) return [409, ['error' => 'This product has linked inventory or billing records. Turn off public visibility to remove it from the shop.']];
            return [$status, $result];
        }
        if ($action !== 'content') return [422, ['error' => 'Invalid shop action.']];
        $content = WebsiteContentFields::pageWithSummary($input['content'] ?? null, self::PAGE_FIELDS);
        $pageSize = $input['content']['items_per_page'] ?? null;
        if ($content === null || !is_int($pageSize) || $pageSize < 1 || $pageSize > 2147483647
            || !WebsiteContentFields::validLink($content['hero_image']) || !WebsiteContentFields::validLink($content['inquiry_link_default'])) {
            return [422, ['error' => 'Enter valid shop page content, links and items per page.']];
        }
        $content['items_per_page'] = $pageSize;
        $this->db->beginTransaction();
        try {
            $this->db->prepare('INSERT INTO shop_page_content (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)')
                ->execute([json_encode($content, JSON_THROW_ON_ERROR)]);
            audit($this->db, 'studio.shop.content', $actor);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
        return [200, ['saved' => true]];
    }
}
