<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;

final class InvoiceMailTransport
{
    public function config(): ?array
    {
        $host = getenv('GYM_SMTP_HOST') ?: '';
        $from = getenv('GYM_SMTP_FROM') ?: '';
        $port = filter_var(getenv('GYM_SMTP_PORT') ?: '587', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]);
        $encryption = getenv('GYM_SMTP_ENCRYPTION') ?: 'tls';
        $test = PHP_SAPI === 'cli-server' && getenv('GYM_SMTP_TEST') === '1'
            && getenv('GYM_AUTH_TEST') === '1' && $host === '127.0.0.1' && $encryption === 'test';
        if (!preg_match('/^[a-zA-Z0-9.-]+$/D', $host) || !$port || !filter_var($from, FILTER_VALIDATE_EMAIL)
            || (!$test && !in_array($encryption, ['tls', 'ssl'], true))
            || !is_file(__DIR__ . '/../vendor/autoload.php') || (!$test && !extension_loaded('openssl'))) {
            return null;
        }
        return ['host' => $host, 'from' => $from, 'port' => $port, 'encryption' => $test ? '' : $encryption,
            'username' => $test ? '' : (getenv('GYM_SMTP_USER') ?: ''),
            'password' => $test ? '' : (getenv('GYM_SMTP_PASSWORD') ?: '')];
    }

    public function send(array $config, array $attempt, array $receipt, array $settings): string
    {
        require_once __DIR__ . '/../vendor/autoload.php';
        $smtp = new class extends SMTP {
            public bool $dataStarted = false;
            public function data($msg_data)
            {
                $this->dataStarted = true;
                return parent::data($msg_data);
            }
        };
        try {
            $bill = $receipt['invoice'];
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->setSMTPInstance($smtp);
            $mail->SMTPAutoTLS = false;
            $mail->Host = $config['host'];
            $mail->Port = $config['port'];
            $mail->SMTPSecure = $config['encryption'];
            $mail->SMTPAuth = $config['username'] !== '';
            $mail->Username = $config['username'];
            $mail->Password = $config['password'];
            $mail->Timeout = 8;
            $smtp->Timelimit = 10;
            $mail->CharSet = 'UTF-8';
            $mail->setFrom($config['from'], $settings['gym_name']);
            $mail->addAddress($attempt['recipient']);
            $mail->MessageID = '<bill-' . $attempt['message_token'] . '@' . substr(strrchr($config['from'], '@'), 1) . '>';
            $mail->Subject = 'Invoice ' . $bill['invoice_number'];
            $mail->isHTML(true);
            $html = $this->printable($receipt, $settings);
            $mail->Body = $html;
            $mail->AltBody = 'Invoice ' . $bill['invoice_number'] . ' from ' . $settings['gym_name'] . '. See the attached printable invoice.';
            $mail->addStringAttachment($html, 'invoice.html', PHPMailer::ENCODING_BASE64, 'text/html');
            $mail->send();
            return 'sent';
        } catch (Throwable) {
            // A disconnect during DATA can occur after server acceptance.
            return $smtp->dataStarted ? 'uncertain' : 'failed';
        }
    }

    private function printable(array $receipt, array $settings): string
    {
        $bill = $receipt['invoice'];
        $escape = static fn (mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $units = max(0, min(4, (int) $settings['currency_minor_unit']));
        $money = static function (int $minor) use ($bill, $escape, $units): string {
            $divisor = 10 ** $units;
            return $escape($bill['currency_code']) . ' ' . intdiv($minor, $divisor)
                . ($units > 0 ? '.' . str_pad((string) ($minor % $divisor), $units, '0', STR_PAD_LEFT) : '');
        };
        $html = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Invoice</title><body><h1>'
            . $escape($settings['gym_name']) . '</h1><p>' . $escape($settings['address']) . ' · ' . $escape($settings['phone']) . '</p>'
            . '<h2>Invoice ' . $escape($bill['invoice_number']) . '</h2><p>' . $escape($bill['billing_date'])
            . ' · ' . $escape($bill['customer_name']) . '</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>';
        foreach ($receipt['items'] as $item) {
            $html .= '<tr><td>' . $escape($item['description']) . '</td><td>' . $escape($item['quantity'])
                . '</td><td>' . $money($item['unit_price_minor']) . '</td><td>' . $money($item['line_total_minor']) . '</td></tr>';
        }
        $html .= '</tbody></table><dl>';
        foreach (['Subtotal' => 'subtotal_minor', 'Discount' => 'discount_minor', 'Tax' => 'tax_minor',
            'Total' => 'total_minor', 'Paid' => 'paid_minor', 'Balance' => 'balance_minor'] as $label => $field) {
            $html .= '<dt>' . $label . '</dt><dd>' . $money($bill[$field]) . '</dd>';
        }
        $html .= '</dl><h3>Payment history</h3><ul>';
        foreach ($receipt['payments'] as $payment) {
            $html .= '<li>' . $escape($payment['payment_date']) . ' · ' . $escape($payment['payment_method']) . ' · '
                . ($payment['is_reversal'] ? 'Reversal ' : '') . $money($payment['amount_minor']) . '</li>';
        }
        return $html . '</ul><p>' . $escape($settings['receipt_footer']) . '</p></body></html>';
    }
}
