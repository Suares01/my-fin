# Validation: PASS — Global Transaction Drawer (final independent recheck)

**Date**: 2026-09-08
**Spec**: `.specs/features/transaction-global-drawer/spec.md`
**Implementation range**: `333d688..fb5af8a`
**Verifier**: independent sub-agent (author != verifier)

## Verdict

**Result: PASS.** All seven GTD requirements have direct implementation and
test evidence. The workspace-wide Tauri test suite remains **BLOCKED** by 18
known pre-existing failures outside this feature; that separate workspace gate
does not invalidate this scoped feature verdict.

## Spec-Anchored Acceptance Criteria

| Criterion | Evidence | Result |
| --- | --- | --- |
| GTD-01: active book exposes the three creation choices | `apps/tauri/src/features/transactions/components/transaction-create-dropdown.test.tsx:32` invokes each typed callback; `apps/tauri/src/layout/app-shell.test.tsx:149` mounts the action in the shell. | PASS |
| GTD-02: selection opens a right, non-modal Vaul drawer with own backdrop | `apps/tauri/src/features/transactions/components/transaction-create-drawer.test.tsx:176-184` asserts explicit backdrop, `direction="right"`, and `modal={false}`. | PASS |
| GTD-03: exactly the selected dedicated form is rendered | `apps/tauri/src/features/transactions/components/transaction-create-drawer.test.tsx:187-202` asserts each selected form and absence of the other two. | PASS |
| GTD-04: successful mutation closes using existing mutation hooks | `apps/tauri/src/features/transactions/components/transaction-create-drawer.test.tsx:204-215` asserts the exact `{ bookId, draft }` mutation payload and close on success. | PASS |
| GTD-05: rejected mutation retains the drawer, value, and existing error treatment | `apps/tauri/src/features/transactions/components/transaction-create-drawer-error.test.tsx:87-97` first asserts absent alert, then visible failure alert, retained description, and no close after a real form mutation rejection. | PASS |
| GTD-06: cancel or controlled close clears selected type | `apps/tauri/src/features/transactions/hooks/use-transaction-create-drawer.test.tsx:20-33` asserts both close paths reset the type. | PASS |
| GTD-07: no active book hides the global action | `apps/tauri/src/features/transactions/components/transaction-create-quick-action.test.tsx:41-46` asserts no trigger without an active book; `apps/tauri/src/layout/app-shell.test.tsx:154-156` covers shell integration. | PASS |

## Focused Recheck

- `validate_spec.py transaction-global-drawer --strict`: 0 errors, 0 warnings.
- `validate_tasks.py transaction-global-drawer --strict`: 0 errors, 0 warnings.
- `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-create-drawer-error.test.tsx`: 1 passed, 0 failed.

The final feature run previously recorded 31 focused tests passing, plus Tauri
typecheck, ESLint, UI typecheck, and `pnpm --filter tauri build`; build emitted
only Vite's existing chunk-size warning.

## Discrimination Sensor

The real worktree was temporarily mutated at
`apps/tauri/src/features/transactions/components/income-form.tsx:95`, replacing
`setLocalError(error)` with `setLocalError(null)`, then restored before this
report was written.

| Mutation | Test | Result |
| --- | --- | --- |
| Replace `setLocalError(error)` with `setLocalError(null)` | `apps/tauri/src/features/transactions/components/transaction-create-drawer-error.test.tsx:91-93` | Killed: expected failure alert was absent; test failed. |
| Replace `modal={false}` with the default modal behavior | `apps/tauri/src/features/transactions/components/transaction-create-drawer.test.tsx:182-184` | Killed in the preceding recheck: expected `"false"`, received `"true"`. |

**Sensor verdict: 2/2 killed — PASS.**

## Workspace Gate and UAT

- **Workspace suite**: BLOCKED, not green. The full Tauri suite still has 18
  failures outside this diff: 11 in `transaction-filters.test.tsx` and 7 in
  `transaction-summary.test.tsx`. The same 18 failures were confirmed at the
  pre-feature baseline `333d688`; they are not attributable to this work.
- **Interactive/native UAT**: not run. A browser/jsdom run cannot prove the
  native Tauri IPC shell.

## Quality Assessment

- Scope is limited to the shared Vaul primitive, global creation flow, shell
  placement, and removal of the obsolete local CTA.
- Existing editing/deletion overlays and existing mutation invalidation paths
  remain outside the changed flow.
- No mobile-specific route or treatment was added.
