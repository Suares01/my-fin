ALTER TABLE ledger_accounts ADD COLUMN icon_key TEXT;

ALTER TABLE ledger_accounts ADD COLUMN color_hex TEXT;

UPDATE ledger_accounts
SET icon_key = 'label-dollar',
    color_hex = CASE kind
      WHEN 'INCOME' THEN '10b981'
      WHEN 'EXPENSE' THEN 'f43f5e'
    END
WHERE kind IN ('INCOME', 'EXPENSE')
  AND system_purpose IS NULL;

CREATE TRIGGER trg_category_visual_metadata_insert
BEFORE INSERT ON ledger_accounts
WHEN (
  (
    NEW.kind IN ('INCOME', 'EXPENSE')
    AND NEW.system_purpose IS NULL
    AND (
      NEW.icon_key IS NULL
      OR length(NEW.icon_key) = 0
      OR NEW.icon_key GLOB '*[^a-z0-9-]*'
      OR NEW.icon_key GLOB '-*'
      OR NEW.icon_key GLOB '*-'
      OR NEW.icon_key LIKE '%--%'
      OR NEW.color_hex IS NULL
      OR length(NEW.color_hex) <> 6
      OR NEW.color_hex GLOB '*[^0-9a-f]*'
    )
  )
  OR (
    NOT (NEW.kind IN ('INCOME', 'EXPENSE') AND NEW.system_purpose IS NULL)
    AND (NEW.icon_key IS NOT NULL OR NEW.color_hex IS NOT NULL)
  )
)
BEGIN
  SELECT RAISE(ABORT, 'ledger account visual metadata is inconsistent');
END;

CREATE TRIGGER trg_category_visual_metadata_update
BEFORE UPDATE OF kind, system_purpose, icon_key, color_hex ON ledger_accounts
WHEN (
  (
    NEW.kind IN ('INCOME', 'EXPENSE')
    AND NEW.system_purpose IS NULL
    AND (
      NEW.icon_key IS NULL
      OR length(NEW.icon_key) = 0
      OR NEW.icon_key GLOB '*[^a-z0-9-]*'
      OR NEW.icon_key GLOB '-*'
      OR NEW.icon_key GLOB '*-'
      OR NEW.icon_key LIKE '%--%'
      OR NEW.color_hex IS NULL
      OR length(NEW.color_hex) <> 6
      OR NEW.color_hex GLOB '*[^0-9a-f]*'
    )
  )
  OR (
    NOT (NEW.kind IN ('INCOME', 'EXPENSE') AND NEW.system_purpose IS NULL)
    AND (NEW.icon_key IS NOT NULL OR NEW.color_hex IS NOT NULL)
  )
)
BEGIN
  SELECT RAISE(ABORT, 'ledger account visual metadata is inconsistent');
END;
