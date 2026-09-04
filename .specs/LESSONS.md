# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Run UI visibility tests against the committed diff or a clean checkout, never rely on unrelated dirty worktree changes.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tauri transactions` · harmful: 0
- features: transaction-period-query
- evidence: TPQ-08; apps/tauri/src/features/transactions/components/transaction-filters.tsx:88-105 (tauri transactions)
- last seen: 2026-09-04T15:02:02Z

### L-002 - When a query hook changes from paginated to single-list results, update every consuming page and run its clean typecheck.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `tauri transactions` · harmful: 0
- features: transaction-period-query
- evidence: apps/tauri/src/features/transactions/components/transactions-page.tsx:93-96 (tauri transactions)
- last seen: 2026-09-04T15:07:51Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
