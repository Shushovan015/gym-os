CREATE TABLE IF NOT EXISTS historical_documents (
    document_key CHAR(48) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    member_id BIGINT NULL,
    invoice_id BIGINT NULL,
    source_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload_base64 MEDIUMTEXT CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    CHECK ((member_id IS NULL) <> (invoice_id IS NULL)),
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    UNIQUE (member_id, source_sha256),
    UNIQUE (invoice_id, source_sha256)
) ENGINE=InnoDB;
