CREATE TABLE financial_accounts (
  ledger_account_id TEXT PRIMARY KEY CHECK (length(trim(ledger_account_id)) > 0),
  book_id TEXT NOT NULL CHECK (length(trim(book_id)) > 0),
  type TEXT NOT NULL CHECK (type IN (
    'BANK', 'PAYMENT_ACCOUNT', 'CASH', 'CREDIT_CARD',
    'INVESTMENT_ACCOUNT', 'OTHER_ASSET', 'OTHER_LIABILITY'
  )),
  institution_name TEXT,
  display_reference TEXT,
  UNIQUE (ledger_account_id, book_id),
  FOREIGN KEY (ledger_account_id, book_id)
    REFERENCES ledger_accounts (id, book_id)
) STRICT;

CREATE TABLE investment_accounts (
  ledger_account_id TEXT PRIMARY KEY CHECK (length(trim(ledger_account_id)) > 0),
  book_id TEXT NOT NULL CHECK (length(trim(book_id)) > 0),
  default_settlement_account_id TEXT,
  UNIQUE (ledger_account_id, book_id),
  FOREIGN KEY (ledger_account_id, book_id)
    REFERENCES financial_accounts (ledger_account_id, book_id),
  FOREIGN KEY (default_settlement_account_id, book_id)
    REFERENCES ledger_accounts (id, book_id),
  CHECK (
    default_settlement_account_id IS NULL
    OR default_settlement_account_id <> ledger_account_id
  )
) STRICT;

CREATE INDEX ix_financial_accounts_book_type
  ON financial_accounts (book_id, type);

CREATE INDEX ix_investment_accounts_book_settlement
  ON investment_accounts (book_id, default_settlement_account_id);

CREATE TRIGGER trg_financial_accounts_insert
BEFORE INSERT ON financial_accounts
WHEN NOT EXISTS (
  SELECT 1 FROM ledger_accounts
  WHERE id = NEW.ledger_account_id
    AND book_id = NEW.book_id
    AND system_purpose IS NULL
    AND (
      (NEW.type IN ('BANK', 'PAYMENT_ACCOUNT', 'CASH', 'INVESTMENT_ACCOUNT', 'OTHER_ASSET') AND kind = 'ASSET')
      OR (NEW.type IN ('CREDIT_CARD', 'OTHER_LIABILITY') AND kind = 'LIABILITY')
    )
)
BEGIN
  SELECT RAISE(ABORT, 'financial account profile must match a non-system ledger account');
END;

CREATE TRIGGER trg_financial_accounts_update
BEFORE UPDATE OF ledger_account_id, book_id, type ON financial_accounts
WHEN NOT EXISTS (
  SELECT 1 FROM ledger_accounts
  WHERE id = NEW.ledger_account_id
    AND book_id = NEW.book_id
    AND system_purpose IS NULL
    AND (
      (NEW.type IN ('BANK', 'PAYMENT_ACCOUNT', 'CASH', 'INVESTMENT_ACCOUNT', 'OTHER_ASSET') AND kind = 'ASSET')
      OR (NEW.type IN ('CREDIT_CARD', 'OTHER_LIABILITY') AND kind = 'LIABILITY')
    )
)
BEGIN
  SELECT RAISE(ABORT, 'financial account profile must match a non-system ledger account');
END;

CREATE TRIGGER trg_investment_accounts_insert
BEFORE INSERT ON investment_accounts
WHEN NOT EXISTS (
  SELECT 1 FROM financial_accounts
  WHERE ledger_account_id = NEW.ledger_account_id
    AND book_id = NEW.book_id
    AND type = 'INVESTMENT_ACCOUNT'
)
BEGIN
  SELECT RAISE(ABORT, 'investment profile requires INVESTMENT_ACCOUNT type');
END;

CREATE TRIGGER trg_investment_accounts_update
BEFORE UPDATE OF ledger_account_id, book_id ON investment_accounts
WHEN NOT EXISTS (
  SELECT 1 FROM financial_accounts
  WHERE ledger_account_id = NEW.ledger_account_id
    AND book_id = NEW.book_id
    AND type = 'INVESTMENT_ACCOUNT'
)
BEGIN
  SELECT RAISE(ABORT, 'investment profile requires INVESTMENT_ACCOUNT type');
END;

INSERT INTO financial_accounts (ledger_account_id, book_id, type)
SELECT id, book_id,
  CASE kind
    WHEN 'ASSET' THEN 'OTHER_ASSET'
    WHEN 'LIABILITY' THEN 'OTHER_LIABILITY'
  END
FROM ledger_accounts
WHERE system_purpose IS NULL
  AND kind IN ('ASSET', 'LIABILITY');
