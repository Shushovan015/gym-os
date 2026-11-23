<?php
declare(strict_types=1);

// Copy to gym-private/config.php, set owner-only permissions and fill values on the server.
return [
    'GYM_DB_DSN' => 'mysql:host=localhost;dbname=ACCOUNT_gym;charset=utf8mb4',
    'GYM_DB_USER' => '',
    'GYM_DB_PASSWORD' => '',
    'GYM_PRIVATE_MEDIA_DIR' => '/absolute/private/path/member-media',
    'GYM_PRODUCT_MEDIA_DIR' => '/absolute/private/path/catalog-media',
    'GYM_BACKUP_DIR' => '/absolute/private/path/backups',
    'GYM_SMTP_HOST' => '',
    'GYM_SMTP_PORT' => '587',
    'GYM_SMTP_ENCRYPTION' => 'tls',
    'GYM_SMTP_FROM' => '',
    'GYM_SMTP_USER' => '',
    'GYM_SMTP_PASSWORD' => '',
    'GYM_MEMBERS_WEBHOOK_URL' => '',
    'GYM_MEMBERS_WEBHOOK_SECRET' => '',
];
