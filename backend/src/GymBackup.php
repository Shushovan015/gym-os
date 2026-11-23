<?php
declare(strict_types=1);

final class GymBackup
{
    public const ARCHIVE_NAME = '/^gym-[0-9]{8}-[0-9]{6}-[0-9a-f]{16}\.zip$/D';
    private const SEEDS = ['schema_migrations', 'admin_settings', 'member_write_lock', 'invoice_number_sequences'];
    private const MANIFEST = 'manifest.json';
    private const KEY = '/^[a-f0-9]{48}\.(jpg|png|webp)$/D';
    private const MEDIA_PREFIXES = ['members' => '/api/members/photo?key=', 'catalog' => '/api/media/product?key='];

    private readonly string $archiveDirectory;
    private readonly array $media;

    public function __construct(private PDO $db, private string $password)
    {
        if (strlen($password) < 24 || !class_exists(ZipArchive::class)
            || !ZipArchive::isEncryptionMethodSupported(ZipArchive::EM_AES_256, true)) {
            throw new RuntimeException('PHP Zip with AES-256 and a backup password of at least 24 bytes are required.');
        }
        $this->archiveDirectory = self::archiveDirectory();
        $this->media = ['members' => self::directory('GYM_PRIVATE_MEDIA_DIR'), 'catalog' => self::directory('GYM_PRODUCT_MEDIA_DIR')];
        $paths = [$this->archiveDirectory, ...array_values($this->media)];
        foreach ($paths as $index => $path) {
            foreach (array_slice($paths, $index + 1) as $other) {
                if (self::contains($path, $other) || self::contains($other, $path)) {
                    throw new RuntimeException('Use separate archive and media directories.');
                }
            }
        }
    }

    public function create(): string
    {
        return $this->withWorkspace(function (string $workspace): string {
            $archiveFile = $workspace . '/snapshot.zip';
            $zip = new ZipArchive();
            if ($zip->open($archiveFile, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
                throw new RuntimeException('Could not create the backup archive.');
            }
            $closed = false;
            try {
                $this->db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                $this->db->beginTransaction();
                $manifest = ['version' => 1, 'source' => $this->databaseName(), 'createdAt' => gmdate(DATE_ATOM),
                    'migrations' => $this->migrations(), 'tables' => [], 'media' => []];
                foreach (GymSchema::TABLES as $table) {
                    $name = self::tableEntry($table);
                    $file = $workspace . '/' . $table;
                    $count = $this->writeRows($table, $file);
                    $manifest['tables'][$table] = ['rows' => $count, 'sha256' => self::digest($file)];
                    $this->encryptFile($zip, $name, $file);
                }
                foreach ($this->mediaKeys() as $group => $keys) {
                    foreach ($keys as $key) {
                        $file = $workspace . '/' . $group . '-' . $key;
                        $source = $this->media[$group] . '/' . $key;
                        if (!is_file($source) || is_link($source) || !copy($source, $file)) {
                            throw new RuntimeException('An uploaded image is missing. Repair storage or retry after writes finish.');
                        }
                        $name = "media/$group/$key";
                        $manifest['media'][$name] = self::digest($file);
                        $this->encryptFile($zip, $name, $file);
                    }
                }
                $this->db->commit();
                if (!$zip->addFromString(self::MANIFEST, json_encode($manifest, JSON_THROW_ON_ERROR))
                    || !$zip->setEncryptionName(self::MANIFEST, ZipArchive::EM_AES_256, $this->password)) {
                    throw new RuntimeException('Could not seal the backup manifest.');
                }
                $closed = $zip->close();
                if (!$closed) throw new RuntimeException('Could not finalize the backup archive.');
                $this->check($archiveFile);
                $destination = $this->archiveDirectory . '/gym-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(8)) . '.zip';
                if (!rename($archiveFile, $destination)) throw new RuntimeException('Could not publish the encrypted backup.');
                return $destination;
            } finally {
                if ($this->db->inTransaction()) $this->db->rollBack();
                if (!$closed) $zip->close();
            }
        });
    }

    public function check(string $archive): array
    {
        [$zip, $manifest] = $this->open($archive);
        try {
            foreach ($this->entries($manifest) as $name => $expected) $this->readEntry($zip, $name, $expected);
            return ['createdAt' => $manifest['createdAt'], 'tables' => count($manifest['tables']), 'media' => count($manifest['media'])];
        } finally {
            $zip->close();
        }
    }

    public function restore(string $archive, string $target): array
    {
        return $this->withWorkspace(function (string $workspace) use ($archive, $target): array {
            [$zip, $manifest] = $this->open($archive);
            $written = [];
            $committed = false;
            try {
                if ($target !== $this->databaseName() || $target === $manifest['source']) {
                    throw new RuntimeException('Restore requires an explicitly named database different from the backup source.');
                }
                if ($this->migrations() !== $manifest['migrations']) {
                    throw new RuntimeException('The archive and target must have identical application migrations.');
                }
                foreach ($this->entries($manifest) as $name => $expected) {
                    $this->readEntry($zip, $name, $expected, $workspace . '/' . str_replace('/', '-', $name));
                }
                $this->db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                $this->db->exec('SET SESSION FOREIGN_KEY_CHECKS = 0');
                $this->db->beginTransaction();
                $this->assertEmptyTarget();
                foreach (self::SEEDS as $table) $this->db->exec("DELETE FROM `$table`");
                foreach ($manifest['tables'] as $table => $info) {
                    $count = $this->restoreRows($table, $workspace . '/db-' . $table . '.ndjson');
                    if ($count !== $info['rows']) throw new RuntimeException('The archive row count did not match its manifest.');
                }
                $this->verifyRelationships();
                $expectedMedia = [];
                foreach ($this->mediaKeys() as $group => $keys) foreach ($keys as $key) $expectedMedia[] = "media/$group/$key";
                if (array_diff($expectedMedia, array_keys($manifest['media'])) !== []) {
                    throw new RuntimeException('The restored database references images absent from the archive.');
                }
                foreach (array_keys($manifest['media']) as $name) {
                    [, $group, $key] = explode('/', $name);
                    $file = $this->media[$group] . '/' . $key;
                    $stream = fopen($file, 'xb');
                    if ($stream === false) throw new RuntimeException('A restore media file already exists.');
                    $written[] = $file;
                    try {
                        $source = $workspace . '/' . str_replace('/', '-', $name);
                        $input = fopen($source, 'rb');
                        if ($input === false) throw new RuntimeException('Could not read verified media.');
                        try {
                            if (stream_copy_to_stream($input, $stream) !== filesize($source)) throw new RuntimeException('Could not restore an image.');
                        } finally {
                            fclose($input);
                        }
                    } finally {
                        fclose($stream);
                    }
                }
                $this->db->commit();
                $committed = true;
                return ['tables' => count($manifest['tables']), 'media' => count($written)];
            } finally {
                if ($this->db->inTransaction()) $this->db->rollBack();
                $this->db->exec('SET SESSION FOREIGN_KEY_CHECKS = 1');
                if (!$committed) foreach ($written as $file) unlink($file);
                $zip->close();
            }
        });
    }

    private function open(string $archive): array
    {
        $zip = new ZipArchive();
        if (!is_file($archive) || is_link($archive) || $zip->open($archive, ZipArchive::RDONLY) !== true) {
            throw new RuntimeException('Could not open the backup archive.');
        }
        try {
            $zip->setPassword($this->password);
            $stat = $zip->statName(self::MANIFEST);
            if (!$stat || $stat['size'] > 16777216 || $stat['encryption_method'] !== ZipArchive::EM_AES_256) {
                throw new RuntimeException('Invalid encrypted backup manifest.');
            }
            $json = $zip->getFromName(self::MANIFEST);
            if ($json === false) throw new RuntimeException('Could not decrypt the backup manifest.');
            $manifest = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
            if (($manifest['version'] ?? null) !== 1 || !is_string($manifest['source'] ?? null)
                || !is_string($manifest['createdAt'] ?? null) || !is_array($manifest['migrations'] ?? null)
                || array_keys($manifest['tables'] ?? []) !== GymSchema::TABLES || !is_array($manifest['media'] ?? null)) {
                throw new RuntimeException('Backup archive format is not supported.');
            }
            $expected = [self::MANIFEST => true];
            foreach ($this->entries($manifest) as $name => $digest) {
                if (!is_string($digest) || !preg_match('/^[0-9a-f]{64}$/D', $digest)) throw new RuntimeException('Invalid backup digest.');
                $expected[$name] = true;
            }
            for ($index = 0; $index < $zip->numFiles; $index++) {
                $entry = $zip->statIndex($index);
                if (!$entry || !isset($expected[$entry['name']]) || $entry['encryption_method'] !== ZipArchive::EM_AES_256) {
                    throw new RuntimeException('The archive contains an unexpected, duplicate or unencrypted file.');
                }
                unset($expected[$entry['name']]);
            }
            if ($expected !== []) throw new RuntimeException('The archive is incomplete.');
            return [$zip, $manifest];
        } catch (Throwable $error) {
            $zip->close();
            throw $error;
        }
    }

    private function entries(array $manifest): iterable
    {
        foreach ($manifest['tables'] as $table => $info) {
            if (!is_int($info['rows'] ?? null) || $info['rows'] < 0) throw new RuntimeException('Invalid backup row count.');
            yield self::tableEntry($table) => $info['sha256'] ?? null;
        }
        foreach ($manifest['media'] as $name => $digest) {
            if (!is_string($name) || !preg_match('~^media/(members|catalog)/[a-f0-9]{48}\.(jpg|png|webp)$~D', $name)) {
                throw new RuntimeException('Invalid backup media path.');
            }
            yield $name => $digest;
        }
    }

    private function writeRows(string $table, string $file): int
    {
        $stream = fopen($file, 'xb');
        if ($stream === false) throw new RuntimeException('Could not write backup data.');
        $this->db->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
        $count = 0;
        try {
            $query = $this->db->query("SELECT * FROM `$table`");
            try {
                while (($row = $query->fetch(PDO::FETCH_ASSOC)) !== false) {
                    $line = json_encode($row, JSON_THROW_ON_ERROR) . "\n";
                    if (fwrite($stream, $line) !== strlen($line)) throw new RuntimeException('Could not write backup data.');
                    $count++;
                }
            } finally {
                $query->closeCursor();
            }
        } finally {
            fclose($stream);
            $this->db->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
        }
        return $count;
    }

    private function restoreRows(string $table, string $file): int
    {
        $fields = $this->db->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_COLUMN);
        $columns = implode(', ', array_map(self::identifier(...), $fields));
        $markers = implode(', ', array_fill(0, count($fields), '?'));
        $insert = $this->db->prepare("INSERT INTO `$table` ($columns) VALUES ($markers)");
        $stream = fopen($file, 'rb');
        if ($stream === false) throw new RuntimeException('Could not read verified backup data.');
        $count = 0;
        try {
            while (($line = fgets($stream, 16777217)) !== false) {
                $row = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
                if (!is_array($row) || array_keys($row) !== $fields) throw new RuntimeException('The backup row differs from the target schema.');
                $insert->execute(array_values($row));
                $count++;
            }
            if (!feof($stream)) throw new RuntimeException('Could not read the entire backup table.');
        } finally {
            fclose($stream);
        }
        return $count;
    }

    private function mediaKeys(): array
    {
        $keys = ['members' => [], 'catalog' => []];
        foreach ($this->db->query('SELECT DISTINCT photo_url FROM members WHERE photo_url IS NOT NULL')->fetchAll(PDO::FETCH_COLUMN) as $url) {
            $prefix = self::MEDIA_PREFIXES['members'];
            if (str_starts_with($url, $prefix)) $keys['members'][] = substr($url, strlen($prefix));
        }
        $keys['catalog'] = $this->db->query('SELECT file_key FROM product_media_files')->fetchAll(PDO::FETCH_COLUMN);
        foreach ($keys as $group) foreach ($group as $key) {
            if (!preg_match(self::KEY, $key)) throw new RuntimeException('A database image reference is invalid.');
        }
        return $keys;
    }

    private function verifyRelationships(): void
    {
        $rows = $this->db->query('SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
            ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION')->fetchAll(PDO::FETCH_ASSOC);
        $groups = [];
        foreach ($rows as $row) $groups[$row['TABLE_NAME'] . '.' . $row['CONSTRAINT_NAME']][] = $row;
        foreach ($groups as $group) {
            $child = self::identifier($group[0]['TABLE_NAME']);
            $parent = self::identifier($group[0]['REFERENCED_TABLE_NAME']);
            $join = $exists = [];
            foreach ($group as $key) {
                $field = self::identifier($key['COLUMN_NAME']);
                $ref = self::identifier($key['REFERENCED_COLUMN_NAME']);
                $join[] = "c.$field = p.$ref";
                $exists[] = "c.$field IS NOT NULL";
            }
            $match = implode(' AND ', $join);
            $present = implode(' AND ', $exists);
            $missing = self::identifier($group[0]['REFERENCED_COLUMN_NAME']);
            if ($this->db->query("SELECT 1 FROM $child c LEFT JOIN $parent p ON $match WHERE $present AND p.$missing IS NULL LIMIT 1")->fetchColumn() !== false) {
                throw new RuntimeException('A restored relationship is invalid.');
            }
        }
    }

    private function assertEmptyTarget(): void
    {
        foreach (GymSchema::TABLES as $table) {
            if (in_array($table, self::SEEDS, true)) continue;
            if ($this->db->query("SELECT 1 FROM `$table` LIMIT 1 FOR UPDATE")->fetchColumn() !== false) {
                throw new RuntimeException('The restore database already contains application data.');
            }
        }
        foreach ($this->media as $path) {
            if ((new FilesystemIterator($path, FilesystemIterator::SKIP_DOTS))->valid()) {
                throw new RuntimeException('The restore media directories must be empty.');
            }
        }
    }

    private function migrations(): array
    {
        $known = $this->db->query('SELECT version, checksum FROM schema_migrations ORDER BY version')->fetchAll(PDO::FETCH_KEY_PAIR);
        $expected = [];
        foreach (glob(__DIR__ . '/../database/migrations/*.sql') as $file) {
            $sql = file_get_contents($file);
            if ($sql === false) throw new RuntimeException('Could not read migrations for backup verification.');
            $expected[basename($file)] = hash('sha256', str_replace("\r\n", "\n", $sql));
        }
        ksort($expected);
        if ($known !== $expected) throw new RuntimeException('The database migrations differ from the application release.');
        return $expected;
    }

    private function withWorkspace(Closure $operation): mixed
    {
        $lock = $this->db->query("SELECT GET_LOCK(CONCAT('gym-schema-', MD5(DATABASE())), 10)")->fetchColumn();
        if ((int) $lock !== 1) throw new RuntimeException('Could not lock the backup schema.');
        $workspace = $this->archiveDirectory . '/work-' . bin2hex(random_bytes(16));
        $mask = umask(0077);
        try {
            if (!mkdir($workspace, 0700)) throw new RuntimeException('Could not create a private backup workspace.');
            return $operation($workspace);
        } finally {
            if (is_dir($workspace)) {
                foreach (new FilesystemIterator($workspace, FilesystemIterator::SKIP_DOTS) as $entry) unlink($entry->getPathname());
                rmdir($workspace);
            }
            umask($mask);
            $this->db->query("SELECT RELEASE_LOCK(CONCAT('gym-schema-', MD5(DATABASE())))");
        }
    }

    private function encryptFile(ZipArchive $zip, string $name, string $file): void
    {
        if (!$zip->addFile($file, $name) || !$zip->setEncryptionName($name, ZipArchive::EM_AES_256, $this->password)) {
            throw new RuntimeException('Could not encrypt a backup file.');
        }
    }

    private function readEntry(ZipArchive $zip, string $name, string $expected, ?string $file = null): void
    {
        $source = $zip->getStream($name);
        if ($source === false) throw new RuntimeException('Could not decrypt a backup file.');
        $target = $file === null ? null : fopen($file, 'xb');
        $digest = hash_init('sha256');
        try {
            if ($target === false) throw new RuntimeException('Could not stage a verified backup file.');
            while (!feof($source)) {
                $chunk = fread($source, 65536);
                if ($chunk === false || ($chunk === '' && !feof($source))) throw new RuntimeException('Could not read a backup file.');
                hash_update($digest, $chunk);
                if ($target !== null && fwrite($target, $chunk) !== strlen($chunk)) throw new RuntimeException('Could not stage a backup file.');
            }
            if (!hash_equals($expected, hash_final($digest))) throw new RuntimeException('Backup content did not match its digest.');
        } finally {
            fclose($source);
            if (is_resource($target)) fclose($target);
        }
    }

    private function databaseName(): string
    {
        return (string) $this->db->query('SELECT DATABASE()')->fetchColumn();
    }

    private static function tableEntry(string $table): string
    {
        return "db/$table.ndjson";
    }

    private static function identifier(string $name): string
    {
        if (!preg_match('/^[a-zA-Z0-9_]+$/D', $name)) throw new RuntimeException('Unexpected database identifier.');
        return "`$name`";
    }

    private static function digest(string $path): string
    {
        $digest = hash_file('sha256', $path);
        if ($digest === false) throw new RuntimeException('Could not checksum the backup file.');
        return $digest;
    }

    private static function directory(string $setting): string
    {
        $value = getenv($setting);
        $path = $value ? realpath($value) : false;
        $root = realpath(getenv('GYM_WEB_ROOT') ?: (($_SERVER['DOCUMENT_ROOT'] ?? '') ?: __DIR__ . '/../public'));
        if ($path === false || $root === false || !is_dir($path) || self::contains($root, $path) || self::contains($path, $root)) {
            throw new RuntimeException("Configure $setting as an existing directory outside the web root.");
        }
        return $path;
    }

    public static function archiveDirectory(): string
    {
        return self::directory('GYM_BACKUP_DIR');
    }

    private static function contains(string $base, string $path): bool
    {
        $normalize = static function (string $value): string {
            $value = rtrim(str_replace(chr(92), '/', $value), '/') . '/';
            return PHP_OS_FAMILY === 'Windows' ? strtolower($value) : $value;
        };
        return str_starts_with($normalize($path), $normalize($base));
    }
}
