CREATE TABLE IF NOT EXISTS trainer_page_content (
    id TINYINT UNSIGNED PRIMARY KEY CHECK (id = 1),
    content JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE trainers
    ADD COLUMN IF NOT EXISTS long_bio TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS coaching_style TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS certifications JSON NOT NULL DEFAULT ('[]') CHECK (JSON_TYPE(certifications) = 'ARRAY'),
    ADD COLUMN IF NOT EXISTS achievements JSON NOT NULL DEFAULT ('[]') CHECK (JSON_TYPE(achievements) = 'ARRAY'),
    ADD COLUMN IF NOT EXISTS session_focus JSON NOT NULL DEFAULT ('[]') CHECK (JSON_TYPE(session_focus) = 'ARRAY'),
    ADD COLUMN IF NOT EXISTS intro_video_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS intro_video_thumb TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS clients_coached INT NOT NULL DEFAULT 0,
    ADD INDEX IF NOT EXISTS trainer_image (image(191), is_active),
    ADD INDEX IF NOT EXISTS trainer_video_thumbnail (intro_video_thumb(191), is_active);
