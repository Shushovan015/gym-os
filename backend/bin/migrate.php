<?php
declare(strict_types=1);

require __DIR__ . '/../src/database.php';
require __DIR__ . '/../src/GymSchema.php';

if (PHP_SAPI !== 'cli') {
    exit(1);
}

$mode = $argv[1] ?? '';
if (!in_array($mode, ['install', 'apply', 'verify'], true)) {
    fwrite(STDERR, "Usage: php backend/bin/migrate.php install|apply|verify\n");
    exit(2);
}

$db = database(getenv('GYM_CONFIG_FILE') ?: null);
$lock = $db->query("SELECT GET_LOCK(CONCAT('gym-schema-', MD5(DATABASE())), 10)")->fetchColumn();
if ((int) $lock !== 1) {
    throw new RuntimeException('Could not lock the schema.');
}
if ($mode === 'install') {
    $hasObjects = $db->query("SELECT (
        EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE())
        OR EXISTS (SELECT 1 FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE())
        OR EXISTS (SELECT 1 FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE())
    )")->fetchColumn();
    if ((int) $hasObjects !== 0) {
        fwrite(STDERR, "Install requires a new empty database. Existing database objects were left unchanged.\n");
        exit(1);
    }
}
if ($mode !== 'verify') {
    $db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB');
}

$lookup = $db->prepare('SELECT checksum FROM schema_migrations WHERE version = ?');
$record = $db->prepare('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)');
foreach (glob(__DIR__ . '/../database/migrations/*.sql') as $path) {
    $version = basename($path);
    $sql = file_get_contents($path);
    if ($sql === false) {
        throw new RuntimeException('Could not read ' . $version);
    }
    $checksum = hash('sha256', str_replace("\r\n", "\n", $sql));
    $lookup->execute([$version]);
    $known = $lookup->fetchColumn();
    if ($known !== false && !hash_equals($known, $checksum)) {
        throw new RuntimeException('Migration checksum differs for ' . $version);
    }
    if ($known !== false) {
        continue;
    }
    if ($mode === 'verify') {
        throw new RuntimeException('Pending migration ' . $version);
    }
    // Migration files contain flat DDL statements. Use rerunnable DDL because MySQL commits schema changes implicitly.
    foreach (explode(';', $sql) as $statement) {
        if (trim($statement) !== '') {
            $db->exec($statement);
        }
    }
    $record->execute([$version, $checksum]);
}
$tables = GymSchema::TABLES;
$engine = $db->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
foreach ($tables as $table) {
    $engine->execute([$table]);
    if ($engine->fetchColumn() !== 'InnoDB') {
        throw new RuntimeException("InnoDB table missing or invalid: $table");
    }
}
$foreignKeys = $db->query("SELECT CONCAT(TABLE_NAME, '.', COLUMN_NAME), CONCAT(REFERENCED_TABLE_NAME, '.', REFERENCED_COLUMN_NAME)
    FROM information_schema.KEY_COLUMN_USAGE WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL")
    ->fetchAll(PDO::FETCH_KEY_PAIR);
$requiredKeys = [
    'attendance_records.member_ref' => 'members.id',
    'member_status_history.member_id' => 'members.id',
    'invoices.member_ref' => 'members.id',
    'invoice_payments.invoice_id' => 'invoices.id',
    'pg_import_invoice_holds.invoice_id' => 'invoices.id',
    'historical_documents.member_id' => 'members.id',
    'historical_documents.invoice_id' => 'invoices.id',
    'invoice_payments.reverses_payment_id' => 'invoice_payments.id',
    'membership_fees.member_id' => 'members.id',
    'membership_fees.invoice_id' => 'invoices.id',
    'invoice_items.invoice_id' => 'invoices.id',
    'membership_payment_allocations.payment_id' => 'invoice_payments.id',
    'membership_payment_allocations.fee_id' => 'membership_fees.id',
    'membership_payment_allocations.invoice_item_id' => 'invoice_items.id',
    'membership_payment_requests.payment_id' => 'invoice_payments.id',
    'payment_audit_events.payment_id' => 'invoice_payments.id',
    'payment_audit_events.member_id' => 'members.id',
    'shop_items.supplier_id' => 'inventory_suppliers.id',
    'invoice_items.product_id' => 'shop_items.id',
    'invoice_items.variant_id' => 'inventory_product_variants.id',
    'inventory_product_variants.product_id' => 'shop_items.id',
    'stock_movements.variant_id' => 'inventory_product_variants.id',
    'stock_movements.invoice_id' => 'invoices.id',
    'stock_movements.supplier_id' => 'inventory_suppliers.id',
    'product_invoice_requests.invoice_id' => 'invoices.id',
    'bill_email_attempts.invoice_id' => 'invoices.id',
    'invoice_balance_payment_requests.payment_id' => 'invoice_payments.id',
    'legacy_sql_evidence.member_id' => 'members.id',
    'legacy_sql_evidence.invoice_id' => 'invoices.id',
];
foreach ($requiredKeys as $source => $target) {
    if (($foreignKeys[$source] ?? null) !== $target) {
        throw new RuntimeException("Foreign key is missing: $source to $target");
    }
}
echo "Migration records, InnoDB tables and foreign keys verified.\n";
