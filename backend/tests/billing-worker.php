<?php
declare(strict_types=1);

require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/MembershipBilling.php';
require __DIR__ . '/../src/Stock.php';
require __DIR__ . '/../src/ProductBilling.php';
require __DIR__ . '/../src/BillingAttempts.php';

if (PHP_SAPI !== 'cli' || !preg_match('/^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_migration_test;charset=utf8mb4$/D', getenv('GYM_DB_DSN') ?: '')) {
    exit(2);
}
$db = database();
$mode = $argv[1] ?? '';
$actor = '00000000-0000-0000-0000-000000000001';
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
switch ($mode) {
    case 'media-fixture':
        $image = imagecreatetruecolor(2, 2);
        ob_start();
        imagepng($image);
        echo base64_encode(ob_get_clean());
        break;
    case 'media-age':
        $db->prepare('UPDATE product_media_files SET created_at = CURRENT_TIMESTAMP(6) - INTERVAL 2 DAY WHERE file_key = ?')
            ->execute([$input]);
        echo 'true';
        break;
    case 'legacy-fixture':
        $db->beginTransaction();
        $db->exec("INSERT INTO shop_items (title, category, inventory_enabled) VALUES ('Imported stock', 'Fixture', 1)");
        $product = (int) $db->lastInsertId();
        $db->prepare('INSERT INTO inventory_product_variants (product_id, sku, current_quantity) VALUES (?, ?, 2)')
            ->execute([$product, bin2hex(random_bytes(16))]);
        $variant = (int) $db->lastInsertId();
        $db->prepare("INSERT INTO invoices (invoice_number, customer_name, billing_date, invoice_status, payment_status,
            subtotal_minor,total_minor,paid_minor,balance_minor,created_by,legacy_source)
            VALUES (?, 'Imported buyer','2025-04-03','issued','partially_paid',1000,1000,500,500,?,'legacy_mysql')")
            ->execute(['LEG-' . bin2hex(random_bytes(12)), $actor]);
        $invoice = (int) $db->lastInsertId();
        $db->prepare("INSERT INTO invoice_items (invoice_id,item_type,customer_type,product_id,variant_id,description,quantity,unit_price_minor,line_total_minor)
            VALUES (?,'product','general',?,?,'Imported stock',1.250,800,1000)")->execute([$invoice, $product, $variant]);
        $db->prepare("INSERT INTO invoice_payments (invoice_id, amount_minor, payment_method, payment_date, received_by)
            VALUES (?, ?, 'cash','2025-04-03',?)")->execute([$invoice, $input === 'bad-payment' ? 400 : 500, $actor]);
        $sold = $input === 'bad-stock' ? '1.000' : '1.250';
        $db->prepare("INSERT INTO stock_movements (invoice_id,variant_id,movement_type,quantity_delta,previous_quantity,resulting_quantity,created_by)
            VALUES (?,?,'sale',-?,2+?,2,?)")->execute([$invoice, $variant, $sold, $sold, $actor]);
        $db->commit();
        echo json_encode(['invoiceId' => $invoice, 'variantId' => $variant], JSON_THROW_ON_ERROR);
        break;
    case 'attempt':
        try {
            echo json_encode((new BillingAttempts($db))->change($input, $actor), JSON_THROW_ON_ERROR);
        } catch (PDOException $error) {
            if ($error->getCode() !== '45000' || ($error->errorInfo[2] ?? '') !== 'test audit failure') {
                throw $error;
            }
            echo '[500,{}]';
        }
        break;
    case 'training-fixture':
        $db->prepare("INSERT INTO personal_training_plans (name, details) VALUES (?, 'NPR 1,500')")->execute([$input]);
        echo $db->lastInsertId();
        break;
    case 'plan-fixture':
        $db->prepare("INSERT INTO pricing_items (kind, title) VALUES ('plan', ?)")->execute([$input]);
        echo $db->lastInsertId();
        break;
    case 'stock-fixture':
        $db->exec("INSERT INTO shop_items (title, category, inventory_enabled, selling_price_minor, wholesale_price_minor)
            VALUES ('Fixture', 'Fixture', 1, 1200, 800)");
        $product = (int) $db->lastInsertId();
        $db->prepare('INSERT INTO inventory_product_variants (product_id, sku) VALUES (?, ?)')->execute([$product, bin2hex(random_bytes(16))]);
        echo $db->lastInsertId();
        break;
    case 'product-issue':
        try {
            echo json_encode((new ProductBilling($db))->issue($input['invoice'], $input['key'], $actor), JSON_THROW_ON_ERROR);
        } catch (PDOException $error) {
            if ($error->getCode() !== '45000' || ($error->errorInfo[2] ?? '') !== 'test stock failure') {
                throw $error;
            }
            echo '[500,{}]';
        }
        break;
    case 'product-cancel':
        echo json_encode((new ProductBilling($db))->cancel(['invoiceId' => $input, 'reason' => 'Test cancellation'], $actor), JSON_THROW_ON_ERROR);
        break;
    case 'product-receipt':
        echo json_encode((new MembershipBilling($db))->receipt((string) $input), JSON_THROW_ON_ERROR);
        break;
    case 'stock-inject':
        $variant = filter_var($input, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($variant === false) {
            exit(2);
        }
        $db->exec("CREATE OR REPLACE TRIGGER billing_test_stock_failure BEFORE INSERT ON stock_movements FOR EACH ROW
            BEGIN IF NEW.variant_id = $variant AND NEW.movement_type = 'sale'
            THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test stock failure'; END IF; END");
        echo 'true';
        break;
    case 'stock-clear':
        $db->exec('DROP TRIGGER IF EXISTS billing_test_stock_failure');
        echo 'true';
        break;
    case 'stock':
        echo json_encode((new Stock($db))->adjust($input, $actor), JSON_THROW_ON_ERROR);
        break;
    case 'stock-history':
        echo json_encode((new Stock($db))->history((string) $input), JSON_THROW_ON_ERROR);
        break;
    case 'fixture':
        $db->prepare("INSERT INTO members (member_id, full_name, phone, membership_type, membership_status, payment_status, is_active)
            VALUES (?, 'Billing fixture', '+9770000', 'monthly', 'active', 'overdue', 1)")
            ->execute([bin2hex(random_bytes(16))]);
        $member = (int) $db->lastInsertId();
        $insert = $db->prepare('INSERT INTO membership_fees (member_id, billing_month, amount_minor, due_date, status)
            VALUES (?, ?, ?, ?, ?)');
        $ids = [];
        foreach ($input as [$date, $amount]) {
            $insert->execute([$member, substr($date, 0, 7) . '-01', $amount, $date, 'overdue']);
            $ids[] = (int) $db->lastInsertId();
        }
        echo json_encode(['memberId' => $member, 'feeIds' => $ids]);
        break;
    case 'pay':
        try {
            echo json_encode((new MembershipBilling($db))->pay($input['payment'], $input['key'], $actor), JSON_THROW_ON_ERROR);
        } catch (PDOException $error) {
            if ($error->getCode() !== '45000' || ($error->errorInfo[2] ?? '') !== 'test audit failure') {
                throw $error;
            }
            echo '[500,{}]';
        }
        break;
    case 'inject':
        $member = filter_var($input, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($member === false) {
            exit(2);
        }
        $db->exec("CREATE OR REPLACE TRIGGER billing_test_audit_failure BEFORE INSERT ON payment_audit_events FOR EACH ROW
            BEGIN IF NEW.member_id = $member THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test audit failure'; END IF; END");
        echo 'true';
        break;
    case 'cancel':
        echo json_encode((new MembershipBilling($db))->cancel(['invoiceId' => $input, 'reason' => 'Test cancellation'], $actor), JSON_THROW_ON_ERROR);
        break;
    case 'clear':
        $db->exec('DROP TRIGGER IF EXISTS billing_test_audit_failure');
        echo 'true';
        break;
    case 'state':
        $member = $input;
        $counts = [
            'invoices' => 'SELECT COUNT(*) FROM invoices WHERE member_ref = ?',
            'items' => 'SELECT COUNT(*) FROM invoice_items l JOIN invoices i ON i.id = l.invoice_id WHERE i.member_ref = ?',
            'payments' => 'SELECT COUNT(*) FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.member_ref = ?',
            'requests' => 'SELECT COUNT(*) FROM membership_payment_requests r JOIN invoice_payments p ON p.id = r.payment_id
                JOIN invoices i ON i.id = p.invoice_id WHERE i.member_ref = ?',
            'audits' => 'SELECT COUNT(*) FROM payment_audit_events WHERE member_id = ?',
            'allocations' => 'SELECT COUNT(*) FROM membership_payment_allocations a JOIN membership_fees f ON f.id = a.fee_id WHERE f.member_id = ?',
            'allocated' => 'SELECT SUM(a.amount_minor) FROM membership_payment_allocations a JOIN membership_fees f ON f.id = a.fee_id WHERE f.member_id = ?',
            'fee_paid' => 'SELECT SUM(paid_amount_minor) FROM membership_fees WHERE member_id = ?',
            'invoice_total' => 'SELECT SUM(total_minor) FROM invoices WHERE member_ref = ?',
            'line_total' => 'SELECT SUM(l.line_total_minor) FROM invoice_items l JOIN invoices i ON i.id = l.invoice_id WHERE i.member_ref = ?',
            'paid_total' => 'SELECT SUM(IF(p.is_reversal, -p.amount_minor, p.amount_minor))
                FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.member_ref = ?',
        ];
        $result = [];
        foreach ($counts as $name => $sql) {
            $query = $db->prepare($sql);
            $query->execute([$member]);
            $result[$name] = (int) $query->fetchColumn();
        }
        $result['next_number'] = (int) $db->query('SELECT next_number FROM invoice_number_sequences WHERE id = 1')->fetchColumn();
        $query = $db->prepare('SELECT payment_status, payment_due_date FROM members WHERE id = ?');
        $query->execute([$member]);
        $result['member'] = $query->fetch(PDO::FETCH_ASSOC);
        echo json_encode($result, JSON_THROW_ON_ERROR);
        break;
    case 'tax':
        $db->prepare('UPDATE admin_settings SET tax_enabled = ?, tax_rate_basis_points = ? WHERE id = 1')
            ->execute([(int) ($input > 0), $input]);
        echo 'true';
        break;
    default:
        exit(2);
}
