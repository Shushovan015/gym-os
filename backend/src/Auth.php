<?php
declare(strict_types=1);

final class Auth
{
    private const IDLE_SECONDS = 1800;
    private const SESSION_SECONDS = 43200;
    private const RATE_WINDOW = 900;

    public function __construct(private PDO $db)
    {
    }

    public static function startSession(): void
    {
        if (!session_start([
            'name' => '__Host-gym',
            'cache_limiter' => '',
            'use_strict_mode' => 1,
            'use_only_cookies' => 1,
            'cookie_secure' => true,
            'cookie_httponly' => true,
            'cookie_samesite' => 'Lax',
            'cookie_path' => '/',
            'cookie_domain' => '',
        ])) {
            throw new RuntimeException('Session could not be opened.');
        }
    }

    public static function email(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $email = strtolower(trim($value));
        return strlen($email) <= 254 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false
            ? $email : null;
    }

    public static function csrf(): string
    {
        return $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    }

    public static function acceptsCsrf(mixed $token): bool
    {
        return is_string($token) && isset($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
    }

    public function user(): ?array
    {
        $now = time();
        if (!isset($_SESSION['account'])) {
            return null;
        }
        if ($now - $_SESSION['last_seen'] >= self::IDLE_SECONDS ||
            $now - $_SESSION['signed_in'] >= self::SESSION_SECONDS) {
            $this->clearIdentity();
            return null;
        }
        $statement = $this->db->prepare('SELECT id, email, role, session_version FROM admin_accounts WHERE id = ? AND enabled = 1');
        $statement->execute([$_SESSION['account']]);
        $account = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$account || (int) $account['session_version'] !== $_SESSION['version']) {
            $this->clearIdentity();
            return null;
        }
        $_SESSION['last_seen'] = $now;
        unset($account['session_version']);
        return $account;
    }

    public function login(array $input, string $ip): int
    {
        $email = self::email($input['email'] ?? null);
        $password = $input['password'] ?? null;
        if (!$this->consumeAttempts($email, $ip)) {
            return 429;
        }
        if ($email === null || !is_string($password) || strlen($password) > 72 || str_contains($password, "\0")) {
            return 401;
        }
        $statement = $this->db->prepare('SELECT id, password_hash, session_version FROM admin_accounts WHERE email = ? AND enabled = 1');
        $statement->execute([$email]);
        $account = $statement->fetch(PDO::FETCH_ASSOC);
        $fallback = '$2y$10$C6UzMDM.H6dfI/f/IKcEe.6ijgN.4Ml.qeEOGuZK1acExq/L9Bz0e';
        if (!password_verify($password, $account['password_hash'] ?? $fallback) || !$account) {
            return 401;
        }
        audit($this->db, 'auth.login', $account['id']);
        $this->clearIdentity();
        $_SESSION['account'] = $account['id'];
        $_SESSION['version'] = (int) $account['session_version'];
        $_SESSION['last_seen'] = $_SESSION['signed_in'] = time();
        return 200;
    }

    public function logout(): void
    {
        $actor = $_SESSION['account'] ?? null;
        $this->clearIdentity();
        if ($actor !== null) {
            audit($this->db, 'auth.logout', $actor);
        }
    }

    private function clearIdentity(): void
    {
        $_SESSION = [];
        if (!session_regenerate_id(true)) {
            throw new RuntimeException('Session regeneration failed.');
        }
    }

    private function consumeAttempts(?string $email, string $ip): bool
    {
        $now = time();
        $cutoff = $now - self::RATE_WINDOW;
        $scopes = ['ip:' . $ip => 30];
        if ($email !== null) {
            $scopes['email:' . $email] = 10;
        }
        $this->db->beginTransaction();
        try {
            $upsert = $this->db->prepare(
                'INSERT INTO login_limits (scope_key, window_started, attempts) VALUES (?, ?, 1)
                 ON DUPLICATE KEY UPDATE attempts = IF(window_started <= ?, 1, LEAST(attempts + 1, 31)),
                 window_started = IF(window_started <= ?, ?, window_started)'
            );
            $query = $this->db->prepare('SELECT attempts FROM login_limits WHERE scope_key = ?');
            $allowed = true;
            foreach ($scopes as $scope => $limit) {
                $key = hash('sha256', $scope);
                $upsert->execute([$key, $now, $cutoff, $cutoff, $now]);
                $query->execute([$key]);
                $allowed = (int) $query->fetchColumn() <= $limit && $allowed;
            }
            $this->db->commit();
            return $allowed;
        } catch (Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }
}
