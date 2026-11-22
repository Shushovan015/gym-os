<?php
declare(strict_types=1);

// The CLI test server models HTTPS terminated by the hosting web server.
if (PHP_SAPI !== 'cli-server' || getenv('GYM_AUTH_TEST') !== '1') {
    http_response_code(404);
    exit;
}
$_SERVER['HTTPS'] = 'on';
$_SERVER['REMOTE_ADDR'] = getenv('GYM_AUTH_TEST_ADDRESS');
require __DIR__ . '/../public/index.php';
