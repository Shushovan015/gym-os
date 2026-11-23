<?php
declare(strict_types=1);

final class BackupDownloads
{
    public function __construct(private PDO $db)
    {
    }

    public function listing(): array
    {
        try {
            $path = GymBackup::archiveDirectory();
        } catch (RuntimeException) {
            return ['configured' => false, 'archives' => []];
        }
        $archives = [];
        foreach (new FilesystemIterator($path, FilesystemIterator::SKIP_DOTS) as $file) {
            $name = $file->getFilename();
            if (!$file->isLink() && $file->isFile() && preg_match(GymBackup::ARCHIVE_NAME, $name)) {
                $archives[] = ['name' => $name, 'bytes' => $file->getSize(), 'createdAt' => gmdate(DATE_ATOM, $file->getMTime())];
            }
        }
        usort($archives, static fn (array $a, array $b): int => strcmp($b['name'], $a['name']));
        return ['configured' => true, 'archives' => array_slice($archives, 0, 50)];
    }

    public function stream(mixed $name, string $actor): void
    {
        if (!is_string($name) || !preg_match(GymBackup::ARCHIVE_NAME, $name)) return;
        try {
            $directory = GymBackup::archiveDirectory();
        } catch (RuntimeException) {
            return;
        }
        $path = $directory . DIRECTORY_SEPARATOR . $name;
        if (!is_file($path) || is_link($path)) return;
        $stream = fopen($path, 'rb');
        if ($stream === false) return;
        try {
            audit($this->db, 'admin.backup.download', $actor);
            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="' . $name . '"');
            session_write_close();
            fpassthru($stream);
        } finally {
            fclose($stream);
        }
        exit;
    }
}
