<?php
declare(strict_types=1);

final class HistoricalDocuments
{
    public function __construct(private PDO $db)
    {
    }

    public function import(string $owner, int $id, string $path, string $sha256): string
    {
        if (!is_file($path) || is_link($path)) throw new DomainException('Missing document file.');
        $maxBytes = 4 * 1024 * 1024;
        $bytes = @file_get_contents($path, false, null, 0, $maxBytes + 1);
        if (!$bytes || strlen($bytes) > $maxBytes || !hash_equals($sha256, hash('sha256', $bytes))) {
            throw new DomainException('The document checksum or size is invalid.');
        }
        if (!str_starts_with($bytes, '%PDF-') || (new finfo(FILEINFO_MIME_TYPE))->buffer($bytes) !== 'application/pdf') {
            throw new DomainException('Only PDF documents are supported.');
        }
        [$table, $column, $condition] = match ($owner) {
            'member' => ['members', 'member_id', ' AND deleted_at IS NULL'],
            'invoice' => ['invoices', 'invoice_id', ''],
        };
        $key = bin2hex(random_bytes(24));
        $this->db->beginTransaction();
        try {
            $lock = $this->db->prepare("SELECT id FROM $table WHERE id = ?$condition FOR UPDATE");
            $lock->execute([$id]);
            if ($lock->fetchColumn() === false) throw new DomainException('The reviewed document owner was not found.');
            $lookup = $this->db->prepare("SELECT document_key FROM historical_documents WHERE $column = ? AND source_sha256 = ?");
            $lookup->execute([$id, $sha256]);
            $existing = $lookup->fetchColumn();
            if ($existing !== false) {
                $this->db->rollBack();
                return $existing;
            }
            $this->db->prepare("INSERT INTO historical_documents (document_key, $column, source_sha256, payload_base64) VALUES (?, ?, ?, ?)")
                ->execute([$key, $id, $sha256, base64_encode($bytes)]);
            audit($this->db, 'historical_document.import', null);
            $this->db->commit();
            return $key;
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function download(mixed $key): void
    {
        if (!is_string($key) || !preg_match('/^[a-f0-9]{48}$/D', $key)) return;
        $query = $this->db->prepare('SELECT d.payload_base64, d.source_sha256 FROM historical_documents d
            LEFT JOIN members m ON m.id = d.member_id
            WHERE d.document_key = ? AND (d.member_id IS NULL OR (m.id IS NOT NULL AND m.deleted_at IS NULL))');
        $query->execute([$key]);
        $document = $query->fetch(PDO::FETCH_ASSOC);
        if (!$document) return;
        $bytes = base64_decode($document['payload_base64'], true);
        if ($bytes === false || !hash_equals($document['source_sha256'], hash('sha256', $bytes))) return;
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="historical-document.pdf"');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: default-src 'none'; sandbox");
        session_write_close();
        echo $bytes;
        exit;
    }
}
