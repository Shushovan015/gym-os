<?php
declare(strict_types=1);

require __DIR__ . '/../src/database.php';

if (PHP_SAPI !== 'cli' || !preg_match('/^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_(backup|restore)_fixture;charset=utf8mb4$/D', getenv('GYM_DB_DSN') ?: '')) {
    exit(2);
}
$db = database();
$action = $argv[1] ?? '';
$photo = str_repeat('a', 48) . '.png';
$catalogImage = str_repeat('c', 48) . '.png';
if ($action === 'seed') {
    $actor = '00000000-0000-4000-8000-000000000001';
    $db->beginTransaction();
    $db->prepare("INSERT IGNORE INTO members (id, member_id, full_name, phone, membership_type, membership_status, payment_status, photo_url) VALUES
        (101, 'FIXTURE-A', 'Backup fixture', '+9770000000000', 'monthly', 'active', 'unpaid', ?)")->execute(['/api/members/photo?key=' . $photo]);
    $db->prepare("INSERT IGNORE INTO invoices (id, invoice_number, member_ref, customer_name, billing_date, invoice_status, payment_status,
        subtotal_minor, total_minor, paid_minor, balance_minor, created_by)
        VALUES (201, '507', 101, 'Backup fixture', '2025-05-01', 'issued', 'partially_paid', 1200, 1200, 400, 800, ?)")
        ->execute([$actor]);
    $db->prepare("INSERT IGNORE INTO invoice_payments (id, invoice_id, amount_minor, payment_method, payment_date, received_by)
        VALUES (301, 201, 400, 'cash', '2025-05-01', ?)")->execute([$actor]);
    $db->prepare("INSERT IGNORE INTO product_media_files (file_key) VALUES (?)")->execute([$catalogImage]);
    $db->prepare("INSERT IGNORE INTO shop_items (id, title, category, image, inventory_enabled) VALUES
        (501, 'Backup product', 'Fixture', ?, 1)")->execute(['/api/media/product?key=' . $catalogImage]);
    $db->exec("INSERT IGNORE INTO inventory_product_variants (id, product_id, sku, current_quantity) VALUES (601, 501, 'BACKUP-FIXTURE', 1.125)");
    $db->exec('UPDATE invoice_number_sequences SET next_number = 508 WHERE id = 1');
    $pdf = "%PDF-1.4\n% backup fixture\n%%EOF\n";
    $db->prepare('INSERT IGNORE INTO historical_documents (document_key, invoice_id, source_sha256, payload_base64) VALUES (?, 201, ?, ?)')
        ->execute([str_repeat('d', 48), hash('sha256', $pdf), base64_encode($pdf)]);
    $db->commit();
    foreach (['GYM_PRIVATE_MEDIA_DIR' => $photo, 'GYM_PRODUCT_MEDIA_DIR' => $catalogImage] as $directory => $key) {
        $image = imagecreatetruecolor(2, 2);
        if (!imagepng($image, getenv($directory) . '/' . $key)) exit(3);
    }
} elseif ($action === 'break-reference' && $db->query('SELECT DATABASE()')->fetchColumn() === 'gym_backup_fixture') {
    $db->exec('SET SESSION FOREIGN_KEY_CHECKS = 0');
    $db->exec('UPDATE invoice_payments SET invoice_id = 9999 WHERE id = 301');
} elseif ($action === 'repair-reference' && $db->query('SELECT DATABASE()')->fetchColumn() === 'gym_backup_fixture') {
    $db->exec('UPDATE invoice_payments SET invoice_id = 201 WHERE id = 301');
} elseif ($action !== 'inspect') {
    exit(2);
}
echo json_encode([
    'member' => $db->query("SELECT id, member_id, photo_url FROM members WHERE id = 101")->fetch(PDO::FETCH_ASSOC),
    'invoice' => $db->query("SELECT id, invoice_number, member_ref, total_minor, paid_minor, balance_minor FROM invoices WHERE id = 201")->fetch(PDO::FETCH_ASSOC),
    'payment' => $db->query("SELECT id, invoice_id, amount_minor FROM invoice_payments WHERE id = 301")->fetch(PDO::FETCH_ASSOC),
    'document' => $db->query("SELECT invoice_id, source_sha256, payload_base64 FROM historical_documents WHERE invoice_id = 201")->fetch(PDO::FETCH_ASSOC),
    'stock' => $db->query("SELECT id, product_id, current_quantity FROM inventory_product_variants WHERE id = 601")->fetch(PDO::FETCH_ASSOC),
    'nextNumber' => $db->query("SELECT next_number FROM invoice_number_sequences WHERE id = 1")->fetchColumn(),
], JSON_THROW_ON_ERROR);
