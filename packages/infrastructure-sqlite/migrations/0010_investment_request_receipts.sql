CREATE TABLE investment_request_receipts (
  book_id TEXT NOT NULL, request_id TEXT NOT NULL CHECK (length(trim(request_id)) > 0), format_version INTEGER NOT NULL CHECK (format_version >= 1), canonical_command TEXT NOT NULL CHECK (json_valid(canonical_command)), result_json TEXT NOT NULL CHECK (json_valid(result_json)), recorded_at TEXT NOT NULL,
  PRIMARY KEY (book_id, request_id), FOREIGN KEY (book_id) REFERENCES financial_books (id)
) STRICT;
CREATE INDEX ix_investment_request_receipts_recorded_at ON investment_request_receipts (book_id, recorded_at);
