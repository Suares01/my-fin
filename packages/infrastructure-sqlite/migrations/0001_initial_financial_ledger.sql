CREATE TABLE financial_books (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  base_currency TEXT NOT NULL CHECK (base_currency GLOB '[A-Z][A-Z][A-Z]'),
  timezone TEXT NOT NULL CHECK (length(trim(timezone)) > 0),
  version INTEGER NOT NULL CHECK (version >= 0)
) STRICT;

CREATE TABLE ledger_accounts (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) > 0),
  book_id TEXT NOT NULL CHECK (length(trim(book_id)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) > 0),
  kind TEXT NOT NULL CHECK (kind IN ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  system_purpose TEXT CHECK (
    system_purpose IS NULL OR system_purpose IN (
      'OPENING_BALANCE',
      'RECONCILIATION_ADJUSTMENT',
      'UNCATEGORIZED_INCOME',
      'UNCATEGORIZED_EXPENSE'
    )
  ),
  version INTEGER NOT NULL CHECK (version >= 0),
  UNIQUE (id, book_id),
  FOREIGN KEY (book_id) REFERENCES financial_books (id)
) STRICT;

CREATE TABLE journal_sequences (
  book_id TEXT PRIMARY KEY,
  last_sequence INTEGER NOT NULL CHECK (
    last_sequence >= 0 AND last_sequence <= 9223372036854775807
  ),
  FOREIGN KEY (book_id) REFERENCES financial_books (id)
) STRICT;

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) > 0),
  book_id TEXT NOT NULL CHECK (length(trim(book_id)) > 0),
  occurred_on TEXT NOT NULL CHECK (length(trim(occurred_on)) > 0),
  recorded_at TEXT NOT NULL CHECK (length(trim(recorded_at)) > 0),
  sequence TEXT NOT NULL CHECK (
    length(sequence) > 0 AND sequence NOT GLOB '*[^0-9]*'
  ),
  description TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  origin TEXT NOT NULL CHECK (origin IN ('MANUAL', 'SYSTEM')),
  reversal_of_id TEXT,
  reversed_by_id TEXT,
  version INTEGER NOT NULL CHECK (version >= 0),
  UNIQUE (id, book_id),
  UNIQUE (book_id, sequence),
  UNIQUE (book_id, reversal_of_id),
  UNIQUE (book_id, reversed_by_id),
  FOREIGN KEY (book_id) REFERENCES financial_books (id),
  FOREIGN KEY (reversal_of_id, book_id)
    REFERENCES journal_entries (id, book_id),
  FOREIGN KEY (reversed_by_id, book_id)
    REFERENCES journal_entries (id, book_id)
) STRICT;

CREATE TABLE postings (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) > 0),
  book_id TEXT NOT NULL CHECK (length(trim(book_id)) > 0),
  journal_entry_id TEXT NOT NULL CHECK (length(trim(journal_entry_id)) > 0),
  account_id TEXT NOT NULL CHECK (length(trim(account_id)) > 0),
  position INTEGER NOT NULL CHECK (position >= 0),
  amount_minor INTEGER NOT NULL CHECK (amount_minor <> 0),
  currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  UNIQUE (journal_entry_id, position),
  FOREIGN KEY (journal_entry_id, book_id)
    REFERENCES journal_entries (id, book_id),
  FOREIGN KEY (account_id, book_id)
    REFERENCES ledger_accounts (id, book_id)
) STRICT;

CREATE INDEX ix_ledger_accounts_book
  ON ledger_accounts (book_id);

CREATE UNIQUE INDEX ux_ledger_account_name
  ON ledger_accounts (book_id, kind, normalized_name);

CREATE UNIQUE INDEX ux_system_account_purpose
  ON ledger_accounts (book_id, system_purpose)
  WHERE system_purpose IS NOT NULL;

CREATE INDEX ix_journal_entries_book_date_sequence
  ON journal_entries (book_id, occurred_on, sequence);

CREATE INDEX ix_journal_entries_reversal_of
  ON journal_entries (book_id, reversal_of_id);

CREATE INDEX ix_journal_entries_reversed_by
  ON journal_entries (book_id, reversed_by_id);

CREATE INDEX ix_postings_entry
  ON postings (book_id, journal_entry_id, position);

CREATE INDEX ix_postings_account_entry
  ON postings (book_id, account_id, journal_entry_id);
