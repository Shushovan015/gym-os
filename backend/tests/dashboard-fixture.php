<?php
declare(strict_types=1);
require __DIR__ . '/../src/database.php';

if (PHP_SAPI !== 'cli' || !preg_match('/^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_migration_test;charset=utf8mb4$/D', getenv('GYM_DB_DSN') ?: '')) {
    exit(2);
}
$db = database();
$today = new DateTimeImmutable('today', new DateTimeZone('Asia/Kathmandu'));
$date = $today->format('Y-m-d');
$yesterday = $today->modify('-1 day')->format('Y-m-d');
$reference = bin2hex(random_bytes(12));
$actor = '00000000-0000-0000-0000-000000000001';
$db->beginTransaction();
$db->prepare("INSERT INTO members (member_id, full_name, phone, membership_type, membership_status, payment_status, payment_due_date, is_active)
    VALUES (?, 'Dashboard fixture', '', 'Fixture plan', 'active', 'overdue', ?, 1)")->execute([$reference, $yesterday]);
$member = (int) $db->lastInsertId();
$db->prepare("INSERT INTO membership_fees (member_id, billing_month, amount_minor, paid_amount_minor, status, due_date)
    VALUES (?, ?, 1000, 400, 'partial', ?)")->execute([$member, $today->format('Y-m-01'), $yesterday]);
$db->prepare("INSERT INTO attendance_records (member_ref, attendance_date, status) VALUES (?, ?, 'late'), (?, ?, 'absent')")
    ->execute([$member, $date, $member, $yesterday]);
$db->prepare("INSERT INTO attendance_holidays (holiday_date, name) VALUES (?, 'Dashboard fixture holiday')
    ON DUPLICATE KEY UPDATE name = VALUES(name)")->execute([$date]);
$bill = $db->prepare("INSERT INTO invoices (invoice_number, member_ref, customer_name, billing_date, invoice_status, payment_status,
    subtotal_minor, total_minor, paid_minor, balance_minor, created_by) VALUES (?, ?, 'Dashboard fixture', ?, ?, 'partially_paid', 1000, 1000, ?, ?, ?)");
$payment = $db->prepare("INSERT INTO invoice_payments (invoice_id, amount_minor, payment_method, payment_date, received_by, is_reversal)
    VALUES (?, ?, 'cash', ?, ?, ?)");
$bill->execute([$reference . '-issued', $member, $yesterday, 'issued', 500, 500, $actor]);
$invoice = (int) $db->lastInsertId();
$payment->execute([$invoice, 200, $yesterday, $actor, 0]);
$payment->execute([$invoice, 400, $date, $actor, 0]);
$payment->execute([$invoice, 100, $date, $actor, 1]);
$bill->execute([$reference . '-cancelled', $member, $date, 'cancelled', 0, 1000, $actor]);
$payment->execute([(int) $db->lastInsertId(), 1000, $date, $actor, 0]);
$db->exec("INSERT INTO shop_items (title, category, inventory_enabled, low_stock_threshold) VALUES ('Dashboard fixture','Fixture',1,3)");
$product = (int) $db->lastInsertId();
$db->prepare('INSERT INTO inventory_product_variants (product_id, sku, current_quantity) VALUES (?, ?, 2), (?, ?, 0)')
    ->execute([$product, $reference . '-low', $product, $reference . '-out']);
$db->commit();
echo json_encode(['memberId' => $member, 'today' => $date]);
