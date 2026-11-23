<?php
declare(strict_types=1);

final class ProductMedia
{
    private const PREFIX = '/api/media/product?key=';
    private const MIME = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];

    public function __construct(private PDO $db)
    {
    }

    private function directory(): string
    {
        $configured = getenv('GYM_PRODUCT_MEDIA_DIR');
        $directory = $configured ? realpath($configured) : false;
        $root = realpath(($_SERVER['DOCUMENT_ROOT'] ?? '') ?: __DIR__ . '/../public');
        if (!$directory || !$root || !is_dir($directory)) {
            throw new RuntimeException('Product media directory is not configured.');
        }
        $normalize = static function (string $value): string {
            $path = rtrim(str_replace('\\', '/', $value), '/') . '/';
            return PHP_OS_FAMILY === 'Windows' ? strtolower($path) : $path;
        };
        if (str_starts_with($normalize($directory), $normalize($root))) {
            throw new RuntimeException('Product media must be stored outside the web root.');
        }
        return $directory;
    }

    public function upload(mixed $file, string $actor, string $auditAction = 'catalog.image.upload'): array
    {
        if (!is_array($file) || ($file['error'] ?? null) !== UPLOAD_ERR_OK ||
            !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) {
            return [422, ['error' => 'A valid image upload is required.']];
        }
        try {
            $url = $this->stage($file['tmp_name']);
        } catch (DomainException $error) {
            return [422, ['error' => $error->getMessage()]];
        }
        audit($this->db, $auditAction, $actor);
        return [201, ['url' => $url]];
    }

    public function stage(string $source): string
    {
        if (!extension_loaded('gd') || !extension_loaded('fileinfo')) {
            throw new RuntimeException('GD and Fileinfo are required for catalog images.');
        }
        $size = is_file($source) ? filesize($source) : false;
        if ($size === false || $size < 1 || $size > 5 * 1024 * 1024) {
            throw new DomainException('The image must be at most 5 MiB.');
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($source);
        $extension = array_search($mime, self::MIME, true);
        $dimensions = @getimagesize($source);
        if (!$extension || !$dimensions || $dimensions['mime'] !== $mime ||
            $dimensions[0] < 1 || $dimensions[1] < 1 || max($dimensions[0], $dimensions[1]) > 4096 ||
            $dimensions[0] * $dimensions[1] > 8000000) {
            throw new DomainException('Choose a JPEG, PNG or WebP image within the supported dimensions.');
        }
        $content = file_get_contents($source, false, null, 0, 5 * 1024 * 1024 + 1);
        $image = $content !== false && strlen($content) <= 5 * 1024 * 1024 ? @imagecreatefromstring($content) : false;
        if (!$image) throw new DomainException('The image could not be decoded.');
        $key = bin2hex(random_bytes(24)) . '.' . $extension;
        $path = $this->directory() . DIRECTORY_SEPARATOR . $key;
        if ($extension !== 'jpg') {
            imagealphablending($image, false);
            imagesavealpha($image, true);
        }
        $written = match ($extension) {
            'png' => imagepng($image, $path),
            'webp' => imagewebp($image, $path, 90),
            'jpg' => imagejpeg($image, $path, 90),
        };
        if (!$written || !is_file($path) || filesize($path) < 1 ||
            (PHP_OS_FAMILY !== 'Windows' && !chmod($path, 0600))) {
            if (is_file($path)) unlink($path);
            throw new RuntimeException('Could not save the product image.');
        }
        try {
            $this->db->prepare('INSERT INTO product_media_files (file_key) VALUES (?)')->execute([$key]);
        } catch (Throwable $error) {
            unlink($path);
            throw $error;
        }
        return self::PREFIX . $key;
    }

    public function validateReference(?string $url): bool
    {
        if ($url === null || $url === '') return true;
        if (str_starts_with($url, self::PREFIX)) {
            $key = substr($url, strlen(self::PREFIX));
            if (!self::validKey($key)) return false;
            $query = $this->db->prepare('SELECT file_key FROM product_media_files WHERE file_key = ? FOR UPDATE');
            $query->execute([$key]);
            $path = $this->directory() . DIRECTORY_SEPARATOR . $key;
            return $query->fetchColumn() !== false && is_file($path) && !is_link($path);
        }
        return !preg_match('/[\x00-\x20\\\\]/', $url) &&
            ((str_starts_with($url, '/') && !str_starts_with($url, '//')) ||
                (str_starts_with($url, 'https://') && filter_var($url, FILTER_VALIDATE_URL) !== false));
    }

    public function stream(mixed $key, bool $admin): void
    {
        if (!self::validKey($key)) return;
        $query = $this->db->prepare('SELECT 1 FROM product_media_files WHERE file_key = ?');
        $query->execute([$key]);
        if ($query->fetchColumn() === false || (!$admin && !$this->referenced(self::PREFIX . $key, true))) return;
        $path = $this->directory() . DIRECTORY_SEPARATOR . $key;
        if (!is_file($path) || is_link($path)) return;
        $stream = fopen($path, 'rb');
        if (!$stream) return;
        $extension = pathinfo($key, PATHINFO_EXTENSION);
        header('Content-Type: ' . self::MIME[$extension]);
        header('Content-Disposition: inline; filename="catalog-image.' . $extension . '"');
        header("Content-Security-Policy: default-src 'none'; sandbox");
        if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
        fpassthru($stream);
        fclose($stream);
        exit;
    }

    public function collect(): int
    {
        $keys = $this->db->query("SELECT file_key FROM product_media_files f
            WHERE created_at < CURRENT_TIMESTAMP(6) - INTERVAL 1 DAY
            AND NOT EXISTS(SELECT 1 FROM shop_items WHERE image = CONCAT('/api/media/product?key=', f.file_key))
            AND NOT EXISTS(SELECT 1 FROM inventory_product_variants WHERE image = CONCAT('/api/media/product?key=', f.file_key))
            AND NOT EXISTS(SELECT 1 FROM facility_items WHERE image = CONCAT('/api/media/product?key=', f.file_key))
            AND NOT EXISTS(SELECT 1 FROM trainers WHERE image = CONCAT('/api/media/product?key=', f.file_key))
            AND NOT EXISTS(SELECT 1 FROM trainers WHERE intro_video_thumb = CONCAT('/api/media/product?key=', f.file_key))
            AND NOT EXISTS(SELECT 1 FROM testimonials WHERE image = CONCAT('/api/media/product?key=', f.file_key))
            ORDER BY created_at LIMIT 500")->fetchAll(PDO::FETCH_COLUMN);
        $directory = $this->directory();
        $count = 0;
        foreach ($keys as $key) {
            if (!self::validKey($key)) continue;
            $this->db->beginTransaction();
            try {
                $lock = $this->db->prepare('SELECT file_key FROM product_media_files WHERE file_key = ? FOR UPDATE');
                $lock->execute([$key]);
                if ($lock->fetchColumn() !== false && !$this->referenced(self::PREFIX . $key, false)) {
                    $path = $directory . DIRECTORY_SEPARATOR . $key;
                    if ((!is_file($path) && !is_link($path)) || unlink($path)) {
                        $this->db->prepare('DELETE FROM product_media_files WHERE file_key = ?')->execute([$key]);
                        $count++;
                    }
                }
                $this->db->commit();
            } catch (Throwable $error) {
                if ($this->db->inTransaction()) $this->db->rollBack();
                throw $error;
            }
        }
        return $count;
    }

    private function referenced(string $url, bool $published): bool
    {
        $product = $published ? ' AND is_active = 1' : '';
        $variant = $published ? ' AND v.is_active = 1 AND p.is_active = 1' : '';
        $query = $this->db->prepare("SELECT EXISTS(SELECT 1 FROM shop_items WHERE image = ?$product)
            OR EXISTS(SELECT 1 FROM inventory_product_variants v JOIN shop_items p ON p.id = v.product_id WHERE v.image = ?$variant)
            OR EXISTS(SELECT 1 FROM facility_items WHERE image = ?$product)
            OR EXISTS(SELECT 1 FROM trainers WHERE image = ?$product)
            OR EXISTS(SELECT 1 FROM trainers WHERE intro_video_thumb = ?$product)
            OR EXISTS(SELECT 1 FROM testimonials WHERE image = ?$product)");
        $query->execute([$url, $url, $url, $url, $url, $url]);
        return (bool) $query->fetchColumn();
    }

    private static function validKey(mixed $key): bool
    {
        return is_string($key) && (bool) preg_match('/^[a-f0-9]{48}\.(jpg|png|webp)$/D', $key);
    }
}
