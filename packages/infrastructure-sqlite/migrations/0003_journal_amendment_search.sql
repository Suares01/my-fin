ALTER TABLE journal_entries
  ADD COLUMN replacement_of_id TEXT;

ALTER TABLE journal_entries
  ADD COLUMN replaced_by_id TEXT;

ALTER TABLE journal_entries
  ADD COLUMN search_text TEXT NOT NULL DEFAULT '';

ALTER TABLE journal_entries
  ADD COLUMN search_version INTEGER NOT NULL DEFAULT 0 CHECK (search_version >= 0);

CREATE UNIQUE INDEX ux_journal_entries_replacement_of
  ON journal_entries (book_id, replacement_of_id);

CREATE UNIQUE INDEX ux_journal_entries_replaced_by
  ON journal_entries (book_id, replaced_by_id);

CREATE INDEX ix_journal_entries_book_search
  ON journal_entries (book_id, search_text);

CREATE TRIGGER trg_journal_entries_replacement_of_same_book_insert
BEFORE INSERT ON journal_entries
WHEN NEW.replacement_of_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE id = NEW.replacement_of_id AND book_id = NEW.book_id
  )
BEGIN
  SELECT RAISE(ABORT, 'journal replacement_of_id must reference the same book');
END;

CREATE TRIGGER trg_journal_entries_replacement_of_same_book_update
BEFORE UPDATE OF replacement_of_id, book_id ON journal_entries
WHEN NEW.replacement_of_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE id = NEW.replacement_of_id AND book_id = NEW.book_id
  )
BEGIN
  SELECT RAISE(ABORT, 'journal replacement_of_id must reference the same book');
END;

CREATE TRIGGER trg_journal_entries_replaced_by_same_book_insert
BEFORE INSERT ON journal_entries
WHEN NEW.replaced_by_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE id = NEW.replaced_by_id AND book_id = NEW.book_id
  )
BEGIN
  SELECT RAISE(ABORT, 'journal replaced_by_id must reference the same book');
END;

CREATE TRIGGER trg_journal_entries_replaced_by_same_book_update
BEFORE UPDATE OF replaced_by_id, book_id ON journal_entries
WHEN NEW.replaced_by_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE id = NEW.replaced_by_id AND book_id = NEW.book_id
  )
BEGIN
  SELECT RAISE(ABORT, 'journal replaced_by_id must reference the same book');
END;
