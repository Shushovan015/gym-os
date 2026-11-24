<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(2);
require __DIR__ . '/../src/Auth.php';

function verifiedInput(string $path, string $digest): string
{
    if (!preg_match('/^[a-f0-9]{64}$/D', $digest) || !is_file($path) || is_link($path)) {
        throw new DomainException('Invalid recovery input.');
    }
    $data = file_get_contents($path, false, null, 0, 1024 * 1024 + 1);
    if ($data === false || strlen($data) > 1024 * 1024 || !hash_equals($digest, hash('sha256', $data))) {
        throw new DomainException('Recovery input checksum or size is invalid.');
    }
    return $data;
}

try {
    if ($argc !== 5) throw new DomainException('Usage: php staff-recovery-plan.php STAFF.csv STAFF_SHA256 APPROVED.json ROSTER_SHA256');
    $roster = json_decode(verifiedInput($argv[3], $argv[4]), true, flags: JSON_THROW_ON_ERROR);
    if (!is_array($roster) || !array_is_list($roster) || $roster === []) throw new DomainException('Review and approve a nonempty roster.');
    $csv = fopen('php://memory', 'w+');
    fwrite($csv, verifiedInput($argv[1], $argv[2]));
    rewind($csv);
    if (fgetcsv($csv, 0, ',', '"', '') !== ['id', 'email', 'email_confirmed_at', 'banned_until', 'deleted_at', 'source_role']) {
        throw new DomainException('The staff export header is invalid.');
    }
    $source = [];
    while (($row = fgetcsv($csv, 0, ',', '"', '')) !== false) {
        if (count($row) !== 6 || isset($source[strtolower($row[0])])) throw new DomainException('Duplicate or invalid staff export record.');
        $source[strtolower($row[0])] = $row;
    }
    $seenIds = $seenEmails = [];
    $roles = ['admin' => 0, 'viewer' => 0];
    $blocked = [];
    foreach ($roster as $index => $entry) {
        $id = is_string($entry['id'] ?? null) ? strtolower($entry['id']) : '';
        $email = Auth::email($entry['email'] ?? null);
        $role = $entry['role'] ?? null;
        $evidence = $source[$id] ?? null;
        if (!preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/D', $id) || $email === null
            || !is_string($role) || !isset($roles[$role]) || isset($seenIds[$id]) || isset($seenEmails[$email])
            || !$evidence || Auth::email($evidence[1]) !== $email || $evidence[2] === '' || $evidence[3] !== ''
            || $evidence[4] !== '' || ($role === 'admin' && $evidence[5] !== 'admin')) {
            $blocked[] = $index + 1;
            continue;
        }
        $seenIds[$id] = $seenEmails[$email] = true;
        $roles[$role]++;
    }
    echo json_encode(['reviewed' => count($roster), 'eligibleByRole' => $roles, 'blockedEntries' => $blocked], JSON_THROW_ON_ERROR), PHP_EOL;
    exit($blocked ? 1 : 0);
} catch (Throwable $error) {
    fwrite(STDERR, ($error instanceof DomainException ? $error->getMessage() : 'Could not verify the recovery inputs.') . PHP_EOL);
    exit(2);
}
