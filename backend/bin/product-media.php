<?php
declare(strict_types=1);

require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/ProductMedia.php';
if (PHP_SAPI !== 'cli') exit(2);

$action = $argv[1] ?? '';
$kind = $argv[2] ?? '';
$id = filter_var($argv[3] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($action !== 'cleanup' && ($action !== 'import' || !in_array($kind, ['product', 'variant'], true) || !$id || count($argv) !== 6)) {
    fwrite(STDERR, "Usage: php product-media.php cleanup | import product|variant ID OLD_URL LOCAL_FILE\n");
    exit(2);
}
$db = database();
$media = new ProductMedia($db);
if ($action === 'cleanup') {
    echo $media->collect(), " unused files removed.\n";
    exit;
}
$table = $kind === 'product' ? 'shop_items' : 'inventory_product_variants';
$old = $argv[4];
$check = $db->prepare("SELECT image FROM $table WHERE id = ?");
$check->execute([$id]);
if ($check->fetchColumn() !== $old) {
    fwrite(STDERR, "The existing catalog image changed. No replacement was made.\n");
    exit(1);
}
$url = $media->stage($argv[5]);
$db->beginTransaction();
try {
    if (!$media->validateReference($url)) throw new RuntimeException('Staged file is unavailable.');
    $update = $db->prepare("UPDATE $table SET image = ? WHERE id = ? AND BINARY image = ?");
    $update->execute([$url, $id, $old]);
    if ($update->rowCount() !== 1) throw new RuntimeException('The existing catalog image changed.');
    audit($db, 'catalog.image.import', null);
    $db->commit();
    echo "$url\n";
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
