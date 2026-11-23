<?php
declare(strict_types=1);

final class HomeContent
{
    private const CONTENT_FIELDS = [
        'hero_badge', 'hero_title', 'hero_description', 'hero_image', 'hero_primary_cta_text',
        'hero_primary_cta_link', 'hero_secondary_cta_text', 'hero_secondary_cta_link',
        'status_title', 'zones_title', 'coaches_title', 'coaches_subtitle', 'maximus_badge',
        'maximus_title', 'maximus_description', 'maximus_image', 'maximus_learn_more_link',
        'maximus_instagram_link', 'gallery_title', 'testimonials_title', 'testimonials_subtitle',
        'final_cta_title', 'final_cta_description', 'final_primary_cta_text', 'final_primary_cta_link',
        'final_secondary_cta_text', 'final_secondary_cta_link',
    ];
    private const LISTS = [
        'status' => ['home_status_items', ['label', 'value']],
        'points' => ['home_maximus_points', ['point']],
    ];

    public function __construct(private PDO $db)
    {
    }

    public function read(bool $editor): array
    {
        $json = $this->db->query('SELECT content FROM home_content WHERE id = 1')->fetchColumn();
        $data = ['content' => $json === false ? null : json_decode($json, true, flags: JSON_THROW_ON_ERROR)];
        foreach (self::LISTS as $key => [$table, $fields]) {
            $columns = implode(', ', $fields);
            $filter = $editor ? '' : ' WHERE is_active = 1';
            $data[$key] = $this->rows("SELECT id, $columns, sort_order, is_active FROM $table$filter ORDER BY sort_order, id");
        }
        if (!$editor) {
            $data['statusConfigured'] = $data['status'] !== [] || (bool) $this->db->query('SELECT EXISTS(SELECT 1 FROM home_status_items)')->fetchColumn();
            $data['zones'] = $this->rows("SELECT id, kind, title, description, tag, image, sort_order, is_active
                FROM facility_items WHERE kind = 'zone' AND is_active = 1 ORDER BY sort_order, id LIMIT 3");
            $data['trainers'] = $this->rows('SELECT id, name, role, bio, image, specialties FROM trainers
                WHERE is_active = 1 ORDER BY sort_order, id LIMIT 3');
            foreach ($data['trainers'] as &$trainer) {
                $trainer['specialties'] = json_decode($trainer['specialties'], true, flags: JSON_THROW_ON_ERROR);
            }
            unset($trainer);
            $data['testimonials'] = (new TestimonialContent($this->db))->read(false);
        }
        return $data;
    }

    public function save(array $input, string $actor): array
    {
        $action = $input['action'] ?? null;
        $id = $input['id'] ?? null;
        $table = null;
        if ($id !== null && (!is_int($id) || $id < 1)) return [422, ['error' => 'Invalid homepage item ID.']];

        if ($action === 'content') {
            $data = self::content($input['content'] ?? null);
            if ($data === null) return [422, ['error' => 'Enter valid homepage text, image URLs and links.']];
            $sql = 'INSERT INTO home_content (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)';
            $parameters = [json_encode($data, JSON_THROW_ON_ERROR)];
        } else {
            $list = $input['list'] ?? null;
            if (!is_string($list) || !isset(self::LISTS[$list])) return [422, ['error' => 'Invalid homepage list.']];
            [$table, $fields] = self::LISTS[$list];
            if ($action === 'delete' && $id !== null) {
                $sql = "DELETE FROM $table WHERE id = ?";
                $parameters = [$id];
            } elseif ($action === 'item') {
                $item = $input['item'] ?? null;
                $text = WebsiteContentFields::text($item, $fields, 4000);
                $sort = $item['sort_order'] ?? null;
                $active = $item['is_active'] ?? null;
                if ($text === null || in_array('', array_map('trim', $text), true) || !is_bool($active)
                    || !is_int($sort) || $sort < -2147483648 || $sort > 2147483647) {
                    return [422, ['error' => 'Enter the required text, order and visibility.']];
                }
                $columns = [...$fields, 'sort_order', 'is_active'];
                $parameters = [...array_values($text), $sort, (int) $active];
                if ($id === null) {
                    $names = implode(', ', $columns);
                    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
                    $sql = "INSERT INTO $table ($names) VALUES ($placeholders)";
                } else {
                    $assignments = implode(' = ?, ', $columns) . ' = ?';
                    $sql = "UPDATE $table SET $assignments WHERE id = ?";
                    $parameters[] = $id;
                }
            } else {
                return [422, ['error' => 'Invalid homepage action.']];
            }
        }

        $this->db->beginTransaction();
        try {
            if ($table !== null && $id !== null) {
                $record = $this->db->prepare("SELECT id FROM $table WHERE id = ? FOR UPDATE");
                $record->execute([$id]);
                if ($record->fetchColumn() === false) {
                    $this->db->rollBack();
                    return [404, ['error' => 'Homepage item not found.']];
                }
            }
            $this->db->prepare($sql)->execute($parameters);
            audit($this->db, 'studio.home.' . $action, $actor);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
        return [200, ['saved' => true]];
    }

    private function rows(string $sql): array
    {
        $rows = $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            if (isset($row['is_active'])) $row['is_active'] = (bool) $row['is_active'];
        }
        return $rows;
    }

    private static function content(mixed $input): ?array
    {
        $data = WebsiteContentFields::text($input, self::CONTENT_FIELDS, 4000);
        if ($data === null) return null;
        foreach ($data as $key => $value) {
            if ((str_ends_with($key, '_image') || str_ends_with($key, '_link'))
                && !WebsiteContentFields::validLink($value)) return null;
        }
        foreach (['hero_metrics' => ['label', 'value', 'icon'], 'gallery_images' => ['url', 'alt']] as $key => $fields) {
            $entries = $input[$key] ?? null;
            if (!is_array($entries) || !array_is_list($entries) || count($entries) > 50) return null;
            $data[$key] = [];
            foreach ($entries as $entry) {
                $entry = WebsiteContentFields::text($entry, $fields, 2000);
                if ($entry === null || (isset($entry['url']) && ($entry['url'] === '' || !WebsiteContentFields::validLink($entry['url'])))) return null;
                $data[$key][] = $entry;
            }
        }
        return $data;
    }
}
