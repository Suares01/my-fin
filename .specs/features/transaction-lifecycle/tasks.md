# Transaction Lifecycle Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/transaction-lifecycle/design.md`
**Status**: Approved (2026-09-03)

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: no dedicated `AGENTS.md`, `CONTRIBUTING.md`, or testing guide; strong defaults applied. Command and style provenance: `package.json`, `turbo.json`, `apps/tauri/package.json`, `apps/tauri/vite.config.ts`, existing co-located Vitest suites under `apps/tauri/src/features/**`, and the regression suites under `packages/application/src/**` and `packages/infrastructure-sqlite/tests/**`.

| Code Layer                                               | Required Test Type | Coverage Expectation                                                                                                                              | Location Pattern                                                                                           | Run Command                                       |
| -------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Pure transaction models and helpers                      | unit               | All branches; 1:1 mapping to the assigned acceptance criteria; every amount, date, filter, cursor, status, and mapping edge case                  | `apps/tauri/src/features/transactions/**/*.test.ts`                                                        | `pnpm --filter tauri exec vitest run <test-file>` |
| Query, option, mutation, and cache hooks                 | integration        | Exact service input/output, success, pending, error, concurrency, book-switch, cursor recovery, and scoped invalidation paths                     | `apps/tauri/src/features/transactions/**/*.test.tsx`, `apps/tauri/src/features/query-invalidation.test.ts` | `pnpm --filter tauri exec vitest run <test-file>` |
| Transaction React components                             | integration        | Every assigned happy, loading, empty, validation, service-error, keyboard, focus, and responsive content contract using jsdom and Testing Library | `apps/tauri/src/features/transactions/**/*.test.tsx`                                                       | `pnpm --filter tauri exec vitest run <test-file>` |
| Route and application shell integration                  | integration        | `/transactions` route, shell placement, active navigation, breadcrumb, keyboard access, and preservation of existing routes                       | `apps/tauri/src/routes/*.test.tsx`, `apps/tauri/src/layout/*.test.tsx`                                     | `pnpm --filter tauri exec vitest run <test-file>` |
| Existing domain, application, and SQLite ledger behavior | integration        | Existing amendment, reversal, read-model, and persistence suites remain green; no new lower-layer behavior is introduced                          | Existing `*.test.ts` files in the three packages                                                           | `pnpm test`                                       |

## Gate Check Commands

> Generated from codebase - confirm before Execute. Commands are run separately in the listed order.

| Gate Level | When to Use                    | Command                                                                                                                    |
| ---------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Quick      | After a pure-model task        | `pnpm --filter tauri exec vitest run <task-test-file>`                                                                     |
| Full       | After a hook or component task | `pnpm --filter tauri exec vitest run <task-test-file>`, then `pnpm --filter tauri exec tsc --noEmit`                       |
| Build      | After each phase               | `pnpm --filter tauri exec vitest run`, `pnpm --filter tauri exec eslint src --max-warnings 0`, `pnpm --filter tauri build` |
| Workspace  | After the final task           | `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, then `git diff --check`                                          |

---

## Execution Plan

Phases are ordered and run sequentially. Each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Query and Model Foundation

```
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 2: Mutation Pipeline

```
T7 → T8 → T9 → T10 → T11 → T12
```

### Phase 3: Dedicated Forms

```
T13 → T14 → T15 → T16 → T17 → T18
```

### Phase 4: Consolidated Presentation

```
T19 → T20 → T21 → T22 → T23 → T24
```

### Phase 5: Route and Shell Integration

```
T25 → T26 → T27
```

---

## Task Breakdown

### Phase 1: Query and Model Foundation

#### T1: Create the transaction list model

**What**: Implement one pure model module for filter normalization, loaded-page deduplication, local status selection, signed amount presentation, and loaded-results summaries.
**Where**: `apps/tauri/src/features/transactions/transaction-list-model.ts`
**Depends on**: None
**Reuses**: `packages/application/src/ports/journal-view-queries.ts`, shared money formatting, and existing list-model test patterns
**Requirement**: TXL-03, TXL-04, TXL-05, TXL-41, TXL-44, TXL-45, TXL-47, TXL-48, TXL-49

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The module keeps status outside the server filter, deduplicates by stable `chainId`, preserves server order, and computes summaries with `BigInt`.
- [x] Income is positive, expense is negative, transfer is neutral for totals, and transfer still contributes to count and largest absolute value.
- [x] Co-located tests assert every assigned acceptance outcome and boundary.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/transaction-list-model.test.ts`.
- [x] Test count: exactly 12 task-owned tests pass; no existing test is removed or skipped.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(transactions): add transaction list model`

---

#### T2: Create the transaction form model

**What**: Implement one pure model module for form schemas, civil-date helpers, current-value edit drafts, safe error translation, and affected-account derivation.
**Where**: `apps/tauri/src/features/transactions/transaction-form-model.ts`
**Depends on**: T1
**Reuses**: existing account/category form-model patterns and application journal draft contracts
**Requirement**: TXL-17, TXL-18, TXL-19, TXL-26, TXL-34, TXL-35, TXL-49, TXL-55, TXL-56, TXL-57

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Amount, description, valid civil date, cancellation-date order, and distinct-account rules match the spec exactly.
- [x] Fresh chain detail maps unambiguously to a same-type edit draft, and ambiguous projections block editing.
- [x] Domain failures map to safe Portuguese feedback without changing submitted identifiers.
- [x] Co-located tests assert every assigned acceptance outcome and boundary.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/transaction-form-model.test.ts`.
- [x] Test count: exactly 14 task-owned tests pass; no existing test is removed or skipped.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(transactions): add transaction form model`

---

#### T3: Define book-scoped transaction query keys

**What**: Define the single transaction query-key factory for lists and stable chain details.
**Where**: `apps/tauri/src/features/transactions/hooks/transaction-keys.ts`
**Depends on**: T2
**Reuses**: account, category, balance, and statement query-key conventions
**Requirement**: TXL-43, TXL-45, TXL-54, TXL-58

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Every key includes the owning `bookId`; list keys include normalized server filters and detail keys use stable `chainId`.
- [x] Co-located tests prove key stability, filter separation, and cross-book isolation.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/hooks/transaction-keys.test.ts`.
- [x] Test count: exactly 5 task-owned tests pass; no existing test is removed or skipped.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(transactions): define transaction query keys`

---

#### T4: Implement the transaction-chain infinite query

**What**: Implement the hook that lists journal chains in pages of 20 with fixed transaction types, normalized server filters, cursor recovery, and page deduplication.
**Where**: `apps/tauri/src/features/transactions/hooks/use-transaction-chains.ts`
**Depends on**: T3
**Reuses**: `useMyFin`, `useActiveBook`, TanStack Query infinite-query patterns, and `ListJournalChains`
**Requirement**: TXL-02, TXL-08, TXL-41, TXL-42, TXL-43, TXL-45, TXL-46, TXL-54

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The exact list command carries the active `bookId`, `INCOME|EXPENSE|TRANSFER`, limit 20, supported filters, and opaque cursor.
- [x] Filter changes restart at page one; rejected cursors recover once without losing visible filters; automatic retry is disabled.
- [x] Co-located hook tests cover initial, pagination, deduplication, filter-reset, error, retry, and book-switch paths.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/hooks/use-transaction-chains.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 10 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): query transaction chains`

---

#### T5: Implement lazy transaction-chain detail

**What**: Implement the hook that lazily fetches fresh detail for one stable chain identity before expansion, edit, or deletion.
**Where**: `apps/tauri/src/features/transactions/hooks/use-transaction-chain-detail.ts`
**Depends on**: T4
**Reuses**: `GetJournalChainDetail`, `transactionKeys`, and existing enabled-query hook patterns
**Requirement**: TXL-06, TXL-25, TXL-26, TXL-30, TXL-31, TXL-32, TXL-40

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Fetching remains disabled until detail is requested and always targets the latest presented entry associated with the stable chain.
- [x] Loading, error, refetch, and cross-book states are explicit and never expose stale edit/delete identities.
- [x] Co-located hook tests cover all assigned paths.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/hooks/use-transaction-chain-detail.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 7 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): load transaction chain detail`

---

#### T6: Refresh transaction projections safely

**What**: Extend the existing invalidation module with one transaction projection refresh function that settles list, detail, balance, statement, and insight refreshes independently.
**Where**: `apps/tauri/src/features/query-invalidation.ts`
**Depends on**: T5
**Reuses**: existing account/category invalidation helpers and query-key namespaces
**Requirement**: TXL-22, TXL-28, TXL-38, TXL-56, TXL-58, TXL-59

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `refreshTransactionProjections` scopes every key by the command's `bookId`, accepts affected account IDs and optional stable chain ID, and uses settled refresh results.
- [x] A refresh rejection cannot convert a committed command into mutation failure and returns a retryable projection outcome.
- [x] Co-located tests seed every cache family, force partial failure, and switch books during a pending command.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/query-invalidation.test.ts`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Phase 1 build gate passes using all three Build commands.
- [x] Test count: exactly 8 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: build
**Commit**: `feat(transactions): refresh transaction projections`

### Phase 2: Mutation Pipeline

#### T7: Create the guarded mutation executor

**What**: Implement one shared mutation executor that synchronously rejects duplicate submissions, disables automatic retry, preserves command success across refresh failure, and returns the projection outcome.
**Where**: `apps/tauri/src/features/transactions/hooks/transaction-mutation.ts`
**Depends on**: T6
**Reuses**: `refreshTransactionProjections`, TanStack Query mutation patterns, and safe application-error mapping
**Requirement**: TXL-21, TXL-23, TXL-37, TXL-39, TXL-58, TXL-59

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The in-flight guard is synchronous, `retry` is false, service errors remain distinct from post-command refresh warnings, and submitted `bookId` owns all refreshes.
- [x] Co-located tests cover double submit, service failure, refresh failure, late completion after book switch, and guard release.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/hooks/transaction-mutation.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 7 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): guard transaction mutations`

---

#### T8: Implement income creation mutation

**What**: Implement the single income-creation hook and its exact application command mapping.
**Where**: `apps/tauri/src/features/transactions/hooks/use-record-income.ts`
**Depends on**: T7
**Reuses**: guarded mutation executor, `RecordIncome`, and affected-account derivation
**Requirement**: TXL-20, TXL-21, TXL-22, TXL-23, TXL-58, TXL-59

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] One valid submit invokes exactly one income command with unchanged IDs and refreshes only the submitted book and affected account.
- [x] Co-located tests cover exact payload, pending duplicate rejection, service error with retained caller state, and refresh warning.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/hooks/use-record-income.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 6 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): record income mutations`

---

#### T9: Implement expense creation mutation

**What**: Implement the single expense-creation hook and its exact application command mapping.
**Where**: `apps/tauri/src/features/transactions/hooks/use-record-expense.ts`
**Depends on**: T8
**Reuses**: guarded mutation executor, `RecordExpense`, and affected-account derivation
**Requirement**: TXL-20, TXL-21, TXL-22, TXL-23, TXL-58, TXL-59

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] One valid submit invokes exactly one expense command with unchanged IDs and refreshes only the submitted book and affected account.
- [x] Co-located tests cover exact payload, pending duplicate rejection, service error with retained caller state, and refresh warning.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/hooks/use-record-expense.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 6 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): record expense mutations`

---

#### T10: Implement transfer creation mutation

**What**: Implement the single transfer-creation hook and its exact application command mapping.
**Where**: `apps/tauri/src/features/transactions/hooks/use-transfer-money.ts`
**Depends on**: T9
**Reuses**: guarded mutation executor, `TransferMoney`, and affected-account derivation
**Requirement**: TXL-19, TXL-20, TXL-21, TXL-22, TXL-23, TXL-57, TXL-58, TXL-59

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] One valid submit invokes exactly one transfer command and refreshes both distinct affected accounts under the submitted book.
- [x] Equal accounts never reach the service; duplicate, service-error, book-switch, and refresh-warning paths are covered.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/hooks/use-transfer-money.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 7 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): record transfer mutations`

---

#### T11: Implement transaction amendment mutation

**What**: Implement the single amendment hook using the latest presented identity and a same-type replacement.
**Where**: `apps/tauri/src/features/transactions/hooks/use-amend-transaction.ts`
**Depends on**: T10
**Reuses**: guarded mutation executor, `AmendJournalEntry`, detail refetch, and discriminated journal drafts
**Requirement**: TXL-25, TXL-27, TXL-28, TXL-29, TXL-30, TXL-55, TXL-56, TXL-58, TXL-59

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The command contains `bookId`, latest `presentedEntryId`, `presentedVersion`, and one same-type replacement.
- [x] General failure leaves caller state open; optimistic conflict locks resubmission until fresh detail is loaded.
- [x] Co-located tests cover all three replacement types, atomic-failure presentation, conflict recovery, renamed options, and late book switch.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/hooks/use-amend-transaction.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 10 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): amend transaction chains`

---

#### T12: Implement reversal-backed deletion mutation

**What**: Implement the single reversal hook that cancels the current presented entry without optimistic removal.
**Where**: `apps/tauri/src/features/transactions/hooks/use-reverse-transaction.ts`
**Depends on**: T11
**Reuses**: guarded mutation executor, `ReverseJournalEntry`, detail refetch, and cancellation-date validation
**Requirement**: TXL-32, TXL-35, TXL-36, TXL-37, TXL-38, TXL-39, TXL-40, TXL-58, TXL-59

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Exactly one valid reversal command carries latest identity, version, date, and cancellation description.
- [x] The chain remains visible while pending and on failure; optimistic conflict locks reconfirmation until refetch.
- [x] Co-located tests cover active and edited chains, invalid date, duplicate confirmation, service failure, conflict, refresh warning, and no optimistic removal.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/hooks/use-reverse-transaction.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Phase 2 build gate passes using all three Build commands.
- [x] Test count: exactly 10 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: build
**Commit**: `feat(transactions): reverse transaction chains`

### Phase 3: Dedicated Forms

#### T13: Load transaction form options

**What**: Implement the hook that exposes active base-currency financial accounts and active type-compatible categories for the current book.
**Where**: `apps/tauri/src/features/transactions/hooks/use-transaction-form-options.ts`
**Depends on**: T2, T12
**Reuses**: `useAccounts`, `useCategories`, `useActiveBook`, and existing query invalidation patterns
**Requirement**: TXL-15, TXL-16, TXL-24, TXL-55, TXL-56, TXL-57

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Options include only active financial accounts in the active book's base currency and only active categories of the requested type.
- [x] Missing, archived, renamed, loading, error, and fewer-than-two-transfer-account states are explicit and refreshable.
- [x] Co-located hook tests cover every assigned acceptance outcome.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/hooks/use-transaction-form-options.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 9 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): load transaction form options`

---

#### T14: Create shared transaction form fields

**What**: Implement the single shared field component for amount, civil date, description, field errors, and pending-state semantics.
**Where**: `apps/tauri/src/features/transactions/components/transaction-form-fields.tsx`
**Depends on**: T13
**Reuses**: shared `Field`, `Input`, `MoneyInput`, `Button`, and existing form accessibility patterns
**Requirement**: TXL-13, TXL-14, TXL-17, TXL-18, TXL-21, TXL-34, TXL-35, TXL-49

**Tools**:

- MCP: GitHub, for reference-only comparison with the approved transaction template
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The component renders controlled amount, date, and description fields with stable labels, descriptions, errors, and disabled states.
- [x] Native civil-date behavior and money-boundary feedback remain visible and keyboard operable.
- [x] Co-located component tests cover valid values, every field error, pending state, and accessible name relationships.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-form-fields.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 8 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): add shared transaction fields`

---

#### T15: Create the dedicated income form

**What**: Implement the income form component that validates and emits exactly one income draft while retaining values on failure.
**Where**: `apps/tauri/src/features/transactions/components/income-form.tsx`
**Depends on**: T8, T14
**Reuses**: transaction form model, shared fields, option hook, income mutation hook, and existing account/category form patterns
**Requirement**: TXL-12, TXL-13, TXL-15, TXL-16, TXL-17, TXL-18, TXL-20, TXL-21, TXL-23, TXL-24, TXL-26, TXL-27, TXL-30, TXL-55, TXL-56

**Tools**:

- MCP: GitHub, to compare the Open Coin income flow without copying its separate feature boundary
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Create and edit modes share one income form and emit the exact discriminated draft expected by their caller.
- [x] Missing account/category guidance links are shown instead of an unusable form.
- [x] Pending, service error, refresh warning, conflict lock, prefill, retained-values, and renamed-option behavior satisfy the spec.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/income-form.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 12 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): add income transaction form`

---

#### T16: Create the dedicated expense form

**What**: Implement the expense form component that validates and emits exactly one expense draft while retaining values on failure.
**Where**: `apps/tauri/src/features/transactions/components/expense-form.tsx`
**Depends on**: T9, T15
**Reuses**: transaction form model, shared fields, option hook, expense mutation hook, and existing account/category form patterns
**Requirement**: TXL-12, TXL-13, TXL-15, TXL-16, TXL-17, TXL-18, TXL-20, TXL-21, TXL-23, TXL-24, TXL-26, TXL-27, TXL-30, TXL-55, TXL-56

**Tools**:

- MCP: GitHub, to compare the Open Coin expense flow without copying its separate feature boundary
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Create and edit modes share one expense form and emit the exact discriminated draft expected by their caller.
- [x] Missing account/category guidance links are shown instead of an unusable form.
- [x] Pending, service error, refresh warning, conflict lock, prefill, retained-values, and renamed-option behavior satisfy the spec.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/expense-form.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 12 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): add expense transaction form`

---

#### T17: Create the dedicated transfer form

**What**: Implement the transfer form component that validates two distinct accounts and emits exactly one transfer draft while retaining values on failure.
**Where**: `apps/tauri/src/features/transactions/components/transfer-form.tsx`
**Depends on**: T10, T16
**Reuses**: transaction form model, shared fields, option hook, transfer mutation hook, and the Open Coin transfer behavior as reference only
**Requirement**: TXL-12, TXL-14, TXL-15, TXL-17, TXL-18, TXL-19, TXL-20, TXL-21, TXL-23, TXL-24, TXL-26, TXL-27, TXL-30, TXL-55, TXL-56, TXL-57

**Tools**:

- MCP: GitHub, to compare the Open Coin transfer flow without copying its separate feature boundary
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Create and edit modes share one transfer form, never require a category, and emit the exact discriminated draft expected by their caller.
- [x] Equal accounts show `Escolha contas diferentes.`; fewer than two eligible accounts block the form and link to account creation.
- [x] Pending, failure, refresh warning, conflict lock, prefill, retained-values, and archived/renamed option behavior satisfy the spec.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/transfer-form.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 14 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): add transfer transaction form`

---

#### T18: Create the transaction deletion dialog

**What**: Implement the reversal confirmation component with cancellation explanation, local-date default, date guard, pending state, and conflict recovery.
**Where**: `apps/tauri/src/features/transactions/components/transaction-delete-dialog.tsx`
**Depends on**: T12, T17
**Reuses**: existing `Sheet` focus behavior, transaction form model, and reversal hook
**Requirement**: TXL-32, TXL-33, TXL-34, TXL-35, TXL-36, TXL-37, TXL-38, TXL-39, TXL-40, TXL-53, TXL-54

**Tools**:

- MCP: GitHub, for reference-only visual comparison
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Opening explains cancellation semantics, defaults to the local civil date, and preserves the chain until confirmed success.
- [x] Invalid date, duplicate confirmation, service failure, and optimistic conflict keep the dialog open with actionable feedback.
- [x] Accessible naming, focus containment, keyboard cancel/confirm, and focus return are covered.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-delete-dialog.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Phase 3 build gate passes using all three Build commands.
- [x] Test count: exactly 12 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: build
**Commit**: `feat(transactions): add transaction deletion dialog`

### Phase 4: Consolidated Presentation

#### T19: Create loaded-results transaction summary

**What**: Implement the summary-card component for loaded income, expense, largest absolute value, and item count.
**Where**: `apps/tauri/src/features/transactions/components/transaction-summary.tsx`
**Depends on**: T1, T18
**Reuses**: shared `Card`, `FormattedMoney`, transaction list model, and approved fintech template hierarchy
**Requirement**: TXL-47, TXL-48, TXL-49

**Tools**:

- MCP: GitHub, to inspect the approved shadcn-fintech presentation reference
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Four cards use only locally filtered loaded items, preserve each displayed currency, and visibly say `resultados carregados`.
- [x] Transfers remain neutral in income/expense totals and participate in count and largest absolute value.
- [x] Co-located component tests cover empty, mixed-type, multi-currency, signed, and large-integer outcomes.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-summary.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 7 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): add loaded transaction summary`

---

#### T20: Create transaction filters

**What**: Implement the filter component for search, period, type, local status, account, category, reset, and the loaded-results status notice.
**Where**: `apps/tauri/src/features/transactions/components/transaction-filters.tsx`
**Depends on**: T19
**Reuses**: native semantic controls, `Button`, active book option data, and transaction filter model
**Requirement**: TXL-10, TXL-41, TXL-42, TXL-43, TXL-44, TXL-46, TXL-50, TXL-52

**Tools**:

- MCP: GitHub, to inspect the approved shadcn-fintech filter hierarchy
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Supported server filters emit normalized values; status stays local and displays its loaded-results limitation.
- [x] Reset clears every filter, search is keyboard accessible, and controls span full width below 640 px.
- [x] Co-located tests cover each filter, combined filters, reset, local status notice, keyboard use, and responsive class contracts.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-filters.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 12 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): add transaction filters`

---

#### T21: Create expandable transaction row details

**What**: Implement the single expanded-row component that renders contextual chain history and only currently permitted actions.
**Where**: `apps/tauri/src/features/transactions/components/transaction-row-details.tsx`
**Depends on**: T5, T20
**Reuses**: lazy detail hook, shared `Button`, and application chain-detail read model
**Requirement**: TXL-03, TXL-04, TXL-05, TXL-06, TXL-25, TXL-31, TXL-32, TXL-38, TXL-52

**Tools**:

- MCP: GitHub, for hierarchy comparison only
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Income/expense detail presents account and category; transfer presents origin to destination with no category requirement.
- [x] Active/edited chains expose Edit and Excluir; cancelled chains expose neither.
- [x] Loading, detail error/retry, full history, and keyboard action access are covered.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-row-details.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 10 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): add transaction row details`

---

#### T22: Create the responsive transaction list

**What**: Implement the consolidated list component with mobile rows, desktop table, expansion, signed values, skeleton, errors, empty states, and load-more behavior.
**Where**: `apps/tauri/src/features/transactions/components/transaction-list.tsx`
**Depends on**: T4, T21
**Reuses**: `EmptyState`, semantic HTML, shared `Button`, list model, and row details
**Requirement**: TXL-03, TXL-04, TXL-05, TXL-06, TXL-07, TXL-08, TXL-09, TXL-10, TXL-44, TXL-45, TXL-49, TXL-50, TXL-51, TXL-52

**Tools**:

- MCP: GitHub, to adapt the approved transaction table without importing unsupported UI primitives
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Initial loading uses list-geometry skeleton plus `aria-busy=true`; initial failure has `Tentar novamente`; unfiltered and filtered empty states have their distinct actions.
- [x] Mobile content requires no horizontal scrolling for essential fields; desktop renders semantic context, value, date, status, and action columns.
- [x] Load more preserves filters, keeps locally filtered empty results honest, deduplicates stable chains, and remains keyboard operable.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-list.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 16 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): add responsive transaction list`

---

#### T23: Create the transaction overlay coordinator

**What**: Implement the single responsive overlay component that chooses exactly one create/edit/delete child and preserves accessible focus behavior.
**Where**: `apps/tauri/src/features/transactions/components/transaction-overlay.tsx`
**Depends on**: T18, T22
**Reuses**: existing Base UI-backed `Sheet`, three dedicated forms, delete dialog, and discriminated overlay state
**Requirement**: TXL-11, TXL-12, TXL-25, TXL-26, TXL-32, TXL-33, TXL-53, TXL-54

**Tools**:

- MCP: GitHub, for reference-only overlay hierarchy
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The create chooser offers exactly Receita, Despesa, and Transferência, and every state renders at most one dedicated child.
- [x] Mobile width, localized accessible close naming, contained focus, Escape/cancel, and focus return satisfy the spec.
- [x] A book change closes the overlay and clears stale detail/form state.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-overlay.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 12 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): coordinate transaction overlays`

---

#### T24: Compose the transactions page

**What**: Implement the page container that owns filters, selected chain, overlay state, query state, refresh warnings, summary, and list composition.
**Where**: `apps/tauri/src/features/transactions/components/transactions-page.tsx`
**Depends on**: T6, T23
**Reuses**: active-book container patterns from accounts/categories pages and every transaction module created above
**Requirement**: TXL-02, TXL-07, TXL-08, TXL-09, TXL-10, TXL-11, TXL-22, TXL-28, TXL-38, TXL-41, TXL-42, TXL-43, TXL-44, TXL-45, TXL-46, TXL-47, TXL-48, TXL-50, TXL-54, TXL-58, TXL-59

**Tools**:

- MCP: GitHub, to verify the approved reference's hierarchy against the unified My Fin screen
- Skill: `tlc-spec-driven`

**Done when**:

- [x] One page presents header/action, summary, filters, list, and overlay with all initial/loading/error/empty/filtered/paginated states.
- [x] Book changes clear local state and late mutations affect only their submitted book.
- [x] Successful commands close their form, failed commands retain values, and partial refresh failures show reload guidance without asking for command resubmission.
- [x] Co-located integration tests cover the composed create/edit/delete flows with mocked services and content contracts at 375, 768, and 1280 px.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/transactions-page.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Phase 4 build gate passes using all three Build commands.
- [x] Test count: exactly 18 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: build
**Commit**: `feat(transactions): compose transactions page`

### Phase 5: Route and Shell Integration

#### T25: Export the transactions feature

**What**: Define the single public feature entry point that exports the transactions page without leaking internal hooks or models.
**Where**: `apps/tauri/src/features/transactions/index.ts`
**Depends on**: T24
**Reuses**: existing feature public-entry conventions
**Requirement**: TXL-01

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The entry point exports `TransactionsPage` and no internal mutation/query primitive.
- [x] A co-located public-contract test imports the page only through the feature entry point.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/index.test.ts`.
- [x] Test count: exactly 2 task-owned tests pass; no existing test is removed or skipped.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(transactions): expose transactions feature`

---

#### T26: Register the transactions route

**What**: Add the `/transactions` route to the existing router and render the public transactions page inside the authenticated application shell.
**Where**: `apps/tauri/src/routes/app-routes.tsx`
**Depends on**: T25
**Reuses**: existing route tree, book-route navigation, and application-shell outlet
**Requirement**: TXL-01, TXL-54

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Navigating to `/transactions` renders the feature through the existing shell and does not change existing route behavior.
- [x] Co-located router tests cover direct navigation, shell presence, active-book handoff, and an existing-route regression.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/routes/app-routes.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 5 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `feat(transactions): register transactions route`

---

#### T27: Add transactions to the application shell

**What**: Add the transactions destination, active state, and breadcrumb metadata to the current application shell.
**Where**: `apps/tauri/src/layout/app-shell.tsx`
**Depends on**: T26
**Reuses**: current responsive sidebar, navigation item, breadcrumb, and icon patterns
**Requirement**: TXL-01, TXL-50, TXL-52

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Desktop and mobile navigation expose Transações, highlight it at `/transactions`, and show matching breadcrumb text.
- [x] Keyboard navigation works and unrelated user modifications in the shell remain intact.
- [x] Co-located shell tests cover desktop/mobile link rendering, active state, breadcrumb, keyboard activation, and existing navigation regression.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/layout/app-shell.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Workspace gate passes using every command in the Workspace row.
- [x] Test count: exactly 7 task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: workspace
**Commit**: `feat(transactions): add transactions navigation`

---

## Corrective Verification Cycle 1

#### T28: Prove transaction dialog focus lifecycle

**What**: Add integration evidence that the transaction form Sheet and cancellation confirmation keep keyboard focus within their modal surface and restore focus to the initiating control on close.
**Where**: `apps/tauri/src/features/transactions/components/` dialog integration suites
**Depends on**: T27 and the independent Verifier report
**Reuses**: Base UI Sheet focus guards and the existing controlled-overlay/component test patterns
**Requirement**: TXL-53

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] The form overlay test moves focus through the trailing Base UI focus guard, verifies it returns to the first form action, closes the Sheet, and verifies focus returns to its opener.
- [x] The cancellation confirmation test performs the equivalent containment and focus-return assertions.
- [x] The targeted component suites pass without removing or skipping existing tests.
- [x] Gate check passes: `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-delete-dialog.test.tsx src/features/transactions/components/transaction-overlay.test.tsx`, then `pnpm --filter tauri exec tsc --noEmit`.
- [x] Test count: exactly 2 corrective task-owned tests pass; no existing test is removed or skipped.

**Tests**: integration
**Gate**: full
**Commit**: `test(transactions): cover dialog focus lifecycle`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1: T1 → T2 → T3 → T4 → T5 → T6
Phase 2: T7 → T8 → T9 → T10 → T11 → T12
Phase 3: T13 → T14 → T15 → T16 → T17 → T18
Phase 4: T19 → T20 → T21 → T22 → T23 → T24
Phase 5: T25 → T26 → T27 → T28
Correction 1: T28 (Verifier gap closure)
```

Execution is strictly sequential. Phase boundaries are semantic and are never split across workers. With 27 tasks, the proposed packing is five sequential whole-phase batches of 6, 6, 6, 6, and 3 tasks. Execute must offer the user a choice between inline execution and approved batch sub-agents before dispatching any worker. A fresh independent Verifier still runs after the final task in either mode.

## Requirement Traceability

| Requirement range | Owning tasks                    |
| ----------------- | ------------------------------- |
| TXL-01            | T25, T26, T27                   |
| TXL-02–TXL-10     | T4, T5, T20, T21, T22, T24      |
| TXL-11–TXL-24     | T2, T7–T10, T13–T17, T23, T24   |
| TXL-25–TXL-31     | T2, T5, T11, T15–T17, T21, T23  |
| TXL-32–TXL-40     | T5, T7, T12, T18, T21, T23, T24 |
| TXL-41–TXL-46     | T1, T3, T4, T20, T22, T24       |
| TXL-47–TXL-53     | T1, T2, T14, T18–T24, T27, T28  |
| TXL-54–TXL-59     | T2–T13, T15–T18, T23, T24, T26  |

Coverage target: 59 of 59 requirements have at least one implementation task and spec-derived test owner.

## Task Granularity Check

| Task | Scope                                     | Status      |
| ---- | ----------------------------------------- | ----------- |
| T1   | 1 cohesive pure model module              | ✅ Granular |
| T2   | 1 cohesive pure form-model module         | ✅ Granular |
| T3   | 1 query-key factory file                  | ✅ Granular |
| T4   | 1 infinite-query hook                     | ✅ Granular |
| T5   | 1 detail-query hook                       | ✅ Granular |
| T6   | 1 projection-refresh function in one file | ✅ Granular |
| T7   | 1 guarded mutation executor               | ✅ Granular |
| T8   | 1 income mutation hook                    | ✅ Granular |
| T9   | 1 expense mutation hook                   | ✅ Granular |
| T10  | 1 transfer mutation hook                  | ✅ Granular |
| T11  | 1 amendment mutation hook                 | ✅ Granular |
| T12  | 1 reversal mutation hook                  | ✅ Granular |
| T13  | 1 form-options hook                       | ✅ Granular |
| T14  | 1 shared field component                  | ✅ Granular |
| T15  | 1 income form component                   | ✅ Granular |
| T16  | 1 expense form component                  | ✅ Granular |
| T17  | 1 transfer form component                 | ✅ Granular |
| T18  | 1 deletion dialog component               | ✅ Granular |
| T19  | 1 summary component                       | ✅ Granular |
| T20  | 1 filters component                       | ✅ Granular |
| T21  | 1 row-detail component                    | ✅ Granular |
| T22  | 1 list component                          | ✅ Granular |
| T23  | 1 overlay component                       | ✅ Granular |
| T24  | 1 page-container component                | ✅ Granular |
| T25  | 1 public entry-point file                 | ✅ Granular |
| T26  | 1 route file change                       | ✅ Granular |
| T27  | 1 shell file change                       | ✅ Granular |

## Diagram-Definition Cross-Check

Cross-phase dependencies are represented by the ordered `Phase N → Phase N+1` edge; each within-phase predecessor is represented explicitly.

| Task | Depends On (task body) | Diagram Shows                          | Status   |
| ---- | ---------------------- | -------------------------------------- | -------- |
| T1   | None                   | Phase 1 start                          | ✅ Match |
| T2   | T1                     | T1 → T2                                | ✅ Match |
| T3   | T2                     | T2 → T3                                | ✅ Match |
| T4   | T3                     | T3 → T4                                | ✅ Match |
| T5   | T4                     | T4 → T5                                | ✅ Match |
| T6   | T5                     | T5 → T6                                | ✅ Match |
| T7   | T6                     | Phase 1 → Phase 2                      | ✅ Match |
| T8   | T7                     | T7 → T8                                | ✅ Match |
| T9   | T8                     | T8 → T9                                | ✅ Match |
| T10  | T9                     | T9 → T10                               | ✅ Match |
| T11  | T10                    | T10 → T11                              | ✅ Match |
| T12  | T11                    | T11 → T12                              | ✅ Match |
| T13  | T2, T12                | Phase 2 → Phase 3; T2 already complete | ✅ Match |
| T14  | T13                    | T13 → T14                              | ✅ Match |
| T15  | T8, T14                | T14 → T15; T8 already complete         | ✅ Match |
| T16  | T9, T15                | T15 → T16; T9 already complete         | ✅ Match |
| T17  | T10, T16               | T16 → T17; T10 already complete        | ✅ Match |
| T18  | T12, T17               | T17 → T18; T12 already complete        | ✅ Match |
| T19  | T1, T18                | Phase 3 → Phase 4; T1 already complete | ✅ Match |
| T20  | T19                    | T19 → T20                              | ✅ Match |
| T21  | T5, T20                | T20 → T21; T5 already complete         | ✅ Match |
| T22  | T4, T21                | T21 → T22; T4 already complete         | ✅ Match |
| T23  | T18, T22               | T22 → T23; T18 already complete        | ✅ Match |
| T24  | T6, T23                | T23 → T24; T6 already complete         | ✅ Match |
| T25  | T24                    | Phase 4 → Phase 5                      | ✅ Match |
| T26  | T25                    | T25 → T26                              | ✅ Match |
| T27  | T26                    | T26 → T27                              | ✅ Match |

## Test Co-location Validation

Every task owns the test file adjacent to its implementation file; no later task is allowed to backfill another task's proof.

| Task | Code Layer Created/Modified | Matrix Requires | Task Says   | Status |
| ---- | --------------------------- | --------------- | ----------- | ------ |
| T1   | Pure list model             | unit            | unit        | ✅ OK  |
| T2   | Pure form model             | unit            | unit        | ✅ OK  |
| T3   | Pure query-key helper       | unit            | unit        | ✅ OK  |
| T4   | Infinite-query hook         | integration     | integration | ✅ OK  |
| T5   | Detail-query hook           | integration     | integration | ✅ OK  |
| T6   | Cache refresh integration   | integration     | integration | ✅ OK  |
| T7   | Mutation executor hook      | integration     | integration | ✅ OK  |
| T8   | Income mutation hook        | integration     | integration | ✅ OK  |
| T9   | Expense mutation hook       | integration     | integration | ✅ OK  |
| T10  | Transfer mutation hook      | integration     | integration | ✅ OK  |
| T11  | Amendment mutation hook     | integration     | integration | ✅ OK  |
| T12  | Reversal mutation hook      | integration     | integration | ✅ OK  |
| T13  | Form-option hook            | integration     | integration | ✅ OK  |
| T14  | Shared form component       | integration     | integration | ✅ OK  |
| T15  | Income form component       | integration     | integration | ✅ OK  |
| T16  | Expense form component      | integration     | integration | ✅ OK  |
| T17  | Transfer form component     | integration     | integration | ✅ OK  |
| T18  | Deletion dialog component   | integration     | integration | ✅ OK  |
| T19  | Summary component           | integration     | integration | ✅ OK  |
| T20  | Filter component            | integration     | integration | ✅ OK  |
| T21  | Row-detail component        | integration     | integration | ✅ OK  |
| T22  | List component              | integration     | integration | ✅ OK  |
| T23  | Overlay component           | integration     | integration | ✅ OK  |
| T24  | Page integration component  | integration     | integration | ✅ OK  |
| T25  | Public feature contract     | unit            | unit        | ✅ OK  |
| T26  | Route integration           | integration     | integration | ✅ OK  |
| T27  | Shell integration           | integration     | integration | ✅ OK  |

## Tool Assignment

Confirmed by the user on 2026-09-03:

- T1–T13 and T25–T27: local workspace tools plus `tlc-spec-driven`; MCP NONE.
- T14–T24: local workspace tools plus `tlc-spec-driven`; GitHub MCP only for read-only comparison with the already approved Open Coin and shadcn-fintech references.
- Final interactive UAT: `playwright` skill, if approved and the Tauri/web runtime is available.
- Final independent verification: fresh Verifier required by `tlc-spec-driven`; no remote write, push, deploy, or destructive action.

Available relevant MCPs: GitHub.

Available relevant skills: `tlc-spec-driven`, `playwright`.
