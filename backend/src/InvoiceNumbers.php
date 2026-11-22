<?php
declare(strict_types=1);

final class InvoiceNumbers
{
    public static function allocate(PDO $db, int $minimum): string
    {
        $next = $db->query('SELECT next_number FROM invoice_number_sequences WHERE id = 1 FOR UPDATE')->fetchColumn();
        if ($next === false) {
            throw new RuntimeException('Invoice numbering is not initialized.');
        }
        $exists = $db->prepare('SELECT id FROM invoices WHERE invoice_number = ?');
        for ($candidate = max((int) $next, $minimum); $candidate <= 9007199254740991; $candidate++) {
            $exists->execute([(string) $candidate]);
            if ($exists->fetchColumn() === false) {
                $db->prepare('UPDATE invoice_number_sequences SET next_number = ? WHERE id = 1')->execute([$candidate + 1]);
                return (string) $candidate;
            }
        }
        throw new DomainException('Invoice numbers are exhausted.');
    }
}
