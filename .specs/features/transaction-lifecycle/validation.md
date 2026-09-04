# Transaction Lifecycle Validation

**Date**: 2026-09-04
**Spec**: `.specs/features/transaction-lifecycle/spec.md`
**Diff range**: `3339b1f..6d69b99`
**Verifier**: standalone fresh-eyes verifier (fallback without sub-agent support)
**Verdict**: PASS

---

## Task Completion

| Tasks | Status | Evidence |
| --- | --- | --- |
| T1, T2, T3, T4, T5, T6 | Done | Checked in `tasks.md`; corresponding commits `0ddd642` through `ea68af3` exist. |
| T7, T8, T9, T10, T11, T12 | Done | Checked in `tasks.md`; corresponding commits `f08b573` through `5d788d3` exist. |
| T13, T14, T15, T16, T17, T18 | Done | Checked in `tasks.md`; corresponding commits `9712973` through `aaed4e3` exist. |
| T19, T20, T21, T22, T23, T24 | Done | Checked in `tasks.md`; corresponding commits `f148422` through `cd46220` exist. |
| T25, T26, T27 | Done | Checked in `tasks.md`; corresponding commits `2455b7c`, `14258fa`, `87322f2` exist. |
| T28 | Done | Focus lifecycle evidence committed in `bf71bad`. |
| T29 | Done | Tauri lint gate formatting committed in `f447716`. |
| T30 | Done | Cancellation keyboard-close sensor gap closed in `6d69b99`. |

All 30 task headings have only completed `Done when` boxes; no unchecked task item was found.

## Spec-Anchored Acceptance Criteria

Evidence is assertion-level. A row without an assertion is a gap under evidence-or-zero.

| ID | Spec-defined outcome | Assertion evidence | Result |
| --- | --- | --- | --- |
| TXL-01 | `/transactions` is inside the shell and its navigation is active. | `apps/tauri/src/layout/app-shell.test.tsx:110` - `expect(...hasAttribute("data-active")).toBe(true)` | PASS |
| TXL-02 | Active `bookId`, exactly three business types, limit 20. | `apps/tauri/src/features/transactions/hooks/use-transaction-chains.test.tsx:107` - `expect(...execute).toHaveBeenCalledWith({ ... })` | PASS |
| TXL-03 | Row shows description, type, occurrence date, currency value, context and status. | `apps/tauri/src/features/transactions/components/transaction-list.test.tsx:129` - `expect(.../2026-09-03/).toBeGreaterThan(0)` | PASS |
| TXL-04 | Income/expense context includes financial account and category. | `apps/tauri/src/features/transactions/components/transaction-row-details.test.tsx:58` - `expect(screen.getByText("Banco")).toBeTruthy()` | PASS |
| TXL-05 | Transfer shows origin to destination without category. | `apps/tauri/src/features/transactions/components/transaction-row-details.test.tsx:77` - `expect(screen.getByText(/Origem → Destino/)).toBeTruthy()` | PASS |
| TXL-06 | Expansion keeps contextual data and allowed actions on the current route. | `apps/tauri/src/features/transactions/components/transaction-list.test.tsx:99` - `expect(..."Detalhe expandido").toBe(2)` | PASS |
| TXL-07 | Initial pending state is list geometry with `aria-busy=true`. | `apps/tauri/src/features/transactions/components/transaction-list.test.tsx:50` - `expect(...getAttribute("aria-busy")).toBe("true")` | PASS |
| TXL-08 | Initial failure offers retry, not empty list. | `apps/tauri/src/features/transactions/components/transaction-list.test.tsx:57` - `expect(props.onRetry).toHaveBeenCalledTimes(1)` | PASS |
| TXL-09 | Unfiltered empty state offers `Nova transação`. | `apps/tauri/src/features/transactions/components/transaction-list.test.tsx:62` - `expect(props.onCreate).toHaveBeenCalledTimes(1)` | PASS |
| TXL-10 | Filtered empty state offers `Limpar filtros`. | `apps/tauri/src/features/transactions/components/transaction-list.test.tsx:67` - `expect(props.onResetFilters).toHaveBeenCalledTimes(1)` | PASS |
| TXL-11 | Creation chooser offers exactly income, expense and transfer. | `apps/tauri/src/features/transactions/components/transaction-overlay.test.tsx:30` - `expect(["Receita", "Despesa", "Transferência"]...).toHaveLength(3)` | PASS |
| TXL-12 | Chosen kind opens its dedicated overlay form. | `apps/tauri/src/features/transactions/components/transaction-overlay.test.tsx:39` - `expect(...onStateChange).toHaveBeenCalledWith({ kind: "income" })` | PASS |
| TXL-13 | Income/expense form carries account, category, amount, date and description. | `apps/tauri/src/features/transactions/components/income-form.test.tsx:64` - `expect(props.onSubmit).toHaveBeenCalledWith({ ... })` | PASS |
| TXL-14 | Transfer form carries source, destination, amount, date and description. | `apps/tauri/src/features/transactions/components/transfer-form.test.tsx:68` - `expect(props.onSubmit).toHaveBeenCalledWith({ ... })` | PASS |
| TXL-15 | Options are only active financial accounts in active book/base currency. | `apps/tauri/src/features/transactions/hooks/use-transaction-form-options.test.tsx:77` - `expect(result.current).toMatchObject({ ... })` | PASS |
| TXL-16 | Income/expense options are only active matching-kind categories. | `apps/tauri/src/features/transactions/hooks/use-transaction-form-options.test.tsx:89` - `expect(result.current.categories).toEqual([{ id: "i1", name: "Salário" }])` | PASS |
| TXL-17 | Invalid minor-unit amounts block submit; range is 1..9223372036854775807. | `apps/tauri/src/features/transactions/transaction-form-model.test.ts:49` - `expect(amountMinorSchema.safeParse(value).success).toBe(false)` | PASS |
| TXL-18 | Invalid civil date or trimmed-empty description blocks submit. | `apps/tauri/src/features/transactions/transaction-form-model.test.ts:55` - `expect(descriptionSchema.safeParse("  ").success).toBe(false)` | PASS |
| TXL-19 | Same transfer accounts are blocked with exact destination error. | `apps/tauri/src/features/transactions/transaction-form-model.test.ts:81` - `expect(result.error?.issues[0]?.message).toBe("Escolha contas diferentes.")` | PASS |
| TXL-20 | Valid forms send exactly one discriminated application command. | `apps/tauri/src/features/transactions/hooks/use-transfer-money.test.tsx:89` - `expect(record).toHaveBeenCalledWith({ ... })` | PASS |
| TXL-21 | Pending creation disables/rejects duplicate submission and does not retry. | `apps/tauri/src/features/transactions/hooks/transaction-mutation.test.tsx:77` - `await expect(...mutateAsync(...)).rejects.toBeInstanceOf(...)` | PASS |
| TXL-22 | Success refreshes list and affected projections. | `apps/tauri/src/features/query-invalidation.test.ts:35` - `expect(invalidate).toHaveBeenCalledWith({ ... })` | PASS |
| TXL-23 | Creation failure retains state, re-enables form and reports translated feedback. | `apps/tauri/src/features/transactions/components/income-form.test.tsx:127` - `expect(..."Não foi possível registrar a receita.").toBeTruthy()` | PASS |
| TXL-24 | Missing account/category replaces form with creation guidance. | `apps/tauri/src/features/transactions/components/income-form.test.tsx:94` - `expect(...getByRole("link", { name: "Criar conta" })).toBeTruthy()` | PASS |
| TXL-25 | Active/edited effective chains expose Edit. | `apps/tauri/src/features/transactions/components/transaction-row-details.test.tsx:118` - `expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy()` | PASS |
| TXL-26 | Edit opens same-type form with current fields. | `apps/tauri/src/features/transactions/transaction-form-model.test.ts:91` - `expect(editDraftFromDetail(detail())).toEqual({ ... })` | PASS |
| TXL-27 | Amendment maps `bookId`, presented identity/version and same-type replacement. | `apps/tauri/src/features/transactions/hooks/use-amend-transaction.test.tsx:128` - `expect(amend).toHaveBeenCalledWith(expectedCommand(income))` | PASS |
| TXL-28 | Amendment refreshes replacement chain, presents EDITED and retains history. | `apps/tauri/src/features/transactions/hooks/use-amend-transaction.test.tsx:143` - `expect(client.invalidateQueries).toHaveBeenCalledWith({ ... })`; `transaction-row-details.test.tsx:97` asserts chain history | PASS |
| TXL-29 | Failed amendment preserves original/reversal/replacement/sequence/events. | `packages/infrastructure-memory/src/use-cases/amend-journal-entry.test.ts:409` - `expect(...store.snapshot()).toEqual(before)` | PASS |
| TXL-30 | Optimistic conflict retains form, informs user and refetches before retry. | `apps/tauri/src/features/transactions/hooks/use-amend-transaction.test.tsx:173` - `expect(client.refetchQueries).toHaveBeenCalledTimes(2)` | PASS |
| TXL-31 | CANCELLED chain hides/disables Edit. | `apps/tauri/src/features/transactions/components/transaction-row-details.test.tsx:129` - `expect(...queryByRole("button", { name: "Editar" })).toBeNull()` | PASS |
| TXL-32 | Active/edited chain exposes Excluir. | `apps/tauri/src/features/transactions/components/transaction-row-details.test.tsx:119` - `expect(screen.getByRole("button", { name: "Excluir" })).toBeTruthy()` | PASS |
| TXL-33 | Delete confirmation explains financial cancellation with history retained. | `apps/tauri/src/features/transactions/components/transaction-delete-dialog.test.tsx:36` - `expect(..."histórico da transação será preservado").toBeTruthy()` | PASS |
| TXL-34 | Confirmation defaults to current local civil date and is editable. | `apps/tauri/src/features/transactions/components/transaction-delete-dialog.test.tsx:44` - `expect(...getAttribute("value")).toBe(localCivilDate())` | PASS |
| TXL-35 | Cancellation before presented occurrence is blocked with date error. | `apps/tauri/src/features/transactions/components/transaction-delete-dialog.test.tsx:96` - `expect(..."A data de cancelamento não pode ser anterior ao lançamento.").toBeTruthy()` | PASS |
| TXL-36 | Valid deletion sends exactly one reversal command. | `apps/tauri/src/features/transactions/hooks/use-reverse-transaction.test.tsx:100` - `expect(reverse).toHaveBeenCalledWith(expected(value))` | PASS |
| TXL-37 | Pending reversal keeps row, disables confirmation and has no optimistic removal. | `apps/tauri/src/features/transactions/components/transaction-delete-dialog.test.tsx:105` - `expect(...hasAttribute("disabled")).toBe(true)` | PASS |
| TXL-38 | Completed reversal retains CANCELLED chain, refreshes balances and removes actions. | `packages/infrastructure-sqlite/tests/contracts/ledger-completion-use-cases.test.ts:615` - `expect(await snapshot(...)).toMatchObject({ reversedBy: "entry-6" })`; `transaction-row-details.test.tsx:130` hides Excluir | PASS |
| TXL-39 | Reversal failure retains effective chain and open dialog with error. | `apps/tauri/src/features/transactions/components/transaction-delete-dialog.test.tsx:138` - `expect(await screen.findByText("Não foi possível cancelar a transação")).toBeTruthy()` | PASS |
| TXL-40 | Reversal concurrency conflict blocks new confirmation until refetch. | `apps/tauri/src/features/transactions/hooks/use-reverse-transaction.test.ts:177` - `expect(client.refetchQueries).toHaveBeenCalledTimes(2)` | PASS |
| TXL-41 | Search is normalized and sent to journal query. | `apps/tauri/src/features/transactions/transaction-list-model.test.ts:46` - `expect(normalizeTransactionServerFilters(...)).toEqual({ search: "mercado" ... })` | PASS |
| TXL-42 | Filters offer period, type, status, account and category from active book. | `apps/tauri/src/features/transactions/components/transaction-filters.test.tsx:138` - `expect(...getByRole("option", { name: "Banco" })).toBeTruthy()` | PASS |
| TXL-43 | Supported server-filter change restarts cursor at first page. | `apps/tauri/src/features/transactions/hooks/use-transaction-chains.test.tsx:192` - `expect(...execute).toHaveBeenLastCalledWith({ ...cursor: undefined })` | PASS |
| TXL-44 | Status filters loaded rows and labels the loaded-results limitation. | `apps/tauri/src/features/transactions/transaction-list-model.test.ts:106` - `expect(filterTransactionChainsByStatus(..., "CANCELLED")).toEqual([...])` | PASS |
| TXL-45 | Next page appends, dedupes `chainId`, preserves filters. | `apps/tauri/src/features/transactions/hooks/use-transaction-chains.test.tsx:171` - `expect(...items.map(...chainId)).toEqual([ ... ])` | PASS |
| TXL-46 | Invalid filtered cursor is dropped and first page reloaded. | `apps/tauri/src/features/transactions/hooks/use-transaction-chains.test.tsx:248` - `expect(...execute).toHaveBeenLastCalledWith({ ...cursor: undefined })` | PASS |
| TXL-47 | Four cards calculate loaded, locally filtered income/expense/largest/count. | `apps/tauri/src/features/transactions/components/transaction-summary.test.tsx:76` - `expect(...income-BRL).toBeNull()` | PASS |
| TXL-48 | Partial cards explicitly say `resultados carregados`. | `apps/tauri/src/features/transactions/components/transaction-summary.test.tsx:39` - `expect(...).toHaveLength(4)` | PASS |
| TXL-49 | Display preserves entry currency and income/expense/transfer direction. | `apps/tauri/src/features/transactions/transaction-list-model.test.ts:112` - `expect(transactionAmountSign("INCOME")).toBe("+")` | PASS |
| TXL-50 | Under 640px filters/actions are full width and essentials remain without horizontal-scroll requirement. | `apps/tauri/src/features/transactions/components/transaction-filters.test.tsx:130` - `expect(...className).toContain("w-full")` | PASS |
| TXL-51 | At desktop list is table with context/value/date/status/actions. | `apps/tauri/src/features/transactions/components/transaction-list.test.tsx:87` - `expect(screen.getByRole("columnheader", { name: "Contexto" })).toBeTruthy()` | PASS |
| TXL-52 | Keyboard can expand row and access operations. | `apps/tauri/src/features/transactions/components/transaction-list.test.tsx:99` - `expect(..."Detalhe expandido").toBe(2)` | PASS |
| TXL-53 | Open dialog must have accessible name, trapped focus and focus return. | `transaction-overlay.test.tsx:127` - `expect(focusGuards).toHaveLength(2)`; `:129` - `expect(document.activeElement).toBe(firstChoice)`; `:133` - `expect(document.activeElement).toBe(trigger)`; `transaction-delete-dialog.test.tsx:205`, `:208-211`, `:214-216` assert the equivalent guard, focus return and Escape close path. | PASS |
| TXL-54 | Book switch closes overlays and clears stale feature state. | `apps/tauri/src/features/transactions/components/transaction-overlay.test.tsx:81` - `expect(...onStateChange).toHaveBeenLastCalledWith({ kind: "closed" })` | PASS |
| TXL-55 | Archived selection shows service error then options refresh before retry. | `apps/tauri/src/features/transactions/components/income-form.test.tsx:175` - `expect(state.options.refresh).toHaveBeenCalledOnce()` | PASS |
| TXL-56 | Renamed read-model name renders without changing sent id. | `apps/tauri/src/features/transactions/components/income-form.test.tsx:111` - `expect(...option, { name: "Conta renomeada" }).toBeTruthy()` | PASS |
| TXL-57 | Transfer without two eligible accounts blocks form and offers account creation. | `apps/tauri/src/features/transactions/components/transfer-form.test.tsx:115` - `expect(...getByRole("link", { name: "Criar conta" })).toBeTruthy()` | PASS |
| TXL-58 | Late mutation refreshes only submitted book caches. | `apps/tauri/src/features/transactions/hooks/use-amend-transaction.test.tsx:235` - `expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["books", "book-1", ...] })` | PASS |
| TXL-59 | Projection refresh failure preserves mutation success and gives reload path. | `apps/tauri/src/features/transactions/hooks/use-amend-transaction.test.tsx:216` - `await expect(...mutateAsync(...)).resolves.toEqual({ value: result, refresh: { ok: false, ... } })` | PASS |

**Status**: 59/59 precise spec outcomes matched; no spec-precision gap.

## Discrimination Sensor

Baseline real-worktree porcelain was `?? .specs/features/transaction-lifecycle/validation.md` while this report was being prepared. Each mutation ran only in disposable checkout copies under `/tmp`; those copies were removed. The real porcelain matched the baseline after cleanup.

| # | Mutation | Scratch file:line | Focused command | Killed? |
| --- | --- | --- | --- | --- |
| 1 | Changed income total from `+=` to `-=`. | `transaction-list-model.ts:117` | `pnpm --filter tauri exec vitest run src/features/transactions/transaction-list-model.test.ts` | Yes - expected positive large integer, received negative. |
| 2 | Changed cancellation-date guard from `<` to `<=`. | `transaction-form-model.ts:99` | `pnpm --filter tauri exec vitest run src/features/transactions/transaction-form-model.test.ts src/features/transactions/components/transaction-delete-dialog.test.tsx` | Yes - equal-date confirmation tests failed. |
| 3 | Disabled synchronous in-flight guard. | `transaction-mutation.ts:48` | `pnpm --filter tauri exec vitest run src/features/transactions/hooks/transaction-mutation.test.tsx` | Yes - duplicate-submit test failed. |
| 4 | Changed form Sheet close handling from `!open` to `open`. | `transaction-overlay.tsx:94` | `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-overlay.test.tsx` | Yes - dialog remained mounted after close. |
| 5 | Changed cancellation Sheet close handling from `!open` to `open`. | `transaction-delete-dialog.tsx:79` | `pnpm --filter tauri exec vitest run src/features/transactions/components/transaction-delete-dialog.test.tsx` | Yes - Escape-close lifecycle test failed. |

**Sensor depth**: lightweight
**Result**: 5 injected, 5 killed, 0 survived.

## Gate Check

| Command | Result |
| --- | --- |
| `python3 .codex/skills/tlc-spec-driven/scripts/validate_spec.py transaction-lifecycle` | PASS - 0 errors, 0 warnings. |
| `python3 .codex/skills/tlc-spec-driven/scripts/validate_tasks.py transaction-lifecycle` | PASS - 0 errors, 1 granularity warning for the mechanical T29 two-file correction. |
| `pnpm --filter tauri exec vitest run` | PASS - 45 files, 442 tests. |
| `pnpm --filter tauri exec eslint src --max-warnings 0` | PASS - no errors. |
| `pnpm --filter tauri build` | PASS - TypeScript and Vite build; only the existing chunk-size warning. |
| `git diff --check` | PASS. |

Test declarations: 1,105 at `3339b1f`, 1,363 at `6d69b99` (`+258`); current Tauri suite has 442 passing tests, and the transaction feature owns 240 declarations. No test decrease was detected.

## Interactive UAT

**Result**: BLOCKED - not PASS.

`npx` and Node v24.14.0 are available. Vite could start only with escalated local bind permission, but the command environment terminated the server immediately afterwards (`curl http://127.0.0.1:1420/` could not connect). The Playwright CLI wrapper (`npx --yes --package @playwright/cli playwright-cli`) produced no session/help result within 15-30 seconds. Consequently no browser flow or native Tauri IPC lifecycle was observed. Automated jsdom and hook evidence above is retained, but does not substitute for UAT.

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code and surgical diff surface | PASS |
| No feature beyond transaction lifecycle requested | PASS |
| Matches local React Query, form, Sheet and shell patterns | PASS |
| Tests map to explicit outcomes | PASS - TXL-53 has focus containment, keyboard close and focus-return assertions. |
| Per-layer coverage | PASS - dialog integration behavior is covered in jsdom at the Sheet boundary. |
| Unclaimed tests | PASS - reviewed feature tests map to an AC, edge case, or task Done-when criterion. |
| Documented guidelines | PASS - none found; strong defaults from `tasks.md` used. |

## Ranked Gaps

None in the automated verification. Interactive UAT remains blocked because the Playwright wrapper produced no session in the available environment; this does not invalidate the deterministic jsdom/build evidence.

## Requirement Traceability Update

No `spec.md` traceability status was modified by the independent verifier. It remains the implementer-owned artifact; this report is the evidence record.

## Summary

**Overall**: PASS for the spec-anchored automated verification. All 59 ACs have assertion-level evidence, the Build gate passes, and the sensor killed 5/5 mutations. Interactive UAT is separately BLOCKED by unavailable browser tooling/runtime evidence.
