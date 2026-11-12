# Fluxo progressivo de cadastro de investimentos - Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.**

**Design**: `.specs/features/investment-registration-flow/design.md`
**Status**: In Progress

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `.specs/features/investments-foundation/tasks.md` e manifests do workspace; não há AGENTS.md ou threshold de cobertura neste repositório.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| React form model | unit | Todos os ramos condicionais, tipos por unidade e validações da spec | `apps/tauri/src/features/investments/forms/*.test.ts` | `pnpm --filter tauri exec vitest run` |
| React components/forms | integration | Happy, edge e erro; comandos, preview, rascunho, teclado observável e retry | `apps/tauri/src/features/investments/forms/*.test.tsx` | `pnpm --filter tauri exec vitest run` |
| Browser/Tauri UI | UAT | Drawer, viewport, foco e fluxo completo quando runtime disponível | `apps/tauri/tests/*uat*` | roteiro existente + inspeção Tauri |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Model ou componente focal | `pnpm --filter tauri exec vitest run <arquivo-de-teste>` |
| Full | Integração do formulário | `pnpm --filter @workspace/domain build && pnpm --filter @workspace/application build && pnpm --filter @workspace/infrastructure-memory build && pnpm --filter @workspace/infrastructure-sqlite build && pnpm --filter @workspace/infrastructure-tauri build && pnpm --filter tauri exec vitest run && pnpm --filter tauri exec tsc --noEmit` |
| Build | Encerramento | Full + `pnpm --filter tauri exec eslint src/features/investments/forms && pnpm --filter tauri build && git diff --check` |

## Execution Plan

### Phase 1: Contrato e componentes

```
T1 → T2 → T3
```

### Phase 2: Integração e validação

```
T3 → T4 → T5 → T6
```

## Task Breakdown

### T1: Modelar o wizard e as regras contextuais

**What**: Remover `valuationDisplay`, expor classificação de tipos, validação por etapa e montagem pura da prévia.
**Where**: `apps/tauri/src/features/investments/forms/open-investment-position-form-model.ts`
**Depends on**: None
**Reuses**: comandos e parsers atuais.
**Requirement**: IRF-05–IRF-08, IRF-15–IRF-16, IRF-27–IRF-28
**Tools**: Skill `ui-ux-pro-max`
**Done when**:
- [x] Todos os tipos unitários exigem UNITS e quantidade positiva.
- [x] Termos parciais válidos e datas inválidas são discriminados.
- [x] O model não contém `valuationDisplay`.
- [x] Testes unitários focais passam.
**Tests**: unit
**Gate**: quick

**Execution evidence (2026-11-12)**: 25/25 testes focais passaram. Cobertura suficiente: tipos por unidade em `open-investment-position-form-model.test.ts:21`, renda fixa em `:25`, quantidade em `:36`, ausência de quantidade inventada em `:51`, termos em `:79` e `:98`, origem externa em `:114`, saldo inicial sem avaliação em `:128` e aplicação externa em `:158`. Cobertura necessária: cada assertion mapeia a IRF-05–IRF-08, IRF-11, IRF-14–IRF-16, IRF-27 ou IRF-28; nenhum teste especulativo foi incluído. Adequacy verdict: PASS.

### T2: Criar componentes reutilizáveis das etapas

**What**: Implementar escolha/busca, dados condicionais, seção avançada e origem em linguagem simples.
**Where**: `apps/tauri/src/features/investments/forms/investment-registration-steps.tsx`
**Depends on**: T1
**Reuses**: Controlled fields, Collapsible, Button e tipos de read model.
**Requirement**: IRF-01–IRF-08, IRF-14, IRF-24
**Tools**: Skill `ui-ux-pro-max`
**Done when**:
- [x] Busca filtra nome, tipo, emissor e identificadores.
- [x] Campos essenciais e avançados são separados.
- [x] Opções contábeis têm linguagem simples e descrição de efeito.
- [x] Testes de integração focais passam.
**Tests**: integration
**Gate**: quick

**Execution evidence (2026-11-12)**: 5/5 testes focais passaram. Cobertura suficiente: busca por emissor/identificador em `investment-registration-steps.test.tsx:109-114`, densidade inicial em `:119-122`, seleção em `:130-138`, revelação avançada e aviso de avaliação separada em `:142-147`, e patrimônio ausente em `:152-159`. Cobertura necessária: assertions mapeiam IRF-01, IRF-03, IRF-07, IRF-08, IRF-11 e IRF-16. Adequacy verdict: PASS.

### T3: Criar revisão contábil reutilizável

**What**: Implementar resumo da posição, estados da prévia, postings, avisos e confirmação de saldo inicial.
**Where**: `apps/tauri/src/features/investments/forms/investment-registration-review.tsx`
**Depends on**: T2
**Reuses**: Card, Alert, formatMinorAmount e preview read model.
**Requirement**: IRF-11, IRF-17–IRF-19, IRF-29
**Tools**: Skill `ui-ux-pro-max`
**Done when**:
- [x] Valores e efeitos têm rótulos legíveis e nomes de contas.
- [x] Falha de prévia oferece retry e não permite confirmação.
- [x] Patrimônio ausente exige confirmação dedicada.
- [x] Testes de integração focais passam.
**Tests**: integration
**Gate**: quick

**Execution evidence (2026-11-12)**: 4/4 testes focais passaram após fortalecer a assertion do saldo inicial para exigir suas duas apresentações intencionais. Cobertura suficiente: resumo e valores em `investment-registration-review.test.tsx:49-53`, confirmação separada em `:79`, falha sem valor obsoleto e retry em `:100-103`, postings nomeados e aviso de caixa negativo em `:144-145`. Cada assertion mapeia IRF-11, IRF-17–IRF-19 ou IRF-29. Adequacy verdict: PASS.

### T4: Integrar o orquestrador progressivo

**What**: Substituir o formulário monolítico pelo wizard preservando hooks, comandos, rascunho e criação rápida.
**Where**: `apps/tauri/src/features/investments/forms/open-investment-position-form.tsx`
**Depends on**: T3
**Reuses**: useInvestmentSubmission, AccountForm, InvestmentInstrumentForm e previewOpening.
**Requirement**: IRF-02, IRF-04, IRF-09–IRF-16, IRF-20–IRF-23, IRF-25–IRF-26
**Tools**: Skill `ui-ux-pro-max`
**Done when**:
- [x] Os cinco caminhos contábeis enviam os comandos existentes corretos.
- [x] O saldo inicial não se repete após falha de alocação.
- [x] Falhas preservam etapa, valores e requestId.
- [x] A criação rápida retorna ao rascunho.
**Tests**: integration
**Gate**: full

**Execution evidence (2026-11-12)**: o orquestrador mantém uma única instância de React Hook Form nas quatro etapas, retorna da criação rápida com as seleções preservadas e reutiliza useInvestmentSubmission para abertura, compra/aplicação e saldo inicial. O gate full passou: cinco builds de pacotes, 89 arquivos/1101 testes React e tsc --noEmit. A suíte focal prova abertura sem lançamento, aplicação externa atômica, compra, saldo inicial explícito seguido de alocação e retry sem repetir o saldo. Adequacy verdict: PASS.

### T5: Atualizar a matriz completa de testes do formulário

**What**: Adaptar e ampliar a suíte para etapas, classes, origens, prévia, erros e idempotência.
**Where**: `apps/tauri/src/features/investments/forms/open-investment-position-form.test.tsx`
**Depends on**: T4
**Reuses**: mocks e fixtures existentes.
**Requirement**: IRF-01–IRF-29
**Tools**: Skill `tlc-spec-driven`
**Done when**:
- [x] Nenhum cenário financeiro existente perde cobertura.
- [x] Busca/criação rápida, review obrigatório e ausência de avaliação são provados.
- [x] Erro, retry, requestId e pending têm assertions de estado e payload.
- [x] Full React passa sem teste pulado.
**Tests**: integration
**Gate**: full

**Execution evidence (2026-11-12)**: 35/35 testes do orquestrador e 69/69 testes focais do fluxo passaram. A matriz cobre as seis classes por unidade, modo por valor, renda fixa parcial/inválida, abertura existente nas três origens, compra interna/externa, confirmação patrimonial separada, ausência de valuationDisplay, prévia, falha após saldo confirmado, conflito, pending e retry com o mesmo requestId. O full React passou com 89 arquivos e 1101 testes, sem skips reportados. Adequacy verdict: PASS.

### T6: Validar layout e runtime

**What**: Ajustar o roteiro visual afetado, validar viewports e executar build/lint/Tauri quando disponível.
**Where**: `apps/tauri/tests/investments-browser-uat.js`
**Depends on**: T5
**Reuses**: harness Chromium/Tauri existente.
**Requirement**: IRF-01, IRF-02, IRF-17–IRF-24
**Tools**: Skill `ui-ux-pro-max`
**Done when**:
- [ ] Roteiro cobre navegação por teclado, retenção e ausência de overflow em 360/1280.
- [ ] Build gate passa.
- [ ] Tauri é inspecionado quando o runtime estiver disponível; limitações são registradas.
**Tests**: integration
**Gate**: build

## Phase Execution Map

```
Phase 1: T1 → T2 → T3
Phase 2: T3 → T4 → T5 → T6
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 model | ✅ Granular |
| T2 | 1 módulo de etapas de apresentação | ✅ Cohesive |
| T3 | 1 componente de revisão | ✅ Granular |
| T4 | 1 orquestrador | ✅ Granular |
| T5 | 1 suíte de integração | ✅ Granular |
| T6 | 1 roteiro UAT | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | raiz | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | T4 → T5 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | form model | unit | unit | ✅ |
| T2 | React components | integration | integration | ✅ |
| T3 | React component | integration | integration | ✅ |
| T4 | React form | integration | integration | ✅ |
| T5 | tests | integration | integration | ✅ |
| T6 | UAT | UAT/integration | integration | ✅ |
