# Global Transaction Drawer Tasks

**Status**: Done

## Test Coverage Matrix

| Code layer | Required test type | Coverage expectation | Run command |
| --- | --- | --- | --- |
| Shared Drawer primitive | build | Public component compiles in `@workspace/ui`. | `pnpm --filter @workspace/ui typecheck` |
| Creation hook and dropdown | jsdom unit | Selected type, close reset and three labeled options. | `pnpm --filter tauri exec vitest run <test-file>` |
| Creation drawer | jsdom integration | Exact child form, success close and failure retention. | `pnpm --filter tauri exec vitest run <test-file>` |
| Shell and page integration | jsdom integration | Active-book visibility, global placement and absent local CTA. | `pnpm --filter tauri exec vitest run <test-file>` |

## Gate Check Commands

| Gate level | Command |
| --- | --- |
| Quick | `pnpm --filter tauri exec vitest run <task-test-file>` |
| Full | `pnpm --filter tauri exec vitest run <task-test-file> && pnpm --filter tauri exec tsc --noEmit` |
| Build | `pnpm --filter tauri exec vitest run && pnpm --filter tauri exec eslint src --max-warnings 0 && pnpm --filter tauri build` |

## Execution Plan

### Phase 1: Drawer foundation

```
T1
```

### Phase 2: Transaction creation surfaces

```
T1 -> T2 -> T3
```

### Phase 3: Shell integration

```
T3 -> T4
```

## Task Breakdown

### T1: Add the shared Vaul drawer

**What**: Add the Vaul dependency and the shared Drawer primitive adapted from Orca AI.
**Where**: `packages/ui/src/components/drawer.tsx`
**Depends on**: None
**Reuses**: `packages/ui/src/components/sheet.tsx` styling conventions and Orca AI Drawer hierarchy.
**Requirement**: GTD-02

**Done when**:

- [x] `@workspace/ui/components/drawer` exports the Drawer family required by the transaction feature.
- [x] The controlled primitive supports a right direction, `modal={false}` and explicit backdrop.
- [x] `@workspace/ui` typechecks with `vaul` resolved from its own manifest.

**Tests**: build
**Gate**: build
**Commit**: `feat(ui): add vaul drawer primitive`

### T2: Add creation state and type chooser

**What**: Add the local drawer controller hook and the dropdown with the three transaction types.
**Where**: `apps/tauri/src/features/transactions/hooks/use-transaction-create-drawer.ts`
**Depends on**: T1
**Reuses**: local React hook and `@workspace/ui` dropdown/button patterns.
**Requirement**: GTD-01, GTD-06

**Done when**:

- [x] Selecting a type opens the controller with that exact type.
- [x] Closing resets the selected type.
- [x] The dropdown offers exactly Receita, Despesa and Transferência.

**Tests**: jsdom unit
**Gate**: full
**Commit**: `feat(transactions): add creation drawer controller`

### T3: Add the controlled creation drawer

**What**: Render one existing form in the Vaul drawer and connect it to the existing creation mutations.
**Where**: `apps/tauri/src/features/transactions/components/transaction-create-drawer.tsx`
**Depends on**: T2
**Reuses**: `IncomeForm`, `ExpenseForm`, `TransferForm`, and existing transaction mutation hooks.
**Requirement**: GTD-02, GTD-03, GTD-04, GTD-05

**Done when**:

- [x] Each selected type renders only its dedicated form.
- [x] A successful mutation closes the drawer.
- [x] A rejected mutation leaves the drawer open and exposes the existing form error path.

**Tests**: jsdom integration
**Gate**: full
**Commit**: `feat(transactions): add global creation drawer`

### T4: Mount the global action and remove the local CTA

**What**: Compose the quick action in the application header and remove the obsolete page-local creation CTA.
**Where**: `apps/tauri/src/layout/app-shell.tsx`
**Depends on**: T3
**Reuses**: active-book provider and application-shell test harness.
**Requirement**: GTD-01, GTD-07

**Done when**:

- [x] The action is available in the shell only with an active book.
- [x] The Transactions page no longer owns a creation CTA or creation state.
- [x] Existing edit and deletion components are untouched.

**Tests**: jsdom integration
**Gate**: build
**Commit**: `feat(transactions): mount global creation action`
