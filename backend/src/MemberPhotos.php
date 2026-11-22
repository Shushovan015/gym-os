<?php
declare(strict_types=1);

final class MemberPhotos
{
    public function __construct(private PDO $db)
    {
    }

    private function directory(): string
    {
        $configured = getenv('GYM_PRIVATE_MEDIA_DIR');
        $directory = $configured ? realpath($configured) : false;
        $root = realpath($_SERVER['DOCUMENT_ROOT'] ?? '');
        if ($directory === false || $root === false || !is_dir($directory)) {
            throw new RuntimeException('Private media directory is not configured.');
        }
        $normalizedDirectory = rtrim(str_replace('\\', '/', $directory), '/') . '/';
        $normalizedRoot = rtrim(str_replace('\\', '/', $root), '/') . '/';
        if (PHP_OS_FAMILY === 'Windows') {
            $normalizedDirectory = strtolower($normalizedDirectory);
            $normalizedRoot = strtolower($normalizedRoot);
        }
        if (str_starts_with($normalizedDirectory, $normalizedRoot)) {
            throw new RuntimeException('Private media directory is inside the document root.');
        }
        return $directory;
    }

    public function upload(mixed $memberId, mixed $file, string $actor): array
    {
        $id = filter_var($memberId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false || !is_array($file) || ($file['error'] ?? null) !== UPLOAD_ERR_OK ||
            !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) {
            return [422, ['error' => 'A valid member and photo upload are required.']];
        }
        $temporary = $file['tmp_name'];
        $size = filesize($temporary);
        if ($size === false || $size < 1 || $size > 5 * 1024 * 1024) {
            return [413, ['error' => 'The photo must be at most 5 MiB.']];
        }
        $image = @getimagesize($temporary);
        $extension = $image ? match ($image[2]) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            default => null,
        } : null;
        if ($extension === null || $image[0] < 1 || $image[1] < 1 || $image[0] > 4096 || $image[1] > 4096) {
            return [422, ['error' => 'Choose a JPEG, PNG or WebP image up to 4096 pixels per side.']];
        }
        $key = bin2hex(random_bytes(24)) . '.' . $extension;
        $destination = $this->directory() . DIRECTORY_SEPARATOR . $key;
        $url = '/api/members/photo?key=' . $key;
        $this->db->beginTransaction();
        try {
            $lookup = $this->db->prepare('SELECT id FROM members WHERE id = ? AND deleted_at IS NULL FOR UPDATE');
            $lookup->execute([$id]);
            if ($lookup->fetchColumn() === false) {
                $this->db->rollBack();
                return [404, ['error' => 'Member was not found.']];
            }
            if (!move_uploaded_file($temporary, $destination) ||
                (PHP_OS_FAMILY !== 'Windows' && !chmod($destination, 0600))) {
                throw new RuntimeException('Could not save the photo.');
            }
            $this->db->prepare('UPDATE members SET photo_url = ? WHERE id = ?')->execute([$url, $id]);
            audit($this->db, 'member.photo', $actor);
            $this->db->commit();
            return [201, ['url' => $url]];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            // A failed commit can have an uncertain result. Retain the private file for reconciliation.
            throw $error;
        }
    }

    public function download(mixed $key): void
    {
        if (!is_string($key) || !preg_match('/^[a-f0-9]{48}\.(jpg|png|webp)$/D', $key, $parts)) {
            return;
        }
        $lookup = $this->db->prepare('SELECT id FROM members WHERE photo_url = ? LIMIT 1');
        $lookup->execute(['/api/members/photo?key=' . $key]);
        if ($lookup->fetchColumn() === false) {
            return;
        }
        $path = $this->directory() . DIRECTORY_SEPARATOR . $key;
        if (!is_file($path) || is_link($path)) {
            return;
        }
        $stream = fopen($path, 'rb');
        if ($stream === false) {
            return;
        }
        $type = $parts[1] === 'jpg' ? 'jpeg' : $parts[1];
        header('Content-Type: image/' . $type);
        header('Content-Disposition: inline; filename="member-photo.' . $parts[1] . '"');
        header("Content-Security-Policy: default-src 'none'; sandbox");
        session_write_close();
        fpassthru($stream);
        fclose($stream);
        exit;
    }
}
