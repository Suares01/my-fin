# Account Form RHF/Zod Validation

## Validation: PASS

**Date**: 2026-09-10  
**Spec**: `.specs/features/account-form-rhf-zod/spec.md`  
**Diff range**: `54dd02d..90359c9`  
**Verifier**: independent sub-agent (author != verifier)  
**Verdict**: PASS

---

## Task Completion

`tasks.md` is absent for this medium-sized feature, so there are no task checkboxes or declared task gate to audit. Validation used the affected Tauri component tests plus package typecheck, lint, and production build.

## Spec-Anchored Acceptance Criteria

| Requirement | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| ACRHF-01 / P1 AC 1 | Empty name and cleared kind block creation and show `Informe um nome para a conta.` / `Escolha Ativo ou Passivo.`. | `apps/tauri/src/features/accounts/components/account-form.test.tsx:66-75` - exact name message and no mutation; `:77-85` - exact kind message and no mutation. Schema messages are defined at `apps/tauri/src/features/accounts/components/account-form-model.ts:3-8`. | PASS |
| ACRHF-02 / P1 AC 2 | Creation receives active `bookId`, trimmed name, and selected kind. | `apps/tauri/src/features/accounts/components/account-form.test.tsx:87-101` - exact `{ bookId: "book-1", name: "Carteira", kind: "ASSET" }`; `:104-120` - exact `kind: "LIABILITY"`. Command construction is `apps/tauri/src/features/accounts/components/account-form.tsx:42-54`. | PASS |
| ACRHF-03 / P1 AC 3 | Rejection retains values and calls an error toast titled `Não foi possível criar a conta`, with safe `accountErrorMessage` text. | `apps/tauri/src/features/accounts/components/account-form.test.tsx:123-138` - exact toast payload, retained `Reserva`, and no exposed `vault.sqlite`; implementation `apps/tauri/src/features/accounts/components/account-form.tsx:56-61`. | PASS |
| ACRHF-04 / P1 AC 4 | Pending creation disables every account field and action. | `apps/tauri/src/features/accounts/components/account-form.test.tsx:141-166` - name, **Ativo**, **Passivo**, Cancelar, and Criar/Criando are all asserted disabled; propagation is `apps/tauri/src/features/accounts/components/account-form.tsx:43,84-103,107-125`. | PASS |
| ACRHF-05 / P1 AC 5 | Shared toggle keeps one selection, error, description, disabled state, and RHF touched state after blur synchronized. | `apps/tauri/src/components/forms/controlled-toggle-group.test.tsx:53-67` - initial option and description; `:70-89` - selected `INCOME` then cleared `""`; `:92-97` - blur changes RHF output to `Tocado`; `:100-115` - RHF error and both disabled options. Wiring is `apps/tauri/src/components/forms/controlled-toggle-group.tsx:29-57`. | PASS |
| ACRHF-06 / P1 AC 6 | Category create mode uses the shared control while retaining default Expense and original income/expense command selection. | `apps/tauri/src/features/categories/components/category-form.test.tsx:101-117` - Expense initially pressed and Income selectable; `:131-170` - exact expense and income command payloads. Reuse is `apps/tauri/src/features/categories/components/category-form.tsx:199-210`. | PASS |

**Status**: 6/6 ACs match their spec-defined outcomes. No spec-precision gap found.

## Edge Cases

| Requirement | Evidence | Result |
| --- | --- | --- |
| ACRHF-07: no active book shows the existing alert and no account fields. | `apps/tauri/src/features/accounts/components/account-form.tsx:65-74`; `apps/tauri/src/features/accounts/components/account-form.test.tsx:168-176` asserts the alert and absent name field. | PASS |
| ACRHF-08: clearing the unique selection stores empty kind and makes required-kind validation possible. | `apps/tauri/src/components/forms/controlled-toggle-group.test.tsx:84-89` asserts submitted `{ kind: "" }`; `apps/tauri/src/features/accounts/components/account-form.test.tsx:77-85` asserts the required-kind schema message after clearing. | PASS |

## Gate Check

| Command | Result |
| --- | --- |
| `pnpm --filter tauri exec vitest run src/components/forms/controlled-toggle-group.test.tsx src/features/accounts/components/account-form.test.tsx` | PASS: 13/13 tests. |
| `pnpm --filter tauri exec vitest run src/components/forms/controlled-toggle-group.test.tsx src/features/accounts/components/account-form.test.tsx src/features/categories/components/category-form.test.tsx` | 26 passed, 4 failed; all four are proven pre-existing category color/icon failures, separated below. |
| `pnpm --filter tauri exec tsc --noEmit` | PASS. |
| `pnpm --filter tauri exec eslint src/components/forms/controlled-toggle-group.tsx src/components/forms/controlled-toggle-group.test.tsx src/features/accounts/components/account-form.tsx src/features/accounts/components/account-form.test.tsx src/features/categories/components/category-form.tsx src/features/categories/components/category-form.test.tsx` | PASS. |
| `pnpm --filter tauri build` | PASS (`tsc && vite build`); only Vite's non-failing chunk-size warning was emitted. |

### Test integrity and baseline separation

- Relevant test count increased from 25 at `54dd02d` (9 account + 16 category) to 30 (9 account + 17 category + 4 shared-toggle): +5. No test was deleted or skipped; account assertions were strengthened.
- An isolated `git archive 54dd02d` scratch run of `category-form.test.tsx` produced exactly 12 passed and these 4 failures, identical to the current combined gate:
  1. `category-form.test.tsx:82` expected default color `f43f5e`, received `""`.
  2. `category-form.test.tsx:225` expected normalized `colorHex: "abcdef"`, received `"f43f5e"` (baseline line 207).
  3. `category-form.test.tsx:256` expected edit color `abcdef`, received `""` (baseline line 238).
  4. `category-form.test.tsx:312` expected the invalid-color schema text, which was absent (baseline line 294).
- These failures are explicitly out of scope in `spec.md:16-18`, do not involve the shared type selector, and do not alter any ACRHF verdict.

## Discrimination Sensor

Sensor depth: lightweight. A `git archive HEAD` scratch under `/tmp` was mutated and deleted; the real-worktree porcelain was identical before and after: ` M apps/tauri/src/features/accounts/components/accounts-page.tsx` and this report as an untracked file. No stash or real-tree mutation was used.

| Mutation | Scratch target | Focused proof | Killed? |
| --- | --- | --- | --- |
| Replace selection propagation with `field.onChange("")`. | `controlled-toggle-group.tsx:54` | Shared-toggle test failed expecting submitted `INCOME`, receiving `""`, at `controlled-toggle-group.test.tsx:78-80`. | PASS |
| Replace account toggle pending state with `disabled={false}`. | `account-form.tsx:98` | Account test failed at `account-form.test.tsx:150-152`: **Ativo** expected `aria-disabled="true"`, received `"false"`. This directly discriminates the new Ativo/Passivo pending assertions. | PASS |
| Replace `onBlur={field.onBlur}` with a no-op. | `controlled-toggle-group.tsx:55` | Shared-toggle test failed at `controlled-toggle-group.test.tsx:92-97`: `Tocado` was absent after blur. | PASS |

**Result**: 3/3 mutations killed.

## Code Quality

| Check | Status |
| --- | --- |
| Minimum/surgical scope; no unrelated product change | PASS. The diff adds the shared control and migrates only account/category form usage and focused tests. |
| Existing RHF/Zod and controlled-field patterns | PASS. `AccountForm` uses `zodResolver`; category creation retains its existing command branches. |
| Tests are outcome-specific and map to requirements | PASS. Each changed test maps to an AC or edge case; assertions target exact messages, payloads, toast data, state, and RHF behavior. |
| Documented quality guidance | PASS. `.codex/skills/tlc-spec-driven/references/validate.md` was followed. |

## Interactive UAT

Not performed. This is an automated jsdom/typecheck/lint/build validation; no browser or native Tauri-runtime evidence is claimed.

## Summary

**Overall**: PASS for all 6 acceptance criteria and 2 edge cases.

- Spec-anchored check: 6/6 ACs, 2/2 edge cases.
- Gate: 26 scoped tests passed; 4 category color/icon failures are baseline-identical and out of scope. Direct RHF/toggle gate: 13/13 passed.
- Sensor: 3/3 behavior-level mutants killed, including pending **Ativo/Passivo** and RHF blur/touched behavior.
- Limit: interactive browser/native UAT was not performed.
