<?php
declare(strict_types=1);

require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/Auth.php';

if (PHP_SAPI !== 'cli') {
    exit(1);
}

$mode = $argv[1] ?? '';
$id = strtolower($argv[2] ?? '');
$email = Auth::email($argv[3] ?? null);
$role = $argv[4] ?? '';
if (!preg_match('/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/D', $id)
    || !in_array($mode, ['create', 'reset'], true)
    || ($mode === 'create' && ($email === null || !in_array($role, ['admin', 'viewer'], true)))) {
    fwrite(STDERR, "Usage: php backend/bin/account.php create UUID EMAIL admin|viewer\n");
    fwrite(STDERR, "       php backend/bin/account.php reset UUID\n");
    exit(2);
}

$password = rtrim(stream_get_line(STDIN, 75, "\n") ?: '', "\r");
if (strlen($password) < 15 || strlen($password) > 72 || str_contains($password, "\0")) {
    fwrite(STDERR, "Supply a password of 15 to 72 bytes on standard input.\n");
    exit(2);
}
$hash = password_hash($password, PASSWORD_BCRYPT);
unset($password);
$db = database(getenv('GYM_CONFIG_FILE') ?: null);
$db->beginTransaction();
try {
    if ($mode === 'create') {
        $db->prepare('INSERT INTO admin_accounts (id, email, role, password_hash) VALUES (?, ?, ?, ?)')
            ->execute([$id, $email, $role, $hash]);
    } else {
        $statement = $db->prepare('UPDATE admin_accounts SET password_hash = ?, session_version = session_version + 1 WHERE id = ?');
        $statement->execute([$hash, $id]);
        if ($statement->rowCount() !== 1) {
            throw new RuntimeException('Account does not exist.');
        }
    }
    audit($db, 'account.' . $mode, $id);
    $db->commit();
} catch (Throwable $error) {
    $db->rollBack();
    fwrite(STDERR, "Account change failed. Verify the UUID, email and target database.\n");
    exit(1);
}
echo "Account change recorded.\n";
