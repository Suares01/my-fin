CREATE TABLE investment_positions (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) > 0),
  book_id TEXT NOT NULL, investment_account_id TEXT NOT NULL, instrument_id TEXT NOT NULL,
  label TEXT, normalized_label TEXT NOT NULL, quantity_mode TEXT NOT NULL CHECK (quantity_mode IN ('UNITS', 'AMOUNT')),
  quantity TEXT, book_cost_minor INTEGER NOT NULL, currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  opened_on TEXT NOT NULL, closed_on TEXT, status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  allocation_revision INTEGER NOT NULL CHECK (allocation_revision >= 1), allocation_effective_on TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 0), UNIQUE (id, book_id),
  FOREIGN KEY (investment_account_id, book_id) REFERENCES investment_accounts (ledger_account_id, book_id),
  FOREIGN KEY (instrument_id, book_id) REFERENCES investment_instruments (id, book_id),
  CHECK ((quantity_mode = 'UNITS' AND quantity IS NOT NULL) OR (quantity_mode = 'AMOUNT' AND quantity IS NULL)),
  CHECK ((status = 'OPEN' AND closed_on IS NULL) OR (status = 'CLOSED' AND closed_on IS NOT NULL))
) STRICT;

CREATE TABLE investment_fixed_income_terms (
  position_id TEXT PRIMARY KEY, book_id TEXT NOT NULL, rate_kind TEXT CHECK (rate_kind IN ('PREFIXED', 'INDEXED', 'HYBRID')),
  index_name TEXT CHECK (index_name IN ('CDI', 'SELIC', 'IPCA', 'IGPM', 'OTHER')), annual_rate TEXT, index_percentage TEXT,
  annual_spread_rate TEXT, issue_date TEXT, maturity_date TEXT, grace_period_date TEXT,
  UNIQUE (position_id, book_id), FOREIGN KEY (position_id, book_id) REFERENCES investment_positions (id, book_id),
  CHECK ((rate_kind IS NULL AND index_name IS NULL AND annual_rate IS NULL AND index_percentage IS NULL AND annual_spread_rate IS NULL)
    OR (rate_kind = 'PREFIXED' AND annual_rate IS NOT NULL AND index_name IS NULL AND index_percentage IS NULL AND annual_spread_rate IS NULL)
    OR (rate_kind = 'INDEXED' AND index_name IS NOT NULL AND index_percentage IS NOT NULL AND annual_rate IS NULL AND annual_spread_rate IS NULL)
    OR (rate_kind = 'HYBRID' AND index_name IS NOT NULL AND index_percentage IS NOT NULL AND annual_spread_rate IS NOT NULL AND annual_rate IS NULL)),
  CHECK (maturity_date IS NULL OR issue_date IS NULL OR maturity_date >= issue_date),
  CHECK (grace_period_date IS NULL OR issue_date IS NULL OR grace_period_date >= issue_date),
  CHECK (grace_period_date IS NULL OR maturity_date IS NULL OR grace_period_date <= maturity_date)
) STRICT;

CREATE INDEX ix_investment_positions_book_account_status ON investment_positions (book_id, investment_account_id, status);
CREATE INDEX ix_investment_positions_book_instrument_status ON investment_positions (book_id, instrument_id, status);
