# Validation: Fluxo progressivo de cadastro de investimentos — PASS ✅

**Date**: 2026-11-20
**Spec**: `.specs/features/investment-registration-flow/spec.md`
**Diff range**: `7a2c7c6..80eb198`
**Verifier**: independent sub-agent (author ≠ verifier)

O commit corretivo fechou os dez gaps evidence-or-zero sem alterar produção ou domínio. Todos os critérios têm asserções específicas; gate e sensor estão verdes.

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1–T4 | ✅ Done | Model, etapas, review e orquestrador entregues. |
| T5 | ✅ Done | Matriz completa e gaps corretivos cobertos. |
| T6 | ✅ Done com limite | Chromium coberto; Tauri teve boot, sem jornada do Drawer/IPC/persistência. |
| T7 | ✅ Done | Evidência corretiva para os dez IRFs, sem alteração de produção. |

## Spec-Anchored Acceptance Criteria

| ID | Resultado e evidência | Status |
| --- | --- | --- |
| IRF-01 | Primeira etapa somente com cenário/instrumento/carteira: `open-investment-position-form.test.tsx:416-420`. | ✅ PASS |
| IRF-02 | Voltar preserva custo e rótulo: `apps/tauri/tests/investments-browser-uat.js:135-145`. | ✅ PASS |
| IRF-03 | Nome, tipo, emissor e identificador: `investment-registration-steps.test.tsx:140-153`. | ✅ PASS |
| IRF-04 | Carteira selecionada e BUY preservado; instrumento selecionado: `open-investment-position-form.test.tsx:445-474`. | ✅ PASS |
| IRF-05 | Seis classes, erro e payload UNITS: `open-investment-position-form.test.tsx:662-700`. | ✅ PASS |
| IRF-06 | UNITS exige quantidade; AMOUNT não inventa: `open-investment-position-form.test.tsx:702-720`. | ✅ PASS |
| IRF-07 | Avançado recolhido e termo parcial enviado: `investment-registration-steps.test.tsx:144-149`; `open-investment-position-form.test.tsx:722-739`. | ✅ PASS |
| IRF-08 | OWNED/BUY, renda fixa/não fixa e taxa selecionada: `investment-registration-steps.test.tsx:188-215`. | ✅ PASS |
| IRF-09 | `open` exato, sem purchase/balance: `open-investment-position-form.test.tsx:481-492`. | ✅ PASS |
| IRF-10 | APPLICATION externo explícito: `open-investment-position-form.test.tsx:499-508`. | ✅ PASS |
| IRF-11 | Final bloqueado, confirmação separada, saldo→alocação e 10500: `open-investment-position-form.test.tsx:530-569`. | ✅ PASS |
| IRF-12 | Duas alocações, um saldo: `open-investment-position-form.test.tsx:572-597`. | ✅ PASS |
| IRF-13 | PURCHASE interno e externo: `open-investment-position-form.test.tsx:768-780`, `:857-892`. | ✅ PASS |
| IRF-14 | Mensagem exata e sem purchase: `open-investment-position-form.test.tsx:510-523`. | ✅ PASS |
| IRF-15 | Sem valuation, erro de custo e sem open: `open-investment-position-form.test.tsx:621-630`. | ✅ PASS |
| IRF-16 | Campo ausente e orientação posterior: `open-investment-position-form.test.tsx:625`; `investment-registration-steps.test.tsx:149`. | ✅ PASS |
| IRF-17 | Cenário, instrumento, carteira, custo, quantidade, origem e data: `investment-registration-review.test.tsx:51-58`. | ✅ PASS |
| IRF-18 | Custo, fluxo, caixa, saldo, postings e aviso: `investment-registration-review.test.tsx:59-65`, `:142-181`. | ✅ PASS |
| IRF-19 | Loading bloqueia final e falha bloqueia/retry: `open-investment-position-form.test.tsx:958-995`; ausência sem valores: `investment-registration-review.test.tsx:118-140`. | ✅ PASS |
| IRF-20 | Rascunho, erro focado e mesmo requestId: `open-investment-position-form.test.tsx:1034-1058`. | ✅ PASS |
| IRF-21 | Falha, edição para 20000 e requestId novo: `open-investment-position-form.test.tsx:1060-1090`. | ✅ PASS |
| IRF-22 | Final, Voltar e Cancelar disabled; uma chamada: `open-investment-position-form.test.tsx:996-1032`. | ✅ PASS |
| IRF-23 | Conflito orienta e não aloca: `open-investment-position-form.test.tsx:599-619`. | ✅ PASS |
| IRF-24 | Erro inline associado por ARIA e resumo focado: `open-investment-position-form.test.tsx:644-662`; quantidade duplicada inline/resumo em `:734-744`. | ✅ PASS |
| IRF-25 | Sem livro orienta seleção: `open-investment-position-form.test.tsx:430-433`. | ✅ PASS |
| IRF-26 | Erro recuperável, sem BRL e zero preview/open/purchase/balance: `open-investment-position-form.test.tsx:458-466`. | ✅ PASS |
| IRF-27 | Custo 0, UNITS 10: `open-investment-position-form.test.tsx:632-660`. | ✅ PASS |
| IRF-28 | Componentes incompletos e datas invertidas bloqueiam: `open-investment-position-form.test.tsx:741-766`. | ✅ PASS |
| IRF-29 | Aviso de caixa negativo com final habilitado: `open-investment-position-form.test.tsx:894-922`. | ✅ PASS |

**Status**: 29/29 critérios cobertos e alinhados ao resultado definido pela spec.

## Gate, integridade e edge cases

- Build gate completo: cinco packages, Vitest, TypeScript, ESLint, Vite e `git diff --check`.
- Atual: 89 arquivos, 1.108 passed, 0 failed, 0 skipped.
- Suítes corretivas focais: 3 arquivos, 51 passed, 0 failed, 0 skipped.
- Base `7a2c7c6` em worktree isolado: 86 arquivos, 1.067 passed.
- Delta: +3 arquivos e +41 testes. Os cenários anteriores foram preservados; não houve skip ou enfraquecimento identificado.
- Edge cases completos: livro/moeda ausente, custo zero/unidades, renda fixa inválida, caixa negativo e retry após saldo.
- Aviso não bloqueante: chunk de produção acima de 500 kB, preexistente.

## Discrimination Sensor

Mutações executadas somente em worktrees descartáveis; a árvore real terminou idêntica ao baseline preexistente.

| Mutação | Evidência | Estado |
| --- | --- | --- |
| Roteamento OWNED interno/externo invertido em `open-investment-position-form.tsx:316` | 17/35 falharam; primeira asserção em `open-investment-position-form.test.tsx:482`. | ✅ Killed |
| Saldo inicial perdeu caixa real em `open-investment-position-form.tsx:322` | `amountMinor: 10500` falhou em `open-investment-position-form.test.tsx:567`. | ✅ Killed |
| Emissor removido da busca em `investment-registration-search.ts:17` | Busca “banco” falhou em `investment-registration-steps.test.tsx:113`. | ✅ Killed |
| `intentKey` fixado em `open-investment-position-form.tsx:120` | Novo teste falhou na igualdade do requestId em `open-investment-position-form.test.tsx:1090`. | ✅ Killed |

**Sensor**: lightweight, 4/4 killed no total; a rodada corretiva adicionou 1/1 killed.

## Visual e runtime

- Chromium real 360/1280, fluxo, retenção e foco: `apps/tauri/tests/investments-browser-uat.js:8-29`, `:89-167`. Evidência executada pelo autor; não repetida pelo Verifier.
- Tauri/WebKitGTK: boot e janela nativa em `.specs/features/investment-registration-flow/tasks.md:149`.
- Limite: banco isolado abriu no onboarding; o Drawer nativo não foi repetido. IPC e persistência dessa jornada não são alegados.

## Code Quality

| Princípio | Estado |
| --- | --- |
| Sem mudança de domínio, biblioteca ou automação financeira | ✅ |
| Mudanças cirúrgicas e padrões RHF/Zod/React Query/@workspace/ui | ✅ |
| Model, busca, etapas, review e orquestrador separados | ✅ |
| Spec-anchored outcome e cobertura por camada | ✅ 29/29 |
| Testes reivindicados e sem casos especulativos | ✅ |
| Diretrizes de `coding-principles.md` e `tasks.md` | ✅ |

## Corrective Round

O commit `80eb198` fechou os três fix plans apenas com testes e evidência em `tasks.md`. Nenhuma mudança adicional é necessária.

## Requirement Traceability Update

| Requisitos | Novo status |
| --- | --- |
| IRF-01–IRF-29 | ✅ Verified |

## Summary

**Overall**: ✅ Ready
**Spec-anchored check**: 29/29 completos; 0 gaps; 0 gaps de precisão.
**Gate**: 1.108/1.108, build/tipos/lint/diff-check verdes.
**Sensor**: 4/4 killed no total; 1/1 na rodada corretiva.
**Limite visual**: Chromium real comprovado; Tauri somente boot/janela, sem alegar Drawer nativo, IPC ou persistência.
