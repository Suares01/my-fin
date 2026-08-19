CREATE INDEX ix_journal_entries_book_date_sequence_numeric
  ON journal_entries (
    book_id,
    occurred_on DESC,
    length(sequence) DESC,
    sequence DESC
  );

CREATE INDEX ix_postings_book_account_entry_position
  ON postings (book_id, account_id, journal_entry_id, position);
