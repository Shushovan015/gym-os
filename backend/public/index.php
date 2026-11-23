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
require __DIR__ . '/../src/BillingOverview.php';
require __DIR__ . '/../src/Dashboard.php';
require __DIR__ . '/../src/MonthlyReports.php';
require __DIR__ . '/../src/ContactContent.php';
require __DIR__ . '/../src/WebsiteContentFields.php';
require __DIR__ . '/../src/FooterContent.php';
require __DIR__ . '/../src/HomeContent.php';
require __DIR__ . '/../src/FacilitiesContent.php';
require __DIR__ . '/../src/TrainersContent.php';
require __DIR__ . '/../src/PricingContent.php';
require __DIR__ . '/../src/TestimonialContent.php';
require __DIR__ . '/../src/ShopContent.php';
require __DIR__ . '/../src/BillingAttempts.php';
require __DIR__ . '/../src/InvoiceMailTransport.php';
require __DIR__ . '/../src/InvoiceMail.php';
require __DIR__ . '/../src/ProductMedia.php';
require __DIR__ . '/../src/InvoiceBalancePayments.php';

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
    '/api/attendance/grid' => 'GET',
    '/api/attendance/holiday' => 'POST',
    '/api/attendance/change' => 'POST',
    '/api/members' => 'GET',
    '/api/members/details' => 'GET',
    '/api/admin/settings' => 'GET',
    '/api/members/plans' => 'GET',
    '/api/members/fees' => 'GET',
    '/api/membership/payments' => 'POST',
    '/api/membership/payment-history' => 'GET',
    '/api/invoices/receipt' => 'GET',
    '/api/invoices' => 'GET',
    '/api/admin/dashboard' => 'GET',
    '/api/admin/reports' => 'GET',
    '/api/public/contact' => 'GET',
    '/api/studio/contact' => 'GET',
    '/api/studio/contact/save' => 'POST',
    '/api/public/footer' => 'GET',
    '/api/public/home' => 'GET',
    '/api/studio/home' => 'GET',
    '/api/studio/home/save' => 'POST',
    '/api/public/facilities' => 'GET',
    '/api/studio/facilities' => 'GET',
    '/api/studio/facilities/save' => 'POST',
    '/api/studio/media/upload' => 'POST',
    '/api/public/trainers' => 'GET',
    '/api/studio/trainers' => 'GET',
    '/api/studio/trainers/save' => 'POST',
    '/api/public/pricing' => 'GET',
    '/api/studio/pricing' => 'GET',
    '/api/studio/pricing/save' => 'POST',
    '/api/studio/testimonials' => 'GET',
    '/api/studio/testimonials/save' => 'POST',
    '/api/public/shop' => 'GET',
    '/api/studio/proshop' => 'GET',
    '/api/studio/proshop/save' => 'POST',
    '/api/studio/footer/save' => 'POST',
    '/api/billing/attempt' => 'GET',
    '/api/billing/attempt/change' => 'POST',
    '/api/invoices/email' => 'GET',
    '/api/invoices/email/send' => 'POST',
    '/api/invoices/email/reconcile' => 'POST',
    '/api/invoices/payments' => 'POST',
    '/api/invoices/products/issue' => 'POST',
    '/api/invoices/services/issue' => 'POST',
    '/api/invoices/training-plans' => 'GET',
    '/api/invoices/products/cancel' => 'POST',
    '/api/membership/cancel-invoice' => 'POST',
    '/api/inventory/stock' => 'POST',
    '/api/inventory/stock-history' => 'GET',
    '/api/inventory/catalog' => 'GET',
    '/api/inventory/variants' => 'GET',
    '/api/inventory/suppliers' => 'GET',
    '/api/inventory/catalog/save' => 'POST',
    '/api/inventory/catalog/delete' => 'POST',
    '/api/inventory/catalog/activation' => 'POST',
    '/api/inventory/media/upload' => 'POST',
    '/api/media/product' => 'GET',
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
    if ($path === '/api/public/shop') {
        respond(200, (new ShopContent(database()))->read(false));
    }
    if ($path === '/api/public/pricing') {
        respond(200, (new PricingContent(database()))->read(false));
    }
    if ($path === '/api/public/trainers') {
        respond(200, (new TrainersContent(database()))->read(false));
    }
    if ($path === '/api/public/facilities') {
        respond(200, (new FacilitiesContent(database()))->read(false));
    }
    if ($path === '/api/public/home') {
        respond(200, (new HomeContent(database()))->read(false));
    }
    if ($path === '/api/public/footer') {
        respond(200, (new FooterContent(database()))->read());
    }
    if ($path === '/api/public/contact') {
        respond(200, (new ContactContent(database()))->read(false));
    }
    if ($path === '/api/media/product') {
        $db = database();
        $media = new ProductMedia($db);
        $key = $_GET['key'] ?? null;
        $media->stream($key, false);
        Auth::startSession();
        if (((new Auth($db))->user()['role'] ?? null) === 'admin') $media->stream($key, true);
        respond(404, ['error' => 'Image not found.']);
    }
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
    if ($path === '/api/attendance/grid') {
        [$status, $result] = (new Attendance($db))->grid($_GET);
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
    if (in_array($path, ['/api/inventory/catalog', '/api/inventory/variants', '/api/inventory/suppliers'], true)) {
        $catalog = new Catalog($db);
        [$status, $result] = match ($path) {
            '/api/inventory/catalog' => $catalog->listing($_GET),
            '/api/inventory/variants' => $catalog->variantsPage($_GET),
            default => $catalog->suppliers(),
        };
        respond($status, $result);
    }
    if ($path === '/api/membership/payment-history' || $path === '/api/invoices/receipt') {
        $billing = new MembershipBilling($db);
        [$status, $result] = $path === '/api/invoices/receipt'
            ? $billing->receipt($_GET['id'] ?? null)
            : $billing->history($_GET['id'] ?? null);
        respond($status, $result);
    }
    if ($path === '/api/invoices') {
        [$status, $result] = (new BillingOverview($db))->invoices($_GET);
        respond($status, $result);
    }
    if ($path === '/api/invoices/training-plans') {
        $plans = $db->query('SELECT id, name AS title, details AS price, TRUE AS is_active FROM personal_training_plans
            WHERE is_active = 1 ORDER BY sort_order, id')->fetchAll(PDO::FETCH_ASSOC);
        respond(200, ['plans' => $plans]);
    }
    if ($path === '/api/admin/dashboard') {
        [$status, $result] = (new Dashboard($db))->overview($_GET);
        respond($status, $result);
    }
    if ($path === '/api/admin/reports') {
        [$status, $result] = (new MonthlyReports($db))->load($_GET);
        respond($status, $result);
    }
    if ($path === '/api/studio/contact') {
        respond(200, (new ContactContent($db))->read(true));
    }
    if ($path === '/api/studio/home') {
        respond(200, (new HomeContent($db))->read(true));
    }
    if ($path === '/api/studio/facilities') {
        respond(200, (new FacilitiesContent($db))->read(true));
    }
    if ($path === '/api/studio/trainers') {
        respond(200, (new TrainersContent($db))->read(true));
    }
    if ($path === '/api/studio/pricing') {
        respond(200, (new PricingContent($db))->read(true));
    }
    if ($path === '/api/studio/testimonials') {
        respond(200, ['items' => (new TestimonialContent($db))->read(true)]);
    }
    if ($path === '/api/studio/proshop') {
        respond(200, (new ShopContent($db))->read(true));
    }
    if ($path === '/api/studio/media/upload') {
        [$status, $result] = (new ProductMedia($db))->upload($_FILES['photo'] ?? null, $user['id'], 'studio.image.upload');
        respond($status, $result);
    }
    if ($path === '/api/billing/attempt') {
        [$status, $result] = (new BillingAttempts($db))->retrieve($user['id']);
        respond($status, $result);
    }
    if ($path === '/api/invoices/email') {
        [$status, $result] = (new InvoiceMail($db))->status($_GET['id'] ?? null);
        respond($status, $result);
    }
    if ($path === '/api/members/upload-photo') {
        [$status, $result] = (new MemberPhotos($db))->upload($_POST['memberId'] ?? null, $_FILES['photo'] ?? null, $user['id']);
        respond($status, $result);
    }
    if ($path === '/api/inventory/media/upload') {
        [$status, $result] = (new ProductMedia($db))->upload($_FILES['photo'] ?? null, $user['id']);
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
        if ($path === '/api/studio/contact/save') {
            [$status, $result] = (new ContactContent($db))->save($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/studio/footer/save') {
            [$status, $result] = (new FooterContent($db))->save($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/studio/home/save') {
            [$status, $result] = (new HomeContent($db))->save($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/studio/facilities/save') {
            [$status, $result] = (new FacilitiesContent($db))->save($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/studio/trainers/save') {
            [$status, $result] = (new TrainersContent($db))->save($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/studio/pricing/save') {
            [$status, $result] = (new PricingContent($db))->save($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/studio/testimonials/save') {
            [$status, $result] = (new TestimonialContent($db))->save($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/studio/proshop/save') {
            [$status, $result] = (new ShopContent($db))->save($input, $user['id']);
            respond($status, $result);
        }
        if (in_array($path, ['/api/membership/payments', '/api/invoices/payments', '/api/invoices/products/issue', '/api/invoices/services/issue'], true)) {
            [$status, $result] = (new BillingAttempts($db))->direct(substr($path, 4), $input, $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? null, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/attendance/change') {
            [$status, $result] = (new Attendance($db))->change($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/attendance/holiday') {
            [$status, $result] = (new Attendance($db))->holiday($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/billing/attempt/change') {
            [$status, $result] = (new BillingAttempts($db))->change($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/invoices/email/send' || $path === '/api/invoices/email/reconcile') {
            session_write_close();
            $mail = new InvoiceMail($db);
            [$status, $result] = $path === '/api/invoices/email/send' ? $mail->send($input, $user['id']) : $mail->reconcile($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/membership/cancel-invoice') {
            [$status, $result] = (new MembershipBilling($db))->cancel($input, $user['id']);
            respond($status, $result);
        }
        if ($path === '/api/invoices/products/cancel') {
            [$status, $result] = (new ProductBilling($db))->cancel($input, $user['id']);
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
        if ($path === '/api/inventory/catalog/activation') {
            [$status, $result] = (new Catalog($db))->activateProducts($input, $user['id']);
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
