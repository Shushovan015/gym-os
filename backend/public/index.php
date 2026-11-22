<?php
declare(strict_types=1);

require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/Auth.php';
require __DIR__ . '/../src/Attendance.php';
require __DIR__ . '/../src/Members.php';
require __DIR__ . '/../src/MemberPhotos.php';
require __DIR__ . '/../src/MembershipFees.php';
require __DIR__ . '/../src/MembershipBilling.php';
require __DIR__ . '/../src/Stock.php';
require __DIR__ . '/../src/Catalog.php';
require __DIR__ . '/../src/ProductBilling.php';

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_THROW_ON_ERROR);
    exit;
}

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['HTTPS'] ?? '') !== 'on') {
    respond(400, ['error' => 'HTTPS is required.']);
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$routes = [
    '/api/auth/session' => 'GET',
    '/api/auth/login' => 'POST',
    '/api/auth/logout' => 'POST',
    '/api/auth/admin' => 'GET',
    '/api/attendance/history' => 'GET',
    '/api/attendance/change' => 'POST',
    '/api/members' => 'GET',
    '/api/members/details' => 'GET',
    '/api/admin/settings' => 'GET',
    '/api/members/plans' => 'GET',
    '/api/members/fees' => 'GET',
    '/api/membership/payments' => 'POST',
    '/api/membership/payment-history' => 'GET',
    '/api/invoices/receipt' => 'GET',
    '/api/invoices/products/issue' => 'POST',
    '/api/invoices/products/cancel' => 'POST',
    '/api/membership/cancel-invoice' => 'POST',
    '/api/inventory/stock' => 'POST',
    '/api/inventory/stock-history' => 'GET',
    '/api/inventory/catalog' => 'GET',
    '/api/inventory/suppliers' => 'GET',
    '/api/inventory/catalog/save' => 'POST',
    '/api/inventory/catalog/delete' => 'POST',
    '/api/members/save' => 'POST',
    '/api/members/change' => 'POST',
    '/api/members/photo' => 'GET',
    '/api/members/upload-photo' => 'POST',
];
if (!isset($routes[$path])) {
    respond(404, ['error' => 'Route not found.']);
}
if ($method !== $routes[$path]) {
    header('Allow: ' . $routes[$path]);
    respond(405, ['error' => 'Method not allowed.']);
}

try {
    Auth::startSession();
    if ($method === 'POST' && !Auth::acceptsCsrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
        respond(403, ['error' => 'Invalid CSRF token.']);
    }
    if ($path === '/api/auth/session' && !isset($_SESSION['account'])) {
        respond(200, ['user' => null, 'csrfToken' => Auth::csrf()]);
    }
    $db = database();
    $auth = new Auth($db);
    if (!in_array($path, ['/api/auth/session', '/api/auth/login', '/api/auth/logout'], true)) {
        $user = $auth->user();
        if (($user['role'] ?? null) !== 'admin') {
            respond($user === null ? 401 : 403, ['error' => 'Administrator access is required.']);
        }
    }
    if ($path === '/api/attendance/history') {
        [$status, $result] = (new Attendance($db))->history($_GET['memberId'] ?? null);
        respond($status, $result);
    }
    if ($path === '/api/members' || $path === '/api/members/details') {
        $members = new Members($db);
        [$status, $result] = $path === '/api/members' ? $members->list($_GET) : $members->details($_GET['id'] ?? null);
        respond($status, $result);
    }
    if ($path === '/api/admin/settings') {
        $settings = $db->query('SELECT * FROM admin_settings WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
        if (!$settings) {
            respond(404, ['error' => 'Gym settings were not found.']);
        }
        foreach (['attendance_holiday_lock', 'tax_enabled', 'allow_negative_stock'] as $field) {
            $settings[$field] = (bool) $settings[$field];
        }
        respond(200, ['settings' => $settings]);
    }
    if ($path === '/api/members/plans') {
        $plans = $db->query("SELECT id, title FROM pricing_items WHERE kind = 'plan' AND is_active = 1 ORDER BY sort_order, id")
            ->fetchAll(PDO::FETCH_ASSOC);
        respond(200, ['plans' => array_map(static fn (array $plan): array => $plan + ['is_active' => true], $plans)]);
    }
    if ($path === '/api/members/photo') {
        (new MemberPhotos($db))->download($_GET['key'] ?? null);
        respond(404, ['error' => 'Photo was not found.']);
    }
    if ($path === '/api/members/fees') {
        [$status, $result] = (new MembershipFees($db))->status($_GET['id'] ?? null);
        respond($status, $result);
    }
    if ($path === '/api/inventory/stock-history') {
        [$status, $result] = (new Stock($db))->history($_GET['variantId'] ?? null);
        respond($status, $result);
    }
    if ($path === '/api/inventory/catalog' || $path === '/api/inventory/suppliers') {
        $catalog = new Catalog($db);
        [$status, $result] = $path === '/api/inventory/catalog' ? $catalog->listing($_GET) : $catalog->suppliers();
        respond($status, $result);
    }
    if ($path === '/api/membership/payment-history' || $path === '/api/invoices/receipt') {
        $billing = new MembershipBilling($db);
        [$status, $result] = $path === '/api/invoices/receipt'
            ? $billing->receipt($_GET['id'] ?? null)
            : $billing->history($_GET['id'] ?? null);
        respond($status, $result);
    }
    if ($path === '/api/members/upload-photo') {
        [$status, $result] = (new MemberPhotos($db))->upload($_POST['memberId'] ?? null, $_FILES['photo'] ?? null, $user['id']);
        respond($status, $result);
    }
    if ($method === 'POST' && $path !== '/api/auth/logout') {
        $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
        if ($type !== 'application/json') {
            respond(415, ['error' => 'JSON is required.']);
        }
        $limit = $path === '/api/auth/login' ? 4096 : 65536;
        $body = file_get_contents('php://input', false, null, 0, $limit + 1);
        if ($body === false || strlen($body) > $limit) {
            respond(413, ['error' => 'Request body is too large.']);
        }
        $input = json_decode($body, true);
        if (!is_array($input) || array_is_list($input)) {
            respond(400, ['error' => 'Invalid request body.']);
        }
        if ($path === '/api/attendance/change') {
            [$status, $result] = (new Attendance($db))->change($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/membership/payments') {
            [$status, $result] = (new MembershipBilling($db))->pay($input, $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? null, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/membership/cancel-invoice') {
            [$status, $result] = (new MembershipBilling($db))->cancel($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/invoices/products/issue' || $path === '/api/invoices/products/cancel') {
            $billing = new ProductBilling($db);
            [$status, $result] = $path === '/api/invoices/products/issue'
                ? $billing->issue($input, $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? null, $user['id'])
                : $billing->cancel($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/inventory/stock') {
            [$status, $result] = (new Stock($db))->adjust($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/inventory/catalog/save' || $path === '/api/inventory/catalog/delete') {
            $catalog = new Catalog($db);
            [$status, $result] = $path === '/api/inventory/catalog/save'
                ? $catalog->save($input, $user['id']) : $catalog->delete($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/members/save' || $path === '/api/members/change') {
            $members = new Members($db);
            [$status, $result] = $path === '/api/members/save'
                ? $members->save($input, $user['id'])
                : $members->change($input, $user['id']);
            respond($status, $result);
        }
        $status = $auth->login($input, $_SERVER['REMOTE_ADDR'] ?? '');
        if ($status !== 200) {
            respond($status, ['error' => $status === 429 ? 'Try again later.' : 'Invalid credentials.']);
        }
    }
    if ($path === '/api/auth/logout') {
        $auth->logout();
    }
    $user = $user ?? $auth->user();
    respond(200, ['user' => $user, 'csrfToken' => Auth::csrf()]);
} catch (Throwable $error) {
    error_log('Gym API request failed: ' . $error::class . ' (' . $error->getCode() . ')');
    respond(500, ['error' => 'The request could not be completed.']);
}
