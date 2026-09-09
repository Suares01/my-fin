# Metadados Visuais e Gestão de Categorias — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow, including the per-task cycle, atomic commits, batch delegation, independent Verifier and discrimination sensor.

**If the skill cannot be activated, STOP and tell the user. Do not proceed without it.**

Cada tarefa deve atualizar seu checkbox e a rastreabilidade da spec antes do próprio commit. O commit inclui código, testes e artefatos `.specs` da tarefa. Não executar push, deploy ou alteração externa.

---

**Design:** `.specs/features/category-management-enhancements/design.md`
**Status:** Draft — aguardando aprovação para Execute
**Total:** 25 tarefas, 5 fases, 3 batches previstos

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: none; strong defaults applied. Commands and conventions were inferred from `package.json`, `turbo.json` and sampled Vitest suites in domain, application, memory, SQLite, UI and Tauri.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain aggregate and validation | unit | All branches, conditional account/category invariants, exact version/fact outcomes and all invalid formats | `packages/domain/src/**/*.test.ts` | `pnpm --filter @workspace/domain test` |
| Application contracts and dispatcher | unit | Public type/export surface and exact event allowlist/envelope behavior | `packages/application/src/**/*.test.ts` | `pnpm --filter @workspace/application test` |
| Category use cases | integration with memory adapters | Happy path, no-op, duplicate, wrong book/entity/kind, stale version, rollback and exact published facts | `packages/infrastructure-memory/src/use-cases/*.test.ts` | `pnpm --filter @workspace/infrastructure-memory test` |
| SQLite migration | integration | Upgrade/backfill for both kinds, non-category preservation, insert/update triggers, idempotency and rollback | `packages/infrastructure-sqlite/tests/migrations/*.test.ts` | `pnpm --filter @workspace/infrastructure-sqlite test` |
| SQLite mapper/repository/query | unit + integration | Round trip, CAS, corruption/error handling and every category query shape | `packages/infrastructure-sqlite/{src,tests}/**/*.test.ts` | `pnpm --filter @workspace/infrastructure-sqlite test` |
| Shared ColorPicker | integration from Tauri jsdom | Controlled value/reset fidelity, RGB↔HSL conversion, no divergent echo and opaque output | `apps/tauri/src/components/forms/*.test.tsx` | `pnpm --filter tauri exec vitest run src/components/forms` |
| Tauri controlled fields and icon selector | component integration | RHF registration, errors, reset, disabled, keyboard and accessible selected state | `apps/tauri/src/components/forms/*.test.tsx`, `apps/tauri/src/features/categories/components/*.test.tsx` | `pnpm --filter tauri exec vitest run src/components/forms src/features/categories/components` |
| Tauri facade, hooks and cache | unit + hook integration | Exact commands, no retries/duplicates, book-scoped keys, three cache families, conflict and partial invalidation | `apps/tauri/src/{bootstrap,features/categories/hooks}/**/*.test.ts*` | `pnpm --filter tauri exec vitest run src/bootstrap/create-services.test.ts src/features/categories/hooks` |
| Category form/page/card | component integration | Every UI AC and edge case, including create/edit/archive/reactivate, filters, states, toasts and book switch | `apps/tauri/src/features/categories/components/*.test.tsx` | `pnpm --filter tauri exec vitest run src/features/categories/components` |
| Runtime accessibility and visuals | interactive UAT | Keyboard operation, focus return, opaque picker, actual icon/color rendering and fallback in a real runtime | Verifier `validation.md` | Tauri/browser walkthrough during final verification |

### Baseline captured on 2026-09-09

| Package/scope | Baseline |
| --- | --- |
| `@workspace/domain` | 10 files, 156 tests passing |
| `@workspace/application` | 17 files, 202 tests passing |
| `@workspace/infrastructure-memory` | 23 files, 214 tests passing |
| `@workspace/infrastructure-sqlite` | 38 files, 670 tests passing |
| `@workspace/ui` | 1 file, 23 tests passing |
| Tauri focused categories/forms/bootstrap | 7 files, 53 tests passing |
| Tauri full suite, informational | 58 files, 548 tests: 533 passing and 15 pre-existing failures in transaction filters/table/forms |

Cada tarefa registra o total obtido no commit. O total do escopo afetado não pode ficar abaixo do baseline imediatamente anterior à tarefa. Os mínimos de casos novos listados abaixo impedem que um teste antigo seja removido para compensar um novo.

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick Domain | Alterações no agregado/validação | `pnpm --filter @workspace/domain test && pnpm --filter @workspace/domain check-types` |
| Quick Application | Ports, dispatcher e exports | `pnpm --filter @workspace/domain build && pnpm --filter @workspace/application test && pnpm --filter @workspace/application check-types` |
| Full Application | Casos de uso e transações em memória | `pnpm --filter @workspace/domain build && pnpm --filter @workspace/application build && pnpm --filter @workspace/infrastructure-memory test && pnpm --filter @workspace/infrastructure-memory check-types` |
| Full SQLite | Migração, mapper, repository e queries | `pnpm --filter @workspace/domain build && pnpm --filter @workspace/application build && pnpm --filter @workspace/infrastructure-memory build && pnpm --filter @workspace/infrastructure-sqlite check:migrations && pnpm --filter @workspace/infrastructure-sqlite test && pnpm --filter @workspace/infrastructure-sqlite check-types` |
| Quick UI | `ColorPicker` compartilhado | `pnpm --filter @workspace/ui test && pnpm --filter @workspace/ui typecheck` |
| Quick Tauri | Facade, fields, hooks e componentes de categoria | `pnpm --filter @workspace/domain build && pnpm --filter @workspace/application build && pnpm --filter @workspace/infrastructure-sqlite build && pnpm --filter tauri exec vitest run src/bootstrap/create-services.test.ts src/components/forms src/features/categories` |
| Build Scoped | Encerramento de cada fase | `pnpm --filter @workspace/domain lint && pnpm --filter @workspace/domain build && pnpm --filter @workspace/application lint && pnpm --filter @workspace/application build && pnpm --filter @workspace/infrastructure-memory lint && pnpm --filter @workspace/infrastructure-memory build && pnpm --filter @workspace/infrastructure-sqlite lint && pnpm --filter @workspace/infrastructure-sqlite build && git diff --check` |
| Final Feature | Última tarefa, antes do Verifier | Executar todos os gates anteriores, `pnpm --filter @workspace/ui lint`, `pnpm --filter tauri exec tsc --noEmit`, `pnpm --filter tauri exec eslint . --max-warnings 0`, `pnpm --filter tauri build` e comparar a suíte Tauri completa com o baseline documentado |

A suíte Tauri completa não é gate isolado enquanto as 15 falhas preexistentes permanecerem fora desta feature. O gate obrigatório é: todos os testes focados passam, nenhum teste antes verde regride e o conjunto de falhas completo não aumenta. O Verifier relata essa limitação separadamente.

---

## Execution Plan

As fases e tarefas são estritamente sequenciais.

### Phase 1: Domain and application boundary

```text
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8
```

### Phase 2: SQLite persistence and read models

```text
T9 -> T10 -> T11 -> T12
```

### Phase 3: Tauri services, cache and icon registry

```text
T13 -> T14 -> T15 -> T16 -> T17
```

### Phase 4: Controlled fields and shared category form

```text
T18 -> T19 -> T20 -> T21 -> T22
```

### Phase 5: Category management page

```text
T23 -> T24 -> T25
```

### Planned execution batches

| Batch | Whole phases | Tasks | Execution |
| --- | --- | --- | --- |
| B1 | Phase 1 | T1–T8 | Sequential |
| B2 | Phases 2–3 | T9–T17 | Sequential |
| B3 | Phases 4–5 | T18–T25 | Sequential |

Como o plano excede oito tarefas, o Execute deve oferecer esses três workers de batch antes de iniciar. Os batches nunca executam em paralelo. O Verifier independente roda depois de T25, mesmo se o usuário preferir execução sem workers.

---

## Task Breakdown

### Phase 1: Domain and application boundary

#### T1: Model category appearance in LedgerAccount

**What:** Adicionar aparência condicional, validação canônica, refinamento de categoria gerenciável e `updateCategory` ao agregado existente.
**Where:** `packages/domain/src/ledger/accounts/`
**Depends on:** None
**Reuses:** `LedgerAccount`, `AggregateRoot`, `DomainError`, normalização de nome e padrão de testes do agregado.
**Requirements:** CAT-01, CAT-02, CAT-07, CAT-09, CAT-10, CAT-33, CAT-34, CAT-35, CAT-70, CAT-71

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [x] Categorias gerenciáveis exigem `iconKey` slug e `colorHex` canônico; contas financeiras/sistema rejeitam aparência.
- [x] `updateCategory` altera nome/ícone/cor em uma versão e um fato, e valores idênticos são no-op.
- [x] Create, restore e snapshot preservam as invariantes sem introduzir fatos na restauração.
- [x] Pelo menos 10 casos unitários novos cobrem todos os branches acima e o total do pacote não diminui.
- [x] Quick Domain passa.

**Tests:** unit
**Gate:** Quick Domain
**Commit:** `feat(domain): add category visual metadata invariants`

#### T2: Define category commands and DTO contracts

**What:** Criar contratos tipados de create/update/archive/reactivate e DTO/read summaries com aparência obrigatória, mantendo `AccountDto` inalterado.
**Where:** `packages/application/src/ports/`
**Depends on:** T1
**Reuses:** Commands e DTOs existentes, `CategorySummary` e tipos do domínio.
**Requirements:** CAT-01, CAT-04, CAT-24, CAT-36, CAT-37

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [x] `CreateCategoryCommand` exige kind literal, ícone e cor.
- [x] Os três commands dedicados usam `categoryId`; update inclui nome, aparência e `expectedVersion`.
- [x] `CategoryDto` e todos os summaries expõem aparência obrigatória; `AccountDto` não expõe esses campos.
- [x] Pelo menos 2 casos de contrato/public API são adicionados e o total não diminui.
- [x] Quick Application passa.

**Tests:** unit/type contract
**Gate:** Quick Application
**Commit:** `feat(application): add category management contracts`

#### T3: Register CategoryUpdated in domain event dispatch

**What:** Permitir que o dispatcher publique `CategoryUpdated` com envelope e payload resultante estáveis.
**Where:** `packages/application/src/core/`
**Depends on:** T2
**Reuses:** `ApplicationEventType`, `DomainEventDispatcher` e testes de allowlist/envelope.
**Requirements:** CAT-38, CAT-71

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [x] A allowlist aceita `CategoryUpdated` e continua rejeitando tipos desconhecidos.
- [x] O envelope preserva aggregate ID/version, book ID e appearance resultante.
- [x] Pelo menos 2 casos unitários novos cobrem sucesso e proteção da allowlist; o total não diminui.
- [x] Quick Application passa.

**Tests:** unit
**Gate:** Quick Application
**Commit:** `feat(application): publish category updated events`

#### T4: Create categories with visual metadata

**What:** Adaptar as criações de receita e despesa para validar, persistir, retornar e publicar aparência.
**Where:** `packages/application/src/ledger/accounts/`
**Depends on:** T3
**Reuses:** `CreateIncomeCategory`, `CreateExpenseCategory`, `executeUseCase` e harness em memória.
**Requirements:** CAT-01, CAT-09, CAT-10, CAT-24, CAT-36, CAT-38

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [x] Ambos os casos de uso gravam e retornam `iconKey`/`colorHex` canônicos.
- [x] Cor/ícone inválidos, kind incorreto, livro ausente e duplicidade deixam store e publisher intactos.
- [x] O fato de criação contém o snapshot visual completo.
- [x] Pelo menos 6 casos de integração novos distribuem happy/error paths entre receita e despesa; o total não diminui.
- [x] Full Application passa.

**Tests:** integration
**Gate:** Full Application
**Commit:** `feat(application): create categories with visual metadata`

#### T5: Add atomic UpdateCategory use case

**What:** Implementar `UpdateCategory` com boundary de categoria, CAS, duplicidade, no-op e DTO/fato únicos.
**Where:** `packages/application/src/ledger/accounts/`
**Depends on:** T4
**Reuses:** `executeUseCase`, repository `existsWithName`, assertions de livro/versão e harness em memória.
**Requirements:** CAT-29, CAT-30, CAT-31, CAT-32, CAT-33, CAT-34, CAT-35, CAT-36, CAT-38, CAT-71

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [x] Mudanças isoladas e combinadas geram uma versão, um save e um `CategoryUpdated`.
- [x] No-op retorna DTO sem save, versão ou fato novos.
- [x] Conta financeira/sistema, outro livro, stale version, duplicidade e entradas inválidas não alteram estado/fatos.
- [x] Pelo menos 9 casos de integração novos cobrem todos os outcomes; o total não diminui.
- [x] Full Application passa.

**Tests:** integration
**Gate:** Full Application
**Commit:** `feat(application): add atomic category updates`

#### T6: Add dedicated ArchiveCategory use case

**What:** Implementar arquivamento que aceite somente categoria gerenciável e retorne `CategoryDto`.
**Where:** `packages/application/src/ledger/accounts/`
**Depends on:** T5
**Reuses:** `ArchiveLedgerAccount`, assertions comuns e transação/fatos existentes.
**Requirements:** CAT-30, CAT-31, CAT-37, CAT-38

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [x] Categoria ativa é arquivada com appearance preservada e uma transição versionada.
- [x] Categoria já arquivada com versão atual é no-op.
- [x] Conta financeira/sistema, livro incorreto e stale version são rejeitados sem escrita/fato.
- [x] Pelo menos 5 casos de integração novos cobrem os branches; o total não diminui.
- [x] Full Application passa.

**Tests:** integration
**Gate:** Full Application
**Commit:** `feat(application): add dedicated category archiving`

#### T7: Add dedicated ReactivateCategory use case

**What:** Implementar reativação exclusiva de categoria com proteção contra repetição e CAS.
**Where:** `packages/application/src/ledger/accounts/`
**Depends on:** T6
**Reuses:** `ReactivateLedgerAccount`, assertions comuns e transação/fatos existentes.
**Requirements:** CAT-30, CAT-31, CAT-37, CAT-38, CAT-69

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [x] Categoria arquivada volta a `ACTIVE` com appearance preservada e uma transição.
- [x] Repetição com a mesma versão não persiste segunda transição.
- [x] Conta financeira/sistema, livro incorreto e stale version são rejeitados sem escrita/fato.
- [x] Pelo menos 6 casos de integração novos cobrem os branches; o total não diminui.
- [x] Full Application passa.

**Tests:** integration
**Gate:** Full Application
**Commit:** `feat(application): add dedicated category reactivation`

#### T8: Export the category management application API

**What:** Expor os novos commands, DTO, event e casos de uso pela API pública do pacote.
**Where:** `packages/application/src/`
**Depends on:** T7
**Reuses:** Barrels existentes e `public-api.test.ts`.
**Requirements:** CAT-36, CAT-37, CAT-71

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [ ] Consumidores importam todos os contratos/casos de uso sem caminhos internos.
- [ ] APIs genéricas de conta continuam exportadas para o facade de contas.
- [ ] Pelo menos 2 assertions públicas novas são adicionadas e nenhum export anterior desaparece.
- [ ] Full Application e Build Scoped passam.

**Tests:** unit/public API
**Gate:** Full Application + Build Scoped
**Commit:** `feat(application): expose category management api`

### Phase 2: SQLite persistence and read models

#### T9: Add the category visual metadata migration

**What:** Criar `0004` com colunas, backfill e triggers condicionais, depois regenerar o catálogo de migrations.
**Where:** `packages/infrastructure-sqlite/migrations/`
**Depends on:** T8
**Reuses:** Runner transacional, script `generate:migrations` e testes de upgrade existentes.
**Requirements:** CAT-03, CAT-05, CAT-06, CAT-07, CAT-08, CAT-70

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [ ] Upgrade preenche defaults exatos por kind e mantém contas não gerenciáveis com `NULL`.
- [ ] Triggers de insert/update rejeitam ausência, `#`, casing/formato inválido e metadados em não categorias.
- [ ] Falha intermediária reverte colunas, dados, triggers e registro da migration.
- [ ] `generate:migrations` e `check:migrations` concordam.
- [ ] Pelo menos 9 casos de integração novos cobrem backfill, constraints, idempotência e rollback; o total não diminui.
- [ ] Full SQLite passa.

**Tests:** integration
**Gate:** Full SQLite
**Commit:** `feat(sqlite): migrate category visual metadata`

#### T10: Map category appearance through SQLite rows

**What:** Estender `LedgerAccountMapper` com leitura/escrita condicional e rejeição de rows inconsistentes.
**Where:** `packages/infrastructure-sqlite/src/mappers/`
**Depends on:** T9
**Reuses:** Readers de valores SQLite e testes de round trip/corruption existentes.
**Requirements:** CAT-01, CAT-02, CAT-04, CAT-07, CAT-70

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [ ] Categoria válida round-trips os dois campos; conta comum round-trips ambos como `NULL`/ausentes.
- [ ] Rows categóricas incompletas ou inválidas e rows não categóricas com appearance são rejeitadas.
- [ ] Restauração não cria fatos.
- [ ] Pelo menos 5 casos unitários novos cobrem essas combinações; o total não diminui.
- [ ] Full SQLite passa.

**Tests:** unit
**Gate:** Full SQLite
**Commit:** `feat(sqlite): map category visual metadata`

#### T11: Persist appearance in the ledger account repository

**What:** Incluir as duas colunas em find/add/save e preservar optimistic concurrency.
**Where:** `packages/infrastructure-sqlite/src/repositories/`
**Depends on:** T10
**Reuses:** `SqliteLedgerAccountRepository`, mapper, fact collector e testes CAS existentes.
**Requirements:** CAT-03, CAT-33, CAT-34, CAT-35, CAT-38, CAT-69, CAT-70

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [ ] Add/find/save preservam appearance de categoria e ausência em contas comuns/sistema.
- [ ] Update de três campos usa um statement CAS e não altera kind/book/status/system purpose.
- [ ] Conflito/rejeição não registra fatos nem persiste estado parcial.
- [ ] Pelo menos 6 casos de integração novos cobrem round trip, save, CAS e constraints; o total não diminui.
- [ ] Full SQLite passa.

**Tests:** integration
**Gate:** Full SQLite
**Commit:** `feat(sqlite): persist category visual metadata`

#### T12: Return appearance from every category catalog query

**What:** Estender queries de receita, despesa, gestão e detalhe com appearance obrigatória e validação de row.
**Where:** `packages/infrastructure-sqlite/src/queries/catalog/`
**Depends on:** T11
**Reuses:** `SqliteCategoryCatalogQueries`, readers tipados e ordenação/filtros atuais.
**Requirements:** CAT-04, CAT-47

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [ ] As quatro formas de leitura retornam `iconKey` e `colorHex` exatos.
- [ ] Status, exclusão de system accounts e ordenação existentes permanecem intactos.
- [ ] Row visual inválida falha como corrupção em vez de omitir silenciosamente campos.
- [ ] Pelo menos 5 casos de integração novos cobrem todos os query shapes; o total não diminui.
- [ ] Full SQLite e Build Scoped passam.

**Tests:** integration
**Gate:** Full SQLite + Build Scoped
**Commit:** `feat(sqlite): query category visual metadata`

### Phase 3: Tauri services, cache and icon registry

#### T13: Wire dedicated category services into the Tauri facade

**What:** Substituir rename/archive/reactivate genéricos no facade de categorias pelos novos serviços tipados.
**Where:** `apps/tauri/src/bootstrap/`
**Depends on:** T12
**Reuses:** `createMyFinServices`, transaction manager, dispatcher e bootstrap tests.
**Requirements:** CAT-30, CAT-37

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [ ] `services.categories` expõe create/update/archive/reactivate dedicados.
- [ ] `services.accounts` mantém os serviços genéricos sem regressão.
- [ ] Pelo menos 3 casos/assertions novos provam instâncias e boundary público; o total não diminui.
- [ ] Quick Tauri passa.

**Tests:** unit/integration
**Gate:** Quick Tauri
**Commit:** `feat(tauri): wire dedicated category services`

#### T14: Make category query invalidation complete and resilient

**What:** Criar invalidador que cubra gestão/detalhe e seletores, usando o book do command e `allSettled`.
**Where:** `apps/tauri/src/features/categories/hooks/`
**Depends on:** T13
**Reuses:** `categoryKeys`, padrões de `query-invalidation.ts` e React Query.
**Requirements:** CAT-26, CAT-44, CAT-54, CAT-65, CAT-66

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [ ] Um sucesso invalida prefixo de gestão/detalhe e ambas as keys de selector do `bookId` recebido.
- [ ] Falha parcial retorna scopes falhos sem rejeitar o sucesso persistido.
- [ ] Troca do livro ativo não redireciona as keys.
- [ ] Pelo menos 5 casos unitários novos cobrem sucesso total, falhas parciais e isolamento; o total não diminui.
- [ ] Quick Tauri passa.

**Tests:** unit
**Gate:** Quick Tauri
**Commit:** `fix(tauri): make category invalidation resilient`

#### T15: Submit visual metadata from category creation hooks

**What:** Atualizar hooks de criação para `CategoryDto`, commands completos, deduplicação e warning de refresh.
**Where:** `apps/tauri/src/features/categories/hooks/`
**Depends on:** T14
**Reuses:** Hooks existentes, novo invalidador e tests com `renderHook`.
**Requirements:** CAT-24, CAT-25, CAT-26, CAT-65, CAT-66

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [ ] Receita/despesa enviam uma vez o command completo e não fazem retry automático.
- [ ] Sucesso retorna DTO mesmo se alguma invalidação falhar e expõe orientação de refresh.
- [ ] Todas as keys usam o `bookId` original do command.
- [ ] Pelo menos 5 casos de hook novos cobrem os outcomes; o total não diminui.
- [ ] Quick Tauri passa.

**Tests:** hook integration
**Gate:** Quick Tauri
**Commit:** `feat(tauri): submit category visual metadata`

#### T16: Add update, archive and reactivate category hooks

**What:** Trocar o lifecycle genérico por mutations dedicadas e tipadas, incluindo conflito e refresh parcial.
**Where:** `apps/tauri/src/features/categories/hooks/`
**Depends on:** T15
**Reuses:** `useMutation`, facade dedicado, invalidador de categoria e mapeamento de erros.
**Requirements:** CAT-42, CAT-44, CAT-46, CAT-53, CAT-54, CAT-55, CAT-65, CAT-66, CAT-69

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`

**Done when:**

- [ ] Update/archive/reactivate usam `categoryId`, versão atual e uma chamada por ação.
- [ ] Conflito invalida detalhe e bloqueia replay implícito.
- [ ] Falha preserva item/form; refresh parcial não reclassifica mutation persistida como falha.
- [ ] Pelo menos 7 casos de hook novos cobrem os três serviços e edge cases; o total não diminui.
- [ ] Quick Tauri passa.

**Tests:** hook integration
**Gate:** Quick Tauri
**Commit:** `feat(tauri): add category lifecycle mutations`

#### T17: Make the category icon registry a single source of truth

**What:** Derivar names/entries do objeto readonly, manter lookup direto e fallback estável.
**Where:** `apps/tauri/src/components/category-icons/`
**Depends on:** T16
**Reuses:** Biblioteca de ícones fornecida pelo usuário e `CategoryIconComponent`.
**Requirements:** CAT-11, CAT-12, CAT-13, CAT-14, CAT-15, CAT-16, CAT-63

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`, `shadcn`

**Done when:**

- [ ] Existe um único objeto chave→componente; names e entries são derivados em ordem determinística.
- [ ] Lookup válido é direto; desconhecido resolve `label-dollar`; coleções externas não mutam a fonte.
- [ ] Consumidores recebem componentes, não strings.
- [ ] Pelo menos 5 casos unitários novos cobrem primeira/meio/última chave, unicidade, ordem e fallback; o total não diminui.
- [ ] Quick Tauri e Build Scoped passam.

**Tests:** unit
**Gate:** Quick Tauri + Build Scoped
**Commit:** `refactor(tauri): centralize category icon registry`

### Phase 4: Controlled fields and shared category form

#### T18: Fix controlled ColorPicker synchronization

**What:** Corrigir a conversão RGB/HSL e impedir eco divergente em valor controlado/reset.
**Where:** `packages/ui/src/components/`
**Depends on:** T17
**Reuses:** `ColorPicker`, biblioteca `color` e composição atual de selection/hue/eyedropper.
**Requirements:** CAT-20, CAT-21, CAT-22, CAT-67

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`, `shadcn`

**Done when:**

- [ ] Valor externo e reset reconstituem os canais HSL corretos.
- [ ] Uma sincronização equivalente não emite valor diferente nem dirty state falso.
- [ ] Alpha recebido continua representável internamente, mas a composição opaca pode descartá-lo.
- [ ] Pelo menos 4 casos de integração novos cobrem valor inicial, mudança externa, reset e ausência de eco; o total não diminui.
- [ ] Quick UI e Quick Tauri passam.

**Tests:** component integration
**Gate:** Quick UI + Quick Tauri
**Commit:** `fix(ui): synchronize controlled color picker values`

#### T19: Add ControlledColorPicker to the form field library

**What:** Adaptar o picker opaco a `ControlledFieldProps<TValues, string, TOutput>` com RHF como fonte única.
**Where:** `apps/tauri/src/components/forms/`
**Depends on:** T18
**Reuses:** `Controller`, `ControlledField`, `InputGroup` quando aplicável e primitives do ColorPicker.
**Requirements:** CAT-20, CAT-21, CAT-22, CAT-67, CAT-68, CAT-75, CAT-76, CAT-77, CAT-78, CAT-79

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`, `shadcn`

**Done when:**

- [ ] Campo delega label/description/error/disabled a `ControlledField`.
- [ ] UI não renderiza alpha, percentual ou seletor de formato; saída válida é `rrggbb` minúsculo.
- [ ] Entrada manual inválida permanece visível para Zod; conta-gotas descarta alpha.
- [ ] Reset sincroniza sem emissão divergente e disabled bloqueia todas as mudanças.
- [ ] Pelo menos 7 casos de componente novos cobrem integração, formatos, reset, erro e disabled; o total não diminui.
- [ ] Quick Tauri passa.

**Tests:** component integration
**Gate:** Quick Tauri
**Commit:** `feat(tauri): add controlled color picker field`

#### T20: Add an accessible controlled category icon field

**What:** Criar radio grid de todos os ícones integrado a RHF e `ControlledField`.
**Where:** `apps/tauri/src/features/categories/components/`
**Depends on:** T19
**Reuses:** Registry, radios/fieldset nativos, `Controller`, `ControlledField` e foco semântico.
**Requirements:** CAT-19, CAT-23, CAT-60, CAT-74

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`, `shadcn`

**Done when:**

- [ ] Cada chave aparece exatamente uma vez com nome acessível e estado selecionado.
- [ ] Teclado altera uma única seleção e o valor registrado no RHF.
- [ ] Erro e disabled seguem o contrato controlado; componentes resolvidos são passados à apresentação.
- [ ] Pelo menos 5 casos de componente novos cobrem listagem, seleção, teclado, erro e disabled; o total não diminui.
- [ ] Quick Tauri passa.

**Tests:** component integration
**Gate:** Quick Tauri
**Commit:** `feat(tauri): add accessible category icon field`

#### T21: Define the shared category form schema and error mapping

**What:** Consolidar schema create/edit, defaults e tradução segura de erros/ações sem lógica React.
**Where:** `apps/tauri/src/features/categories/components/`
**Depends on:** T20
**Reuses:** Zod, models extraídos para respeitar react-refresh e mensagens das transações.
**Requirements:** CAT-17, CAT-18, CAT-21, CAT-23, CAT-24, CAT-27, CAT-41, CAT-45, CAT-68

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`, `shadcn`

**Done when:**

- [ ] Defaults são `EXPENSE`, `label-dollar`, `f43f5e`.
- [ ] Schema trimma nome, lower-case apenas cor válida e rejeita todos os formatos manuais proibidos.
- [ ] Mensagens conhecidas são traduzidas por ação; dados internos nunca aparecem.
- [ ] Pelo menos 6 casos unitários novos cobrem defaults, transforms, cada campo e error mapping; o total não diminui.
- [ ] Quick Tauri passa.

**Tests:** unit
**Gate:** Quick Tauri
**Commit:** `refactor(tauri): define category form schema`

#### T22: Reuse one RHF form for category creation and editing

**What:** Refatorar `CategoryForm` para modos create/edit com zodResolver e todos os campos controlados.
**Where:** `apps/tauri/src/features/categories/components/`
**Depends on:** T21
**Reuses:** `ControlledInput`, `ControlledField`, `ControlledColorPicker`, icon field, transaction submission/toast pattern, `FieldGroup`, `Badge`, `Spinner`.
**Requirements:** CAT-17, CAT-18, CAT-19, CAT-20, CAT-21, CAT-22, CAT-23, CAT-24, CAT-25, CAT-27, CAT-28, CAT-40, CAT-41, CAT-42, CAT-43, CAT-45, CAT-46, CAT-72, CAT-73, CAT-74, CAT-75, CAT-76, CAT-77, CAT-78, CAT-79

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`, `shadcn`

**Done when:**

- [ ] Create usa defaults e envia exatamente um command completo ao serviço correto.
- [ ] Edit preenche valores atuais, mostra kind imutável e envia um `UpdateCategoryCommand` com versão.
- [ ] Zod bloqueia mutations e associa erros aos quatro campos.
- [ ] Pending/trava impedem duplo submit; falha preserva valores e usa um toast seguro.
- [ ] Conflito bloqueia reenvio até nova ação; ausência de livro substitui campos por orientação.
- [ ] Pelo menos 10 casos de componente novos cobrem ambos os modos e todos os estados; o total não diminui.
- [ ] Quick Tauri e Build Scoped passam.

**Tests:** component integration
**Gate:** Quick Tauri + Build Scoped
**Commit:** `feat(tauri): support category creation and editing`

### Phase 5: Category management page

#### T23: Filter categories by independent status and type

**What:** Refatorar o model puro para compor filtros exclusivos com defaults ativos/todas.
**Where:** `apps/tauri/src/features/categories/components/`
**Depends on:** T22
**Reuses:** `category-list-model.ts` e arrays readonly de opções.
**Requirements:** CAT-47, CAT-48, CAT-49, CAT-50, CAT-56, CAT-61

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`, `shadcn`

**Done when:**

- [ ] Defaults são `ACTIVE` e `ALL`.
- [ ] Toda combinação status×tipo retorna somente os itens correspondentes sem mutar a entrada.
- [ ] Opções fornecem labels para dois `ToggleGroup` exclusivos.
- [ ] Pelo menos 5 casos unitários novos cobrem matriz completa e vazio; o total não diminui.
- [ ] Quick Tauri passa.

**Tests:** unit
**Gate:** Quick Tauri
**Commit:** `feat(tauri): filter categories by status and type`

#### T24: Render visual identity and lifecycle actions on CategoryCard

**What:** Aplicar ícone/cor persistidos e ações edit/archive/reactivate acessíveis conforme status.
**Where:** `apps/tauri/src/features/categories/components/`
**Depends on:** T23
**Reuses:** Registry, `Badge`, `Button`/menu, toast e hooks dedicados.
**Requirements:** CAT-39, CAT-51, CAT-52, CAT-53, CAT-55, CAT-58, CAT-59, CAT-60, CAT-63, CAT-69

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`, `shadcn`

**Done when:**

- [ ] Filete e stroke usam `#${colorHex}`; nome e Badge mantêm tipo legível sem depender da cor.
- [ ] Chave desconhecida mostra fallback e preserva todas as ações.
- [ ] Ativo oferece editar/arquivar; arquivado oferece editar/reativar; labels incluem o nome.
- [ ] Cada gesto dispara uma mutation; pending desabilita repetição e falha usa toast sem remover o card.
- [ ] Pelo menos 7 casos de componente novos cobrem aparência, fallback, status, payload e erro; o total não diminui.
- [ ] Quick Tauri passa.

**Tests:** component integration
**Gate:** Quick Tauri
**Commit:** `feat(tauri): add category card lifecycle actions`

#### T25: Complete archived-category management in CategoriesPage

**What:** Integrar query completa, filtros, Sheets de create/edit, empty/error/loading, refresh e troca de livro.
**Where:** `apps/tauri/src/features/categories/components/`
**Depends on:** T24
**Reuses:** `useCategories(true)`, `Sheet`, `ToggleGroup`, `Empty`, `Alert`, `Skeleton`, `CategoryForm` e `CategoryCard`.
**Requirements:** CAT-26, CAT-39, CAT-40, CAT-43, CAT-44, CAT-45, CAT-46, CAT-47, CAT-48, CAT-49, CAT-50, CAT-51, CAT-52, CAT-54, CAT-55, CAT-56, CAT-57, CAT-61, CAT-62, CAT-64, CAT-65, CAT-66

**Tools:**

- MCP: NONE
- Skills: `tlc-spec-driven`, `shadcn`; `playwright` ou `playwright-interactive` somente no UAT/Verifier

**Done when:**

- [ ] Página consulta `includeArchived: true` e inicia em Ativas/Todas.
- [ ] Dois ToggleGroups funcionam por teclado e preservam criação/filtros nos empty states adequados.
- [ ] Create/edit Sheets têm título, valores corretos, fechamento permitido e retorno de foco.
- [ ] Sucessos movem/atualizam cards; falhas e refresh parcial mantêm estado coerente com feedback seguro.
- [ ] Troca de livro fecha Sheet, descarta ID/versão anterior e invalida somente o livro do command concluído.
- [ ] Loading, query error/retry e ausência de resultados são semanticamente distintos.
- [ ] Pelo menos 10 casos de integração novos cobrem os fluxos completos e o total não diminui.
- [ ] Final Feature passa; a suíte Tauri completa não adiciona falhas ao baseline de 15.
- [ ] O Verifier independente produz `validation.md`, executa o discrimination sensor e realiza UAT real ou registra com precisão a limitação de runtime.

**Tests:** component integration + interactive UAT
**Gate:** Final Feature
**Commit:** `feat(tauri): complete category management page`

---

## Requirement-to-Task Traceability

| Task | Requirements |
| --- | --- |
| T1 | CAT-01, CAT-02, CAT-07, CAT-09, CAT-10, CAT-33, CAT-34, CAT-35, CAT-70, CAT-71 |
| T2 | CAT-01, CAT-04, CAT-24, CAT-36, CAT-37 |
| T3 | CAT-38, CAT-71 |
| T4 | CAT-01, CAT-09, CAT-10, CAT-24, CAT-36, CAT-38 |
| T5 | CAT-29, CAT-30, CAT-31, CAT-32, CAT-33, CAT-34, CAT-35, CAT-36, CAT-38, CAT-71 |
| T6 | CAT-30, CAT-31, CAT-37, CAT-38 |
| T7 | CAT-30, CAT-31, CAT-37, CAT-38, CAT-69 |
| T8 | CAT-36, CAT-37, CAT-71 |
| T9 | CAT-03, CAT-05, CAT-06, CAT-07, CAT-08, CAT-70 |
| T10 | CAT-01, CAT-02, CAT-04, CAT-07, CAT-70 |
| T11 | CAT-03, CAT-33, CAT-34, CAT-35, CAT-38, CAT-69, CAT-70 |
| T12 | CAT-04, CAT-47 |
| T13 | CAT-30, CAT-37 |
| T14 | CAT-26, CAT-44, CAT-54, CAT-65, CAT-66 |
| T15 | CAT-24, CAT-25, CAT-26, CAT-65, CAT-66 |
| T16 | CAT-42, CAT-44, CAT-46, CAT-53, CAT-54, CAT-55, CAT-65, CAT-66, CAT-69 |
| T17 | CAT-11, CAT-12, CAT-13, CAT-14, CAT-15, CAT-16, CAT-63 |
| T18 | CAT-20, CAT-21, CAT-22, CAT-67 |
| T19 | CAT-20, CAT-21, CAT-22, CAT-67, CAT-68, CAT-75, CAT-76, CAT-77, CAT-78, CAT-79 |
| T20 | CAT-19, CAT-23, CAT-60, CAT-74 |
| T21 | CAT-17, CAT-18, CAT-21, CAT-23, CAT-24, CAT-27, CAT-41, CAT-45, CAT-68 |
| T22 | CAT-17, CAT-18, CAT-19, CAT-20, CAT-21, CAT-22, CAT-23, CAT-24, CAT-25, CAT-27, CAT-28, CAT-40, CAT-41, CAT-42, CAT-43, CAT-45, CAT-46, CAT-72, CAT-73, CAT-74, CAT-75, CAT-76, CAT-77, CAT-78, CAT-79 |
| T23 | CAT-47, CAT-48, CAT-49, CAT-50, CAT-56, CAT-61 |
| T24 | CAT-39, CAT-51, CAT-52, CAT-53, CAT-55, CAT-58, CAT-59, CAT-60, CAT-63, CAT-69 |
| T25 | CAT-26, CAT-39, CAT-40, CAT-43, CAT-44, CAT-45, CAT-46, CAT-47, CAT-48, CAT-49, CAT-50, CAT-51, CAT-52, CAT-54, CAT-55, CAT-56, CAT-57, CAT-61, CAT-62, CAT-64, CAT-65, CAT-66 |

**Coverage:** 79/79 requisitos aparecem em pelo menos uma tarefa; cada requisito possui uma camada automatizada ou UAT explícita.

---

## Phase Execution Map

```text
Phase 1: T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8
Phase 2: T9 -> T10 -> T11 -> T12
Phase 3: T13 -> T14 -> T15 -> T16 -> T17
Phase 4: T18 -> T19 -> T20 -> T21 -> T22
Phase 5: T23 -> T24 -> T25
```

Cada primeiro item de fase depende do último item da fase anterior. Essas arestas entre fases ficam nos `Depends on`; o mapa mostra a sequência interna exigida pelo validator.

---

## Task Granularity Check

| Task | Single deliverable | Status |
| --- | --- | --- |
| T1 | Uma capacidade do agregado | ✅ Granular |
| T2 | Uma superfície de contratos | ✅ Granular |
| T3 | Um tipo de evento no dispatcher | ✅ Granular |
| T4 | Um fluxo simétrico de criação de categoria | ✅ Cohesive |
| T5 | Um caso de uso de update | ✅ Granular |
| T6 | Um caso de uso de archive | ✅ Granular |
| T7 | Um caso de uso de reactivate | ✅ Granular |
| T8 | Uma superfície pública de pacote | ✅ Granular |
| T9 | Uma migration atômica | ✅ Granular |
| T10 | Um mapper | ✅ Granular |
| T11 | Um repository | ✅ Granular |
| T12 | Um adapter de queries de categoria | ✅ Cohesive |
| T13 | Um facade de serviços | ✅ Granular |
| T14 | Um invalidador de cache | ✅ Granular |
| T15 | Um fluxo simétrico de hooks de criação | ✅ Cohesive |
| T16 | Um conjunto fechado de hooks de lifecycle | ✅ Cohesive |
| T17 | Um registry | ✅ Granular |
| T18 | Um componente compartilhado | ✅ Granular |
| T19 | Um controlled field | ✅ Granular |
| T20 | Um controlled icon field | ✅ Granular |
| T21 | Um model/schema sem React | ✅ Granular |
| T22 | Um formulário com dois modos | ✅ Cohesive |
| T23 | Uma função/model de filtros | ✅ Granular |
| T24 | Um card | ✅ Granular |
| T25 | Uma página/controller de overlays | ✅ Cohesive |

---

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | início Phase 1 | ✅ Match |
| T2 | T1 | T1 -> T2 | ✅ Match |
| T3 | T2 | T2 -> T3 | ✅ Match |
| T4 | T3 | T3 -> T4 | ✅ Match |
| T5 | T4 | T4 -> T5 | ✅ Match |
| T6 | T5 | T5 -> T6 | ✅ Match |
| T7 | T6 | T6 -> T7 | ✅ Match |
| T8 | T7 | T7 -> T8 | ✅ Match |
| T9 | T8 | início Phase 2; cross-phase | ✅ Match |
| T10 | T9 | T9 -> T10 | ✅ Match |
| T11 | T10 | T10 -> T11 | ✅ Match |
| T12 | T11 | T11 -> T12 | ✅ Match |
| T13 | T12 | início Phase 3; cross-phase | ✅ Match |
| T14 | T13 | T13 -> T14 | ✅ Match |
| T15 | T14 | T14 -> T15 | ✅ Match |
| T16 | T15 | T15 -> T16 | ✅ Match |
| T17 | T16 | T16 -> T17 | ✅ Match |
| T18 | T17 | início Phase 4; cross-phase | ✅ Match |
| T19 | T18 | T18 -> T19 | ✅ Match |
| T20 | T19 | T19 -> T20 | ✅ Match |
| T21 | T20 | T20 -> T21 | ✅ Match |
| T22 | T21 | T21 -> T22 | ✅ Match |
| T23 | T22 | início Phase 5; cross-phase | ✅ Match |
| T24 | T23 | T23 -> T24 | ✅ Match |
| T25 | T24 | T24 -> T25 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Domain aggregate | unit | unit | ✅ OK |
| T2 | Application contracts | unit | unit/type contract | ✅ OK |
| T3 | Event dispatcher | unit | unit | ✅ OK |
| T4 | Create use cases | integration | integration | ✅ OK |
| T5 | Update use case | integration | integration | ✅ OK |
| T6 | Archive use case | integration | integration | ✅ OK |
| T7 | Reactivate use case | integration | integration | ✅ OK |
| T8 | Public API | unit | unit/public API | ✅ OK |
| T9 | SQLite migration | integration | integration | ✅ OK |
| T10 | SQLite mapper | unit | unit | ✅ OK |
| T11 | SQLite repository | integration | integration | ✅ OK |
| T12 | SQLite queries | integration | integration | ✅ OK |
| T13 | Tauri facade | unit/integration | unit/integration | ✅ OK |
| T14 | Cache invalidator | unit | unit | ✅ OK |
| T15 | Creation hooks | hook integration | hook integration | ✅ OK |
| T16 | Lifecycle hooks | hook integration | hook integration | ✅ OK |
| T17 | Icon registry | unit | unit | ✅ OK |
| T18 | Shared ColorPicker | integration | component integration | ✅ OK |
| T19 | ControlledColorPicker | integration | component integration | ✅ OK |
| T20 | Icon field | integration | component integration | ✅ OK |
| T21 | Form model | unit | unit | ✅ OK |
| T22 | CategoryForm | integration | component integration | ✅ OK |
| T23 | Filter model | unit | unit | ✅ OK |
| T24 | CategoryCard | integration | component integration | ✅ OK |
| T25 | CategoriesPage | integration + UAT | component integration + interactive UAT | ✅ OK |

---

## Execute Preconditions

- [ ] Usuário aprova este `tasks.md` e a matriz/gates.
- [ ] Usuário confirma ou substitui as ferramentas propostas em cada tarefa.
- [ ] Antes do código, reconciliar `git status` e preservar mudanças preexistentes.
- [ ] A biblioteca untracked `category-icons`, o `color-picker.tsx` e alterações relacionadas de package/lockfile são baseline fornecido pelo usuário. T17/T18 os incorporam cirurgicamente; tarefas anteriores não os adicionam a commits.
- [ ] Antes de cada commit, rodar `check_commit.py --message`, marcar a tarefa e atualizar a traceability na mesma alteração.
- [ ] Depois de T25, executar Verifier independente, discrimination sensor e `validate_state.py category-management-enhancements`.
