<?php
declare(strict_types=1);

require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/ProductMedia.php';
require __DIR__ . '/../src/MemberPhotos.php';
if (PHP_SAPI !== 'cli') exit(2);

$action = $argv[1] ?? '';
$kind = $argv[2] ?? '';
$id = filter_var($argv[3] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$targets = [
    'product' => ['shop_items', 'image'],
    'variant' => ['inventory_product_variants', 'image'],
    'facility' => ['facility_items', 'image'],
    'trainer' => ['trainers', 'image'],
    'trainer-thumbnail' => ['trainers', 'intro_video_thumb'],
    'testimonial' => ['testimonials', 'image'],
    'member-portrait' => ['members', 'photo_url'],
];
$digest = $argv[6] ?? null;
$contentImage = isset(ProductMedia::CONTENT_IMAGES[$kind]);
if ($action !== 'cleanup' && ($action !== 'import' || (!isset($targets[$kind]) && !$contentImage) || !$id || !in_array($argc, [6, 7], true)
        || ($contentImage && $id !== 1) || (($contentImage || $kind === 'member-portrait') && $digest === null)
        || ($digest !== null && !preg_match('/^[a-f0-9]{64}$/D', $digest)))) {
    fwrite(STDERR, "Usage: php product-media.php cleanup | import product|variant|facility|trainer|trainer-thumbnail|testimonial|member-portrait|home-hero|home-gallery|contact-hero|shop-hero ID OLD_URL LOCAL_FILE [VERIFIED_SHA256]\n");
    exit(2);
}
$db = database();
$media = new ProductMedia($db);
if ($action === 'cleanup') {
    echo $media->collect(), " unused files removed.\n";
    exit;
}
$old = $argv[4];
if (!$contentImage) {
    [$table, $column] = $targets[$kind];
    $check = $db->prepare("SELECT $column FROM $table WHERE id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() !== $old) {
        fwrite(STDERR, "The existing image changed. No replacement was made.\n");
        exit(1);
    }
}
$source = $argv[5];
if ($digest !== null && (!is_file($source) || is_link($source))) {
    fwrite(STDERR, "The file is missing, invalid or does not match the supplied checksum.\n");
    exit(1);
}
try {
    if ($kind === 'member-portrait') {
        echo (new MemberPhotos($db))->import($id, $old, $source, $digest), PHP_EOL;
        exit;
    }
    $url = $media->stage($source, $digest);
    $db->beginTransaction();
    if (!$media->validateReference($url)) throw new RuntimeException('Staged file is unavailable.');
    if ($contentImage) {
        $media->replaceContentImage($kind, $old, $url);
    } else {
        $update = $db->prepare("UPDATE $table SET $column = ? WHERE id = ? AND BINARY $column = ?");
        $update->execute([$url, $id, $old]);
        if ($update->rowCount() !== 1) throw new DomainException('The existing image changed.');
    }
    audit($db, 'catalog.image.import', null);
    $db->commit();
    echo "$url\n";
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    fwrite(STDERR, ($error instanceof DomainException ? $error->getMessage() : 'Unable to import the image.') . "\n");
    exit(1);
}
