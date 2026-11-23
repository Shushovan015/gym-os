<?php
declare(strict_types=1);

final class TrainersContent
{
    private const PROFILE_TEXT = ['name', 'role', 'bio', 'long_bio', 'coaching_style', 'availability', 'image', 'intro_video_url', 'intro_video_thumb'];
    private const PROFILE_LISTS = ['specialties', 'certifications', 'achievements', 'session_focus'];
    private const PAGE_FIELDS = [
        'pt_badge', 'pt_title', 'pt_description', 'pt_cta_text', 'pt_cta_link', 'hero_badge', 'hero_title',
        'hero_description', 'hero_primary_cta_text', 'hero_primary_cta_link', 'hero_secondary_cta_text',
        'hero_secondary_cta_link', 'strength_section_title', 'equipment_section_title',
    ];

    public function __construct(private PDO $db)
    {
    }

    public function read(bool $editor): array
    {
        $json = $this->db->query('SELECT content FROM trainer_page_content WHERE id = 1')->fetchColumn();
        $filter = $editor ? '' : ' WHERE is_active = 1';
        $trainers = $this->rows('trainers', ['id', ...self::PROFILE_TEXT, ...self::PROFILE_LISTS, 'years_experience',
            'clients_coached', 'offers_personal_training', 'sort_order', 'is_active'], self::PROFILE_LISTS, $filter);
        $plans = $this->rows('personal_training_plans', ['id', 'name', 'details', 'points', 'sort_order', 'is_active'], ['points'], $filter);
        return ['ptContent' => $json === false ? null : json_decode($json, true, flags: JSON_THROW_ON_ERROR), 'trainers' => $trainers, 'plans' => $plans];
    }

    public function save(array $input, string $actor): array
    {
        $action = $input['action'] ?? null;
        $id = $input['id'] ?? null;
        $item = $input['item'] ?? null;
        $table = null;
        $images = [];
        if ($id !== null && (!is_int($id) || $id < 1)) return [422, ['error' => 'Invalid trainer or plan ID.']];

        if ($action === 'content') {
            $page = self::page($input['content'] ?? null);
            if ($page === null) return [422, ['error' => 'Enter valid trainer page content, links and spotlight settings.']];
            $sql = 'INSERT INTO trainer_page_content (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)';
            $parameters = [json_encode($page, JSON_THROW_ON_ERROR)];
        } else {
            $entity = $input['entity'] ?? null;
            $table = match ($entity) {
                'trainer' => 'trainers',
                'plan' => 'personal_training_plans',
                default => null,
            };
            if ($table === null) return [422, ['error' => 'Choose a trainer or personal-training plan.']];
            if ($action === 'delete' && $id !== null) {
                $sql = "DELETE FROM $table WHERE id = ?";
                $parameters = [$id];
            } elseif ($action === 'item') {
                $values = $entity === 'trainer' ? self::trainer($item) : self::plan($item);
                if ($values === null) return [422, ['error' => 'Enter valid trainer or personal-training plan fields.']];
                if ($entity === 'trainer') $images = [$values['image'], $values['intro_video_thumb']];
                $columns = array_keys($values);
                $parameters = array_values($values);
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
                return [422, ['error' => 'Invalid trainer page action.']];
            }
        }

        $this->db->beginTransaction();
        try {
            $media = new ProductMedia($this->db);
            sort($images, SORT_STRING);
            foreach ($images as $image) {
                if (!$media->validateReference($image)) {
                    $this->db->rollBack();
                    return [422, ['error' => 'Choose a valid trainer photo or video thumbnail.']];
                }
            }
            if ($table !== null && $id !== null) {
                $record = $this->db->prepare("SELECT id FROM $table WHERE id = ? FOR UPDATE");
                $record->execute([$id]);
                if ($record->fetchColumn() === false) {
                    $this->db->rollBack();
                    return [404, ['error' => 'Trainer or plan not found.']];
                }
            }
            $this->db->prepare($sql)->execute($parameters);
            audit($this->db, 'studio.trainers.' . $action, $actor);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
        return [200, ['saved' => true]];
    }

    private function rows(string $table, array $fields, array $jsonFields, string $filter): array
    {
        $columns = implode(', ', $fields);
        $rows = $this->db->query("SELECT $columns FROM $table$filter ORDER BY sort_order, id")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            foreach ($jsonFields as $field) $row[$field] = json_decode($row[$field], true, flags: JSON_THROW_ON_ERROR);
            $row['is_active'] = (bool) $row['is_active'];
            if (isset($row['offers_personal_training'])) $row['offers_personal_training'] = (bool) $row['offers_personal_training'];
        }
        return $rows;
    }

    private static function orderedItem(mixed $item, array $fields, array $listFields): ?array
    {
        $result = WebsiteContentFields::text($item, $fields, 4000);
        $sort = $item['sort_order'] ?? null;
        $active = $item['is_active'] ?? null;
        if ($result === null || trim($result['name']) === '' || !is_int($sort)
            || $sort < -2147483648 || $sort > 2147483647 || !is_bool($active)) return null;
        foreach ($listFields as $field) {
            $values = $item[$field] ?? null;
            if (!is_array($values) || !array_is_list($values) || count($values) > 50) return null;
            foreach ($values as $value) {
                if (!is_string($value) || strlen($value) > 1000) return null;
            }
            $result[$field] = json_encode($values, JSON_THROW_ON_ERROR);
        }
        return $result + ['sort_order' => $sort, 'is_active' => (int) $active];
    }

    private static function trainer(mixed $item): ?array
    {
        $result = self::orderedItem($item, self::PROFILE_TEXT, self::PROFILE_LISTS);
        $experience = $item['years_experience'] ?? null;
        $clients = $item['clients_coached'] ?? null;
        $offers = $item['offers_personal_training'] ?? null;
        if ($result === null || trim($result['role']) === '' || !is_int($experience) || $experience < 0 || $experience > 2147483647
            || !is_int($clients) || $clients < 0 || $clients > 2147483647 || !is_bool($offers)
            || !WebsiteContentFields::validLink($result['intro_video_url'])) return null;
        return $result + ['years_experience' => $experience, 'clients_coached' => $clients, 'offers_personal_training' => (int) $offers];
    }

    private static function plan(mixed $item): ?array
    {
        return self::orderedItem($item, ['name', 'details'], ['points']);
    }

    private static function page(mixed $input): ?array
    {
        $data = WebsiteContentFields::text($input, self::PAGE_FIELDS, 4000);
        $spotlight = $input['spotlight_count'] ?? null;
        if ($data === null || !is_int($spotlight) || $spotlight < 1 || $spotlight > 2147483647) return null;
        foreach ($data as $field => $text) {
            if (str_ends_with($field, '_link') && !WebsiteContentFields::validLink($text)) return null;
        }
        $data['spotlight_count'] = $spotlight;
        foreach (['strength_metrics' => ['label', 'value', 'sub', 'icon'], 'equipment_zones' => ['title', 'desc', 'icon']] as $key => $fields) {
            $values = $input[$key] ?? null;
            if (!is_array($values) || !array_is_list($values) || count($values) > 50) return null;
            $data[$key] = [];
            foreach ($values as $value) {
                $text = WebsiteContentFields::text($value, $fields, 2000);
                if ($text === null) return null;
                $data[$key][] = $text;
            }
        }
        return $data;
    }
}
