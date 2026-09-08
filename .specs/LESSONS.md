# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Drawer integration tests must assert explicit behavioral root props such as non-modal mode, not only rendered visual artifacts.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `apps/tauri transactions drawer` · harmful: 0
- features: transaction-global-drawer
- evidence: validation.md:24|GTD-02 (apps/tauri transactions drawer)
- last seen: 2026-09-08T18:53:23Z

### L-002 - When a container forwards mutation errors to a form, tests must assert the visible error path and retained controlled values after rejection.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `apps/tauri transactions forms` · harmful: 0
- features: transaction-global-drawer
- evidence: validation.md:27|GTD-05 (apps/tauri transactions forms)
- last seen: 2026-09-08T18:53:23Z

### L-003 - Error-flow tests must start without an error state and prove the error appears only after the failing action.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `transactions` · harmful: 0
- features: transaction-global-drawer
- evidence: apps/tauri/src/features/transactions/components/income-form.tsx:95 (transactions)
- last seen: 2026-09-08T19:03:41Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
