<?php
declare(strict_types=1);

final class FooterContent
{
    private const FIELDS = [
        'brand_name', 'location', 'banner_title', 'banner_subtitle', 'cta_text', 'cta_link',
        'about_text', 'hours_text', 'phone', 'email', 'copyright_text', 'bottom_tags',
    ];

    public function __construct(private PDO $db)
    {
    }

    public function read(): array
    {
        $json = $this->db->query('SELECT content FROM footer_content WHERE id = 1')->fetchColumn();
        return ['content' => $json === false ? null : json_decode($json, true, flags: JSON_THROW_ON_ERROR)];
    }

    public function save(array $input, string $actor): array
    {
        $data = WebsiteContentFields::text($input['content'] ?? null, self::FIELDS, 4000);
        if ($data === null || !WebsiteContentFields::validLink($data['cta_link'])) {
            return [422, ['error' => 'Enter valid footer content and a valid call-to-action link.']];
        }
        $this->db->beginTransaction();
        try {
            $this->db->prepare('INSERT INTO footer_content (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)')
                ->execute([json_encode($data, JSON_THROW_ON_ERROR)]);
            audit($this->db, 'studio.footer.save', $actor);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
        return [200, ['saved' => true]];
    }
}
