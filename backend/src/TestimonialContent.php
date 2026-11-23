<?php
declare(strict_types=1);

final class TestimonialContent
{
    public function __construct(private PDO $db)
    {
    }

    public function read(bool $editor): array
    {
        $filter = $editor ? '' : ' WHERE is_active = 1';
        $rows = $this->db->query("SELECT id, name, goal, quote, image, sort_order, is_active
            FROM testimonials$filter ORDER BY sort_order, id")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) $row['is_active'] = (bool) $row['is_active'];
        return $rows;
    }

    public function save(array $input, string $actor): array
    {
        $action = $input['action'] ?? null;
        $id = $input['id'] ?? null;
        $image = null;
        if ($id !== null && (!is_int($id) || $id < 1)) return [422, ['error' => 'Invalid testimonial ID.']];
        if ($action === 'item') {
            $item = $input['item'] ?? null;
            $fields = WebsiteContentFields::text($item, ['name', 'goal', 'quote', 'image'], 4000);
            $sort = $item['sort_order'] ?? null;
            $active = $item['is_active'] ?? null;
            if ($fields === null || trim($fields['name']) === '' || trim($fields['goal']) === '' || trim($fields['quote']) === ''
                || !is_int($sort) || $sort < -2147483648 || $sort > 2147483647 || !is_bool($active)) {
                return [422, ['error' => 'Enter a testimonial name, goal, quote, order and visibility.']];
            }
            $image = $fields['image'];
            $parameters = [...array_values($fields), $sort, (int) $active];
            if ($id === null) {
                $sql = 'INSERT INTO testimonials (name, goal, quote, image, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)';
            } else {
                $sql = 'UPDATE testimonials SET name = ?, goal = ?, quote = ?, image = ?, sort_order = ?, is_active = ? WHERE id = ?';
                $parameters[] = $id;
            }
        } elseif ($action === 'delete' && $id !== null) {
            $sql = 'DELETE FROM testimonials WHERE id = ?';
            $parameters = [$id];
        } else {
            return [422, ['error' => 'Invalid testimonial action.']];
        }

        $this->db->beginTransaction();
        try {
            if ($image !== null && !(new ProductMedia($this->db))->validateReference($image)) {
                $this->db->rollBack();
                return [422, ['error' => 'Choose a valid testimonial image.']];
            }
            if ($id !== null) {
                $record = $this->db->prepare('SELECT id FROM testimonials WHERE id = ? FOR UPDATE');
                $record->execute([$id]);
                if ($record->fetchColumn() === false) {
                    $this->db->rollBack();
                    return [404, ['error' => 'Testimonial not found.']];
                }
            }
            $this->db->prepare($sql)->execute($parameters);
            audit($this->db, 'studio.testimonials.' . $action, $actor);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
        return [200, ['saved' => true]];
    }
}
