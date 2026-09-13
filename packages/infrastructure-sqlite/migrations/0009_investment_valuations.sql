CREATE TABLE investment_valuations (
  id TEXT PRIMARY KEY, book_id TEXT NOT NULL, position_id TEXT NOT NULL, allocation_revision INTEGER NOT NULL CHECK (allocation_revision >= 1), valued_at TEXT NOT NULL, valued_on TEXT NOT NULL, recorded_at TEXT NOT NULL, record_sequence INTEGER NOT NULL CHECK (record_sequence > 0), source TEXT NOT NULL CHECK (source = 'MANUAL'), quantity TEXT, unit_price TEXT, currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'), gross_value_minor INTEGER NOT NULL, net_value_minor INTEGER, withdrawable_value_minor INTEGER,
  UNIQUE (id, book_id), UNIQUE (book_id, record_sequence), FOREIGN KEY (position_id, book_id) REFERENCES investment_positions (id, book_id)
) STRICT;
CREATE INDEX ix_investment_valuations_current ON investment_valuations (book_id, position_id, allocation_revision, valued_at DESC, recorded_at DESC, record_sequence DESC);
CREATE INDEX ix_investment_valuations_history ON investment_valuations (book_id, position_id, valued_at DESC, record_sequence DESC);
CREATE TRIGGER trg_investment_valuations_immutable_update BEFORE UPDATE ON investment_valuations BEGIN SELECT RAISE(ABORT, 'investment valuations are immutable'); END;
CREATE TRIGGER trg_investment_valuations_immutable_delete BEFORE DELETE ON investment_valuations BEGIN SELECT RAISE(ABORT, 'investment valuations are immutable'); END;
