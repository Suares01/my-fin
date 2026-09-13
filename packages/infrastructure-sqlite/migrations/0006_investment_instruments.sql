CREATE TABLE investment_instruments (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) > 0),
  book_id TEXT NOT NULL CHECK (length(trim(book_id)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) > 0),
  type TEXT NOT NULL CHECK (type IN (
    'CDB', 'RDB', 'LCI', 'LCA', 'LC', 'CRI', 'CRA', 'DEBENTURE', 'LF', 'LIG',
    'TREASURY', 'STOCK', 'BDR', 'ETF', 'REAL_ESTATE_FUND', 'MUTUAL_FUND',
    'PGBL', 'VGBL', 'COE', 'CRYPTO_ASSET', 'OTHER'
  )),
  currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  issuer_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  version INTEGER NOT NULL CHECK (version >= 0),
  UNIQUE (id, book_id),
  FOREIGN KEY (book_id) REFERENCES financial_books (id)
) STRICT;

CREATE TABLE investment_instrument_identifiers (
  instrument_id TEXT NOT NULL CHECK (length(trim(instrument_id)) > 0),
  book_id TEXT NOT NULL CHECK (length(trim(book_id)) > 0),
  scheme TEXT NOT NULL CHECK (scheme IN ('TICKER', 'ISIN', 'REGISTRATION_NUMBER', 'OTHER')),
  value TEXT NOT NULL CHECK (length(trim(value)) > 0),
  normalized_value TEXT NOT NULL CHECK (length(trim(normalized_value)) > 0),
  market TEXT NOT NULL,
  PRIMARY KEY (instrument_id, book_id, scheme, normalized_value, market),
  UNIQUE (book_id, scheme, normalized_value, market),
  FOREIGN KEY (instrument_id, book_id)
    REFERENCES investment_instruments (id, book_id),
  CHECK (
    (scheme = 'TICKER' AND length(trim(market)) > 0)
    OR (scheme <> 'TICKER' AND market = '')
  )
) STRICT;

CREATE INDEX ix_investment_instruments_book_status_type_name
  ON investment_instruments (book_id, status, type, normalized_name, id);

CREATE INDEX ix_investment_instrument_identifiers_book_instrument
  ON investment_instrument_identifiers (book_id, instrument_id);
