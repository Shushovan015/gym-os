<?php
declare(strict_types=1);

final class AdminSettings
{
    private const TEXT = ['gym_name', 'phone', 'email', 'address', 'operating_hours', 'tax_label', 'receipt_footer'];
    private const FLAGS = ['attendance_holiday_lock', 'tax_enabled', 'allow_negative_stock'];

    public function __construct(private PDO $db)
    {
    }

    public function read(): array
    {
        $row = $this->db->query('SELECT * FROM admin_settings WHERE id = 1')->fetch(PDO::FETCH_ASSOC);
        if ($row === false) throw new RuntimeException('Gym settings were not found.');
        foreach (self::FLAGS as $field) $row[$field] = (bool) $row[$field];
        return ['settings' => $row, 'smtpConfigured' => (new InvoiceMailTransport())->config() !== null,
            'memberWebhookConfigured' => MemberWebhook::configured()];
    }

    public function save(array $input, string $actor): array
    {
        $changes = self::validated($input);
        if ($changes === null) return [422, ['error' => 'Check the gym profile, attendance, currency, tax and billing settings.']];

        $this->db->beginTransaction();
        try {
            $configured = $this->db->query('SELECT invoice_start_number FROM admin_settings WHERE id = 1 FOR UPDATE')->fetchColumn();
            if ($configured === false) throw new RuntimeException('Gym settings were not found.');
            if ($changes['invoice_start_number'] !== (int) $configured) {
                $next = $this->db->query('SELECT next_number FROM invoice_number_sequences WHERE id = 1 FOR UPDATE')->fetchColumn();
                if ($next === false) throw new RuntimeException('Invoice numbering is not initialized.');
                $last = $this->db->query("SELECT MAX(CAST(TRIM(invoice_number) AS UNSIGNED)) FROM invoices
                    WHERE TRIM(invoice_number) REGEXP '^[0-9]{1,16}$'
                    AND CAST(TRIM(invoice_number) AS UNSIGNED) <= 9007199254740991")->fetchColumn();
                if ($changes['invoice_start_number'] < (int) $next || $changes['invoice_start_number'] <= (int) $last) {
                    $this->db->rollBack();
                    return [409, ['error' => 'Choose a bill number above the existing invoices and at least as high as the next reserved number.']];
                }
                $this->db->prepare('UPDATE invoice_number_sequences SET next_number = ? WHERE id = 1')->execute([$changes['invoice_start_number']]);
            }
            $assignments = implode(' = ?, ', array_keys($changes)) . ' = ?';
            $this->db->prepare("UPDATE admin_settings SET $assignments WHERE id = 1")->execute(array_values($changes));
            audit($this->db, 'admin.settings.save', $actor);
            $result = $this->read();
            $this->db->commit();
            return [200, $result];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private static function validated(array $input): ?array
    {
        $text = WebsiteContentFields::text($input, self::TEXT, 1020);
        if ($text === null) return null;
        foreach ($text as $key => $value) {
            $value = trim($value);
            if (preg_match_all('/./us', $value) > 255 || ($key !== 'receipt_footer' && $value === '')) return null;
            $text[$key] = $value;
        }
        if (!filter_var($text['email'], FILTER_VALIDATE_EMAIL)) return null;
        $logo = $input['logo_url'] ?? null;
        $pan = $input['pan_vat_number'] ?? null;
        $prefix = $input['invoice_prefix'] ?? null;
        $currency = $input['currency_code'] ?? null;
        $membership = $input['default_membership_type'] ?? null;
        if (($logo !== null && (!is_string($logo) || strlen($logo) > 2000 || !WebsiteContentFields::validLink($logo)))
            || ($pan !== null && (!is_string($pan) || strlen($pan) > 255))
            || !is_string($prefix) || !preg_match('/^[A-Z0-9-]{1,12}$/D', $prefix)
            || !is_string($currency) || !preg_match('/^[A-Z]{3}$/D', $currency)
            || !in_array($membership, ['monthly', 'quarterly', 'yearly', 'trial'], true)
            || !in_array($input['expiry_warning_days'] ?? null, [7, 15, 30], true)) return null;
        $result = $text + ['logo_url' => $logo, 'pan_vat_number' => $pan, 'invoice_prefix' => $prefix, 'currency_code' => $currency,
            'default_membership_type' => $membership, 'expiry_warning_days' => $input['expiry_warning_days'], 'date_display_preference' => 'bs'];
        $ranges = ['weekly_closing_day' => [0, 6], 'absent_after_days' => [1, 60], 'invoice_start_number' => [1, 9007199254740990],
            'currency_minor_unit' => [0, 4], 'tax_rate_basis_points' => [0, 10000]];
        foreach ($ranges as $field => [$min, $max]) {
            $value = $input[$field] ?? null;
            if (!is_int($value) || $value < $min || $value > $max) return null;
            $result[$field] = $value;
        }
        foreach (self::FLAGS as $field) {
            $value = $input[$field] ?? null;
            if (!is_bool($value)) return null;
            $result[$field] = (int) $value;
        }
        return $result;
    }
}
