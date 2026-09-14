# Investimentos v1 Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** The skill governs the per-task cycle, adequacy review, atomic commits, independent Verifier and discrimination sensor. **If the skill cannot be activated, STOP and tell the user.**

**Design:** [design.md](./design.md), aprovado pelo usuário com “Aprovo design, siga para tasks.md”.
**Spec:** [spec.md](./spec.md), 148 requisitos aprovados.
**Status:** Draft, para revisão das tarefas. A autorização atual cobre a criação deste plano; Execute não começou.
**Total:** 94 tarefas em 16 fases sequenciais. Todas pendentes.

Cada tarefa entrega um componente ou um caso de uso. `Where` indica seu ponto principal; testes, exports, mapper privado e ajustes mecânicos de consumidores do mesmo contrato pertencem ao mesmo commit. Isso não autoriza implementar outro componente antecipadamente. Wrapper fino de um mesmo comando discriminado pode compartilhar tarefa; comportamento econômico distinto tem tarefa própria.

Manter os commits compiláveis. Introduzir ports de forma aditiva até seus adapters estarem prontos; tornar RepositoryContext obrigatório em T40, type público em T41 e restore financeiro estrito em T23. Nenhum stub de sucesso, implementação vazia ou cast para esconder ausência de adapter é permitido. Se surgir dependência que exija outro componente ainda não pronto, corrigir a ordem deste plano antes de seguir.

Ciclo por tarefa: teste derivado da spec → implementação → gate → revisão de adequação → checkbox/rastreabilidade/evidência → commit atômico. Testes e evidência não são adiados para a tarefa seguinte. Nunca apagar, enfraquecer ou ignorar testes para obter verde. Nenhum push/deploy está incluído.

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Não foram encontrados AGENTS.md, CONTRIBUTING.md, docs de testes, workflows de CI ou thresholds de cobertura. Aplicam-se os padrões fortes da skill. Manifests dos cinco packages e de apps/tauri fornecem os comandos; eslint.config de cada package integra Prettier. README não especifica testes. Configuração de Vite não define cobertura.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain | unit | Todos os ramos econômicos e validações dos ACs atribuídos; todos os fixtures normativos pertinentes, com valores literais | packages/domain/src/**/*.test.ts | `pnpm --filter @workspace/domain exec vitest run` |
| Application | unit | Contratos públicos, variantes impossíveis, códigos/envelopes exatos e falhas pré/pós-commit | packages/application/src/**/*.test.ts | `pnpm --filter @workspace/application exec vitest run` |
| Command | integration | Happy + erro + edge por AC; CAS, livro, atomicidade, retry e fatos; doubles apenas para injetar falha, valores esperados vêm da spec | packages/infrastructure-memory/src/use-cases/investments/*.test.ts e suites genéricas tocadas | `pnpm --filter @workspace/infrastructure-memory exec vitest run` |
| Memory | integration | Mesmos contratos do SQLite, clones, ordering, CAS e rollback de todas as coleções | packages/infrastructure-memory/src/**/*.test.ts | `pnpm --filter @workspace/infrastructure-memory exec vitest run` |
| SQLite | integration | SQLite real via better-sqlite3: roundtrip, constraints, queries-chave, falhas, migrações e grandes valores; unit no mapper quando necessário | packages/infrastructure-sqlite/tests/**/*.test.ts e src/**/*.test.ts | `pnpm --filter @workspace/infrastructure-sqlite exec vitest run` |
| Integration | integration | Contexto completo, memória/SQLite e adapter Tauri scoped; commit, falha intermediária, concorrência e IPC exato | Suites de transaction/contracts dos adapters e database do Tauri | Gates Full Cross e Native |
| React | integration | RHF/React Query/Router em jsdom: happy + erro + edge por AC, acessibilidade observável, livro e retry; UAT real complementa layout/foco/persistência | apps/tauri/src/**/*.test.ts e *.test.tsx | `pnpm --filter tauri exec vitest run` |
| Native UAT | interactive integration | Jornadas N1–N8 abaixo com banco real, reinício, teclado e 360px/1280px; mock não é evidência substituta | Evidência vinculada à tarefa de integração e validation.md do Verifier | `pnpm --filter tauri tauri dev` e roteiro Native |

Amostras lidas: domain/shared/money.test.ts; domain/ledger/accounts/ledger-account.test.ts; application/core/use-case-executor.test.ts; infrastructure-memory/use-cases/amend-journal-entry.test.ts e transaction/in-memory-transaction-manager.test.ts; infrastructure-sqlite/tests/migrations/category-visual-metadata.test.ts e tests/queries/sqlite-net-worth.test.ts; infrastructure-tauri/database/protocol.test.ts; apps/tauri/bootstrap/create-services.test.ts e features/transactions/components/transaction-delete-dialog.test.tsx. Os caminhos abreviados seguem os roots dos packages. Padrão observado: Vitest, testes próximos do código ou tests/ no SQLite, jsdom explícito nos componentes e assertions de valores/códigos exatos.

**Contagem:** não foi executado baseline de software nesta fase documental. Antes de T1, registrar contagens e falhas atuais por suíte. Cada tarefa declara mínimo de cenários novos/estendidos; registrar também nomes e contagens antes/depois para impedir compensar remoção de teste antigo com teste novo. O mínimo não limita a cobertura exigida pelo AC. Suites não podem passar por ausência de testes: usar `exec vitest run`, sem `--passWithNoTests`.

## Gate Check Commands

> Generated from codebase - confirm before Execute. Rodar a partir da raiz. Nos packages, `check-types` é o script real; no app usar os binários locais. Lint já verifica formatação via Prettier. `format --write` não é gate.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick Domain | Domain | `pnpm --filter @workspace/domain exec vitest run && pnpm --filter @workspace/domain check-types` |
| Quick Application | Contratos/executor/dispatcher | `pnpm --filter @workspace/domain build && pnpm --filter @workspace/application exec vitest run && pnpm --filter @workspace/application check-types` |
| Full Memory | Adapter memory ou Command | `pnpm --filter @workspace/domain build && pnpm --filter @workspace/application build && pnpm --filter @workspace/infrastructure-memory exec vitest run && pnpm --filter @workspace/infrastructure-memory check-types` |
| Full SQLite | Repository/query/migration SQLite | `pnpm --filter @workspace/domain build && pnpm --filter @workspace/application build && pnpm --filter @workspace/infrastructure-memory build && pnpm --filter @workspace/infrastructure-sqlite exec vitest run && pnpm --filter @workspace/infrastructure-sqlite check:migrations && pnpm --filter @workspace/infrastructure-sqlite check-types` |
| Full Cross | Contextos ou contrato transversal | Full Memory + Full SQLite + `pnpm --filter @workspace/infrastructure-sqlite build && pnpm --filter @workspace/infrastructure-tauri exec vitest run && pnpm --filter @workspace/infrastructure-tauri check-types` |
| Full React | Hook/form/componente/facade | Build Dependências abaixo + `pnpm --filter tauri exec vitest run && pnpm --filter tauri exec tsc --noEmit` |
| Build | Última tarefa de cada fase, além do gate da tarefa | Testes de todos os packages tocados na fase + lint/check-types/build desses packages em ordem de dependência; comandos concretos abaixo; `git diff --check` |
| Native | T93: N1–N6/N8 e N7 restrito a Investimentos; T94: N7 completo e regressões afetadas | `pnpm --filter tauri tauri dev`; executar N1–N8, com evidência. Se Rust mudar: `cargo test --manifest-path apps/tauri/src-tauri/Cargo.toml` e `cargo fmt --manifest-path apps/tauri/src-tauri/Cargo.toml -- --check` |
| Final | T94, antes do Verifier | Full Cross + Full React + Build para todos os packages afetados; Native completo após T93/T94. Executar validação independente e sensor depois do commit final |

Build Dependências para o app, cada comando em sequência:

```sh
pnpm --filter @workspace/domain build
pnpm --filter @workspace/application build
pnpm --filter @workspace/infrastructure-memory build
pnpm --filter @workspace/infrastructure-sqlite build
pnpm --filter @workspace/infrastructure-tauri build
```

Para cada package afetado, usar os scripts reais `pnpm --filter @workspace/<package> lint`, `check-types` e `build` (domain, application, infrastructure-memory, infrastructure-sqlite, infrastructure-tauri). Shared UI não tem script build. Se mudar, usar `pnpm --filter @workspace/ui lint` e `typecheck`; não presumir `check-types` nesse package. No app, Build inclui:

```sh
pnpm --filter tauri exec eslint . --max-warnings 0
pnpm --filter tauri exec tsc --noEmit
pnpm --filter tauri build
```

Uma fase só passa se seus testes e build estiverem verdes. Falha anterior à feature deve ser registrada com reprodução e escopo; não herdar listas antigas de falhas como dispensa automática. Se baseline impedir o gate, resolver a condição ou obter definição explícita antes de Execute continuar. Falta de ambiente nativo deixa Native pendente e impede declarar a feature pronta; não bloqueia a elaboração deste plano.

### Native: roteiro de aceitação

- N1: livro BRL com banco e carteira; criar CDB e duas posições com termos distintos; aplicar de banco, avaliar, resgatar com despesas; conferir saldos, principal e receitas/despesas.
- N2: abrir patrimônio ausente antes do saldo inicial, observar caixa negativo e total sinalizado; registrar saldo explícito depois e verificar desaparecimento do aviso sem regravar a alocação.
- N3: venda parcial, avaliação antiga inaplicável, cancelamento produz revisão nova e continua usando custo; amendment com/sem journal nas duas direções preserva história.
- N4: fechar/reabrir, arquivar com caixa residual, reativar conta/instrumento e conferir restrições de settlement e histórico.
- N5: fechar/reabrir app usando banco real; conferir profiles/termos/lineage/valores/recibos. Usar valores individuais próximos ao limite e total acima de int64 via IPC.
- N6: troca de livro com mutation pendente, livro USD vazio, dia/fuso de referência e lançamento futuro; nenhum saldo/resposta pertence ao livro errado.
- N7: teclado, foco de Drawer/menus, erros, loading, vazio e ações em 360px/1280px; navegar entre Investimentos e Transações, conferir filtros e resumo misto.
- N8: resposta de commit indeterminada, quando reproduzível com falha controlada no adapter: conservar requestId, consultar recibo e repetir sem duplicar. Falha de publicação também conserva sucesso. Registrar o mecanismo utilizado; não alegar prova nativa baseada só em mock.

## Execution Plan

Execução estritamente sequencial. A dependência da tarefa imediatamente anterior é também uma barreira de gate: por transitividade, todas as dependências técnicas anteriores já estão disponíveis. Não há trabalho paralelo entre fases ou tarefas. Diagramas e campos Depends on registram a mesma cadeia, inclusive as transições entre fases.

### Phase 1: Valores, perfis e identidade

```text
T1 -> T2 -> T3 -> T4 -> T5
```

### Phase 2: Aggregates de investimentos

```text
T6 -> T7 -> T8 -> T9 -> T10
```

### Phase 3: Plano contábil e fronteiras da aplicação

```text
T11 -> T12 -> T13 -> T14 -> T15 -> T16
```

### Phase 4: Schema e migrações

```text
T17 -> T18 -> T19 -> T20 -> T21 -> T22
```

### Phase 5: Persistência SQLite dos aggregates

```text
T23 -> T24 -> T25 -> T26 -> T27 -> T28 -> T29
```

### Phase 6: Adapters de memória

```text
T30 -> T31 -> T32 -> T33 -> T34 -> T35 -> T36
```

### Phase 7: Leituras de escrita e contas financeiras

```text
T37 -> T38 -> T39 -> T40 -> T41 -> T42 -> T43
```

### Phase 8: Catálogos e execução idempotente

```text
T44 -> T45 -> T46 -> T47 -> T48 -> T49
```

### Phase 9: Abertura e operações

```text
T50 -> T51 -> T52 -> T53 -> T54 -> T55
```

### Phase 10: Correções, avaliações e proteção contábil

```text
T56 -> T57 -> T58 -> T59 -> T60 -> T61
```

### Phase 11: Consultas de investimentos

```text
T62 -> T63 -> T64 -> T65 -> T66 -> T67
```

### Phase 12: Consultas existentes e composição

```text
T68 -> T69 -> T70 -> T71
```

### Phase 13: Estado de UI e cadastros

```text
T72 -> T73 -> T74 -> T75 -> T76 -> T77
```

### Phase 14: Formulários de abertura e operações

```text
T78 -> T79 -> T80 -> T81 -> T82 -> T83
```

### Phase 15: Avaliação, correção e listas

```text
T84 -> T85 -> T86 -> T87 -> T88
```

### Phase 16: Históricos e integração da navegação

```text
T89 -> T90 -> T91 -> T92 -> T93 -> T94
```

### Phase Execution Map

Transições entre fases, também dependências explícitas:

```text
T5 -> T6
T10 -> T11
T16 -> T17
T22 -> T23
T29 -> T30
T36 -> T37
T43 -> T44
T49 -> T50
T55 -> T56
T61 -> T62
T67 -> T68
T71 -> T72
T77 -> T78
T83 -> T84
T88 -> T89
```

Cada fase tem de 4 a 7 tarefas. Se houver delegação durante Execute, propor batches de fases inteiras próximos de 7 tarefas e obter o aceite exigido pela skill antes de despachar workers. Esta etapa não delega nem inicia execução. O Verifier independente após a implementação é obrigatório e não depende de convite adicional.

## Task Breakdown

### Phase 1: Valores, perfis e identidade

### T1: Decimal exato

**What**: Entregar decimal exato conforme os requisitos abaixo.
**Where**: `packages/domain/src/shared/decimal.ts`
**Depends on**: None
**Reuses**: Money e DomainError.
**Requirement**: INV-82, INV-83
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Normalizar zeros/sinal, somar/subtrair 0.1 e 0.2 exatamente e rejeitar exponencial, entrada longa, precisão/escala excedidas; compare e equals não usam float.
- [x] Escrever/atualizar no mesmo commit pelo menos 16 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain
**Commit**: `feat(investments-domain): decimal exato`

**Execution evidence**: baseline Domain: 11 files, 178 tests, pass; T1: 12 files, 199 tests, pass. `decimal.test.ts` adds 21 spec-derived scenarios. `pnpm --filter @workspace/domain exec vitest run` and `check-types` passed.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-82 decimal exact | `packages/domain/src/shared/decimal.test.ts:16` `expect(...).toBe("0.3")` | `0.1 + 0.2 = 0.3` without float | Yes |
| INV-82 normalized zero/sign | `packages/domain/src/shared/decimal.test.ts:12` `expect(...).toBe(expected)` | `0010.5000 → 10.5`; `-0.00 → 0` | Yes |
| INV-83 canonical limits | `packages/domain/src/shared/decimal.test.ts:61` `expectInvalidInput(input)` and `:82` `expect(...code).toBe("INVALID_INVESTMENT_INPUT")` | reject exponent, >80 chars, precision >38 and scale >18 | Yes |
| exact comparison | `packages/domain/src/shared/decimal.test.ts:45` `expect(...compare(...)).toBe(expected)` and `:49` `expect(...equals(...)).toBe(true)` | compare/equals exact, no float | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `decimal.test.ts:16` `expect(...).toBe("0.3")` | INV-82 normative precision fixture | Yes |
| `decimal.test.ts:12` `expect(...).toBe(expected)` | INV-82 canonical decimal normalization | Yes |
| `decimal.test.ts:61` `expectInvalidInput(input)` | INV-83 invalid input/bounds | Yes |
| `decimal.test.ts:45` `expect(...).toBe(expected)` | T1 exact comparison criterion | Yes |

**Adequacy verdict**: PASS. Assertions target normative values and error code; no mock, tautological, or out-of-scope test. The Domain test location follows the Test Coverage Matrix; no project testing guideline was found.

### T2: Validação dos valores de investimento

**What**: Entregar validação dos valores de investimento conforme os requisitos abaixo.
**Where**: `packages/domain/src/investments/values/investment-values.ts`
**Depends on**: T1
**Reuses**: Decimal de T1, Money e LocalDate.
**Requirement**: INV-21, INV-24, INV-36, INV-48, INV-82, INV-83, INV-84, INV-123
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Quantity, Percentage, UnitPrice e limite monetário simétrico respeitam a spec; distinguir custo ausente de zero e permitir percentuais acima de 100.
- [x] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain
**Commit**: `feat(investments-domain): validação dos valores de investimento`

**Execution evidence**: before T2 Domain: 12 files, 199 tests, pass; after: 13 files, 216 tests, pass. `investment-values.test.ts` adds 17 spec-derived scenarios. Quick Domain and supplemental domain lint passed.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-21 quantity | `packages/domain/src/investments/values/investment-values.test.ts:23` `expect(...).toBe(expected)` and `:27` `expectCode(..., "INVALID_INVESTMENT_INPUT")` | quantity is non-negative; absence is not converted to zero | Yes |
| INV-24 percentage | `investment-values.test.ts:37` `expect(...).toBe(expected)` for `105` and `:42` `expectCode(..., "INVALID_INVESTMENT_INPUT")` | 105 is valid; negative percentage is rejected | Yes |
| INV-36 numeric bounds | `investment-values.test.ts:69` `expectCode(..., "INVESTMENT_VALUE_OUT_OF_RANGE")` | persisted individual money accepts only symmetric int64 range | Yes |
| INV-48 unit price | `investment-values.test.ts:49` `expect(...).toBe(expected)` and `:53` `expectCode(..., "INVALID_INVESTMENT_INPUT")` | unit price is non-negative | Yes |
| INV-82 exact money bounds | `investment-values.test.ts:60` `expect(...amountMinor).toBe(amount)` | both ±9223372036854775807 are accepted | Yes |
| INV-83 validation | `investment-values.test.ts:69` `expectCode(..., "INVESTMENT_VALUE_OUT_OF_RANGE")` | out-of-range persisted money is rejected | Yes |
| INV-84 date code | `investment-values.test.ts:92` `expectCode(..., "INVALID_INVESTMENT_DATE")` | invalid local date gets stable investment code | Yes |
| INV-123 absent cost | `investment-values.test.ts:76` `expect(...).toBe(0n)` and `:77` `expectCode(..., "INVESTMENT_BOOK_COST_REQUIRED")` | explicit zero remains valid; missing cost rejects | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `investment-values.test.ts:23` `expect(...).toBe(expected)` | INV-21 quantity representation | Yes |
| `investment-values.test.ts:37` `expect(...).toBe(expected)` | INV-24 no 100 percentage cap | Yes |
| `investment-values.test.ts:69` `expectCode(..., "INVESTMENT_VALUE_OUT_OF_RANGE")` | INV-36/82 persisted money bounds | Yes |
| `investment-values.test.ts:76` `expect(...).toBe(0n)` | INV-123 zero distinct from absent cost | Yes |
| `investment-values.test.ts:92` `expectCode(..., "INVALID_INVESTMENT_DATE")` | INV-84 stable invalid-date code | Yes |

**Adequacy verdict**: PASS. Tests assert domain values and stable errors directly, cover zero/negative/boundary paths, and add no behavior beyond the named requirements. The Domain test location follows the Test Coverage Matrix; no project testing guideline was found.

### T3: Perfis financeiros

**What**: Entregar perfis financeiros conforme os requisitos abaixo.
**Where**: `packages/domain/src/accounts/financial-account-profile.ts`
**Depends on**: T2
**Reuses**: Value objects de identidade e normalização de nomes.
**Requirement**: INV-01, INV-02, INV-03, INV-11, INV-12
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Mapear todos os tipos para kind e validar perfil de investimento, instituição/referência e ausência de settlement; rejeitar combinação estrutural inválida.
- [x] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain
**Commit**: `feat(investments-domain): perfis financeiros`

**Execution evidence**: before T3 Domain: 13 files, 216 tests; after: 14 files, 232 tests. Quick Domain and supplemental lint passed.

| Requirement | Evidence | Spec outcome | Covered |
| --- | --- | --- | --- |
| INV-01 | `financial-account-profile.test.ts:20` `expect(...).toBe(kind)` | every normative type derives its listed kind | Yes |
| INV-02 | `financial-account-profile.test.ts:20` | profile map yields only ASSET/LIABILITY and does not extend LedgerAccountKind | Yes |
| INV-03 | `financial-account-profile.test.ts:72` `expectInvalid(...)`, `:106` exact code | category, EQUITY and system association reject | Yes |
| INV-11 | `financial-account-profile.test.ts:24` `expect(...).toEqual(...)` | investment institution and settlement may be absent | Yes |
| INV-12 | `financial-account-profile.test.ts:53` `expectInvalid(...)` | settlement profile is exclusive to INVESTMENT_ACCOUNT | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `financial-account-profile.test.ts:20` `expect(...).toBe(kind)` | INV-01/02 type map | Yes |
| `financial-account-profile.test.ts:28` `expect(...).toEqual(...)` | INV-11 optional fields | Yes |
| `financial-account-profile.test.ts:106` `expect(...code).toBe(...)` | INV-03 structural rejection | Yes |

**Adequacy verdict**: PASS. The 16 scenarios assert all type branches, optional values and structural failures directly. Domain co-location follows the Test Coverage Matrix; no project testing guideline was found.

### T4: Perfil no aggregate LedgerAccount

**What**: Entregar perfil no aggregate ledgeraccount conforme os requisitos abaixo.
**Where**: `packages/domain/src/ledger/accounts/ledger-account.ts`
**Depends on**: T3
**Reuses**: AggregateRoot, lifecycle e CategoryAppearance existentes.
**Requirement**: INV-02, INV-03, INV-04, INV-07, INV-11, INV-76
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Adicionar profile e mutação única/version/fact, clone profundo e validação quando presente; manter criação interna OTHER compatível. A exigência de profile no restore persistido entra em T23 junto do mapper e backfill.
- [x] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain
**Commit**: `feat(investments-domain): perfil no aggregate ledgeraccount`

**Execution evidence**: before T4 Domain: 14 files, 232 tests; after: 14 files, 244 tests. Quick Domain and lint passed. Assertions at `ledger-account.test.ts:274-367` cover OTHER derivation, version/facts, no-op, structural rejection and restore.

| Requirement | Evidence | Spec outcome | Covered |
| --- | --- | --- | --- |
| INV-02/03 | `ledger-account.test.ts:331` `expect(...).toThrowError(...)` | invalid profile association does not mutate | Yes |
| INV-04 | `ledger-account.test.ts:284` `expect(account.version).toBe(1)` | profile shares aggregate identity/version | Yes |
| INV-07 | `ledger-account.test.ts:313` `expect(...).toEqual(before)` | no-op preserves account state/history | Yes |
| INV-11 | `ledger-account.test.ts:286` `expect(...).toEqual(...)` | investment profile accepts optional fields | Yes |
| INV-76 | `ledger-account.test.ts:358` `expect(restored.pullDomainFacts()).toEqual([])` | restore creates no facts | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `ledger-account.test.ts:284` `expect(account.version).toBe(1)` | INV-04 | Yes |
| `ledger-account.test.ts:297` `expect(...type).toBe(...)` | configuration fact | Yes |
| `ledger-account.test.ts:313` `expect(...).toEqual(before)` | INV-07 no-op | Yes |

**Adequacy verdict**: PASS. The 12 new scenarios assert aggregate state/facts and clone/restore outcomes, with no mock-only assertions.

### T5: Identidades de investimentos

**What**: Entregar identidades de investimentos conforme os requisitos abaixo.
**Where**: `packages/domain/src/shared/identity/ids.ts`
**Depends on**: T4
**Reuses**: IdGenerator e adaptadores locais.
**Requirement**: INV-19, INV-78, INV-89
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Acrescentar quatro IDs internos e métodos do IdGenerator com implementações reais nos adaptadores sequenciais/Tauri; consumidores compilam sem casts para esconder métodos ausentes.
- [x] Escrever/atualizar no mesmo commit pelo menos 6 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain + Build
**Commit**: `feat(investments-domain): identidades de investimentos`

**Execution evidence**: before T5 Domain: 14 files, 244 tests; after: 14 files, 248 tests. Phase build passed: Domain 248/248, Application 209/209, Memory 246/246 and Tauri 63/63; check-types, lint, build and `git diff --check` passed for each touched package.

| Requirement | Evidence | Spec outcome | Covered |
| --- | --- | --- | --- |
| INV-19 | `identity.test.ts:46-52` `expect(fromString(value)).toBe(value)` | each investment entity has its own stable internal identity | Yes |
| INV-78 | `deterministic-adapters.test.ts:37-40` `expect(ids.nextInvestment...Id()).toBe(...)` | sequential adapter creates deterministic IDs for idempotent commands | Yes |
| INV-89 | `platform.test.ts:47-58` `expect(generated).toEqual([...])`; `expect(new Set(generated)).toHaveLength(9)` | Tauri generates real, distinct UUID-backed investment IDs | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `identity.test.ts:52` `expect(fromString(value)).toBe(value)` | INV-19 dedicated identity constructors | Yes |
| `deterministic-adapters.test.ts:37-40` `expect(ids.nextInvestment...Id()).toBe(...)` | INV-78 deterministic internal IDs | Yes |
| `platform.test.ts:47-58` `expect(generated).toEqual([...])`; `expect(new Set(generated)).toHaveLength(9)` | INV-89 real adapter contract | Yes |

**Adequacy verdict**: PASS. Eight new assertions across six parameterized/domain and adapter scenarios cover every new identity and generator outcome; assertions verify values and distinctness, not only calls.

### Phase 2: Aggregates de investimentos

### T6: Aggregate InvestmentInstrument

**What**: Entregar aggregate investmentinstrument conforme os requisitos abaixo.
**Where**: `packages/domain/src/investments/instruments/investment-instrument.ts`
**Depends on**: T5
**Reuses**: Perfis/valores, normalizeSearchText e AggregateRoot.
**Requirement**: INV-14, INV-15, INV-16, INV-17, INV-18, INV-26, INV-83, INV-89, INV-114, INV-116
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Cobrir todos os tipos/classes, normalização dos schemes, mercado obrigatório em TICKER e ausente em ISIN, moeda, metadata, lifecycle, no-op/version/facts e vedação a alterar tipo após uso.
- [x] Escrever/atualizar no mesmo commit pelo menos 18 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain
**Commit**: `feat(investments-domain): aggregate investmentinstrument`

**Execution evidence**: before T6 Domain: 14 files, 248 tests; after: 15 files, 285 tests. Quick Domain passed: 285/285; check-types, lint and `git diff --check` passed.

| Requirement | Evidence | Spec outcome | Covered |
| --- | --- | --- | --- |
| INV-14/15 | `investment-instrument.test.ts:26-59` `expect(...).toMatchObject(...)`; `expect(investmentInstrumentClassFor(type)).toBe(instrumentClass)` | active instrument and normative type-to-class map | Yes |
| INV-16 | `investment-instrument.test.ts:61-66` `toThrowError(...INVESTMENT_CURRENCY_MISMATCH)` | book-currency mismatch is rejected | Yes |
| INV-17/18 | `investment-instrument.test.ts:68-103` `toEqual(...)`; `toThrowError(...DUPLICATE_INSTRUMENT_IDENTIFIER)` | scheme normalization and duplicate rejection | Yes |
| INV-26 | `investment-instrument.test.ts:105-136` `expect(instrument.version).toBe(0)`; immutable type error | metadata versioning and type after use | Yes |
| INV-114/116 | `investment-instrument.test.ts:138-153` `toThrowError(...INVESTMENT_INSTRUMENT_IN_USE)`; `expect(instrument.status).toBe(...)` | archive guard and reactivation lifecycle | Yes |
| INV-83/89 | `investment-instrument.test.ts:82-89,167-175` `toThrowError(...INVALID_INVESTMENT_INPUT)` | bounded validation without external-provider dependency | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `investment-instrument.test.ts:45` `expect(investmentInstrumentClassFor(type)).toBe(instrumentClass)` | INV-15 all instrument types | Yes |
| `investment-instrument.test.ts:81` `expect(...).toEqual({ scheme: "TICKER", value: "PETR4", market: "B3" })` | INV-17 normalization | Yes |
| `investment-instrument.test.ts:114` `expect(instrument.pullDomainFacts()).toHaveLength(1)` | INV-26 versioned metadata fact | Yes |
| `investment-instrument.test.ts:147` `toThrowError(...INVESTMENT_INSTRUMENT_IN_USE)` | INV-114 archive guard | Yes |

**Adequacy verdict**: PASS. Thirty-seven new domain cases map to the normative aggregate contract, including every type, invalid identifier branch, lifecycle path and immutable contract; no assertion relies solely on a mock call.

### T7: Termos de renda fixa

**What**: Entregar termos de renda fixa conforme os requisitos abaixo.
**Where**: `packages/domain/src/investments/positions/fixed-income-terms.ts`
**Depends on**: T6
**Reuses**: Decimal, LocalDate e VOs de T2.
**Requirement**: INV-22, INV-23, INV-24, INV-25, INV-26
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Aceitar termos desconhecidos e variantes PREFIXED/INDEXED/HYBRID completas; validar pares de datas conhecidos e índices, sem calcular remuneração ou encerrar por vencimento.
- [x] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain
**Commit**: `feat(investments-domain): termos de renda fixa`

**Execution evidence**: before T7 Domain: 15 files, 285 tests; after: 16 files, 311 tests. `fixed-income-terms.test.ts` adds 26 spec-derived scenarios. Quick Domain, supplemental domain lint and `git diff --check` passed.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-22 | `fixed-income-terms.test.ts:16` `expect(...).toEqual({ rateKind: "PREFIXED", annualRate: "12.5" })`; `:26` INDEXED; `:37-42` HYBRID; `:7` `toBeUndefined()` | Unknown terms and each complete rate variant are accepted. | Yes |
| INV-23 | `fixed-income-terms.test.ts:110-116` `expectInvalid(...)`; `:119-130` `expectInvalid(...)`; `:146-151` `expectInvalid(...)`; `:154-157` `expectInvalid(...)` | Terms outside FIXED_INCOME, incomplete variants and invalid known date pairs reject with `INVALID_FIXED_INCOME_TERMS`. | Yes |
| INV-24 | `fixed-income-terms.test.ts:26` `expect(...).toEqual(...indexPercentage: "105")`; `:88-96` `expect(...).toBe("0")` | 105% and non-negative decimal rates/spreads are accepted without a 100 cap. | Yes |
| INV-25 | `fixed-income-terms.test.ts:59-64` `expect(...maturityDate).toBe("2020-01-01")` | Elapsed maturity remains descriptive; no remuneration or closing is calculated. | Yes |
| INV-26 | `fixed-income-terms.test.ts:99-107` `expect(...annualRate).toBe("10")` | Contracted terms remain immutable through snapshot copies. | Yes |

| Evidence | Maps to | Keep? |
| --- | --- | --- |
| `fixed-income-terms.test.ts:7` `expect(...).toBeUndefined()` | INV-22 unknown terms | Yes |
| `:16`, `:26`, `:37-42` `expect(...).toEqual(...)` | INV-22 variants | Yes |
| `:52-56`, `:74` `expect(...).toEqual(...)` | INV-22 partial terms and known dates | Yes |
| `:64` `expect(...).toBe("2020-01-01")` | INV-25 maturity does not close | Yes |
| `:85`, `:96` `expect(...).toEqual(...)` / `toBe("0")` | INV-24 allowed index and non-negative rates | Yes |
| `:107` `expect(...annualRate).toBe("10")` | INV-26 immutable terms snapshot | Yes |
| `:110-116`, `:119-130`, `:133-143`, `:146-157`, `:167` `expect(...code).toBe("INVALID_FIXED_INCOME_TERMS")` | INV-23 invalid class, components, index/rates and dates | Yes |

**Adequacy verdict**: PASS. The 26 direct assertions cover every selected rate branch, allowed partial/unknown terms, all known-date ordering pairs, immutable snapshots and the stable rejection code. No test relies on a mock or tautology; the Domain co-location follows the Test Coverage Matrix.

### T8: Aggregate InvestmentPosition

**What**: Entregar aggregate investmentposition conforme os requisitos abaixo.
**Where**: `packages/domain/src/investments/positions/investment-position.ts`
**Depends on**: T7
**Reuses**: AggregateRoot, valores e termos de T7.
**Requirement**: INV-19, INV-20, INV-21, INV-25, INV-26, INV-35, INV-39, INV-40, INV-46, INV-51, INV-53, INV-62, INV-71, INV-118, INV-119, INV-127, INV-128, INV-129, INV-144
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Implementar abertura, metadata e transições finais únicas: UNITS/AMOUNT, custo zero com unidades, fechamento, reabertura, UNOPENED cancelado, revision independente de version e allocationEffectiveOn.
- [x] Escrever/atualizar no mesmo commit pelo menos 24 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain
**Commit**: `feat(investments-domain): aggregate investmentposition`

**Execution evidence**: before T8 Domain: 16 files, 311 tests; after: 17 files, 343 tests. `investment-position.test.ts` adds 32 spec-derived scenarios. Quick Domain, supplemental Domain lint and `git diff --check` passed.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- |
| INV-19, INV-20 | `investment-position.test.ts:36` `expect(first.id).not.toBe(second.id)`; `:43-47` `expect(...).toMatchObject(...)` | Positions remain distinct; identities and quantity mode remain fixed. | Yes |
| INV-21, INV-35 | `:55` `expect(...).toMatchObject({ quantity: "10", bookCostMinor: "0", status: "OPEN" })`; `:70-77` `expectInvalid(...)`; `:157-159` `expectInvalid(...)` | Opening does not infer quantity; units/amount opening rules and explicit cost effect are enforced. | Yes |
| INV-25, INV-26 | `:90-110` `expect(...).toMatchObject({ ...fixedIncomeTerms ... })`; `:113-125` `expect(...type).toBe("InvestmentPositionChanged")` | Terms are retained at opening and metadata changes do not overwrite allocation/contract. | Yes |
| INV-39, INV-40, INV-46 | `:150-154` `expect(...).toMatchObject({ quantity: "6", bookCostMinor: "600", status: "OPEN" })`; `:170-173`, `:185-188`, `:209-212` | Partial exit changes only supplied cost/units; zero allocation closes; amortization-like effect preserves units. | Yes |
| INV-51, INV-127, INV-128, INV-129 | `:83-87`, `:223-227`, `:237-241`, `:252-257`, `:268-272`, `:288-291` | Revision starts at 1, advances once only when final allocation changes, and stays independent from version. | Yes |
| INV-53, INV-62, INV-71 | `:307-310` `expect(...).toMatchObject({ status: "OPEN", closedOn: undefined, allocationRevision: 3 })`; `:318-323` | Corrections reopen auditably; cancelling opening preserves zeroed CLOSED history. | Yes |
| INV-118, INV-119, INV-144 | `:334`, `:346`, `:357-359`, `:370`, `:407` `expect(...code).toBe("INVESTMENT_ENTITY_NOT_ACTIVE")` | Closed/inactive allocation and inactive reopens reject; active post-close cash flow remains permitted. | Yes |

| Evidence | Maps to | Keep? |
| --- | --- | --- |
| `investment-position.test.ts:36`, `:43-47`, `:55`, `:63-77` | INV-19–21 opening identity and allocation matrix | Yes |
| `:83-87`, `:102-110`, `:118-139` | INV-25, INV-26, INV-127 metadata, terms and independent revision | Yes |
| `:150-212` | INV-35, INV-39, INV-40, INV-46 final operation state | Yes |
| `:223-291`, `:307-323` | INV-51, INV-53, INV-62, INV-71, INV-128, INV-129 correction/revision transitions | Yes |
| `:334`, `:346`, `:357-370`, `:407` | INV-118, INV-119, INV-144 activity guards | Yes |
| `:380-387` | INV-127 restore and independent snapshot persistence | Yes |

**Adequacy verdict**: PASS. The 32 direct assertions cover every opening branch, economic final state, cancellation/reopening path, revision invariant, contract snapshot and activity guard assigned to T8. No test relies on a mock or tautology; the Domain co-location follows the Test Coverage Matrix.

### T9: Aggregate InvestmentOperation

**What**: Entregar aggregate investmentoperation conforme os requisitos abaixo.
**Where**: `packages/domain/src/investments/operations/investment-operation.ts`
**Depends on**: T8
**Reuses**: JournalEntry lifecycle e snapshots de Position.
**Requirement**: INV-34, INV-61, INV-63, INV-64, INV-65, INV-66, INV-68, INV-69, INV-72, INV-73, INV-81, INV-132, INV-133, INV-134
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Persistir deltas e estado anterior, role BUSINESS/REVERSAL, datas/sequência e lineage; permitir só mudança de links/version e inversão dos efeitos guardados; identificar última efetiva sem reversões.
- [x] Escrever/atualizar no mesmo commit pelo menos 18 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain
**Commit**: `feat(investments-domain): aggregate investmentoperation`

**Execution evidence**: before T9 Domain: 17 files, 343 tests; after: 18 files, 364 tests. `investment-operation.test.ts` adds 21 spec-derived scenarios. Quick Domain, supplemental Domain lint and `git diff --check` passed.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- |
| INV-34, INV-132 | `investment-operation.test.ts:43-54` `expect(...).toMatchObject({ role: "BUSINESS", quantityDelta: "-4", bookCostDeltaMinor: "-400", netCashFlowMinor: "470", positionBefore: ... })` | Normalized authoritative effects, explicit cash mode and prior economic state persist. | Yes |
| INV-61, INV-63, INV-68 | `:75-81` `expect(...reversedBy).toMatchObject(...)`; `:155` `expect(reversal.isEffective()).toBe(false)`; `:169-171` `expect(...id).toBe("operation-0")` | Lineage changes only links/version; an unlinked BUSINESS fact is the only effective candidate. | Yes |
| INV-72, INV-73, INV-134 | `:111-128` `expect(...).toMatchObject({ occurredOn: "2026-01-02", recordedAt: "2026-02-01T10:00:00.000Z" ... })`; `:158-169` invalid sequence/timestamp rejection | Sequence is positive persisted text; reversal preserves original occurrence and records the real correction instant. | Yes |
| INV-133 | `:120-128` `expect(...quantityDelta).toBe("4")` and `bookCostDeltaMinor: "400"`, `netCashFlowMinor: "-470"`; `:140-144` descriptive amounts | Reversal inverses stored deltas without recalculating descriptive amounts. | Yes |
| INV-81 | `:59-63` `expect(...).toMatchObject({ type: "InvestmentOperationRecorded", aggregateId: "operation-1", aggregateVersion: 0 })` | Recorded operation emits a typed versioned fact. | Yes |

| Evidence | Maps to | Keep? |
| --- | --- | --- |
| `investment-operation.test.ts:43-67`, `:178-201` | Persisted operation contract, optional references and snapshot cloning | Yes |
| `:75-108`, `:147-155` | INV-61, INV-63, INV-68 lineage and effective-state boundaries | Yes |
| `:111-144` | INV-73, INV-132, INV-133, INV-134 reversal contract | Yes |
| `:158-175`, `:204-208`, `:218` | Sequence/timestamp/delta validation and restore behavior | Yes |

**Adequacy verdict**: PASS. The 21 direct assertions cover every aggregate-owned role, lineage, stored-delta, reversal and ordering branch. Journal coordination, generic journal protection and coordinated position correction remain in their explicitly assigned later tasks; no test relies on a mock or tautology.

### T10: Observação InvestmentValuation

**What**: Entregar observação investmentvaluation conforme os requisitos abaixo.
**Where**: `packages/domain/src/investments/valuations/investment-valuation.ts`
**Depends on**: T9
**Reuses**: Valores exatos, Currency e Position.
**Requirement**: INV-47, INV-48, INV-49, INV-59, INV-82, INV-83, INV-84, INV-142
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Criar snapshot imutável com bruto obrigatório, campos opcionais desconhecidos, quantidade coerente e moeda; não alterar posição nem produzir journal/fact próprio.
- [x] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain + Build
**Commit**: `feat(investments-domain): observação investmentvaluation`

**Execution evidence**: before T10 Domain: 18 files, 364 tests; after: 19 files, 380 tests. `investment-valuation.test.ts` adds 16 spec-derived scenarios. Quick Domain, Domain lint, Domain build and `git diff --check` passed.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- |
| INV-47, INV-49 | `investment-valuation.test.ts:33-39` `expect(...).toMatchObject({ source: "MANUAL", grossValueMinor: "1200", allocationRevision: 2 })`; `:39` `expect(...).toEqual([])` | Manual values are immutable observations with no aggregate fact, journal or position mutation. | Yes |
| INV-48, INV-142 | `:59-68`, `:69-80`, `:91-102`, `:121` `expect(...code).toBe("INVALID_INVESTMENT_VALUATION")` | Negative values, mismatch currency/quantity and invalid value timestamps reject with the stable valuation code. | Yes |
| INV-59 | `:46-50` `expect(...).toMatchObject({ netValueMinor: undefined, withdrawableValueMinor: undefined, grossValueMinor: "1200" })` | Unknown optional values remain absent, not zero or gross. | Yes |
| INV-82, INV-83, INV-84 | `:93-97` `expect(...unitPrice).toBe("120.5")`; `:98-106` `expectInvalid(...)` | Decimal values are canonical and invalid temporal/sequence input rejects. | Yes |

| Evidence | Maps to | Keep? |
| --- | --- | --- |
| `investment-valuation.test.ts:33-58`, `:108-112` | INV-47, INV-49, INV-59 immutable append-only snapshot | Yes |
| `:59-102`, `:104-106`, `:121` | INV-48, INV-142 invalid monetary, quantity and temporal paths | Yes |
| `:93-97` | INV-82, INV-83 canonical precise unit price | Yes |

**Adequacy verdict**: PASS. The 16 direct assertions cover every task-owned optional-value, quantity, currency, precision and immutability branch. No test relies on a mock or tautology; the Domain co-location follows the Test Coverage Matrix.

### Phase 3: Plano contábil e fronteiras da aplicação

### T11: Planner contábil de investimentos

**What**: Entregar planner contábil de investimentos conforme os requisitos abaixo.
**Where**: `packages/domain/src/investments/accounting/investment-accounting-plan.ts`
**Depends on**: T10
**Reuses**: Money, Posting e JournalEntry.post.
**Requirement**: INV-27, INV-29, INV-30, INV-35, INV-36, INV-37, INV-38, INV-39, INV-40, INV-41, INV-42, INV-43, INV-44, INV-45, INV-46, INV-125, INV-126, INV-132
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Cobrir todas as linhas da matriz com valores literais da spec: principal, ganho/perda, despesas e caixa; agrupar contas/remover zeros, não criar journal vazio nem capitalizar/repetir taxas.
- [x] Escrever/atualizar no mesmo commit 24 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Domain` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Domain); testes acompanham o componente nesta tarefa.
**Gate**: Quick Domain
**Commit**: `feat(investments-domain): planner contábil de investimentos`

**Execution evidence**: before T11 Domain: 19 files, 380 tests; after: 20 files, 404 tests. `investment-accounting-plan.test.ts` adds 24 spec-derived scenarios. Quick Domain passed: 20 files, 404 tests, 0 failures; `check-types` passed.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- |
| INV-27, INV-29, INV-30, INV-125 | `investment-accounting-plan.test.ts:28-31`, `:45-47` `expect(result.bookCostDeltaMinor).toBe(cost)` | Opening has no journal; purchase/application preserves principal and never capitalizes fees/taxes. | Yes |
| INV-35–INV-46, INV-126 | `:32-42`, `:45-47` `expect(...postings).toEqual(expected)` | Sale/redemption/amortization/income/fee/tax use literal principal, result, expenses and cash deltas. | Yes |
| INV-45 | `:36`, `:47` `expect(...).toEqual([])` | Internal sale at cost with no expenses produces no empty journal. | Yes |
| INV-36, INV-132 | `:50-61` `expect(...).toThrow("Invalid investment accounting plan")` | Impossible routes, required categories, negative net cash and malformed monetary values reject. | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `investment-accounting-plan.test.ts:45-47` | INV-27, INV-29, INV-30, INV-35–INV-46, INV-125, INV-126 literal accounting matrix | Yes |
| `:61` | INV-36 invalid operation boundaries | Yes |

**Adequacy verdict**: PASS. The 24 assertions cover every planner operation branch, no-empty-journal grouping and required invalid inputs with literal spec outcomes.

### T12: Contratos de comandos e resultados

**What**: Entregar contratos de comandos e resultados conforme os requisitos abaixo.
**Where**: `packages/application/src/ports/investment-commands.ts`
**Depends on**: T11
**Reuses**: Commands/Result existentes e modelos de domínio.
**Requirement**: INV-20, INV-36, INV-74, INV-76, INV-78, INV-79, INV-82, INV-83, INV-84, INV-89, INV-90, INV-131, INV-145
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Definir envelopes/drafts discriminados, MutationResult e warning com conta/caixa/moeda; impedir postings arbitrários e mistura de rota interna/externa; versionar contrato canônico.
- [x] Escrever/atualizar no mesmo commit 9 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Application` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Application); testes acompanham o componente nesta tarefa.
**Gate**: Quick Application
**Commit**: `feat(investments-contracts): contratos de comandos e resultados`

**Execution evidence**: before T12 Application: 18 files, 209 tests; after: 19 files, 218 tests. `investment-commands.test.ts` adds 9 spec-derived scenarios. Quick Application passed: 19 files, 218 tests, 0 failures; application check-types passed after Domain build.

| Requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-36, INV-82, INV-83 | `investment-commands.test.ts:25`, `:34`, `:42` `expect(...).toMatchObject(...)` | Drafts preserve explicit strings for cost, gross and expense values. | Yes |
| INV-74, INV-78, INV-79 | `:13`, `:45-49` `expect(receipt).toMatchObject({ formatVersion: 1, result: ... })` | bookId/requestId envelope and versioned canonical receipt preserve replay result. | Yes |
| INV-145 | `:39` `expect(warning).toEqual(...)` | Warning exposes code, investment account, cash, currency and asOf. | Yes |
| INV-89, INV-90 | `:51` `expectTypeOf<InvestmentOperationDraft>().not.toHaveProperty("postings")` | Contract accepts no arbitrary postings or provider surface. | Yes |

**Adequacy verdict**: PASS. Every assertion maps to a public command boundary; routes are discriminated and all result/warning payload fields are asserted.

### T13: Ports de persistência de investimento

**What**: Entregar ports de persistência de investimento conforme os requisitos abaixo.
**Where**: `packages/application/src/ports/investment-repositories.ts`
**Depends on**: T12
**Reuses**: RepositoryContext e SqliteReader como padrão de separação, sem import de infraestrutura.
**Requirement**: INV-74, INV-75, INV-76, INV-78, INV-88, INV-89, INV-132
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Definir BookScopedLookup, repositories, stores append-only, sequence e leituras scoped de D4.3; não exigir implementações novas no RepositoryContext existente antes de T40.
- [x] Escrever/atualizar no mesmo commit 6 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Application` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Application); testes acompanham o componente nesta tarefa.
**Gate**: Quick Application
**Commit**: `feat(investments-contracts): ports de persistência de investimento`

**Execution evidence**: before T13 Application: 19 files, 218 tests; after: 20 files, 224 tests. `investment-repositories.test.ts` adds 6 contract scenarios. Quick Application passed: 20 files, 224 tests, 0 failures; application check-types passed after Domain build.

| Requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-74 | `investment-repositories.test.ts:6-8` `expect(...).toEqual(["FOUND", "NOT_FOUND", "BOOK_MISMATCH"])` | Book lookup distinguishes absence from another book. | Yes |
| INV-75, INV-76, INV-78, INV-88 | `:9-12` `expectTypeOf<Parameters<...>>().toEqualTypeOf<...>()` | Receipt, sequence, valuation and scoped reads remain typed at the application boundary. | Yes |
| INV-89, INV-132 | `:13` `expectTypeOf<RepositoryContext>().not.toHaveProperty("investmentPositions")` | New ports are additive and do not require infrastructure or legacy context changes. | Yes |

**Adequacy verdict**: PASS. The six contract checks cover lookup discrimination, append-only/idempotent stores and scoped transaction reads.

### T14: Contratos das consultas de investimento

**What**: Entregar contratos das consultas de investimento conforme os requisitos abaixo.
**Where**: `packages/application/src/ports/investment-queries.ts`
**Depends on**: T13
**Reuses**: QueryPage/QuerySlice e contracts de queries existentes.
**Requirement**: INV-09, INV-10, INV-50, INV-52, INV-54, INV-55, INV-56, INV-57, INV-58, INV-59, INV-60, INV-93, INV-94, INV-95, INV-96, INV-97, INV-98, INV-140, INV-141
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Tipar resumo/posição/carteira/históricos, valores string, base de avaliação e cursores; resumos têm data e moeda explícitas e não aceitam filtros da lista.
- [x] Escrever/atualizar no mesmo commit 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Application` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Application); testes acompanham o componente nesta tarefa.
**Gate**: Quick Application
**Commit**: `feat(investments-contracts): contratos das consultas de investimento`

**Execution evidence**: before T14 Application: 20 files, 224 tests; after: 21 files, 232 tests. `investment-queries.test.ts` adds 8 contract scenarios. Quick Application passed: 21 files, 232 tests, 0 failures; application check-types passed after Domain build.

**Adequacy verdict**: PASS. Tests assert explicit currency/asOf, string totals, valuation bases, unknown quantities and isolated list cursor/filter contracts.

### T15: Registro dos facts no dispatcher

**What**: Entregar registro dos facts no dispatcher conforme os requisitos abaixo.
**Where**: `packages/application/src/core/event-dispatcher.ts`
**Depends on**: T14
**Reuses**: ApplicationEventType e testes de envelopes atuais.
**Requirement**: INV-04, INV-81, INV-90
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Registrar todos os facts listados na spec com livro/aggregate/version exatos; publicar na ordem e rejeitar tipo desconhecido sem expor payload financeiro no diagnóstico.
- [x] Escrever/atualizar no mesmo commit 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Application` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Application); testes acompanham o componente nesta tarefa.
**Gate**: Quick Application
**Commit**: `feat(investments-contracts): registro dos facts no dispatcher`

**Execution evidence**: before T15 Application: 21 files, 232 tests; after: 21 files, 233 tests. One dispatcher scenario asserts all 10 investment fact variants. Quick Application passed: 21 files, 233 tests, 0 failures; application check-types passed after Domain build.

**Adequacy verdict**: PASS. The assertion compares each fact's ordered type, bookId, aggregateId and aggregateVersion, while the existing unknown-type test retains the diagnostic boundary.

### T16: Resultado preservado após commit

**What**: Entregar resultado preservado após commit conforme os requisitos abaixo.
**Where**: `packages/application/src/core/use-case-executor.ts`
**Depends on**: T15
**Reuses**: executeUseCase, dispatcher e TransactionManager.
**Requirement**: INV-75, INV-78, INV-80, INV-81, INV-90
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Separar falha pré-commit de dispatch/reporter pós-commit; preserveCommitted retorna sucesso salvo mesmo se ambos falharem, default dos consumidores não migrados é preservado.
- [x] Escrever/atualizar no mesmo commit 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Quick Application + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: unit (Application); testes acompanham o componente nesta tarefa.
**Gate**: Quick Application + Build
**Commit**: `feat(investments-contracts): resultado preservado após commit`

**Execution evidence**: before T16 Application: 21 files, 233 tests; after: 21 files, 235 tests. Existing executor coverage plus two post-commit scenarios cover ten commit/dispatch/error branches. Quick Application and Build passed: 21 files, 235 tests, 0 failures; check-types, eslint, application build and `git diff --check` passed after Domain build.

| Requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-75, INV-78 | `use-case-executor.test.ts:411-424` `expect(result).toEqual(Result.ok("saved"))` | A known committed result stays successful when dispatch and reporter fail. | Yes |
| INV-80, INV-81 | `:426-438` `expect(result.error.code).toBe("UNEXPECTED_ERROR")`; existing `:383-402` publish-after-commit assertions | Default legacy behavior is retained; events remain post-commit. | Yes |
| INV-90 | `use-case-executor.ts:20-25` maps post-commit failure to stable ApplicationError before reporting. | Reporter observes only stable error context, not a financial payload. | Yes |

**Adequacy verdict**: PASS. The post-commit tests assert the two mutually exclusive policies and existing tests retain pre-commit rollback/error behavior and event order.

### Phase 4: Schema e migrações

### T17: Migração de perfis financeiros

**What**: Entregar migração de perfis financeiros conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/migrations/0005_financial_account_profiles.sql`
**Depends on**: T16
**Reuses**: Runner e geração de manifesto existentes.
**Requirement**: INV-01, INV-03, INV-05, INV-06, INV-85, INV-86, INV-87, INV-88
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Criar tabelas/triggers de profiles e backfill OTHER inclusive arquivadas, sem tocar postings/versões/checksums; testar banco vazio/v4, repetição e rollback da migration.
- [x] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): migração de perfis financeiros`

**Execution evidence**: baseline SQLite: 39 files, 692 tests; after: 40 files, 703 tests. Full SQLite passed: Domain/Application/Memory builds, SQLite 703/703 tests, migration manifest check and typecheck.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- |
| INV-01, INV-03 | `tests/migrations/investment-migrations.test.ts:87-103` `rejects.toThrow("financial account profile must match")` | profiles accept only matching non-system financial parent accounts | Yes |
| INV-05, INV-06 | `:53-72` `resolves.toEqual([...OTHER_ASSET, OTHER_LIABILITY])`; `:75-84` `resolves.toEqual([{ version: 7 }])` | active/archived ASSET and LIABILITY backfill once; categories/system, account versions and postings remain intact | Yes |
| INV-85, INV-86 | `:39-50` `sql: expect.stringContaining("STRICT")`; `:134-140` migration list is `1..5` after repeated execution | empty and v4 databases get strict, book-scoped profiles without modifying prior migrations | Yes |
| INV-87 | `:143-150` `resolves.toEqual([])` / versions `1..4` | failed v5 rolls back only itself and can be retried | Yes |
| INV-88 | `:106-131` exact child profile selection and invalid settlement assertions | persisted profile relations retain book-scoped parent integrity | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `investment-migrations.test.ts:60-64` `resolves.toEqual([...])` | INV-05/06 normative OTHER backfill | Yes |
| `:92`, `:100`, `:103` `rejects.toThrow(...)` | INV-01/03 profile parent constraints | Yes |
| `:111`, `:119`, `:128`, `:131` direct relation assertions | INV-01/03 investment-profile and settlement constraints | Yes |
| `:140`, `:149-150` migration-state assertions | INV-85/86/87 repeatability and rollback | Yes |

**Adequacy verdict**: PASS. Eleven integration scenarios assert schema state, persisted values and rollback metadata directly. No scenario relies solely on mock calls; existing SQLite migration-test conventions were followed.

### T18: Migração de instrumentos

**What**: Entregar migração de instrumentos conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/migrations/0006_investment_instruments.sql`
**Depends on**: T17
**Reuses**: Migration de T17 e runner existente.
**Requirement**: INV-14, INV-17, INV-18, INV-74, INV-85, INV-86, INV-87
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Criar instrumentos/identificadores STRICT, FK composta e unicidade com mercado canônico não nulo; testar colisões por livro/scheme e migração retomável.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): migração de instrumentos`

**Execution evidence**: before T18 SQLite: 40 files, 703 tests; after: 40 files, 712 tests. Full SQLite passed: dependency builds, SQLite 712/712 tests, generated manifest check and typecheck.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- |
| INV-14 | `tests/migrations/investment-migrations.test.ts:154-162` `sql: expect.stringContaining("STRICT")`; `:218-227` rejects invalid enum/currency/status | instrument catalog is strict and preserves the approved type/lifecycle value set | Yes |
| INV-17 | `:177-198` exact TICKER `market: "B3"`, ISIN `market: ""`, and invalid market rejections | TICKER requires market, ISIN forbids it, and missing market is canonical empty text | Yes |
| INV-18 | `:201-215` collision and foreign-key rejection assertions | normalized identifier is unique per book/scheme/market and cannot cross books | Yes |
| INV-74 | `:210-215` `rejects.toThrow()` | a child identifier cannot reference a parent from another book | Yes |
| INV-85, INV-86, INV-87 | `:230-242` version `1..6`, absent tables and preserved `1..5` assertions | reexecution is safe and a failed v6 rolls back only itself | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `investment-migrations.test.ts:182` exact ticker row | INV-17 canonical market | Yes |
| `:190` `market: ""` | INV-17 ISIN canonical market | Yes |
| `:197-198`, `:207`, `:215` rejections | INV-17/18/74 schema integrity | Yes |
| `:234`, `:241-242` migration-state assertions | INV-85/86/87 retry and rollback | Yes |

**Adequacy verdict**: PASS. Nine integration scenarios assert persisted canonical fields, unique/FK constraints, strict values and retry state. No mock-only assertion or unclaimed scenario was added.

### T19: Migração de posições e termos

**What**: Entregar migração de posições e termos conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/migrations/0007_investment_positions.sql`
**Depends on**: T18
**Reuses**: Schemas de carteira/instrumento e migration runner.
**Requirement**: INV-19, INV-20, INV-21, INV-22, INV-23, INV-74, INV-85, INV-86, INV-127
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Criar posição/termos com FKs de livro, sem unique conta+instrumento; validar modos e variantes de taxa, datas, versões e revisão inicial.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): migração de posições e termos`

**Execution evidence**: before T19 SQLite: 40 files, 712 tests; after: 40 files, 720 tests. Full SQLite passed: dependency builds, SQLite 720/720, manifest check and typecheck.

| Requirement | Evidence | Outcome | Covered |
| --- | --- | --- | --- |
| INV-19, INV-20, INV-21, INV-127 | `tests/migrations/investment-migrations.test.ts:256-264` exact two-position and invalid quantity/revision assertions | multiple positions are allowed; mode and revision constraints persist | Yes |
| INV-22, INV-23 | `:266-267` exact three rate kinds; `:268` invalid variant/date rejections | all complete variants persist; incomplete and reversed dates reject | Yes |
| INV-74, INV-85, INV-86 | `:265`, `:269` FK and v7 rollback assertions | book-scoped parents and migration atomicity hold | Yes |

**Adequacy verdict**: PASS. Eight integration scenarios assert stored rows and direct SQL rejection paths; all map to the task requirements and avoid mock-only coverage.

### T20: Migração de operações e sequência

**What**: Entregar migração de operações e sequência conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/migrations/0008_investment_operations.sql`
**Depends on**: T19
**Reuses**: Constraints de journal e schemas anteriores.
**Requirement**: INV-63, INV-64, INV-68, INV-69, INV-72, INV-74, INV-85, INV-86, INV-132, INV-133, INV-134
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Criar sequence/operations, estado anterior escalar, lineage restrito à posição e ownership de journal; proteger efeitos contra UPDATE e validar links permitidos.
- [x] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): migração de operações e sequência`

**Execution evidence**: 730/730 SQLite tests; Full SQLite, generated migrations and typecheck passed. `investment-migrations.test.ts` adds ten SQL integration scenarios for scalar effects, sequence, cash route, reversal/self lineage, immutable effect updates, indexes and rollback.

**Adequacy verdict**: PASS. Assertions target persisted operation fields and named schema constraints, not mocks.

### T21: Migração de avaliações

**What**: Entregar migração de avaliações conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/migrations/0009_investment_valuations.sql`
**Depends on**: T20
**Reuses**: Position FK e índices previstos em D6.
**Requirement**: INV-47, INV-49, INV-50, INV-74, INV-85, INV-86, INV-88, INV-127
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Criar avaliações imutáveis, índice de seleção vigente e ordem persistida; rejeitar UPDATE/DELETE, aceitar duas observações no mesmo instante.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): migração de avaliações`

**Execution evidence**: 738/738 SQLite tests; Full SQLite, generated manifest and typecheck passed. Eight SQL scenarios cover immutable rows, current/history indexes, sequence ordering, same-instant observations, duplicate sequence, parent isolation and invalid values.

**Adequacy verdict**: PASS. Every assertion targets a required persisted value or schema rejection.

### T22: Migração de recibos

**What**: Entregar migração de recibos conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/migrations/0010_investment_request_receipts.sql`
**Depends on**: T21
**Reuses**: Migration runner e manifesto.
**Requirement**: INV-75, INV-78, INV-79, INV-80, INV-85, INV-86, INV-87
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Criar recibos com PK livro/requestId e JSON versionado; validar unicidade, rollback e retomada desde cada versão intermediária sem expiração/backfill duplicado.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite + Build
**Commit**: `feat(investments-sqlite): migração de recibos`

**Execution evidence**: 746/746 SQLite tests; Full SQLite, manifest, typecheck and SQLite build passed. Eight SQL scenarios cover versioned JSON, composite uniqueness, invalid data, no expiry, rerun and rollback.

**Adequacy verdict**: PASS. Assertions target receipt state and migration outcomes directly.

### Phase 5: Persistência SQLite dos aggregates

### T23: Persistência do perfil no LedgerAccount

**What**: Entregar persistência do perfil no ledgeraccount conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/repositories/sqlite-ledger-account-repository.ts`
**Depends on**: T22
**Reuses**: Mapper e repository atuais; migrations T17–T22.
**Requirement**: INV-01, INV-03, INV-04, INV-05, INV-06, INV-07, INV-11, INV-74, INV-76, INV-88
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Persistir/restaurar profile e settlement junto ao aggregate e CAS; mapper exige profile financeiro após migration. Atualizar fixtures/consumidores de restore no mesmo commit, mantendo categorias/system intactos. A persistência de profiles no adapter em memória também conserva o snapshot completo; strict restore só é ativado quando todos os consumidores forem compatíveis.
- [x] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): persistência do perfil no ledgeraccount`

**Execution evidence**: before T23 SQLite: 40 files, 746 tests; after: 40 files, 761 tests. Full SQLite passed: Domain/Application/Memory builds, SQLite 761/761 tests, generated migration manifest check and SQLite typecheck.

| Requirement / done-when | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-01, INV-04, INV-11, INV-88 | `sqlite-ledger-account-repository.test.ts:176-198` `expect(...toSnapshot()).toEqual(investment.toSnapshot())` | Investment account profile, optional metadata and settlement round-trip with the account identity and version. | Yes |
| INV-03, INV-74, INV-76 | `sqlite-ledger-account-repository.test.ts:201-226` `expect(...toSnapshot()).toEqual(updated.toSnapshot())`; `:247-267` `rejects.toMatchObject({ code: "UNEXPECTED_ERROR" })` and `resolves.toBeNull()` | CAS persists the profile atomically; an invalid settlement cannot leave a persisted aggregate. | Yes |
| INV-05, INV-06, INV-07 | `persistence-contracts.test.ts:58-80` explicit OTHER profile fixtures; `sqlite-ledger-account-repository.test.ts:229-245` `expect(...toSnapshot()).toEqual(updated.toSnapshot())` | Financial types remain compatible with their ASSET/LIABILITY aggregate; same-kind reclassification retains account identity and versioned state. | Yes |
| INV-76, INV-88 | `ledger-account-mapper.test.ts:105-129` `toThrow(...)` assertions | A post-migration financial account with missing or malformed profile data is rejected during restore. | Yes |

**Adequacy verdict**: PASS. The 15 added focused scenarios assert persisted state and rollback outcomes, not only SQL calls. Each maps to T23 requirements; the adapted contract/query fixtures preserve their existing assertions under strict restore.

### T24: Repository SQLite de instrumentos

**What**: Entregar repository sqlite de instrumentos conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/repositories/sqlite-investment-instrument-repository.ts`
**Depends on**: T23
**Reuses**: Repository CAS e mapper de conta.
**Requirement**: INV-14, INV-16, INV-17, INV-18, INV-26, INV-74, INV-76, INV-88, INV-114, INV-116
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Roundtrip de instrumentos/filhas, lookup tipado, unicidade, no-op e CAS com rollback das filhas; não devolver entidade de outro livro.
- [x] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): repository sqlite de instrumentos`

**Execution evidence**: before T24 SQLite: 40 files, 761 tests; after: 41 files, 774 tests. Full SQLite passed: Domain/Application/Memory builds, SQLite 774/774 tests, generated migration manifest check and SQLite typecheck.

| Requirement / done-when | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-14, INV-16, INV-17 | `sqlite-investment-instrument-repository.test.ts:67-81` `expect(...toSnapshot()).toEqual(value.toSnapshot())`; `:103-127` `resolves.toBe(true)` | Scalar fields and normalized TICKER/ISIN identifiers persist and restore exactly. | Yes |
| INV-18, INV-74 | `sqlite-investment-instrument-repository.test.ts:84-91` `resolves.toEqual({ kind: "BOOK_MISMATCH" })`; `:177-193` duplicate rejects and second lookup is `NOT_FOUND` | Other-book lookup exposes no entity; duplicate normalized identifier rolls back its instrument. | Yes |
| INV-26, INV-76 | `sqlite-investment-instrument-repository.test.ts:159-174` `expect(value.version).toBe(0)`; `:196-244` snapshot equality after CAS and stale failure | Metadata no-op preserves version; save replaces children only with the exact next version. | Yes |
| INV-88, INV-114, INV-116 | `sqlite-investment-instrument-repository.test.ts:94-100` `resolves.toBeUndefined()`; `:130-156` scoped/excluded identifier assertions | Reconstructed instruments preserve independent IDs, and repository uniqueness is book-scoped without treating a display name as an identifier key. | Yes |

**Adequacy verdict**: PASS. The 13 scenarios assert returned snapshots, typed lookup envelopes, child state and rollback. Each is requirement-bound; no assertion is only a mock-call count.

### T25: Repository SQLite de posições

**What**: Entregar repository sqlite de posições conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/repositories/sqlite-investment-position-repository.ts`
**Depends on**: T24
**Reuses**: Repository CAS e schemas de T19.
**Requirement**: INV-19, INV-20, INV-21, INV-22, INV-23, INV-26, INV-74, INV-76, INV-88, INV-113, INV-114, INV-127, INV-128
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Restaurar quantidade/termos/revisão exatos, salvar uma versão e consultar uso atual/histórico; proibir alteração de identidade/mode/termos e estado corrompido.
- [x] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): repository sqlite de posições`

**Execution evidence**: before T25 SQLite: 41 files, 774 tests; after: 42 files, 787 tests. Full SQLite passed: Domain/Application/Memory builds, SQLite 787/787 tests, generated migration manifest check, SQLite typecheck and `git diff --check`.

| Requirement / done-when | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-19, INV-20, INV-21, INV-22, INV-23, INV-127 | `sqlite-investment-position-repository.test.ts:120-122` `expect(...toSnapshot()).toEqual(value.toSnapshot())`; `:136-138` same assertion for AMOUNT without quantity/terms | Separate positions retain identity; units or absent AMOUNT quantity, fixed-income terms, exact cost and allocation revision round-trip. | Yes |
| INV-74, INV-113, INV-114 | `sqlite-investment-position-repository.test.ts:146-148` `resolves.toEqual({ kind: "BOOK_MISMATCH" })`; `:161-166` `expect(...kind).toBe("FOUND")`; `:181-186` current/historical account usage | A foreign-book position is not exposed; same account/instrument positions are distinct; current and historical uses remain queryable. | Yes |
| INV-26, INV-76, INV-128 | `sqlite-investment-position-repository.test.ts:241-243` `expect(...toSnapshot()).toEqual(updated.toSnapshot())`; `:253-259` stale save rejection and unchanged snapshot; `:273-279` immutable change rejection and original snapshot | A valid next version preserves allocation state; stale or immutable rewrites do not overwrite persisted data. | Yes |
| INV-88, INV-113, INV-114 | `sqlite-investment-position-repository.test.ts:198-203` `hasAnyForInstrument(...).resolves.toBe(true)` and `hasOpenForInstrument(...).resolves.toBe(false)`; `:211-216` foreign-book usage is false | Repository restores scalar data and distinguishes historical/open use in the requested book only. | Yes |
| state corruption | `sqlite-investment-position-repository.test.ts:292-294` `rejects.toMatchObject({ code: "INVALID_INVESTMENT_OPERATION" })` | A persisted CLOSED position without closedOn is not reconstructed as valid domain state. | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `sqlite-investment-position-repository.test.ts:120-122` `expect(...toSnapshot()).toEqual(value.toSnapshot())` | INV-19–23, INV-127 exact position and terms persistence | Yes |
| `sqlite-investment-position-repository.test.ts:146-148` `resolves.toEqual({ kind: "BOOK_MISMATCH" })` | INV-74 book boundary | Yes |
| `sqlite-investment-position-repository.test.ts:181-186` `hasAnyForAccount(...).resolves.toBe(true)` / `hasOpenForAccount(...).resolves.toBe(true)` | INV-113–114 historical/current account dependency | Yes |
| `sqlite-investment-position-repository.test.ts:253-259` stale rejection plus exact snapshot | INV-76 optimistic concurrency | Yes |
| `sqlite-investment-position-repository.test.ts:273-279` immutable rejection plus exact snapshot | INV-20, INV-23, INV-26 immutable opening contract | Yes |
| `sqlite-investment-position-repository.test.ts:292-294` `rejects.toMatchObject({ code: "INVALID_INVESTMENT_OPERATION" })` | Done-when corrupted-state rejection | Yes |

**Adequacy verdict**: PASS. The 13 SQLite scenarios assert reconstructed snapshots and typed outcomes, not calls. They cover the bounded repository contract; no spec-precision gap or scope-expanding assertion was found.

### T26: Repository SQLite de operações

**What**: Entregar repository sqlite de operações conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/repositories/sqlite-investment-operation-repository.ts`
**Depends on**: T25
**Reuses**: Journal mapper e constraints de T20.
**Requirement**: INV-61, INV-63, INV-64, INV-65, INV-68, INV-69, INV-72, INV-74, INV-76, INV-88, INV-132, INV-133, INV-134, INV-135, INV-136
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Persistir snapshot e lineage sem reescrever efeito; buscar última efetiva com exclusão do alvo e ownership de qualquer journal; testar quatro combinações com/sem journal.
- [x] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): repository sqlite de operações`

**Execution evidence**: before T26 SQLite: 42 files, 787 tests; after: 43 files, 803 tests. Full SQLite passed: Domain/Application/Memory builds, SQLite 803/803 tests, generated migration manifest check, SQLite typecheck and `git diff --check`.

| Requirement / done-when | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-61, INV-65, INV-88, INV-132, INV-133, INV-134 | `sqlite-investment-operation-repository.test.ts:143-145` `expect(...toSnapshot()).toEqual(value.toSnapshot())`; `:282-284` same assertion after `saveLineage` | Snapshot retains normalized effects, state-before, categories, journal and lineage without rewriting effects. | Yes |
| INV-63, INV-68, INV-72 | `sqlite-investment-operation-repository.test.ts:196-201` `resolves.toMatchObject({ id: "later" })`; `:213-218` same-day sequence assertion; `:231-237` target exclusion assertion | Last effective business operation is ordered by date/sequence and excludes the correction target. | Yes |
| INV-74, INV-76 | `sqlite-investment-operation-repository.test.ts:172-174` `resolves.toEqual({ kind: "BOOK_MISMATCH" })`; `:302-308` stale save rejection and persisted link is `"reversal"` | Foreign-book operation is hidden; stale lineage cannot overwrite the persisted link. | Yes |
| INV-135, INV-136 | `sqlite-investment-operation-repository.test.ts:354-365` parameterized `expect(...journalEntryId).toBe(originalJournal/reversalJournal)` | Original and reversal preserve all four journal-presence combinations without fabricating a journal. | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `sqlite-investment-operation-repository.test.ts:143-145` `expect(...toSnapshot()).toEqual(value.toSnapshot())` | INV-88, INV-132 authoritative snapshot restore | Yes |
| `sqlite-investment-operation-repository.test.ts:282-284` `expect(...toSnapshot()).toEqual(original.toSnapshot())` | INV-61, INV-65, INV-133 lineage-only save | Yes |
| `sqlite-investment-operation-repository.test.ts:196-201` `resolves.toMatchObject({ id: "later" })` | INV-68, INV-72 effective ordering | Yes |
| `sqlite-investment-operation-repository.test.ts:302-308` stale rejection and `toBe("reversal")` | INV-76 CAS preservation | Yes |
| `sqlite-investment-operation-repository.test.ts:354-365` `toBe(originalJournal)` / `toBe(reversalJournal)` | INV-135, INV-136 journal combinations | Yes |

**Adequacy verdict**: PASS. The 16 SQLite scenarios assert persisted snapshots and query outcomes, including all journal combinations. No assertion is a spy/call-count surrogate or exceeds the operation repository contract.

### T27: Store SQLite de avaliações

**What**: Entregar store sqlite de avaliações conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/repositories/sqlite-investment-valuation-store.ts`
**Depends on**: T26
**Reuses**: Schema de T21 e protocolo string/int64.
**Requirement**: INV-47, INV-48, INV-49, INV-50, INV-74, INV-88, INV-127
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Append/roundtrip exatos, sem update/delete público, preservando valuedAt/recordedAt/sequence/revision e campos ausentes.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): store sqlite de avaliações`

**Execution evidence**: before T27 SQLite: 43 files, 803 tests; after: 44 files, 811 tests. Full SQLite passed: Domain/Application/Memory builds, SQLite 811/811 tests, generated migration manifest check, SQLite typecheck and `git diff --check`.

| Requirement / done-when | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-47, INV-48, INV-88, INV-127 | `sqlite-investment-valuation-store.test.ts:48-66` `resolves.toEqual([{ ... }])`; `:77-88` exact NULL assertions | Append preserves timestamps, sequence, allocation revision and all present/absent fields exactly. | Yes |
| INV-49, INV-50 | `sqlite-investment-valuation-store.test.ts:90-99` `resolves.toEqual([{ id: "valuation-1" }, { id: "valuation-2" }])` | Same-instant observations remain distinct and persist in sequence order. | Yes |
| INV-74 | `sqlite-investment-valuation-store.test.ts:111-121` duplicate ID/record sequence rejects with `DUPLICATE_ENTITY` | The book-scoped persisted keys do not admit conflicting observations. | Yes |
| append-only / INV-88 | `sqlite-investment-valuation-store.test.ts:123-132` rollback leaves `[]`; `:136-141` update/delete reject | A failed transaction removes its append; SQLite rejects later mutation and deletion. | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `sqlite-investment-valuation-store.test.ts:48-66` `resolves.toEqual([{ ... }])` | INV-47, INV-88 exact persisted valuation | Yes |
| `sqlite-investment-valuation-store.test.ts:90-99` `resolves.toEqual([{ id: "valuation-1" }, { id: "valuation-2" }])` | INV-49 append history | Yes |
| `sqlite-investment-valuation-store.test.ts:123-132` `resolves.toEqual([])` | transaction rollback criterion | Yes |
| `sqlite-investment-valuation-store.test.ts:136-141` mutation promises reject | append-only criterion | Yes |

**Adequacy verdict**: PASS. The eight integration scenarios assert persisted values and database state, including rollback and immutability; no mock call is used as outcome evidence.

### T28: Store SQLite de recibos

**What**: Entregar store sqlite de recibos conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/repositories/sqlite-investment-request-store.ts`
**Depends on**: T27
**Reuses**: Schema de T22 e executor transacional.
**Requirement**: INV-74, INV-75, INV-78, INV-79, INV-80, INV-88
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Guardar e recuperar resultado imutável por livro/request, detectar duplicata e não reaplicar efeitos; rollback remove recibo junto do fato.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): store sqlite de recibos`

**Execution evidence**: before T28 SQLite: 44 files, 811 tests; after: 45 files, 819 tests. Full SQLite passed: Domain/Application/Memory builds, SQLite 819/819 tests, generated migration manifest check, SQLite typecheck and `git diff --check`.

| Requirement / done-when | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-74, INV-78, INV-80, INV-88 | `sqlite-investment-request-store.test.ts:50-54` `resolves.toEqual(value)`; `:56-59` both scoped lookup assertions are null | The exact command/result is recovered only for its book/request identity. | Yes |
| INV-79 | `sqlite-investment-request-store.test.ts:68-74` duplicate rejects `DUPLICATE_ENTITY` and `find(...).resolves.toEqual(first)` | A reused key cannot overwrite the original receipt. | Yes |
| INV-75 | `sqlite-investment-request-store.test.ts:93-100` transaction throws and `find(...).resolves.toBeNull()` | Rollback removes the receipt with its enclosing unit of work. | Yes |
| stored-result variants | `sqlite-investment-request-store.test.ts:61-66` `resolves.toEqual(value)`; `:76-91` two request IDs persist | Empty optional result IDs and independent requests retain exact semantics. | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `sqlite-investment-request-store.test.ts:52-54` `resolves.toEqual(value)` | INV-78, INV-80 immutable retry result | Yes |
| `sqlite-investment-request-store.test.ts:71-74` duplicate error and first result equality | INV-79 idempotency conflict | Yes |
| `sqlite-investment-request-store.test.ts:93-100` `find(...).resolves.toBeNull()` | INV-75 rollback | Yes |

**Adequacy verdict**: PASS. The eight SQLite scenarios assert durable receipt state, book scope, duplicate protection and rollback, without mock-only evidence.

### T29: Store SQLite de sequência

**What**: Entregar store sqlite de sequência conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/repositories/sqlite-investment-sequence-store.ts`
**Depends on**: T28
**Reuses**: Reserva de sequência de journals.
**Requirement**: INV-50, INV-72, INV-75, INV-82, INV-88
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Reservar sequência positiva em transação, preservar string exata no DTO e reverter reserva em erro; rejeitar estouro antes de gravar.
- [x] Escrever/atualizar no mesmo commit pelo menos 6 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite + Build
**Commit**: `feat(investments-sqlite): store sqlite de sequência`

**Execution evidence**: before T29 SQLite: 45 files, 819 tests; after: 46 files, 825 tests. Full SQLite + Build passed: Domain/Application/Memory builds, SQLite 825/825 tests, generated migration manifest check, SQLite typecheck, lint, SQLite build and `git diff --check`.

| Requirement / done-when | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-50, INV-72, INV-88 | `sqlite-investment-sequence-store.test.ts:16-25` `resolves.toBe("1")` and `resolves.toBe("2")` | Reservation starts positive, is monotonic per book, and remains book-scoped. | Yes |
| INV-82 | `sqlite-investment-sequence-store.test.ts:27-31` `resolves.toBe("9007199254740993")` | Values beyond JavaScript safe integer return as exact strings. | Yes |
| INV-75 | `sqlite-investment-sequence-store.test.ts:33-40` transaction rolls back and next result is `"1"` | Reservation belongs to its transaction and is undone on failure. | Yes |
| overflow | `sqlite-investment-sequence-store.test.ts:42-53` error code assertion and exact persisted max | Exhaustion rejects before modifying the int64 counter. | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `sqlite-investment-sequence-store.test.ts:20-21` `resolves.toBe("1")` / `resolves.toBe("2")` | INV-50, INV-72 monotonic ordering | Yes |
| `sqlite-investment-sequence-store.test.ts:31` `resolves.toBe("9007199254740993")` | INV-82 exact string transport | Yes |
| `sqlite-investment-sequence-store.test.ts:40` `resolves.toBe("1")` | INV-75 rollback | Yes |
| `sqlite-investment-sequence-store.test.ts:46-53` error plus unchanged max value | overflow criterion | Yes |

**Adequacy verdict**: PASS. The six SQLite scenarios assert observable counter values and rollback state, including exact large-integer transport; no test relies on a mock call or an implementation-only detail.

### Phase 6: Adapters de memória

### T30: Snapshot de investimentos em memória

**What**: Entregar snapshot de investimentos em memória conforme os requisitos abaixo.
**Where**: `packages/infrastructure-memory/src/store/in-memory-store.ts`
**Depends on**: T29
**Reuses**: Snapshot/restore do InMemoryStore.
**Requirement**: INV-04, INV-75, INV-88, INV-127, INV-132
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Incluir todas as coleções/contador e clone profundo; alterar cópia de profile/termos/identificador/estado anterior não contamina store ou rollback.
- [x] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Memory); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments-memory): snapshot de investimentos em memória`

**Execution evidence**: before T30 Memory: 26 files, 246 tests; after: 26 files, 256 tests. Full Memory passed: Domain/Application builds, Memory 256/256 tests and Memory typecheck.

| Requirement / done-when | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-04, INV-88 | `in-memory-store.test.ts:190-200` `expect(...identifiers[0]?.value).toBe("ABC")`; `202-214` terms assertion; `216-244` categories and `positionBefore` assertions | Snapshot copies nested identifier, terms and previous state without mutable reference escape. | Yes |
| INV-75 | `in-memory-store.test.ts:278-297` `expect(store.snapshot()).toEqual(snapshot)` and `302-304` restored identifiers | Restore returns every investment collection to its pre-failure snapshot. | Yes |
| INV-127 | `in-memory-store.test.ts:202-214` `expect(...fixedIncomeTerms?.annualRate).toBe("10")` | Position terms remain preserved through snapshot copies. | Yes |
| INV-132 | `in-memory-store.test.ts:216-244` exact category/state assertions | Operation normalized effects include independent category and prior economic state snapshots. | Yes |
| counter / book scope | `in-memory-store.test.ts:273-276` `expect(...).toBe("1")` for both books | Exact sequences start at one and are isolated by book. | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `in-memory-store.test.ts:198-200` `expect(...value).toBe("ABC")` | INV-88 mutable identifier reconstruction | Yes |
| `in-memory-store.test.ts:212-214` `expect(...annualRate).toBe("10")` | INV-127 terms persistence | Yes |
| `in-memory-store.test.ts:224-244` category/state assertions | INV-132 operation snapshot | Yes |
| `in-memory-store.test.ts:261-264` `expect(...cashMinor).toBe("-1")` | INV-75 immutable receipt state | Yes |
| `in-memory-store.test.ts:289-297` `expect(store.snapshot()).toEqual(snapshot)` | INV-75 full rollback snapshot | Yes |

**Adequacy verdict**: PASS. Ten direct scenarios cover every new collection, nested mutable structure, book-scoped sequence and snapshot restoration. Assertions target stored values, not calls or implementation-only details.

### T31: Repository em memória de instrumentos

**What**: Entregar repository em memória de instrumentos conforme os requisitos abaixo.
**Where**: `packages/infrastructure-memory/src/repositories/in-memory-investment-instrument-repository.ts`
**Depends on**: T30
**Reuses**: InMemoryLedgerAccountRepository e store T30.
**Requirement**: INV-14, INV-17, INV-18, INV-26, INV-74, INV-76, INV-114, INV-116
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Implementar lookup, unicidade, lifecycle e CAS equivalentes ao adapter SQLite sem retornar referências mutáveis.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Memory); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments-memory): repository em memória de instrumentos`

**Execution evidence**: before T31 Memory: 26 files, 256 tests; after: 27 files, 264 tests. Full Memory passed: Domain/Application builds, Memory 264/264 tests and Memory typecheck.

| Requirement / done-when | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-14, INV-74 | `in-memory-investment-instrument-repository.test.ts:30-41` `toMatchObject({ kind: "FOUND"... })`; `44-52` `toEqual({ kind: "BOOK_MISMATCH" })` | Lookup returns a same-book instrument and never exposes another book. | Yes |
| INV-17, INV-18 | `:62-69` `toBe(true)` for trimmed/uppercase TICKER; `:72-81` book scope | Identifier matching uses the normalized identifier and book boundary. | Yes |
| INV-26, INV-114, INV-116 | `:84-92` nonzero add error; `:95-104` stale save error | Lifecycle version and CAS reject invalid persistence without replacement. | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `in-memory-investment-instrument-repository.test.ts:36-40` `toMatchObject({ kind: "FOUND" })` | INV-14 lookup | Yes |
| `:50-52` `toEqual({ kind: "BOOK_MISMATCH" })` | INV-74 isolation | Yes |
| `:67-69` `toBe(true)` | INV-17 normalization | Yes |
| `:101-104` concurrency error code | INV-76 CAS | Yes |

**Adequacy verdict**: PASS. Eight scenarios assert public results and stable error codes for lookup, isolation, normalized identifiers and optimistic concurrency.

### T32: Repository em memória de posições

**What**: Entregar repository em memória de posições conforme os requisitos abaixo.
**Where**: `packages/infrastructure-memory/src/repositories/in-memory-investment-position-repository.ts`
**Depends on**: T31
**Reuses**: Store T30 e Position.
**Requirement**: INV-19, INV-20, INV-74, INV-76, INV-113, INV-114, INV-127
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Persistir/restaurar posições e termos, uso histórico/aberto e CAS, sem agrupar posições do mesmo instrumento.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Memory); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments-memory): repository em memória de posições`

**Execution evidence**: before T32: 27 files, 264 tests; after: 28 files, 272 tests. Full Memory passed: Domain/Application builds, 272/272 Memory tests and typecheck. `in-memory-investment-position-repository.test.ts:35-44` asserts FOUND and BOOK_MISMATCH; `:58-70` asserts distinct positions/history/open use; `:74-94` asserts stable CAS errors. Adequacy verdict: PASS. Eight spec-scoped assertions cover lookup, book isolation, distinct positions, history/open checks, terms restoration and concurrency.

### T33: Repository em memória de operações

**What**: Entregar repository em memória de operações conforme os requisitos abaixo.
**Where**: `packages/infrastructure-memory/src/repositories/in-memory-investment-operation-repository.ts`
**Depends on**: T32
**Reuses**: Store T30 e Operation.
**Requirement**: INV-61, INV-63, INV-64, INV-65, INV-69, INV-72, INV-74, INV-76, INV-132
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Preservar deltas/lineage, ordenar última efetiva por data/sequência, excluir alvo e resolver ownership sem contar reversões.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Memory); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments-memory): repository em memória de operações`

**Execution evidence**: before T33: 28 files, 272 tests; after: 30 files, 280 tests. Full Memory passed: Domain/Application builds, 280/280 Memory tests, lint, typecheck and `git diff --check`. `in-memory-investment-operation-repository.test.ts:30-90` asserts deltas/lineage restoration, book ownership, missing lookup, effective ordering by date and exact sequence, reversal exclusion, target exclusion and lineage CAS. Adequacy verdict: PASS.

### T34: Store em memória de avaliações

**What**: Entregar store em memória de avaliações conforme os requisitos abaixo.
**Where**: `packages/infrastructure-memory/src/repositories/in-memory-investment-valuation-store.ts`
**Depends on**: T33
**Reuses**: Store T30 e snapshots de Valuation.
**Requirement**: INV-47, INV-49, INV-50, INV-74, INV-88
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Append preserva observações e revisão; cópias não mutam dados guardados e inserções do mesmo instante continuam distintas.
- [x] Escrever/atualizar no mesmo commit pelo menos 6 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Memory); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments-memory): store em memória de avaliações`

**Execution evidence**: before T34: 30 files, 280 tests; after: 32 files, 286 tests. Full Memory passed: Domain/Application builds, 286/286 Memory tests, lint, typecheck and `git diff --check`. `in-memory-investment-valuation-store.test.ts:23-68` asserts append, allocation revision, same-instant distinct IDs, position retention and copy isolation. Adequacy verdict: PASS.

### T35: Store em memória de recibos

**What**: Entregar store em memória de recibos conforme os requisitos abaixo.
**Where**: `packages/infrastructure-memory/src/repositories/in-memory-investment-request-store.ts`
**Depends on**: T34
**Reuses**: Store T30 e contrato de recibos.
**Requirement**: INV-74, INV-75, INV-78, INV-79, INV-80
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Reproduzir unicidade por livro/request, resultado imutável e participação no snapshot/rollback.
- [x] Escrever/atualizar no mesmo commit pelo menos 6 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Memory); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments-memory): store em memória de recibos`

**Execution evidence**: before T35: 32 files, 286 tests; after: 34 files, 292 tests. Full Memory passed: Domain/Application builds, 292/292 Memory tests, lint, typecheck and `git diff --check`. `in-memory-investment-request-store.test.ts:19-72` asserts missing/round-trip reads, book scope, duplicate preservation, independent requests and snapshot rollback. Adequacy verdict: PASS.

### T36: Store em memória de sequência

**What**: Entregar store em memória de sequência conforme os requisitos abaixo.
**Where**: `packages/infrastructure-memory/src/repositories/in-memory-investment-sequence-store.ts`
**Depends on**: T35
**Reuses**: Contador transacional existente.
**Requirement**: INV-50, INV-72, INV-75, INV-82
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Reservar inteiro exato por livro, detectar limite e restaurar reserva após erro sem colisão entre operações/avaliações.
- [x] Escrever/atualizar no mesmo commit pelo menos 6 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Memory); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory + Build
**Commit**: `feat(investments-memory): store em memória de sequência`

**Execution evidence**: before T36: 34 files, 292 tests; after: 36 files, 298 tests. Full Memory + Build passed: Domain/Application/Memory builds, 298/298 Memory tests, lint, typecheck and `git diff --check`. `in-memory-investment-sequence-store.test.ts:8-53` asserts initial/large exact values, book isolation, shared stream, limit detection and rollback restoration. Adequacy verdict: PASS.

### Phase 7: Leituras de escrita e contas financeiras

### T37: Agregador exato de postings

**What**: Entregar agregador exato de postings conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/sqlite-exact-ledger-totals.ts`
**Depends on**: T36
**Reuses**: SqliteReader, parâmetros e codecs monetários.
**Requirement**: INV-55, INV-56, INV-57, INV-82, INV-103, INV-140, INV-141
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Somar bigint em páginas internas de até 512 usando chave estável e reader recebido; cobrir totais >int64, sinais, filtros e reversões sem SUM/TOTAL float ou nova transação.
- [x] Escrever/atualizar no mesmo commit 13 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): agregador exato de postings`

**Execution evidence**: before T37: 46 files, 825 tests; after: 47 files, 838 tests. Full SQLite passed: Domain/Application/Memory builds, 838/838 SQLite tests, migration check, typecheck and `git diff --check`.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-55, INV-82 | `sqlite-exact-ledger-totals.test.ts:80` `expect(...).resolves.toBe("18446744073709551614")` | totals preserve bigint beyond int64 | Yes |
| INV-55, INV-103 | `sqlite-exact-ledger-totals.test.ts:70` `expect(...).resolves.toBe("9223372036854775800")` | signed postings preserve their exact sum | Yes |
| INV-57, INV-140, INV-141 | `sqlite-exact-ledger-totals.test.ts:108` `expect(...).toContain("e.occurred_on <= ?")` | date filter is inclusive and bound in the received reader | Yes |
| INV-55, INV-56, INV-57 | `sqlite-exact-ledger-totals.test.ts:92` `expect(queries).toHaveLength(2)` and `:93` cursor assertion | each scan page has at most 512 rows and uses a stable key | Yes |
| INV-55, INV-103 | `sqlite-exact-ledger-totals.test.ts:167` `expect(...).not.toMatch(/\\b(SUM|TOTAL)\\s*\\(/i)` | aggregation does not use SQLite SUM or TOTAL | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `sqlite-exact-ledger-totals.test.ts:80` `expect(...).resolves.toBe("18446744073709551614")` | INV-82 exact money | Yes |
| `sqlite-exact-ledger-totals.test.ts:70` `expect(...).resolves.toBe("9223372036854775800")` | INV-55 signed cash total | Yes |
| `sqlite-exact-ledger-totals.test.ts:93` `expect(...).toBe("0511")` | T37 512-row stable cursor | Yes |
| `sqlite-exact-ledger-totals.test.ts:167` `expect(...).not.toMatch(...)` | T37 no SQL aggregate | Yes |

**Adequacy verdict**: PASS. Assertions target exact outputs, cursor state and SQL safety constraints; the persisted SQLite scenario covers the received transaction reader. SQLite test placement follows the coverage matrix.

### T38: Leituras transacionais SQLite

**What**: Entregar leituras transacionais sqlite conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/sqlite-investment-transaction-reads.ts`
**Depends on**: T37
**Reuses**: Agregador T37 e índices de posições/settlement.
**Requirement**: INV-12, INV-28, INV-32, INV-55, INV-60, INV-77, INV-113, INV-115, INV-140, INV-141, INV-145
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Calcular L/C/caixa e dependentes ativos no executor recebido, após escritas; incluir aviso de cada carteira negativa, datas e saldo completo para arquivamento sem reentrância Tauri.
- [x] Escrever/atualizar no mesmo commit 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): leituras transacionais sqlite`

**Execution evidence**: before T38: 47 files, 838 tests; after: 48 files, 850 tests. Full SQLite passed: Domain/Application/Memory builds, 850/850 SQLite tests, migration check, typecheck and `git diff --check`.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- |
| INV-12, INV-115 | `sqlite-investment-transaction-reads.test.ts:54` `expect(...).resolves.toBe(true)` and `:71` active-status assertion | only active investment accounts using the settlement are dependents | Yes |
| INV-55, INV-140, INV-141 | `sqlite-investment-transaction-reads.test.ts:83` `expect(...).resolves.toBe("9007199254740993")` and `:93` date parameter assertion | ledger balance is exact and uses the requested inclusive date | Yes |
| INV-28, INV-32, INV-60, INV-145 | `sqlite-investment-transaction-reads.test.ts:119` `expect(...).resolves.toEqual(...cashMinor: "300")` and `:136` negative `"-100"` assertion | cash equals L-C and negative cash remains observable | Yes |
| INV-113 | `sqlite-investment-transaction-reads.test.ts:150` `expect(...).resolves.toEqual` per account | each requested account keeps an independent complete balance | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `sqlite-investment-transaction-reads.test.ts:54` `expect(...).resolves.toBe(true)` | INV-115 settlement use | Yes |
| `sqlite-investment-transaction-reads.test.ts:83` `expect(...).resolves.toBe("9007199254740993")` | INV-55 exact ledger | Yes |
| `sqlite-investment-transaction-reads.test.ts:136` `expect(...cashMinor...).toEqual("-100")` | INV-60 negative cash | Yes |
| `sqlite-investment-transaction-reads.test.ts:189` `expect(...parameters).toEqual(["book", "account"])` | INV-74 book-scoped lookup | Yes |

**Adequacy verdict**: PASS. Tests assert exact cash state, negative state, scope parameters and active settlement behavior directly; no result is inferred from a call count.

### T39: Leituras transacionais em memória

**What**: Entregar leituras transacionais em memória conforme os requisitos abaixo.
**Where**: `packages/infrastructure-memory/src/queries/in-memory-investment-transaction-reads.ts`
**Depends on**: T38
**Reuses**: InMemoryLedgerQueries e store completo.
**Requirement**: INV-12, INV-28, INV-32, INV-55, INV-60, INV-77, INV-113, INV-115, INV-140, INV-141, INV-145
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Calcular os mesmos saldos/avisos e dependentes que SQLite; preservar originais/reversões, data D e dados ainda não confirmados da transação corrente.
- [x] Escrever/atualizar no mesmo commit 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Memory); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments-memory): leituras transacionais em memória`

**Execution evidence**: before T39: 298 tests; after: 308 tests. Full Memory passed: Domain/Application builds, 308/308 Memory tests, typecheck and `git diff --check`.

**Adequacy verdict**: PASS. `in-memory-investment-transaction-reads.test.ts:52` asserts an exact bigint balance, `:66` the inclusive date, `:78` the excluded future balance, `:94` signed arithmetic, `:119` book isolation, `:141` active settlement dependency, `:153` archived-dependent exclusion, and `:164`/`:175` complete cash result shape. Each assertion maps to the T39 cash, date, book and settlement requirements; no mock call count substitutes for state.

### T40: Contexto transacional com investimentos

**What**: Entregar contexto transacional com investimentos conforme os requisitos abaixo.
**Where**: `packages/application/src/ports/repositories.ts`
**Depends on**: T39
**Reuses**: Todos os adapters T23–T39 e filas transacionais existentes.
**Requirement**: INV-74, INV-75, INV-76, INV-77, INV-78, INV-80, INV-81, INV-88, INV-89
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Adicionar os ports obrigatórios e wiring real nos dois transaction managers; confirmar/rollback de posição/operação/journal/recibo/sequência/facts juntos; adaptar fakes e testar scoped executor via adapter Tauri. Rodar contratos reais pelo SQLite, injeção de erro antes do commit e protocolo nativo mockado como prova distinta de UAT.
- [x] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Cross` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Integration); testes acompanham o componente nesta tarefa.
**Gate**: Full Cross
**Commit**: `feat(investments-transaction): contexto transacional com investimentos`

**Execution evidence**: Application: 235 → 241 tests; Memory: 308 → 310 tests; SQLite: 850 → 856 tests. The 14 added/updated scenarios are seven required public context ports, two Memory transaction scenarios, the SQLite context shape, and six SQLite scoped-executor routes. Full Cross passed: Domain/Application builds, 310/310 Memory tests, 856/856 SQLite tests, migration check, SQLite build/typecheck, 63/63 Tauri protocol tests/typecheck, and `git diff --check`.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-74 scoped repository context | `packages/application/src/ports/investment-repositories.test.ts:39` `expectTypeOf<RepositoryContext>().toHaveProperty("investmentInstruments")`; `:51` `...("investmentReads")` | context requires investment ports and book-scoped reads | Yes |
| INV-75 pre-commit rollback | `packages/infrastructure-memory/src/transaction/in-memory-transaction-manager.test.ts:111` `rejects.toThrow("rollback investments")`; `:114` `expect(...next(...)).toBe("1")`; `:116` `expect(...find(...)).toBeNull()` | receipt and sequence are reverted with the enclosing write | Yes |
| INV-76 / INV-77 transaction-scoped persistence | `packages/infrastructure-memory/src/transaction/in-memory-transaction-manager.test.ts:85` `expect(...instrument).toEqual({ kind: "NOT_FOUND" })`; `:86-91` assertions for position, operation, receipt, sequence, dependency and cash | all investment state is accessed within the same transaction context | Yes |
| INV-78 / INV-80 receipt and retry substrate | `packages/application/src/ports/investment-repositories.test.ts:25` `expectTypeOf<Parameters<InvestmentRequestStore["find"]>>().toEqualTypeOf<[string, string]>()`; `packages/infrastructure-memory/src/transaction/in-memory-transaction-manager.test.ts:116` `expect(...find(...)).toBeNull()` after rollback | receipts remain book/request scoped and never survive a failed commit | Yes |
| INV-81 facts stay on the common context | `packages/infrastructure-sqlite/src/repositories/create-sqlite-repository-context.test.ts:128` `expect(fixture.context.facts).toBe(fixture.facts)` | facts are collected by the transaction context, not a separate write path | Yes |
| INV-88 / INV-89 real SQLite wiring without provider coupling | `packages/infrastructure-sqlite/src/repositories/create-sqlite-repository-context.test.ts:115` exact key assertion; `:148` `resolves.toEqual({ kind: "NOT_FOUND" })`; `packages/infrastructure-tauri/src/database/tauri-sqlite-database.test.ts:163` `expect(calls[2]!.args).toEqual(...transactionId: "tx-1")` | all investment adapters are concrete SQLite adapters and use the scoped native executor without provider contracts | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `in-memory-transaction-manager.test.ts:114` `expect(...next(...)).toBe("1")` | INV-75 atomic rollback | Yes |
| `in-memory-transaction-manager.test.ts:116` `expect(...find(...)).toBeNull()` | INV-75/78 receipt rollback | Yes |
| `create-sqlite-repository-context.test.ts:115` `expect(Object.keys(...).sort()).toEqual([...])` | T40 complete concrete context wiring | Yes |
| `create-sqlite-repository-context.test.ts:148` `resolves.toEqual({ kind: "NOT_FOUND" })` | INV-74 book-scoped instrument adapter routing | Yes |
| `create-sqlite-repository-context.test.ts:193` `resolves.toBe(false)` | INV-77 transaction-scoped settlement dependency read | Yes |

**Adequacy verdict**: PASS. Assertions check required context members, exact lookup/read outcomes, and rollback state rather than mock calls; all tests map to T40 and the Integration/Memory/SQLite location conventions in the coverage matrix. Tauri protocol tests are mock-native transport proof only; native UAT remains future T93/T94 scope.

### T41: Criação de conta pelo tipo financeiro

**What**: Entregar criação de conta pelo tipo financeiro conforme os requisitos abaixo.
**Where**: `packages/application/src/ledger/accounts/create-financial-account.ts`
**Depends on**: T40
**Reuses**: Factory de LedgerAccount e executor existente.
**Requirement**: INV-01, INV-02, INV-03, INV-04, INV-11, INV-74
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Trocar kind de entrada por type e migrar chamadas/facade/fixtures mecanicamente no mesmo commit; criar profile e settlement opcional validado sem identidade extra.
- [x] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): criação de conta pelo tipo financeiro`

**Execution evidence**: Memory: 310 → 313 tests. `create-financial-account.test.ts` has 10 command scenarios: typed bank, credit card, investment settlement, invalid settlement/type, normalized optional text, missing book, duplicate name, distinct derived kind, and invalid name. Full Memory passed: Domain/Application builds, 313/313 Memory tests, typecheck and `git diff --check`; Tauri facade typecheck also passed.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-01 type creates derived ledger kind and profile | `packages/infrastructure-memory/src/use-cases/create-financial-account.test.ts:26` `expect(result).toEqual({ ... kind: "ASSET", ... financialAccount: { type: "BANK_ACCOUNT" } })` | account type, not caller kind, determines a financial profile and ledger classification | Yes |
| INV-02 / INV-03 optional institution/reference | `create-financial-account.test.ts:35` `financialAccount: { type: "BANK_ACCOUNT", institutionName: "Banco A", displayReference: "1234" }` | optional profile text is normalized and persisted | Yes |
| INV-04 / INV-11 investment profile and optional settlement | `create-financial-account.test.ts:98` `expect(result).toMatchObject({ ... investment: { defaultSettlementAccountId: "account-99" } })`; `:120` `error: { code: "INVALID_FINANCIAL_ACCOUNT_PROFILE" }` | settlement is allowed only on an investment profile and carries no new identity | Yes |
| INV-74 no cross-book or missing-book write | `create-financial-account.test.ts:183` `error: { code: "ENTITY_NOT_FOUND" }`; `:185` `expect(harness.store.snapshot()).toEqual(before)` | absent book rejects before persistence | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `create-financial-account.test.ts:26` `expect(result).toEqual(...)` | INV-01 typed bank result/profile | Yes |
| `create-financial-account.test.ts:105` `expect(...financialAccount).toEqual(...)` | INV-04 settlement persistence | Yes |
| `create-financial-account.test.ts:120` `error.code === "INVALID_FINANCIAL_ACCOUNT_PROFILE"` | INV-11 invalid settlement profile | Yes |
| `create-financial-account.test.ts:180` `error.code === "DUPLICATE_ENTITY"` | account uniqueness under derived kind | Yes |

**Adequacy verdict**: PASS. Tests assert stored/resulting profile state and exact error codes, not mock calls; all scenarios map to T41 requirements and follow the Memory command-test convention.

### T42: Configuração financeira e liquidação

**What**: Entregar configuração financeira e liquidação conforme os requisitos abaixo.
**Where**: `packages/application/src/ledger/accounts/configure-financial-account.ts`
**Depends on**: T41
**Reuses**: Profile T3 e InvestmentTransactionReads.
**Requirement**: INV-04, INV-07, INV-08, INV-11, INV-12, INV-13, INV-74, INV-76, INV-115, INV-138
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Implementar configuração e wrappers set/clear de settlement sobre uma única mutação; validar posições históricas/dependentes e tipo/kind/livro/status, no-op e CAS, sem postings.
- [x] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): configuração financeira e liquidação`

**Execution evidence**: before T42 Memory: 313 tests; after: 327 tests. Full Memory passed: Domain/Application builds, Memory 327/327 tests, Memory typecheck and `git diff --check`.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-04, INV-07, INV-11, INV-13, INV-138 | `configure-financial-account.test.ts:63` `expect(result).toMatchObject({ value: { id: "account-5", kind: "ASSET", version: 1, financialAccount: { type: "CASH" } } })`; `:77` `expect(...listJournalEntries()).toEqual(beforeJournals)` | compatible reclassification preserves identity/kind and creates no posting | Yes |
| INV-08 | `:112` / `:133` / `:166` exact `error.code === "FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED"` | kind change, historical investment removal and incompatible active settlement change reject | Yes |
| INV-12 | `:185`, `:205`, `:233`, `:252`, `:270` exact `error.code === "INVALID_SETTLEMENT_ACCOUNT"` | self, inactive, cross-book, non-bank/payment and absent settlement reject | Yes |
| INV-04, INV-11 | `:290` `expect(result).toMatchObject({ value: { id: "account-5", version: 1, financialAccount: { investment: { defaultSettlementAccountId: "account-6" } } } })`; `:325` clear result includes the same id and `investment: {}` | set/clear wrappers use one aggregate mutation and retain the account identity | Yes |
| INV-74, INV-76 | `:352` exact `OPTIMISTIC_CONCURRENCY_FAILURE` and `:356` snapshot equality; `:381` exact `BOOK_MISMATCH` and `:382` snapshot equality | stale CAS and foreign-book reference reject without mutation | Yes |
| no-op | `:94` `version: 0`; `:95-96` snapshot/event equality | unchanged normalized profile has no write or event | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `configure-financial-account.test.ts:63-77` resulting profile/account and unchanged journal assertions | INV-04, INV-07, INV-11, INV-13, INV-138 | Yes |
| `:112-170` three exact type-change errors and snapshots | INV-08, INV-115 | Yes |
| `:185-272` five exact settlement errors | INV-12 | Yes |
| `:290-336` set/clear profile, identity and version assertions | INV-04, INV-11 | Yes |
| `:352-382` CAS/book error and immutable snapshot assertions | INV-74, INV-76 | Yes |

**Adequacy verdict**: PASS. Fourteen command scenarios assert persisted/resulting profile state, exact stable errors, versions and absence of postings, not mock calls. The Memory command-test conventions in `packages/infrastructure-memory/src/use-cases/` were followed.

### T43: Política de lifecycle de contas

**What**: Entregar política de lifecycle de contas conforme os requisitos abaixo.
**Where**: `packages/application/src/ledger/accounts/investment-account-lifecycle-policy.ts`
**Depends on**: T42
**Reuses**: Lifecycle de LedgerAccount e leituras T38/T39.
**Requirement**: INV-08, INV-12, INV-74, INV-113, INV-115, INV-116, INV-144
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Conectar política compartilhada a archive/reactivate existentes; bloquear carteira com OPEN ou saldo não zero e settlement em uso; reativar preserva ID e revalida vínculos na transação.
- [x] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory + Build
**Commit**: `feat(investments): política de lifecycle de contas`

**Execution evidence**: before T43 Memory: 327 tests; after: 340 tests, including 13 lifecycle scenarios. Full Memory + Build passed: Domain/Application builds; Memory 35 files/340 tests, typecheck, lint and build; Application 21 files/241 tests, lint, typecheck and build; `git diff --check`.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-113 | `investment-account-lifecycle-policy.test.ts:139` `expect(result).toMatchObject({ ok: false, error: { code: "INVESTMENT_ACCOUNT_IN_USE" } })`; `:159` same exact error for non-zero balance; `:178` `expect(result).toMatchObject({ ok: true, value: { id: "account-5", status: "ARCHIVED", version: 1 } })` | archive rejects an OPEN position or non-zero balance, but accepts CLOSED/zero | Yes |
| INV-115 | `investment-account-lifecycle-policy.test.ts:209` `expect(result).toMatchObject({ ok: false, error: { code: "FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED" } })`; `:213` `expect(harness.store.snapshot()).toEqual(before)` | an active investment account's settlement cannot be archived; rejected command does not mutate state | Yes |
| INV-116 | `investment-account-lifecycle-policy.test.ts:258` `expect(result).toMatchObject({ ok: true, value: { id: "account-5", status: "ACTIVE", version: 2 } })`; `:266` `expect(...financialAccount).toEqual({ type: "INVESTMENT_ACCOUNT", investment: { defaultSettlementAccountId: "account-6" } })` | reactivation preserves identity and profile after transactional link validation | Yes |
| INV-12, INV-116 | `:299`, `:336`, `:364`, `:391`, `:418` each `expect(result).toMatchObject({ ok: false, error: { code: "INVALID_SETTLEMENT_ACCOUNT" } })`; paired `:303`, `:340`, `:368`, `:395`, `:422` snapshot equality | reactivation revalidates inactive, foreign-book, wrong-type, missing and self settlement links without mutation | Yes |
| INV-74 | `archive-ledger-account.test.ts:199` `expect(result).toMatchObject({ ok: false, error: { code: "BOOK_MISMATCH" } })`; `reactivate-ledger-account.test.ts:205` same exact assertion | archive/reactivate reject a requested account from another book | Yes |
| existing lifecycle compatibility | `investment-account-lifecycle-policy.test.ts:230` `expect(result).toMatchObject({ ok: true, value: { status: "ARCHIVED", version: 1 } })`; `:446` `expect(result).toMatchObject({ ok: true, value: { kind: "EXPENSE", status: "ARCHIVED", version: 1 } })` | already archived accounts remain idempotent and non-investment accounts retain the existing lifecycle path | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `investment-account-lifecycle-policy.test.ts:110-123`, `:178-180` resulting account/profile assertions | INV-113, INV-116 archive identity and permitted CLOSED/zero transition | Yes |
| `:139-143`, `:159-163`, `:209-213` exact errors and full snapshots | INV-113, INV-115 in-use/dependent settlement rejection with no write | Yes |
| `:258-270`, `:299-422` activation and every settlement validation error/snapshot | INV-12, INV-116 revalidate active, same-book BANK/PAYMENT linkage transactionally | Yes |
| `archive-ledger-account.test.ts:199-203`, `reactivate-ledger-account.test.ts:205-209` exact book errors and snapshots | INV-74 book isolation for both commands | Yes |
| `investment-account-lifecycle-policy.test.ts:230-234`, `:446-448` no-op and generic account lifecycle results | existing archive/reactivate behavior retained while applying the shared policy | Yes |

**Adequacy verdict**: PASS. Thirteen Memory command scenarios assert resulting account/profile state, exact stable errors and rollback snapshots, never mock calls. They cover each lifecycle branch required by T43 and retain the existing Memory command-test convention.

### Phase 8: Catálogos e execução idempotente

### T44: Criar instrumento

**What**: Entregar criar instrumento conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/instruments/create-investment-instrument.ts`
**Depends on**: T43
**Reuses**: Instrument T6 e executor T16.
**Requirement**: INV-14, INV-15, INV-16, INV-17, INV-18, INV-74, INV-81, INV-83, INV-89
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Validar livro/moeda e identificadores, criar aggregate ativo/fact e confirmar unicidade na transação; falha não deixa filhas órfãs.
- [x] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): criar instrumento`

**Execution evidence**: baseline Memory: 35 files, 340 tests, pass; T44: 36 files, 351 tests, pass. `create-investment-instrument.test.ts` adds 11 spec-derived command scenarios. Full Memory passed: domain/application build, Memory 351/351, Memory typecheck.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-14 active creation | `packages/infrastructure-memory/src/use-cases/create-investment-instrument.test.ts:27` `expect(result).toEqual({ ... status: "ACTIVE", version: 0 })` | active instrument persists name, type, base currency with optional issuer and no identifiers | Yes |
| INV-15 normative class | `packages/infrastructure-memory/src/use-cases/create-investment-instrument.test.ts:34` `instrumentClass: "FIXED_INCOME"` | CDB derives class exclusively from the normative type table | Yes |
| INV-16 book currency | `packages/infrastructure-memory/src/use-cases/create-investment-instrument.test.ts:169` `expect(result).toMatchObject({ error: { code: "INVESTMENT_CURRENCY_MISMATCH" } })` | mismatched currency is rejected before writing | Yes |
| INV-17 identifier normalization | `packages/infrastructure-memory/src/use-cases/create-investment-instrument.test.ts:57` `identifiers: [{ scheme: "TICKER", value: "CDBX", market: "B3" }]` and `:82` `value: "BRABCD123456"` | ticker/ISIN and market trim-uppercase; registration preserves internal content | Yes |
| INV-18 identifier uniqueness | `packages/infrastructure-memory/src/use-cases/create-investment-instrument.test.ts:209` `expect(result).toMatchObject({ error: { code: "DUPLICATE_INSTRUMENT_IDENTIFIER" } })` | equivalent identifier in same book is rejected without a new aggregate | Yes |
| INV-74/81 book-scoped fact | `packages/infrastructure-memory/src/use-cases/create-investment-instrument.test.ts:97` `expect(harness.publisher.events).toEqual([... bookId: "book-1" ...])` | committed fact carries supported type, book ID, aggregate ID and version | Yes |
| INV-75 rollback | `packages/infrastructure-memory/src/use-cases/create-investment-instrument.test.ts:213` `expect(harness.store.snapshot()).toEqual(before)` | duplicate failure leaves no persisted aggregate or children | Yes |
| INV-83 input validation | `packages/infrastructure-memory/src/use-cases/create-investment-instrument.test.ts:186` `expect(result).toMatchObject({ error: { code: "INVALID_INVESTMENT_INPUT" } })` | malformed identifier is rejected before writing | Yes |
| INV-89 provider-free command | `packages/application/src/investments/instruments/create-investment-instrument.ts:58` `InvestmentInstrument.create({ ... })` | command uses only local domain IDs/types, no provider dependency | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `create-investment-instrument.test.ts:27` `expect(result).toEqual({ ... })` | INV-14, INV-15 creation outcome | Yes |
| `create-investment-instrument.test.ts:53` `expect(result).toMatchObject({ ... })` | INV-14/17 optional issuer and ticker normalization | Yes |
| `create-investment-instrument.test.ts:78` `expect(result).toMatchObject({ ... })` | INV-17 ISIN/registration normalization | Yes |
| `create-investment-instrument.test.ts:97` `expect(harness.publisher.events).toEqual([...])` | INV-81 fact payload | Yes |
| `create-investment-instrument.test.ts:118` `expect(result).toMatchObject({ error: { code: "ENTITY_NOT_FOUND" } })` | INV-74 missing-book rejection | Yes |
| `create-investment-instrument.test.ts:135` `expect(result).toMatchObject({ error: { code: "INVALID_INVESTMENT_INPUT" } })` | INV-83 invalid type | Yes |
| `create-investment-instrument.test.ts:152` `expect(result).toMatchObject({ error: { code: "INVALID_INVESTMENT_INPUT" } })` | INV-17/83 invalid scheme | Yes |
| `create-investment-instrument.test.ts:169` `expect(result).toMatchObject({ error: { code: "INVESTMENT_CURRENCY_MISMATCH" } })` | INV-16 | Yes |
| `create-investment-instrument.test.ts:186` `expect(result).toMatchObject({ error: { code: "INVALID_INVESTMENT_INPUT" } })` | INV-17/83 malformed identifier | Yes |
| `create-investment-instrument.test.ts:209` `expect(result).toMatchObject({ error: { code: "DUPLICATE_INSTRUMENT_IDENTIFIER" } })` | INV-18 existing-book duplicate | Yes |
| `create-investment-instrument.test.ts:230` `expect(result).toMatchObject({ error: { code: "DUPLICATE_INSTRUMENT_IDENTIFIER" } })` | INV-18 same-command duplicate | Yes |

**Adequacy verdict**: PASS. Eleven Memory command scenarios assert persisted/resulting state, exact stable errors, fact identity and rollback snapshots. They cover the applicable T44 outcomes without mock-call-only or extra behavior tests.

### T45: Atualizar instrumento

**What**: Entregar atualizar instrumento conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/instruments/update-investment-instrument.ts`
**Depends on**: T44
**Reuses**: Instrument repository e hasAnyForInstrument.
**Requirement**: INV-16, INV-17, INV-18, INV-26, INV-74, INV-76, INV-81, INV-83
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Editar metadata com CAS/no-op; impedir tipo/moeda após qualquer posição histórica e preservar dados econômicos anteriores.
- [x] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): atualizar instrumento`

**Execution evidence**: baseline Memory: 36 files, 351 tests, pass; T45: 37 files, 361 tests, pass. `update-investment-instrument.test.ts` adds 10 spec-derived command scenarios. Full Memory passed: domain/application build, Memory 361/361, Memory typecheck.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-16 currency | `packages/infrastructure-memory/src/use-cases/update-investment-instrument.test.ts:171` `expect(result).toMatchObject({ error: { code: "INVESTMENT_CURRENCY_MISMATCH" } })` | a currency distinct from the book base currency is rejected without changing the instrument | Yes |
| INV-17/18 metadata identifiers | `packages/infrastructure-memory/src/use-cases/update-investment-instrument.test.ts:78` `identifiers: [{ scheme: "TICKER", value: "CDBN", market: "B3" }]` and `:253` `expect(result).toMatchObject({ error: { code: "DUPLICATE_INSTRUMENT_IDENTIFIER" } })` | normalized metadata persists; equivalent identifier cannot duplicate another instrument in book | Yes |
| INV-26 immutable economics | `packages/infrastructure-memory/src/use-cases/update-investment-instrument.test.ts:136` `expect(result).toMatchObject({ error: { code: "INVESTMENT_INSTRUMENT_TYPE_IMMUTABLE" } })` and `:155` `expect(...getInvestmentPosition(...)).toEqual(beforePosition)` | type is immutable after first position and metadata does not alter prior economic state | Yes |
| INV-74 book isolation | `packages/infrastructure-memory/src/use-cases/update-investment-instrument.test.ts:230` `expect(result).toMatchObject({ error: { code: "BOOK_MISMATCH" } })` | cross-book reference is rejected without writing | Yes |
| INV-76 CAS/no-op | `packages/infrastructure-memory/src/use-cases/update-investment-instrument.test.ts:104` `expect(result).toMatchObject({ ok: true, value: { version: 0 } })` and `:189` `expect(result).toMatchObject({ error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" } })` | no-op keeps version; stale expectedVersion cannot overwrite | Yes |
| INV-81 fact | `packages/infrastructure-memory/src/use-cases/update-investment-instrument.test.ts:82` `expect(harness.publisher.events).toEqual([{ ... aggregateVersion: 1 }])` | committed update publishes supported versioned fact | Yes |
| INV-83 input validation | `packages/application/src/investments/instruments/update-investment-instrument.ts:52` `if (!isInstrumentType(command.type) || !isIdentifierList(command))` | invalid type/scheme is rejected before write | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `update-investment-instrument.test.ts:70` `expect(result).toMatchObject({ ... version: 1 })` | metadata update/CAS | Yes |
| `update-investment-instrument.test.ts:104` `expect(result).toMatchObject({ ok: true, value: { version: 0 } })` | no-op | Yes |
| `update-investment-instrument.test.ts:118` `expect(result).toMatchObject({ type: "STOCK", instrumentClass: "EQUITY" })` | type before history | Yes |
| `update-investment-instrument.test.ts:136` `expect(result).toMatchObject({ error: { code: "INVESTMENT_INSTRUMENT_TYPE_IMMUTABLE" } })` | INV-26 immutable type | Yes |
| `update-investment-instrument.test.ts:155` `expect(...getInvestmentPosition(...)).toEqual(beforePosition)` | preserve economic history | Yes |
| `update-investment-instrument.test.ts:171` `expect(result).toMatchObject({ error: { code: "INVESTMENT_CURRENCY_MISMATCH" } })` | INV-16 currency | Yes |
| `update-investment-instrument.test.ts:189` `expect(result).toMatchObject({ error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" } })` | INV-76 | Yes |
| `update-investment-instrument.test.ts:203` `expect(result).toMatchObject({ error: { code: "ENTITY_NOT_FOUND" } })` | missing instrument | Yes |
| `update-investment-instrument.test.ts:230` `expect(result).toMatchObject({ error: { code: "BOOK_MISMATCH" } })` | INV-74 | Yes |
| `update-investment-instrument.test.ts:253` `expect(result).toMatchObject({ error: { code: "DUPLICATE_INSTRUMENT_IDENTIFIER" } })` | INV-18 | Yes |

**Adequacy verdict**: PASS. Ten Memory command scenarios assert resulting DTOs, events, stable errors and full rollback snapshots. The tests cover each T45 branch and do not rely on mock-call counts.

### T46: Lifecycle de instrumento

**What**: Entregar lifecycle de instrumento conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/instruments/set-investment-instrument-status.ts`
**Depends on**: T45
**Reuses**: Lifecycle do Instrument e repository de posições.
**Requirement**: INV-74, INV-76, INV-81, INV-114, INV-116, INV-117, INV-144
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Oferecer archive/reactivate sobre uma transição de status; rejeitar archive com OPEN, preservar identidade e não expor hard delete.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): lifecycle de instrumento`

**Execution evidence**: baseline Memory: 37 files, 361 tests, pass; T46: 38 files, 369 tests, pass. `set-investment-instrument-status.test.ts` adds 8 spec-derived command scenarios. Full Memory passed: domain/application build, Memory 369/369, Memory typecheck.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- |
| archive/reactivate, INV-116 | `packages/infrastructure-memory/src/use-cases/set-investment-instrument-status.test.ts:59` `expect(result).toMatchObject({ value: { id: "instrument-1", status: "ARCHIVED", version: 1 } })` and `:83` `expect(result).toMatchObject({ value: { id: "instrument-1", status: "ACTIVE", version: 2 } })` | lifecycle preserves identity and reactivation restores active state | Yes |
| INV-114 open guard | `set-investment-instrument-status.test.ts:101` `expect(result).toMatchObject({ error: { code: "INVESTMENT_INSTRUMENT_IN_USE" } })` | archive with OPEN position is rejected | Yes |
| closed history | `set-investment-instrument-status.test.ts:112` `expect(await setStatus(h).execute(archive)).toMatchObject({ value: { status: "ARCHIVED" } })` | closed position does not block archive | Yes |
| INV-74/76 | `set-investment-instrument-status.test.ts:163` `expect(result).toMatchObject({ error: { code: "BOOK_MISMATCH" } })` and `:142` `expect(result).toMatchObject({ error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" } })` | book mismatch and stale version write nothing | Yes |
| INV-81 | `set-investment-instrument-status.test.ts:63` `expect(h.publisher.events).toEqual([{ ... aggregateVersion: 1 }])` | transition publishes a supported fact after commit | Yes |
| INV-117 | `packages/application/src/index.ts:7` `export { SetInvestmentInstrumentStatus } ...` | public instrument lifecycle surface exposes transition only; no hard-delete command is added | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `set-investment-instrument-status.test.ts:59` `expect(result).toMatchObject({ ... status: "ARCHIVED" })` | archive | Yes |
| `set-investment-instrument-status.test.ts:83` `expect(result).toMatchObject({ ... status: "ACTIVE" })` | reactivation/INV-116 | Yes |
| `set-investment-instrument-status.test.ts:101` `expect(result).toMatchObject({ error: { code: "INVESTMENT_INSTRUMENT_IN_USE" } })` | INV-114 | Yes |
| `set-investment-instrument-status.test.ts:112` `expect(await ...).toMatchObject({ status: "ARCHIVED" })` | closed position branch | Yes |
| `set-investment-instrument-status.test.ts:127` `expect(result).toMatchObject({ version: 1 })` | archive no-op | Yes |
| `set-investment-instrument-status.test.ts:142` `expect(result).toMatchObject({ error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" } })` | INV-76 | Yes |
| `set-investment-instrument-status.test.ts:163` `expect(result).toMatchObject({ error: { code: "BOOK_MISMATCH" } })` | INV-74 | Yes |
| `set-investment-instrument-status.test.ts:174` `expect(result).toMatchObject({ error: { code: "ENTITY_NOT_FOUND" } })` | missing entity | Yes |

**Adequacy verdict**: PASS. Eight Memory command scenarios assert lifecycle DTOs, facts, stable errors and rollback snapshots. They cover the T46 transition branches without mock-call-only assertions.

### T47: Metadata da posição

**What**: Entregar metadata da posição conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/positions/update-investment-position-metadata.ts`
**Depends on**: T46
**Reuses**: Position.updateLabel e CAS.
**Requirement**: INV-20, INV-26, INV-74, INV-76, INV-83, INV-127, INV-129
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Editar só rótulo, incluindo no-op e erro de versão; manter quantidade/custo/termos/revisão/datas econômicas e histórico.
- [x] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): metadata da posição`

**Execution evidence**: baseline Memory 38 files/369 tests; T47 39 files/377 tests. Full Memory passed: domain/application build, Memory 377/377, Memory typecheck.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-20/26 label-only | `update-investment-position-metadata.test.ts:46` `expect(result).toEqual({ ... label: "Travel", version: 1 })`; `:76` `expect({...after,...}).toEqual(before)` | only label changes; economic snapshot remains intact | Yes |
| INV-76 no-op/CAS | `update-investment-position-metadata.test.ts:106` `expect(result).toMatchObject({ value: { version: 0 } })`; `:118` `expect(result).toMatchObject({ error: { code: "OPTIMISTIC_CONCURRENCY_FAILURE" } })` | no-op retains version; stale write fails | Yes |
| INV-74/83 | `update-investment-position-metadata.test.ts:150` `expect(result).toMatchObject({ error: { code: "BOOK_MISMATCH" } })`; `:165` `expect(result).toMatchObject({ error: { code: "INVALID_INVESTMENT_INPUT" } })` | cross-book and over-limit input write nothing | Yes |

**Adequacy verdict**: PASS. Eight command scenarios assert DTO/state, facts, errors and rollback snapshots; no mock-only assertions.

### T48: Execução idempotente de investimento

**What**: Entregar execução idempotente de investimento conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/shared/execute-investment-request.ts`
**Depends on**: T47
**Reuses**: executeUseCase T16, receipt/sequence stores e Clock.
**Requirement**: INV-74, INV-75, INV-76, INV-77, INV-78, INV-79, INV-80, INV-81, INV-84, INV-90, INV-145
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Canonicalizar payload/versões, buscar recibo antes de CAS/status/data, salvar resultado com facts numa transação e preservar request em erro indeterminado; expor recuperação read-only e testar retry após correção posterior.
- [x] Escrever/atualizar no mesmo commit pelo menos 16 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): execução idempotente de investimento`

**Execution evidence**: baseline Memory 39 files/377 tests; T48 40 files/393 tests. `execute-investment-request.test.ts` adds 16 spec-derived scenarios. Full Memory passed: domain/application build, Memory 393/393, Memory typecheck.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-78 retry | `execute-investment-request.test.ts:42` `expect(await execute(h)).toEqual({ ok: true, value: result() })` | equivalent retry returns saved result | Yes |
| INV-79 conflict | `execute-investment-request.test.ts:49` `expect(...).toMatchObject({ error: { code: "IDEMPOTENCY_CONFLICT" } })` | differing payload under same request ID fails | Yes |
| INV-74 read recovery | `execute-investment-request.test.ts:29` `expect(await getInvestmentRequestResult(...)).toMatchObject(...)` | receipt remains book-scoped and recoverable | Yes |

**Adequacy verdict**: PASS. Sixteen tests assert canonical values, receipt state, retry results and stable conflicts; no mock-only assertions.

### T49: Saldo inicial explícito idempotente

**What**: Entregar saldo inicial explícito idempotente conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/accounts/set-investment-opening-balance.ts`
**Depends on**: T48
**Reuses**: SetOpeningBalance e executor idempotente T48.
**Requirement**: INV-78, INV-120, INV-121, INV-122, INV-123, INV-124, INV-137, INV-145, INV-147
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Reutilizar trabalho transacional de SetOpeningBalance sem execute aninhado; reconhecer custo+caixa real, não valuation, preservar OPENING_BALANCE_ALREADY_SET e saldo confirmado após falha de alocação.
- [x] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory + Build
**Commit**: `feat(investments): saldo inicial explícito idempotente`

**Execution evidence**: before T49 Memory: 40 files/393 tests; after: 41 files/408 tests. `set-investment-opening-balance.test.ts` adds 15 integration scenarios. `validate_tasks.py` passed with 0 errors/0 warnings. Full Memory + Build passed: Domain 20 files/404 tests, Application 21 files/241 tests, Memory 41 files/408 tests; lint, check-types and build passed for Domain, Application and Memory; `git diff --check` passed.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-78 idempotent retry | `set-investment-opening-balance.test.ts:70` `expect(await useCase(h).execute(command)).toEqual({ ok: true, value: { requestId: "request-1", journalEntryIds: ["entry-1"], warnings: [] } })`; `:78` `expect(h.store.listJournalEntries()).toHaveLength(1)` | retry equivalente retorna o resultado salvo sem novo efeito | Yes |
| INV-120/INV-121 origem ausente é um passo explícito, sem alocação ou transferência implícita | `set-investment-opening-balance.test.ts:169` `expect(h.store.listInvestmentPositions()).toEqual([])`; `:170` `expect(h.store.listInvestmentOperations()).toEqual([])`; `:172` `expect(h.store.listJournalEntries()).toHaveLength(1)` | o saldo inicial é separado da alocação; não cria fallback implícito | Yes, slice T49 |
| INV-122 custo conhecido mais caixa real, sem valuation | `set-investment-opening-balance.test.ts:52` `expect(h.store.listJournalEntries()[0]?.postings).toEqual([... amountMinor: 10500n ...])` | o lançamento reconhece o valor explícito de custo+caixa real, sem valuation | Yes, slice T49 |
| INV-123 custo não conhecido não usa valuation como custo | `packages/application/src/ports/investment-commands.ts:36-42` expõe somente `amountMinor`, sem campo de valuation; `set-investment-opening-balance.test.ts:164` `expect(h.store.listInvestmentValuations()).toEqual([])` | não há rota de valuation neste comando; rejeição de abertura sem custo é de T50 | Yes, boundary T49 |
| INV-124 saldo inicial já ativo | `set-investment-opening-balance.test.ts:92` `expect(...).toMatchObject({ ok: false, error: { code: "OPENING_BALANCE_ALREADY_SET" } })`; `:96` `expect(h.store.listJournalEntries()).toEqual([...])` | preservar o código e o saldo existente | Yes |
| INV-137 confirmação permanece após falha posterior | `set-investment-opening-balance.test.ts:184` `expect(h.store.listJournalEntries()).toEqual([expect.objectContaining(...)])`; `:195` `expect(h.store.getInvestmentRequest(...)).toBeUndefined()` | saldo confirmado continua como caixa não alocado e a falha não registra recibo | Yes, boundary before T50 allocation |
| INV-145/INV-147 recuperação não cria aviso/efeito histórico adicional | `set-investment-opening-balance.test.ts:44` `expect(result).toEqual({ ok: true, value: { ..., warnings: [] } })`; `:171` `expect(h.store.listInvestmentValuations()).toEqual([])` | saldo explícito não duplica operação, avaliação ou aviso; cálculo/remoção de aviso é T60 | Yes, boundary T49 |
| atomicidade de falha | `set-investment-opening-balance.test.ts:109` `expect(...).toMatchObject({ ok: false, error: { code: "ENTITY_NOT_FOUND" } })`; `:113` `expect(h.store.listJournalEntries()).toEqual([])` | falha antes do commit não cria journal nem recibo | Yes |

| Test assertion | Maps to | Keep? |
| --- | --- | --- |
| `set-investment-opening-balance.test.ts:44` `expect(result).toEqual(...)` | INV-122, INV-145 | Yes |
| `:70` `expect(await useCase(h).execute(command)).toEqual(...)` and `:78` `expect(...).toHaveLength(1)` | INV-78 | Yes |
| `:85` `expect(...).toMatchObject({ error: { code: "IDEMPOTENCY_CONFLICT" } })` | INV-78 conflict edge | Yes |
| `:92` `expect(...).toMatchObject({ error: { code: "OPENING_BALANCE_ALREADY_SET" } })` | INV-124 | Yes |
| `:109`, `:132`, `:208` failure-code assertions and receipt/journal assertions | INV-137 and command atomicity | Yes |
| `:169-172` empty allocation/valuation assertions | INV-120, INV-121, INV-123, INV-147 boundary | Yes |
| `:184-197` confirmed-entry and absent-receipt assertions | INV-137 | Yes |

**Adequacy verdict**: PASS. The 15 spec-scoped integration scenarios assert receipt, posting amount, persisted state and stable errors, not mock calls. T50 owns rejection of an opening position without book cost; T60 owns the calculated negative-cash warning transition.

### Phase 9: Abertura e operações

### T50: Abrir posição

**What**: Entregar abrir posição conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/positions/open-investment-position.ts`
**Depends on**: T49
**Reuses**: Position, Operation, planner e executor T48.
**Requirement**: INV-19, INV-20, INV-21, INV-27, INV-28, INV-29, INV-30, INV-32, INV-33, INV-34, INV-75, INV-78, INV-120, INV-121, INV-123, INV-127, INV-137, INV-145
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Criar Position e primeira OPENING_ALLOCATION ou compra em unidade atômica; distinguir origens, não inventar saldo/quantidade/custo, permitir caixa negativo com warning e não repetir saldo inicial separado.
- [x] Escrever/atualizar no mesmo commit pelo menos 18 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): abrir posição`

**Execution evidence**: baseline Memory: 42 files, 408 tests; T50: 43 files, 426 tests. Full Memory passed: Domain/Application builds, Memory 426/426 tests and Memory typecheck.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-19, INV-20, INV-27, INV-33, INV-127 | `packages/infrastructure-memory/src/use-cases/open-investment-position.test.ts:52-82` `expect(...).toEqual({ ..., positionId: "position-1", allocationRevision: 1, operationId: "operation-1", journalEntryIds: [] })`; `:72-82` operation `OPENING_ALLOCATION`/no journal | Opening atomically records the position and its first allocation, starting revision 1, without a ledger entry. | Yes |
| INV-28, INV-32, INV-145 | `open-investment-position.test.ts:61-69` `warnings: [{ code: "INVESTMENT_CASH_NEGATIVE", cashMinor: "-1000"... }]`; `:101-108` `expect(...warnings).toMatchObject([])` | Negative cash confirms with the calculated warning; sufficient explicit balance leaves no warning. | Yes |
| INV-21, INV-120, INV-121, INV-123 | `open-investment-position.test.ts:130-142` `expect(...code).toMatchObject({ code: "INVESTMENT_BOOK_COST_REQUIRED" })`; `:145-189` exact invalid value/quantity assertions; `:155-169` unit position with zero cost remains OPEN | Cost is mandatory when unknown; quantity/cost are never invented; a unit holding can retain zero known cost. | Yes |
| INV-75, INV-78, INV-137 | `open-investment-position.test.ts:111-127` `expect(...positionId: "position-1", operationId: "operation-1")`, `toHaveLength(1)`, and `IDEMPOTENCY_CONFLICT`; `:274-279` absent failed receipt; `:304-324` `toHaveLength(1)` journal | Retry has no duplicate effect; invalid work rolls back; a separately confirmed opening balance is not repeated. | Yes |
| INV-34, INV-74 | `open-investment-position.test.ts:192-247` exact `ENTITY_NOT_FOUND` and `BOOK_MISMATCH` error assertions | Missing/cross-book references cannot create an implicit source or write state. | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `open-investment-position.test.ts:52-82` exact result, `OPENING_ALLOCATION`, and `journalEntries=[]` assertions | INV-19, INV-27, INV-33 | Yes |
| `:101-108`, `:282-301` warning/no-warning and ledger-length assertions | INV-28, INV-32, INV-120, INV-145 | Yes |
| `:114-127`, `:274-279`, `:304-324` replay/conflict/rollback/separate-balance assertions | INV-75, INV-78, INV-137 | Yes |
| `:130-189` required cost and quantity-mode assertions | INV-21, INV-121, INV-123 | Yes |
| `:192-271` missing/cross-book/date/revision/label assertions | INV-19, INV-20, INV-74, INV-127 | Yes |

**Adequacy verdict**: PASS. The 18 command scenarios assert persisted operation/position state, exact warnings and stable errors rather than calls; every scenario maps to T50 requirements and follows the Memory integration location in the Test Coverage Matrix.

### T51: Registrar compra ou aplicação

**What**: Entregar registrar compra ou aplicação conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/operations/record-investment-purchase.ts`
**Depends on**: T50
**Reuses**: Executor T48 e matriz T11.
**Requirement**: INV-29, INV-30, INV-32, INV-34, INV-35, INV-36, INV-44, INV-45, INV-74, INV-75, INV-76, INV-77, INV-78, INV-118, INV-125, INV-126, INV-128, INV-145
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Registrar PURCHASE/APPLICATION com rota interna/externa explícita, datas/quantidade/custo/CAS; mesmo planner para ambas, journal só quando necessário e despesa não capitalizada.
- [x] Escrever/atualizar no mesmo commit pelo menos 16 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): registrar compra ou aplicação`

**Execution evidence**: baseline Memory: 43 files, 426 tests; T51: 44 files, 442 tests. Full Memory passed: Domain/Application builds, Memory 442/442 tests and Memory typecheck.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-29, INV-35, INV-45, INV-128 | `packages/infrastructure-memory/src/use-cases/record-investment-purchase.test.ts:89-103` `expect(...positionVersion: 1, allocationRevision: 2, journalEntryIds: [])` and `expect(...quantity: "12", bookCostMinor: "1200")` | Internal purchase changes only explicit units/cost, advances allocation revision once, and creates no zero-effect journal. | Yes |
| INV-30, INV-44, INV-125, INV-126 | `record-investment-purchase.test.ts:118-133` `journalEntryIds: ["entry-1"]`, `bookCostMinor: "1200"`, and postings `-215n/+200n/+10n/+5n` | External application creates one combined journal and never capitalizes fee/tax into cost. | Yes |
| INV-32, INV-76, INV-77, INV-78, INV-145 | `record-investment-purchase.test.ts:144-168` exact stale-CAS, replay length, and conflict assertions; `:214-226` warning `cashMinor: "-1200"` | Stale writes fail, matching retries do not duplicate, and negative cash remains a warning. | Yes |
| INV-34, INV-36, INV-74, INV-118 | `record-investment-purchase.test.ts:135-142`, `:170-180`, `:228-250` exact route/entity/quantity/error assertions | Funding is explicit; invalid reference, amount, or units cannot persist a purchase. | Yes |

| Test assertion | Maps to | Keep |
| --- | --- | --- |
| `record-investment-purchase.test.ts:89-103` state and no-journal assertions | INV-29, INV-35, INV-45, INV-128 | Yes |
| `:118-133` exact combined postings and non-capitalized cost | INV-30, INV-44, INV-125, INV-126 | Yes |
| `:144-250` error, CAS, retry, warning and date assertions | INV-32, INV-34, INV-36, INV-74, INV-76, INV-77, INV-78, INV-118, INV-145 | Yes |
| `:252-264` persisted before-state/deltas assertion | operation audit snapshot | Yes |

**Adequacy verdict**: PASS. Sixteen Memory command scenarios assert operation, position, journal postings, warnings and stable failures; no scenario relies on mock calls or exceeds the T51 contract.

### T52: Registrar venda ou resgate

**What**: Entregar registrar venda ou resgate conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/operations/record-investment-sale.ts`
**Depends on**: T51
**Reuses**: Position e planner; fixtures de venda da spec.
**Requirement**: INV-35, INV-36, INV-37, INV-38, INV-39, INV-40, INV-41, INV-44, INV-45, INV-46, INV-51, INV-53, INV-74, INV-75, INV-76, INV-78, INV-126, INV-128, INV-139
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [x] Registrar SALE/REDEMPTION com custo retirado explícito, ganho/perda e despesas, destinos interno/externo; fechar total, preservar zero custo com unidades e rejeitar redução inválida sem escolher FIFO/média.
- [x] Escrever/atualizar no mesmo commit pelo menos 20 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [x] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): registrar venda ou resgate`

**Execution evidence**: baseline Memory: 43 files, 442 tests; T52: 44 files, 467 tests. Full Memory passed: Domain/Application builds, Memory 467/467 tests and Memory typecheck.

| Done-when / requirement | Evidence | Spec-defined outcome | Covered |
| --- | --- | --- | --- |
| INV-35, INV-37, INV-39, INV-44, INV-126 | `packages/infrastructure-memory/src/use-cases/record-investment-sale.test.ts:149` `expect(...).toMatchObject({ quantity: "6", bookCostMinor: "600", status: "OPEN" })`; `:180` `expect(...postings).toEqual(...)`; `:188` `expect(...).toMatchObject({ feesMinor: "20", taxesMinor: "30", netCashFlowMinor: "450" })` | A partial exit uses the supplied cost/quantity and separates gross gain from fee/tax. | Yes |
| INV-38, INV-40, INV-53 | `record-investment-sale.test.ts:230` `expect(...postings).toEqual(...)`; `:241` `expect(...).toMatchObject({ quantity: "0", bookCostMinor: "0", status: "CLOSED", closedOn: "2026-08-04" })`; `:270` amount-mode close assertion | Direct redemption creates one combined external journal and a zero-cost final state closes on occurredOn. | Yes |
| INV-35, INV-36, INV-39, INV-40, INV-41 | `record-investment-sale.test.ts:285` `expect(...).toMatchObject({ quantity: "6", bookCostMinor: "0", status: "OPEN" })`; `:301`, `:312`, `:323`, `:334` exact `INVALID_INVESTMENT_OPERATION` assertions | Zero known cost retains units; omitted, excessive, or incoherent reductions cannot derive FIFO/average cost or persist state. | Yes |
| INV-45, INV-139 | `record-investment-sale.test.ts:252` `expect(...).toMatchObject({ ok: true, value: { journalEntryIds: [] } })`; `:259` `expect(...).toEqual([])` | An internal exit at cost without expenses creates no JournalEntry; full explicit cost/quantity closes. UI prefill is T80. | Yes |
| INV-74, INV-75, INV-76, INV-78 | `record-investment-sale.test.ts:422` exact negative-net failure; `:434` unchanged position; `:443` exact stale-CAS error; `:460`, `:464`, `:465` replay result and one effect; `:506` `BOOK_MISMATCH` | Invalid work leaves state unchanged, stale/cross-book writes fail, and matching retries retain original effects. | Yes |
| INV-51, INV-128 | `record-investment-sale.test.ts:139` `expect(...value).toMatchObject({ allocationRevision: 2 })`; `:479` `expect(...operation).toMatchObject({ positionBefore: ..., bookCostDeltaMinor: "-400" })` | An economic reduction advances allocation revision once and records its prior allocation state. Valuation read fallback is T62. | Yes |

| Test assertion | Maps to | Keep? |
| --- | --- | --- |
| `record-investment-sale.test.ts:149`, `:154`, `:180` partial state and posting assertions | INV-35, INV-37, INV-39, INV-44, INV-126 | Yes |
| `:230`, `:241`, `:252` direct redemption, closed state, no-journal assertions | INV-38, INV-40, INV-45, INV-53, INV-139 | Yes |
| `:285`, `:301/:312/:323/:334`, `:422/:434` zero-cost and invalid-reduction state/errors | INV-35, INV-36, INV-41, INV-75 | Yes |
| `:443`, `:460/:464/:465`, `:506`, `:479` CAS, retry, book isolation, audit snapshot | INV-74, INV-76, INV-78, INV-128 | Yes |

**Adequacy verdict**: PASS. Twenty-five Memory command scenarios assert position state, complete posting values, close dates, error codes, receipt replay, and audit snapshots. No test relies on mock calls or introduces an implicit FIFO/average-cost policy. INV-46 is AMORTIZATION behavior owned by T54, not a SALE/REDEMPTION behavior.

### T53: Registrar rendimento

**What**: Entregar registrar rendimento conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/operations/record-investment-income.ts`
**Depends on**: T52
**Reuses**: Planner e executor idempotente.
**Requirement**: INV-42, INV-44, INV-74, INV-75, INV-76, INV-78, INV-119, INV-126, INV-129
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] R=100,f=2,t=10 produz I=88 e receita100/despesas12 numa operação; posição CLOSED ativa aceita fluxo sem reabrir/alocar nem criar FEE/TAX extra.
- [ ] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): registrar rendimento`

### T54: Registrar amortização

**What**: Entregar registrar amortização conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/operations/record-investment-amortization.ts`
**Depends on**: T53
**Reuses**: Planner e transições da Position.
**Requirement**: INV-35, INV-42, INV-44, INV-46, INV-74, INV-75, INV-76, INV-78, INV-126, INV-128
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Reduzir custo sem alterar unidades, separar recebimento/principal/resultado/despesas; C1000 reduz200 recebe220 resulta custo800 e receita20.
- [ ] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): registrar amortização`

### T55: Registrar taxa ou imposto independente

**What**: Entregar registrar taxa ou imposto independente conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/operations/record-investment-expense.ts`
**Depends on**: T54
**Reuses**: RecordExpense como padrão e planner de investimento.
**Requirement**: INV-32, INV-43, INV-44, INV-74, INV-75, INV-76, INV-78, INV-119, INV-126, INV-129, INV-145
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Comando discriminado FEE/TAX registra despesa posterior apenas uma vez em caixa interno; aceita CLOSED com vínculos ativos sem mudar revisão e retorna aviso se caixa negativo.
- [ ] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full Memory + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory + Build
**Commit**: `feat(investments): registrar taxa ou imposto independente`

### Phase 10: Correções, avaliações e proteção contábil

### T56: Cancelar operação

**What**: Entregar cancelar operação conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/operations/reverse-investment-operation.ts`
**Depends on**: T55
**Reuses**: Operation, Position.applyCorrection e JournalEntry.createReversal.
**Requirement**: INV-61, INV-62, INV-63, INV-64, INV-65, INV-66, INV-67, INV-69, INV-70, INV-71, INV-72, INV-73, INV-74, INV-75, INV-76, INV-78, INV-128, INV-132, INV-133, INV-134, INV-144, INV-145
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Cancelar somente última efetiva; inverter deltas/postings persistidos e datar reversão no original; aplicar estado final uma vez, avançar revisão quando muda e bloquear reabertura sob cadastro arquivado.
- [ ] Escrever/atualizar no mesmo commit pelo menos 20 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): cancelar operação`

### T57: Substituir operação

**What**: Entregar substituir operação conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/operations/amend-investment-operation.ts`
**Depends on**: T56
**Reuses**: Cancelamento T56 e planner para fato novo, sem recalcular o antigo.
**Requirement**: INV-61, INV-63, INV-64, INV-65, INV-66, INV-67, INV-68, INV-69, INV-70, INV-72, INV-73, INV-74, INV-75, INV-76, INV-78, INV-128, INV-129, INV-132, INV-133, INV-134, INV-135, INV-136, INV-144, INV-145
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Amendment mantém tipo/posição/conta, valida data entre anterior e hoje e uma única versão/revisão final; cobrir quatro combinações de journal e rollback após cada escrita sem links órfãos.
- [ ] Escrever/atualizar no mesmo commit pelo menos 24 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): substituir operação`

### T58: Registrar avaliação manual

**What**: Entregar registrar avaliação manual conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/valuations/record-investment-valuation.ts`
**Depends on**: T57
**Reuses**: Valuation T10, Clock e executor T48.
**Requirement**: INV-47, INV-48, INV-49, INV-50, INV-51, INV-59, INV-74, INV-75, INV-78, INV-84, INV-127, INV-130, INV-131, INV-142
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Validar expectedAllocationRevision dentro da escrita, instante UTC não futuro/quantidade/moeda; append sem alterar Position.version e corrida operação-avaliação válida nas duas ordens.
- [ ] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): registrar avaliação manual`

### T59: Guard de manutenção genérica do journal

**What**: Entregar guard de manutenção genérica do journal conforme os requisitos abaixo.
**Where**: `packages/application/src/ledger/journal/investment-journal-ownership.ts`
**Depends on**: T58
**Reuses**: findOwnerOfJournal e comandos genéricos existentes.
**Requirement**: INV-63, INV-64, INV-67, INV-68, INV-69, INV-74, INV-102, INV-117, INV-135, INV-136
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Inserir guard em Reverse/Amend genéricos na transação para journal original/reversão/substituta de investimento; devolver INVESTMENT_OPERATION_REQUIRED sem alterar posição/journal/facts.
- [ ] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): guard de manutenção genérica do journal`

### T60: Avisos em comandos financeiros comuns

**What**: Entregar avisos em comandos financeiros comuns conforme os requisitos abaixo.
**Where**: `packages/application/src/ledger/journal/investment-cash-warnings.ts`
**Depends on**: T59
**Reuses**: Leituras scoped T38/T39 e DTOs financeiros existentes.
**Requirement**: INV-28, INV-31, INV-32, INV-60, INV-70, INV-75, INV-77, INV-145, INV-147
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Conectar helper pós-postings a Income/Expense/Transfer/OpeningBalance e correções genéricas; warning aditivo por toda carteira afetada, inclusive ambas numa transferência, sem bloquear ou criar operação de investimento.
- [ ] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full Memory` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory
**Commit**: `feat(investments): avisos em comandos financeiros comuns`

### T61: Prévia da operação

**What**: Entregar prévia da operação conforme os requisitos abaixo.
**Where**: `packages/application/src/investments/queries/preview-investment-operation.ts`
**Depends on**: T60
**Reuses**: Planner e readers do contexto, sem executor de escrita.
**Requirement**: INV-13, INV-36, INV-74, INV-76, INV-100, INV-139, INV-145, INV-148
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Read-only chama planner com estado atual e retorna custo/fluxo/categorias/caixa/versões; não grava recibo, ID, sequência ou fact; caixa negativo não é erro e confirmação revalida tudo.
- [ ] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full Memory + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (Command); testes acompanham o componente nesta tarefa.
**Gate**: Full Memory + Build
**Commit**: `feat(investments): prévia da operação`

### Phase 11: Consultas de investimentos

### T62: Resumo patrimonial

**What**: Entregar resumo patrimonial conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/investments/sqlite-investment-portfolio-summary.ts`
**Depends on**: T61
**Reuses**: Agregador T37, índices e GetNetWorth como oráculo.
**Requirement**: INV-09, INV-10, INV-50, INV-51, INV-52, INV-53, INV-54, INV-55, INV-56, INV-57, INV-58, INV-59, INV-60, INV-82, INV-93, INV-97, INV-130, INV-140, INV-141, INV-145, INV-146, INV-147
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Usar uma leitura consistente com D do livro, L/C/V e tupla vigente; fórmulas exatas >int64, cobertura real, custo fallback, moedas/vazio, arquivadas, warnings por carteira e filtro de lista sem efeito no total. Incluir o handler de aplicação que resolve Clock.localDate/moeda e repassa D uma única vez; testar o handler junto da consulta.
- [ ] Escrever/atualizar no mesmo commit pelo menos 20 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): resumo patrimonial`

### T63: Consulta de carteiras

**What**: Entregar consulta de carteiras conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/investments/sqlite-investment-account-queries.ts`
**Depends on**: T62
**Reuses**: Leituras de totais e catalog queries.
**Requirement**: INV-09, INV-10, INV-11, INV-55, INV-60, INV-74, INV-94, INV-107, INV-113, INV-145, INV-146
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] List/detail retornam metadata e totais por carteira sem histórico infinito ou N+1; settlement ausente permanece ausente e warnings/saldos preservam sinais/moeda. Incluir o handler de aplicação e validação da query correspondente, com testes próprios no mesmo commit.
- [ ] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): consulta de carteiras`

### T64: Consulta de instrumentos

**What**: Entregar consulta de instrumentos conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/investments/sqlite-investment-instrument-queries.ts`
**Depends on**: T63
**Reuses**: Catalog query validation e índices de instrumentos.
**Requirement**: INV-14, INV-15, INV-17, INV-18, INV-26, INV-74, INV-99, INV-114, INV-116
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Listar/detalhar instrumentos para manutenção e seleção, status/filtros/ordem determinísticos, identificadores normalizados e isolamento; seletores novos só ativos. Incluir o handler de aplicação e validação da query correspondente, com testes próprios no mesmo commit.
- [ ] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): consulta de instrumentos`

### T65: Consulta de posições

**What**: Entregar consulta de posições conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/investments/sqlite-investment-position-queries.ts`
**Depends on**: T64
**Reuses**: QueryPage/QuerySlice e codecs existentes com prefixo ip1.
**Requirement**: INV-19, INV-20, INV-22, INV-25, INV-26, INV-50, INV-51, INV-52, INV-53, INV-58, INV-59, INV-74, INV-95, INV-96, INV-97, INV-98, INV-130
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] List/detail paginados por nome/rótulo/ID e filtros, termos/valores vigentes; cursor25/100 com fingerprint, LIKE literal e joins indexados sem uma busca de aggregate por linha. Incluir o handler de aplicação e validação da query correspondente, com testes próprios no mesmo commit.
- [ ] Escrever/atualizar no mesmo commit pelo menos 16 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): consulta de posições`

### T66: Histórico de operações

**What**: Entregar histórico de operações conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/investments/sqlite-investment-operation-queries.ts`
**Depends on**: T65
**Reuses**: Operation repository e codecs de query.
**Requirement**: INV-61, INV-63, INV-64, INV-65, INV-68, INV-69, INV-72, INV-74, INV-96, INV-98, INV-117, INV-132, INV-133, INV-134, INV-135, INV-136
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Paginar por data/sequence/id, incluir efeitos/lineage histórico e vínculos de journal opcionais; cursor io1 valida livro/posição/filtros e não perde operação sem journal. Incluir o handler de aplicação e validação da query correspondente, com testes próprios no mesmo commit.
- [ ] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): histórico de operações`

### T67: Histórico de avaliações

**What**: Entregar histórico de avaliações conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/investments/sqlite-investment-valuation-queries.ts`
**Depends on**: T66
**Reuses**: Índices de Valuation e codecs.
**Requirement**: INV-47, INV-49, INV-50, INV-51, INV-53, INV-59, INV-74, INV-96, INV-98, INV-117, INV-127, INV-130
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Paginar observações por valuedAt/sequence/id com cursor iv1 independente das operações; preservar antigas revisões/valores desconhecidos e seleção vigente não usa ID aleatório. Incluir o handler de aplicação e validação da query correspondente, com testes próprios no mesmo commit.
- [ ] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full SQLite + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite + Build
**Commit**: `feat(investments-sqlite): histórico de avaliações`

### Phase 12: Consultas existentes e composição

### T68: Saldos e extrato exatos existentes

**What**: Entregar saldos e extrato exatos existentes conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/sqlite-ledger-queries.ts`
**Depends on**: T67
**Reuses**: SqliteExactLedgerTotals e testes atuais de ledger/statement.
**Requirement**: INV-05, INV-06, INV-07, INV-31, INV-55, INV-57, INV-82, INV-140, INV-141
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Substituir somas vulneráveis nas consultas contábeis/saldos/extrato afetadas pelo helper sem mudar filtros, sinais, asOf ou paginação; testar totais além de int64 e lançamentos futuros.
- [ ] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): saldos e extrato exatos existentes`

### T69: Insights exatos existentes

**What**: Entregar insights exatos existentes conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/sqlite-insight-queries.ts`
**Depends on**: T68
**Reuses**: Helper T37 e suites de insights.
**Requirement**: INV-37, INV-38, INV-42, INV-43, INV-44, INV-55, INV-56, INV-57, INV-82, INV-103, INV-140, INV-141
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Migrar NetWorth, monthly cash flow e category spending para soma exata; preservar semântica temporal/reversões e somar renda/despesa mistas uma vez. O teste legado que exige uma única instrução agrupada deve passar a verificar leitura consistente, lotes limitados e ausência de N+1, preservando todos os oráculos monetários; a mudança decorre do design aprovado.
- [ ] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): insights exatos existentes`

### T70: Read model INVESTMENT em Transações

**What**: Entregar read model investment em transações conforme os requisitos abaixo.
**Where**: `packages/infrastructure-sqlite/src/queries/sqlite-journal-view-queries.ts`
**Depends on**: T69
**Reuses**: Journal view DTOs, codecs/filtros e helper T37.
**Requirement**: INV-31, INV-45, INV-63, INV-64, INV-67, INV-68, INV-69, INV-82, INV-98, INV-102, INV-103, INV-135, INV-136
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven.

**Done when**:

- [ ] Classificar pelo ownership, expor operação/posição e canEditWithGenericFlow, amount=abs(netCashFlow); resumo por postings/kind, count/largest/lifecycle preservados e nenhuma linha artificial sem journal.
- [ ] Escrever/atualizar no mesmo commit pelo menos 16 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full SQLite` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (SQLite); testes acompanham o componente nesta tarefa.
**Gate**: Full SQLite
**Commit**: `feat(investments-sqlite): read model investment em transações`

### T71: Composição MyFinServices

**What**: Entregar composição myfinservices conforme os requisitos abaixo.
**Where**: `apps/tauri/src/bootstrap/create-services.ts`
**Depends on**: T70
**Reuses**: Providers e create-services existentes.
**Requirement**: INV-74, INV-78, INV-80, INV-89, INV-91, INV-92, INV-101, INV-104
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Conectar comandos e queries completos à facade investments e adaptadores reais, sem imports SQLite na UI; fakes públicos refletem a interface e retry consulta recibo.
- [ ] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React + Build
**Commit**: `feat(investments-ui): composição myfinservices`

### Phase 13: Estado de UI e cadastros

### T72: Consultas e cache de investimentos na UI

**What**: Entregar consultas e cache de investimentos na ui conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/hooks/investment-queries.ts`
**Depends on**: T71
**Reuses**: React Query, useActiveBook e key factories existentes.
**Requirement**: INV-50, INV-58, INV-74, INV-93, INV-94, INV-95, INV-96, INV-97, INV-98, INV-104, INV-105, INV-106, INV-107, INV-108, INV-140, INV-141
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Criar hooks via uma factory de queries do livro, cursores independentes e defer só search; refetch/focus/mudança do dia recalculam D sem dia fixo de 24h; chave antiga nunca contamina livro novo.
- [ ] Escrever/atualizar no mesmo commit pelo menos 16 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): consultas e cache de investimentos na ui`

### T73: Submissão de investimentos na UI

**What**: Entregar submissão de investimentos na ui conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/hooks/use-investment-submission.ts`
**Depends on**: T72
**Reuses**: useTransactionFormSubmission e mutation helpers.
**Requirement**: INV-74, INV-76, INV-78, INV-79, INV-80, INV-90, INV-104, INV-105, INV-109, INV-111, INV-131, INV-145, INV-148
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Manter requestId/draft no retry, gerar nova intenção só ao editar, recuperar resposta indeterminada e invalidar livro original; impedir duplo envio e preservar campos em erro/conflito, warning é sucesso.
- [ ] Escrever/atualizar no mesmo commit pelo menos 16 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): submissão de investimentos na ui`

### T74: Classificação no formulário de conta

**What**: Entregar classificação no formulário de conta conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/accounts/components/account-form.tsx`
**Depends on**: T73
**Reuses**: AccountForm RHF e controles existentes.
**Requirement**: INV-01, INV-07, INV-08, INV-11, INV-12, INV-13, INV-99, INV-110, INV-115, INV-138
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Adicionar tipo/instituição/referência e configuração explícita de settlement/reclassificação; explicar OTHER sem inventar postings, bloquear incompatibilidades pelo erro do comando e preservar foco/validação.
- [ ] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): classificação no formulário de conta`

### T75: Resumo contábil em Contas

**What**: Entregar resumo contábil em contas conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/accounts/components/account-summary.tsx`
**Depends on**: T74
**Reuses**: AccountSummaryModel e query de resumo.
**Requirement**: INV-09, INV-10, INV-57, INV-93, INV-107, INV-138, INV-143
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Exibir Patrimônio contábil com moeda do livro, inclusive vazio não-BRL; separar disponível/outros ativos conforme query e orientar classificação pós-migração.
- [ ] Escrever/atualizar no mesmo commit pelo menos 8 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): resumo contábil em contas`

### T76: Formulário de instrumento

**What**: Entregar formulário de instrumento conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/forms/investment-instrument-form.tsx`
**Depends on**: T75
**Reuses**: Controlled fields, Drawer, DropdownMenu e hooks de submissão.
**Requirement**: INV-14, INV-15, INV-16, INV-17, INV-18, INV-26, INV-99, INV-101, INV-109, INV-110, INV-111, INV-114, INV-116
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Cadastrar/editar/arquivar/reativar instrumento com identificadores e erros estáveis; não alterar tipo após uso nem criar catálogo como efeito oculto da operação.
- [ ] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): formulário de instrumento`

### T77: Formulário de metadata da posição

**What**: Entregar formulário de metadata da posição conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/forms/investment-position-metadata-form.tsx`
**Depends on**: T76
**Reuses**: Drawer e UpdateInvestmentPositionMetadata.
**Requirement**: INV-20, INV-26, INV-101, INV-109, INV-110, INV-111, INV-129
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Editar rótulo via caso dedicado, termos imutáveis no detalhe, conflito preserva draft; payload não permite custo/quantidade/revisão.
- [ ] Escrever/atualizar no mesmo commit pelo menos 6 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React + Build
**Commit**: `feat(investments-ui): formulário de metadata da posição`

### Phase 14: Formulários de abertura e operações

### T78: Formulário de abertura

**What**: Entregar formulário de abertura conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/forms/open-investment-position-form.tsx`
**Depends on**: T77
**Reuses**: Catálogos existentes, forms T74/T76 e preview T61.
**Requirement**: INV-19, INV-21, INV-22, INV-23, INV-27, INV-28, INV-33, INV-99, INV-100, INV-101, INV-109, INV-110, INV-111, INV-120, INV-121, INV-122, INV-123, INV-124, INV-137, INV-138, INV-145, INV-148
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Oferecer Já possuo/Comprar e três origens contábeis, quantidade obrigatória nos produtos definidos e termos parciais; saldo inicial confirma separadamente e falha de alocação não o repete.
- [ ] Escrever/atualizar no mesmo commit pelo menos 20 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): formulário de abertura`

### T79: Formulário de compra/aplicação

**What**: Entregar formulário de compra/aplicação conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/forms/investment-purchase-form.tsx`
**Depends on**: T78
**Reuses**: Preview e submissão de investimentos.
**Requirement**: INV-13, INV-29, INV-30, INV-32, INV-36, INV-100, INV-101, INV-109, INV-110, INV-111, INV-118, INV-125, INV-126, INV-145, INV-148
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Solicitar principal, quantidade aplicável, despesas/categorias e rota explícita; pré-seleção de settlement não decide silenciosamente, preview negativo mantém Salvar habilitado.
- [ ] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): formulário de compra/aplicação`

### T80: Formulário de venda/resgate

**What**: Entregar formulário de venda/resgate conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/forms/investment-sale-form.tsx`
**Depends on**: T79
**Reuses**: Preview, query de Position e campos monetários exatos.
**Requirement**: INV-13, INV-35, INV-36, INV-37, INV-38, INV-39, INV-40, INV-41, INV-100, INV-101, INV-109, INV-110, INV-111, INV-126, INV-139, INV-148
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Separar custo retirado de bruto recebido, unidades/total/parcial e despesas; total preenche custo exato, parcial não inventa média e confirmação mostra efeitos/categorias.
- [ ] Escrever/atualizar no mesmo commit pelo menos 16 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): formulário de venda/resgate`

### T81: Formulário de rendimento

**What**: Entregar formulário de rendimento conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/forms/investment-income-form.tsx`
**Depends on**: T80
**Reuses**: Campos controlados e RecordInvestmentIncome.
**Requirement**: INV-42, INV-44, INV-100, INV-101, INV-109, INV-110, INV-111, INV-119, INV-126, INV-148
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Capturar bruto e retenções do evento com categorias, inclusive posição encerrada em vínculos ativos; uma submissão INCOME sem FEE/TAX duplicadas.
- [ ] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): formulário de rendimento`

### T82: Formulário de amortização

**What**: Entregar formulário de amortização conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/forms/investment-amortization-form.tsx`
**Depends on**: T81
**Reuses**: Campos controlados e RecordInvestmentAmortization.
**Requirement**: INV-42, INV-44, INV-46, INV-100, INV-101, INV-109, INV-110, INV-111, INV-126, INV-148
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Pedir custo reduzido e bruto/despesas, sem edição de unidades; preview mostra efeito no custo/resultado e erros mantêm dados.
- [ ] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): formulário de amortização`

### T83: Formulário de despesa de investimento

**What**: Entregar formulário de despesa de investimento conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/forms/investment-expense-form.tsx`
**Depends on**: T82
**Reuses**: RecordInvestmentExpense e form de despesa existente.
**Requirement**: INV-32, INV-43, INV-44, INV-100, INV-101, INV-109, INV-110, INV-111, INV-119, INV-126, INV-145, INV-148
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Oferecer FEE/TAX independente com categoria explícita e caixa interno; explicar vínculo à posição e permitir aviso negativo sem segunda confirmação.
- [ ] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React + Build
**Commit**: `feat(investments-ui): formulário de despesa de investimento`

### Phase 15: Avaliação, correção e listas

### T84: Formulário de avaliação

**What**: Entregar formulário de avaliação conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/forms/investment-valuation-form.tsx`
**Depends on**: T83
**Reuses**: RecordInvestmentValuation e query de detalhe.
**Requirement**: INV-47, INV-48, INV-49, INV-58, INV-59, INV-100, INV-101, INV-109, INV-110, INV-111, INV-130, INV-131, INV-142
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Enviar bruto/instante e revisão observada, opcionais desconhecidos e quantidade coerente; revisão obsoleta exige recarregar sem converter valuation em custo ou lucro informado.
- [ ] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): formulário de avaliação`

### T85: Formulário de correção

**What**: Entregar formulário de correção conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/forms/investment-correction-form.tsx`
**Depends on**: T84
**Reuses**: Forms de operações e comandos T56/T57.
**Requirement**: INV-61, INV-62, INV-65, INV-67, INV-68, INV-69, INV-70, INV-72, INV-73, INV-100, INV-101, INV-109, INV-110, INV-111, INV-128, INV-129, INV-134, INV-135, INV-136, INV-144, INV-148
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Oferecer cancelamento/amendment da última efetiva com motivo e versões, reutilizando form específico do tipo; datas da reversão são derivadas, não editáveis, e conflitos mantêm draft.
- [ ] Escrever/atualizar no mesmo commit pelo menos 18 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): formulário de correção`

### T86: Cards patrimoniais

**What**: Entregar cards patrimoniais conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/components/investment-portfolio-summary.tsx`
**Depends on**: T85
**Reuses**: formatMinorAmount e componentes Card/ErrorState.
**Requirement**: INV-09, INV-10, INV-52, INV-53, INV-54, INV-56, INV-58, INV-59, INV-60, INV-93, INV-106, INV-107, INV-108, INV-112, INV-140, INV-141, INV-146, INV-147
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Exibir disponível/contábil/avaliado, moeda/data/cobertura e desconhecidos; loading/erro não viram zero e total com inconsistência conserva fórmula/aviso até caixa corrigido.
- [ ] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): cards patrimoniais`

### T87: Lista de carteiras

**What**: Entregar lista de carteiras conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/components/investment-account-list.tsx`
**Depends on**: T86
**Reuses**: Query de carteiras, DropdownMenu e forms de contas.
**Requirement**: INV-11, INV-55, INV-60, INV-94, INV-106, INV-107, INV-108, INV-112, INV-113, INV-115, INV-116, INV-145, INV-146, INV-147
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Mostrar L/C/caixa/valor/resultado por carteira, seleção e ações de configuração/lifecycle com erros, vazio e aviso visível mesmo se caixa agregado for positivo.
- [ ] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): lista de carteiras`

### T88: Tabela de posições

**What**: Entregar tabela de posições conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/components/investment-position-table.tsx`
**Depends on**: T87
**Reuses**: Query hooks, tabela e DropdownMenu compartilhados.
**Requirement**: INV-19, INV-25, INV-26, INV-52, INV-53, INV-58, INV-59, INV-95, INV-97, INV-98, INV-106, INV-107, INV-108, INV-110, INV-112, INV-118
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Exibir instrumento/rótulo/carteira/classe/quantidade/custo/base/status e filtros paginados; ações respeitam estado, tabela rola internamente em viewport estreito.
- [ ] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React + Build` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React + Build
**Commit**: `feat(investments-ui): tabela de posições`

### Phase 16: Históricos e integração da navegação

### T89: Histórico visual de operações

**What**: Entregar histórico visual de operações conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/components/investment-operation-history.tsx`
**Depends on**: T88
**Reuses**: Query de histórico e form T85.
**Requirement**: INV-61, INV-63, INV-64, INV-65, INV-68, INV-69, INV-72, INV-73, INV-96, INV-98, INV-106, INV-108, INV-110, INV-112, INV-117, INV-132, INV-133, INV-134, INV-135, INV-136
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Mostrar fatos/reversões/substituições, efeitos e datas de ocorrência/registro, journal opcional e acesso à correção somente da última efetiva; paginação isolada.
- [ ] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): histórico visual de operações`

### T90: Histórico visual de avaliações

**What**: Entregar histórico visual de avaliações conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/components/investment-valuation-history.tsx`
**Depends on**: T89
**Reuses**: Query de avaliações e form T84.
**Requirement**: INV-47, INV-49, INV-50, INV-51, INV-53, INV-58, INV-59, INV-96, INV-98, INV-106, INV-108, INV-112, INV-117, INV-127, INV-130
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Mostrar observações antigas/atuais e revisão/data, opcionais desconhecidos e cadastro append; cursor independente sem substituir histórico ao avaliar.
- [ ] Escrever/atualizar no mesmo commit pelo menos 10 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): histórico visual de avaliações`

### T91: Detalhe da posição

**What**: Entregar detalhe da posição conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/components/investment-position-detail.tsx`
**Depends on**: T90
**Reuses**: Componentes T84–T90 e hooks da feature.
**Requirement**: INV-20, INV-22, INV-25, INV-26, INV-52, INV-53, INV-59, INV-61, INV-74, INV-95, INV-96, INV-101, INV-105, INV-106, INV-108, INV-110, INV-112, INV-119, INV-144
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Compor termos, estado, ações e tabs dos dois históricos sem ler tudo de uma vez; ID de outro livro não abre detalhe e conta/instrumento arquivado orienta reativação.
- [ ] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): detalhe da posição`

### T92: Página Investimentos

**What**: Entregar página investimentos conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/investments/components/investments-page.tsx`
**Depends on**: T91
**Reuses**: Cards/listas/forms prontos e contexto do shell.
**Requirement**: INV-91, INV-92, INV-93, INV-94, INV-95, INV-97, INV-99, INV-101, INV-104, INV-105, INV-106, INV-107, INV-108, INV-110, INV-111, INV-112, INV-138, INV-146, INV-147, INV-148
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Compor resumo, carteiras, posições e drawers com todas as ações; filtro não muda total, troca de livro limpa estado e mutation anterior só invalida seu livro.
- [ ] Escrever/atualizar no mesmo commit pelo menos 18 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React
**Commit**: `feat(investments-ui): página investimentos`

### T93: Rotas e navegação de investimentos

**What**: Entregar rotas e navegação de investimentos conforme os requisitos abaixo.
**Where**: `apps/tauri/src/routes/app-routes.tsx`
**Depends on**: T92
**Reuses**: React Router e ApplicationShell existentes.
**Requirement**: INV-74, INV-91, INV-92, INV-96, INV-99, INV-101, INV-105, INV-110, INV-112
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Registrar /investments e /investments/positions/:positionId sob shell, item/breadcrumb e proteção por livro; executar jornada nativa descrita no gate Native, sem mudar dashboard. Native N1–N6/N8 e o trecho de teclado/layout de Investimentos de N7 são parte deste aceite. A navegação e apresentação INVESTMENT em Transações de N7 são verificadas em T94, quando o componente estiver integrado.
- [ ] Escrever/atualizar no mesmo commit pelo menos 12 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React + Native (N1–N6/N8 e N7 parcial)` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React + Native (N1–N6/N8 e N7 parcial)
**Commit**: `feat(investments-ui): rotas e navegação de investimentos`

### T94: Integração visual com Transações

**What**: Entregar integração visual com transações conforme os requisitos abaixo.
**Where**: `apps/tauri/src/features/transactions/components/transaction-table.tsx`
**Depends on**: T93
**Reuses**: TransactionTable, filtros, Drawer e queries atuais.
**Requirement**: INV-31, INV-45, INV-63, INV-64, INV-67, INV-68, INV-69, INV-98, INV-102, INV-103, INV-104, INV-109, INV-110, INV-112, INV-135, INV-136
**Tools**: MCP: NONE. Ferramentas locais: exec_command/apply_patch. Skill: tlc-spec-driven. Usar shadcn ao compor componentes da biblioteca; playwright quando aplicável à evidência em navegador.

**Done when**:

- [ ] Exibir tipo/filtro/detalhe INVESTMENT e vínculo ao detalhe, ocultar edição genérica e preservar busca/paginação/menus; renderizar receitas/despesas mistas do read model sem recalcular por linha. Revalidar N7 e caminhos nativos afetados, rodar Final e manter toda evidência de T93 válida no estado final.
- [ ] Escrever/atualizar no mesmo commit pelo menos 14 cenários distintos dos ACs acima; conferir todos os ramos/fixtures aplicáveis da matriz, registrar contagem antes/depois e evidência por requisito.
- [ ] Gate `Full React + Build + Final + Native afetado` passa; revisão de adequação e rastreabilidade atualizadas antes do commit.

**Tests**: integration (React); testes acompanham o componente nesta tarefa.
**Gate**: Full React + Build + Final + Native afetado
**Commit**: `feat(investments-ui): integração visual com transações`

## Task Granularity Check

Um componente/caso de uso por tarefa, com testes e integrações mecânicas do mesmo contrato. Não usar o ponto principal como permissão para agregar funcionalidades adjacentes.

| Task | Scope | Status |
| --- | --- | --- |
| T1 | Decimal exato | ✅ Um componente/contrato coeso |
| T2 | Validação dos valores de investimento | ✅ Um componente/contrato coeso |
| T3 | Perfis financeiros | ✅ Um componente/contrato coeso |
| T4 | Perfil no aggregate LedgerAccount | ✅ Um componente/contrato coeso |
| T5 | Identidades de investimentos | ✅ Um componente/contrato coeso |
| T6 | Aggregate InvestmentInstrument | ✅ Um componente/contrato coeso |
| T7 | Termos de renda fixa | ✅ Um componente/contrato coeso |
| T8 | Aggregate InvestmentPosition | ✅ Um componente/contrato coeso |
| T9 | Aggregate InvestmentOperation | ✅ Um componente/contrato coeso |
| T10 | Observação InvestmentValuation | ✅ Um componente/contrato coeso |
| T11 | Planner contábil de investimentos | ✅ Um componente/contrato coeso |
| T12 | Contratos de comandos e resultados | ✅ Um componente/contrato coeso |
| T13 | Ports de persistência de investimento | ✅ Um componente/contrato coeso |
| T14 | Contratos das consultas de investimento | ✅ Um componente/contrato coeso |
| T15 | Registro dos facts no dispatcher | ✅ Um componente/contrato coeso |
| T16 | Resultado preservado após commit | ✅ Um componente/contrato coeso |
| T17 | Migração de perfis financeiros | ✅ Um componente/contrato coeso |
| T18 | Migração de instrumentos | ✅ Um componente/contrato coeso |
| T19 | Migração de posições e termos | ✅ Um componente/contrato coeso |
| T20 | Migração de operações e sequência | ✅ Um componente/contrato coeso |
| T21 | Migração de avaliações | ✅ Um componente/contrato coeso |
| T22 | Migração de recibos | ✅ Um componente/contrato coeso |
| T23 | Persistência do perfil no LedgerAccount | ✅ Um componente/contrato coeso |
| T24 | Repository SQLite de instrumentos | ✅ Um componente/contrato coeso |
| T25 | Repository SQLite de posições | ✅ Um componente/contrato coeso |
| T26 | Repository SQLite de operações | ✅ Um componente/contrato coeso |
| T27 | Store SQLite de avaliações | ✅ Um componente/contrato coeso |
| T28 | Store SQLite de recibos | ✅ Um componente/contrato coeso |
| T29 | Store SQLite de sequência | ✅ Um componente/contrato coeso |
| T30 | Snapshot de investimentos em memória | ✅ Um componente/contrato coeso |
| T31 | Repository em memória de instrumentos | ✅ Um componente/contrato coeso |
| T32 | Repository em memória de posições | ✅ Um componente/contrato coeso |
| T33 | Repository em memória de operações | ✅ Um componente/contrato coeso |
| T34 | Store em memória de avaliações | ✅ Um componente/contrato coeso |
| T35 | Store em memória de recibos | ✅ Um componente/contrato coeso |
| T36 | Store em memória de sequência | ✅ Um componente/contrato coeso |
| T37 | Agregador exato de postings | ✅ Um componente/contrato coeso |
| T38 | Leituras transacionais SQLite | ✅ Um componente/contrato coeso |
| T39 | Leituras transacionais em memória | ✅ Um componente/contrato coeso |
| T40 | Contexto transacional com investimentos | ✅ Um componente/contrato coeso |
| T41 | Criação de conta pelo tipo financeiro | ✅ Um componente/contrato coeso |
| T42 | Configuração financeira e liquidação | ✅ Um componente/contrato coeso |
| T43 | Política de lifecycle de contas | ✅ Um componente/contrato coeso |
| T44 | Criar instrumento | ✅ Um componente/contrato coeso |
| T45 | Atualizar instrumento | ✅ Um componente/contrato coeso |
| T46 | Lifecycle de instrumento | ✅ Um componente/contrato coeso |
| T47 | Metadata da posição | ✅ Um componente/contrato coeso |
| T48 | Execução idempotente de investimento | ✅ Um componente/contrato coeso |
| T49 | Saldo inicial explícito idempotente | ✅ Um componente/contrato coeso |
| T50 | Abrir posição | ✅ Um componente/contrato coeso |
| T51 | Registrar compra ou aplicação | ✅ Um componente/contrato coeso |
| T52 | Registrar venda ou resgate | ✅ Um componente/contrato coeso |
| T53 | Registrar rendimento | ✅ Um componente/contrato coeso |
| T54 | Registrar amortização | ✅ Um componente/contrato coeso |
| T55 | Registrar taxa ou imposto independente | ✅ Um componente/contrato coeso |
| T56 | Cancelar operação | ✅ Um componente/contrato coeso |
| T57 | Substituir operação | ✅ Um componente/contrato coeso |
| T58 | Registrar avaliação manual | ✅ Um componente/contrato coeso |
| T59 | Guard de manutenção genérica do journal | ✅ Um componente/contrato coeso |
| T60 | Avisos em comandos financeiros comuns | ✅ Um componente/contrato coeso |
| T61 | Prévia da operação | ✅ Um componente/contrato coeso |
| T62 | Resumo patrimonial | ✅ Um componente/contrato coeso |
| T63 | Consulta de carteiras | ✅ Um componente/contrato coeso |
| T64 | Consulta de instrumentos | ✅ Um componente/contrato coeso |
| T65 | Consulta de posições | ✅ Um componente/contrato coeso |
| T66 | Histórico de operações | ✅ Um componente/contrato coeso |
| T67 | Histórico de avaliações | ✅ Um componente/contrato coeso |
| T68 | Saldos e extrato exatos existentes | ✅ Um componente/contrato coeso |
| T69 | Insights exatos existentes | ✅ Um componente/contrato coeso |
| T70 | Read model INVESTMENT em Transações | ✅ Um componente/contrato coeso |
| T71 | Composição MyFinServices | ✅ Um componente/contrato coeso |
| T72 | Consultas e cache de investimentos na UI | ✅ Um componente/contrato coeso |
| T73 | Submissão de investimentos na UI | ✅ Um componente/contrato coeso |
| T74 | Classificação no formulário de conta | ✅ Um componente/contrato coeso |
| T75 | Resumo contábil em Contas | ✅ Um componente/contrato coeso |
| T76 | Formulário de instrumento | ✅ Um componente/contrato coeso |
| T77 | Formulário de metadata da posição | ✅ Um componente/contrato coeso |
| T78 | Formulário de abertura | ✅ Um componente/contrato coeso |
| T79 | Formulário de compra/aplicação | ✅ Um componente/contrato coeso |
| T80 | Formulário de venda/resgate | ✅ Um componente/contrato coeso |
| T81 | Formulário de rendimento | ✅ Um componente/contrato coeso |
| T82 | Formulário de amortização | ✅ Um componente/contrato coeso |
| T83 | Formulário de despesa de investimento | ✅ Um componente/contrato coeso |
| T84 | Formulário de avaliação | ✅ Um componente/contrato coeso |
| T85 | Formulário de correção | ✅ Um componente/contrato coeso |
| T86 | Cards patrimoniais | ✅ Um componente/contrato coeso |
| T87 | Lista de carteiras | ✅ Um componente/contrato coeso |
| T88 | Tabela de posições | ✅ Um componente/contrato coeso |
| T89 | Histórico visual de operações | ✅ Um componente/contrato coeso |
| T90 | Histórico visual de avaliações | ✅ Um componente/contrato coeso |
| T91 | Detalhe da posição | ✅ Um componente/contrato coeso |
| T92 | Página Investimentos | ✅ Um componente/contrato coeso |
| T93 | Rotas e navegação de investimentos | ✅ Um componente/contrato coeso |
| T94 | Integração visual com Transações | ✅ Um componente/contrato coeso |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | None | ✅ Match |
| T2 | T1 | T1 | ✅ Match |
| T3 | T2 | T2 | ✅ Match |
| T4 | T3 | T3 | ✅ Match |
| T5 | T4 | T4 | ✅ Match |
| T6 | T5 | T5 | ✅ Match |
| T7 | T6 | T6 | ✅ Match |
| T8 | T7 | T7 | ✅ Match |
| T9 | T8 | T8 | ✅ Match |
| T10 | T9 | T9 | ✅ Match |
| T11 | T10 | T10 | ✅ Match |
| T12 | T11 | T11 | ✅ Match |
| T13 | T12 | T12 | ✅ Match |
| T14 | T13 | T13 | ✅ Match |
| T15 | T14 | T14 | ✅ Match |
| T16 | T15 | T15 | ✅ Match |
| T17 | T16 | T16 | ✅ Match |
| T18 | T17 | T17 | ✅ Match |
| T19 | T18 | T18 | ✅ Match |
| T20 | T19 | T19 | ✅ Match |
| T21 | T20 | T20 | ✅ Match |
| T22 | T21 | T21 | ✅ Match |
| T23 | T22 | T22 | ✅ Match |
| T24 | T23 | T23 | ✅ Match |
| T25 | T24 | T24 | ✅ Match |
| T26 | T25 | T25 | ✅ Match |
| T27 | T26 | T26 | ✅ Match |
| T28 | T27 | T27 | ✅ Match |
| T29 | T28 | T28 | ✅ Match |
| T30 | T29 | T29 | ✅ Match |
| T31 | T30 | T30 | ✅ Match |
| T32 | T31 | T31 | ✅ Match |
| T33 | T32 | T32 | ✅ Match |
| T34 | T33 | T33 | ✅ Match |
| T35 | T34 | T34 | ✅ Match |
| T36 | T35 | T35 | ✅ Match |
| T37 | T36 | T36 | ✅ Match |
| T38 | T37 | T37 | ✅ Match |
| T39 | T38 | T38 | ✅ Match |
| T40 | T39 | T39 | ✅ Match |
| T41 | T40 | T40 | ✅ Match |
| T42 | T41 | T41 | ✅ Match |
| T43 | T42 | T42 | ✅ Match |
| T44 | T43 | T43 | ✅ Match |
| T45 | T44 | T44 | ✅ Match |
| T46 | T45 | T45 | ✅ Match |
| T47 | T46 | T46 | ✅ Match |
| T48 | T47 | T47 | ✅ Match |
| T49 | T48 | T48 | ✅ Match |
| T50 | T49 | T49 | ✅ Match |
| T51 | T50 | T50 | ✅ Match |
| T52 | T51 | T51 | ✅ Match |
| T53 | T52 | T52 | ✅ Match |
| T54 | T53 | T53 | ✅ Match |
| T55 | T54 | T54 | ✅ Match |
| T56 | T55 | T55 | ✅ Match |
| T57 | T56 | T56 | ✅ Match |
| T58 | T57 | T57 | ✅ Match |
| T59 | T58 | T58 | ✅ Match |
| T60 | T59 | T59 | ✅ Match |
| T61 | T60 | T60 | ✅ Match |
| T62 | T61 | T61 | ✅ Match |
| T63 | T62 | T62 | ✅ Match |
| T64 | T63 | T63 | ✅ Match |
| T65 | T64 | T64 | ✅ Match |
| T66 | T65 | T65 | ✅ Match |
| T67 | T66 | T66 | ✅ Match |
| T68 | T67 | T67 | ✅ Match |
| T69 | T68 | T68 | ✅ Match |
| T70 | T69 | T69 | ✅ Match |
| T71 | T70 | T70 | ✅ Match |
| T72 | T71 | T71 | ✅ Match |
| T73 | T72 | T72 | ✅ Match |
| T74 | T73 | T73 | ✅ Match |
| T75 | T74 | T74 | ✅ Match |
| T76 | T75 | T75 | ✅ Match |
| T77 | T76 | T76 | ✅ Match |
| T78 | T77 | T77 | ✅ Match |
| T79 | T78 | T78 | ✅ Match |
| T80 | T79 | T79 | ✅ Match |
| T81 | T80 | T80 | ✅ Match |
| T82 | T81 | T81 | ✅ Match |
| T83 | T82 | T82 | ✅ Match |
| T84 | T83 | T83 | ✅ Match |
| T85 | T84 | T84 | ✅ Match |
| T86 | T85 | T85 | ✅ Match |
| T87 | T86 | T86 | ✅ Match |
| T88 | T87 | T87 | ✅ Match |
| T89 | T88 | T88 | ✅ Match |
| T90 | T89 | T89 | ✅ Match |
| T91 | T90 | T90 | ✅ Match |
| T92 | T91 | T91 | ✅ Match |
| T93 | T92 | T92 | ✅ Match |
| T94 | T93 | T93 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Domain | unit | unit | ✅ Mesmo commit |
| T2 | Domain | unit | unit | ✅ Mesmo commit |
| T3 | Domain | unit | unit | ✅ Mesmo commit |
| T4 | Domain | unit | unit | ✅ Mesmo commit |
| T5 | Domain | unit | unit | ✅ Mesmo commit |
| T6 | Domain | unit | unit | ✅ Mesmo commit |
| T7 | Domain | unit | unit | ✅ Mesmo commit |
| T8 | Domain | unit | unit | ✅ Mesmo commit |
| T9 | Domain | unit | unit | ✅ Mesmo commit |
| T10 | Domain | unit | unit | ✅ Mesmo commit |
| T11 | Domain | unit | unit | ✅ Mesmo commit |
| T12 | Application | unit | unit | ✅ Mesmo commit |
| T13 | Application | unit | unit | ✅ Mesmo commit |
| T14 | Application | unit | unit | ✅ Mesmo commit |
| T15 | Application | unit | unit | ✅ Mesmo commit |
| T16 | Application | unit | unit | ✅ Mesmo commit |
| T17 | SQLite | integration | integration | ✅ Mesmo commit |
| T18 | SQLite | integration | integration | ✅ Mesmo commit |
| T19 | SQLite | integration | integration | ✅ Mesmo commit |
| T20 | SQLite | integration | integration | ✅ Mesmo commit |
| T21 | SQLite | integration | integration | ✅ Mesmo commit |
| T22 | SQLite | integration | integration | ✅ Mesmo commit |
| T23 | SQLite | integration | integration | ✅ Mesmo commit |
| T24 | SQLite | integration | integration | ✅ Mesmo commit |
| T25 | SQLite | integration | integration | ✅ Mesmo commit |
| T26 | SQLite | integration | integration | ✅ Mesmo commit |
| T27 | SQLite | integration | integration | ✅ Mesmo commit |
| T28 | SQLite | integration | integration | ✅ Mesmo commit |
| T29 | SQLite | integration | integration | ✅ Mesmo commit |
| T30 | Memory | integration | integration | ✅ Mesmo commit |
| T31 | Memory | integration | integration | ✅ Mesmo commit |
| T32 | Memory | integration | integration | ✅ Mesmo commit |
| T33 | Memory | integration | integration | ✅ Mesmo commit |
| T34 | Memory | integration | integration | ✅ Mesmo commit |
| T35 | Memory | integration | integration | ✅ Mesmo commit |
| T36 | Memory | integration | integration | ✅ Mesmo commit |
| T37 | SQLite | integration | integration | ✅ Mesmo commit |
| T38 | SQLite | integration | integration | ✅ Mesmo commit |
| T39 | Memory | integration | integration | ✅ Mesmo commit |
| T40 | Integration | integration | integration | ✅ Mesmo commit |
| T41 | Command | integration | integration | ✅ Mesmo commit |
| T42 | Command | integration | integration | ✅ Mesmo commit |
| T43 | Command | integration | integration | ✅ Mesmo commit |
| T44 | Command | integration | integration | ✅ Mesmo commit |
| T45 | Command | integration | integration | ✅ Mesmo commit |
| T46 | Command | integration | integration | ✅ Mesmo commit |
| T47 | Command | integration | integration | ✅ Mesmo commit |
| T48 | Command | integration | integration | ✅ Mesmo commit |
| T49 | Command | integration | integration | ✅ Mesmo commit |
| T50 | Command | integration | integration | ✅ Mesmo commit |
| T51 | Command | integration | integration | ✅ Mesmo commit |
| T52 | Command | integration | integration | ✅ Mesmo commit |
| T53 | Command | integration | integration | ✅ Mesmo commit |
| T54 | Command | integration | integration | ✅ Mesmo commit |
| T55 | Command | integration | integration | ✅ Mesmo commit |
| T56 | Command | integration | integration | ✅ Mesmo commit |
| T57 | Command | integration | integration | ✅ Mesmo commit |
| T58 | Command | integration | integration | ✅ Mesmo commit |
| T59 | Command | integration | integration | ✅ Mesmo commit |
| T60 | Command | integration | integration | ✅ Mesmo commit |
| T61 | Command | integration | integration | ✅ Mesmo commit |
| T62 | SQLite | integration | integration | ✅ Mesmo commit |
| T63 | SQLite | integration | integration | ✅ Mesmo commit |
| T64 | SQLite | integration | integration | ✅ Mesmo commit |
| T65 | SQLite | integration | integration | ✅ Mesmo commit |
| T66 | SQLite | integration | integration | ✅ Mesmo commit |
| T67 | SQLite | integration | integration | ✅ Mesmo commit |
| T68 | SQLite | integration | integration | ✅ Mesmo commit |
| T69 | SQLite | integration | integration | ✅ Mesmo commit |
| T70 | SQLite | integration | integration | ✅ Mesmo commit |
| T71 | React | integration | integration | ✅ Mesmo commit |
| T72 | React | integration | integration | ✅ Mesmo commit |
| T73 | React | integration | integration | ✅ Mesmo commit |
| T74 | React | integration | integration | ✅ Mesmo commit |
| T75 | React | integration | integration | ✅ Mesmo commit |
| T76 | React | integration | integration | ✅ Mesmo commit |
| T77 | React | integration | integration | ✅ Mesmo commit |
| T78 | React | integration | integration | ✅ Mesmo commit |
| T79 | React | integration | integration | ✅ Mesmo commit |
| T80 | React | integration | integration | ✅ Mesmo commit |
| T81 | React | integration | integration | ✅ Mesmo commit |
| T82 | React | integration | integration | ✅ Mesmo commit |
| T83 | React | integration | integration | ✅ Mesmo commit |
| T84 | React | integration | integration | ✅ Mesmo commit |
| T85 | React | integration | integration | ✅ Mesmo commit |
| T86 | React | integration | integration | ✅ Mesmo commit |
| T87 | React | integration | integration | ✅ Mesmo commit |
| T88 | React | integration | integration | ✅ Mesmo commit |
| T89 | React | integration | integration | ✅ Mesmo commit |
| T90 | React | integration | integration | ✅ Mesmo commit |
| T91 | React | integration | integration | ✅ Mesmo commit |
| T92 | React | integration | integration | ✅ Mesmo commit |
| T93 | React | integration | integration | ✅ Mesmo commit |
| T94 | React | integration | integration | ✅ Mesmo commit |

## Requirement Traceability

Mapeamento de planejamento, não evidência de implementação. Cada ID também conserva sua seção responsável em design.md. Durante Execute, acrescentar assertions e file:line à evidência da tarefa e do Verifier.

| Requirement ID | Tasks | Status |
| --- | --- | --- |
| INV-01 | T3, T17, T23, T41, T74 | Planned |
| INV-02 | T3, T4, T41 | Planned |
| INV-03 | T3, T4, T17, T23, T41 | Planned |
| INV-04 | T4, T15, T23, T30, T41, T42 | Planned |
| INV-05 | T17, T23, T68 | Planned |
| INV-06 | T17, T23, T68 | Planned |
| INV-07 | T4, T23, T42, T68, T74 | Planned |
| INV-08 | T42, T43, T74 | Planned |
| INV-09 | T14, T62, T63, T75, T86 | Planned |
| INV-10 | T14, T62, T63, T75, T86 | Planned |
| INV-138 | T42, T74, T75, T78, T92 | Planned |
| INV-11 | T3, T4, T23, T41, T42, T63, T74, T87 | Planned |
| INV-12 | T3, T38, T39, T42, T43, T74 | Planned |
| INV-13 | T42, T61, T74, T79, T80 | Planned |
| INV-14 | T6, T18, T24, T31, T44, T64, T76 | Planned |
| INV-15 | T6, T44, T64, T76 | Planned |
| INV-16 | T6, T24, T44, T45, T76 | Planned |
| INV-17 | T6, T18, T24, T31, T44, T45, T64, T76 | Planned |
| INV-18 | T6, T18, T24, T31, T44, T45, T64, T76 | Planned |
| INV-19 | T5, T8, T19, T25, T32, T50, T65, T78, T88 | Planned |
| INV-20 | T8, T12, T19, T25, T32, T47, T50, T65, T77, T91 | Planned |
| INV-21 | T2, T8, T19, T25, T50, T78 | Planned |
| INV-22 | T7, T19, T25, T65, T78, T91 | Planned |
| INV-23 | T7, T19, T25, T78 | Planned |
| INV-24 | T2, T7 | Planned |
| INV-25 | T7, T8, T65, T88, T91 | Planned |
| INV-26 | T6, T7, T8, T24, T25, T31, T45, T47, T64, T65, T76, T77, T88, T91 | Planned |
| INV-27 | T11, T50, T78 | Planned |
| INV-28 | T38, T39, T50, T60, T78 | Planned |
| INV-29 | T11, T50, T51, T79 | Planned |
| INV-30 | T11, T50, T51, T79 | Planned |
| INV-31 | T60, T68, T70, T94 | Planned |
| INV-32 | T38, T39, T50, T51, T55, T60, T79, T83 | Planned |
| INV-33 | T50, T78 | Planned |
| INV-34 | T9, T50, T51 | Planned |
| INV-120 | T49, T50, T78 | Planned |
| INV-121 | T49, T50, T78 | Planned |
| INV-122 | T49, T78 | Planned |
| INV-123 | T2, T49, T50, T78 | Planned |
| INV-124 | T49, T78 | Planned |
| INV-137 | T49, T50, T78 | Planned |
| INV-35 | T8, T11, T51, T52, T54, T80 | Planned |
| INV-36 | T2, T11, T12, T51, T52, T61, T79, T80 | Planned |
| INV-37 | T11, T52, T69, T80 | Planned |
| INV-38 | T11, T52, T69, T80 | Planned |
| INV-39 | T8, T11, T52, T80 | Planned |
| INV-40 | T8, T11, T52, T80 | Planned |
| INV-41 | T11, T52, T80 | Planned |
| INV-42 | T11, T53, T54, T69, T81, T82 | Planned |
| INV-43 | T11, T55, T69, T83 | Planned |
| INV-44 | T11, T51, T52, T53, T54, T55, T69, T81, T82, T83 | Planned |
| INV-45 | T11, T51, T52, T70, T94 | Planned |
| INV-46 | T8, T11, T52, T54, T82 | Planned |
| INV-125 | T11, T51, T79 | Planned |
| INV-126 | T11, T51, T52, T53, T54, T55, T79, T80, T81, T82, T83 | Planned |
| INV-139 | T52, T61, T80 | Planned |
| INV-47 | T10, T21, T27, T34, T58, T67, T84, T90 | Planned |
| INV-48 | T2, T10, T27, T58, T84 | Planned |
| INV-49 | T10, T21, T27, T34, T58, T67, T84, T90 | Planned |
| INV-50 | T14, T21, T27, T29, T34, T36, T58, T62, T65, T67, T72, T90 | Planned |
| INV-51 | T8, T52, T58, T62, T65, T67, T90 | Planned |
| INV-52 | T14, T62, T65, T86, T88, T91 | Planned |
| INV-53 | T8, T52, T62, T65, T67, T86, T88, T90, T91 | Planned |
| INV-54 | T14, T62, T86 | Planned |
| INV-55 | T14, T37, T38, T39, T62, T63, T68, T69, T87 | Planned |
| INV-56 | T14, T37, T62, T69, T86 | Planned |
| INV-57 | T14, T37, T62, T68, T69, T75 | Planned |
| INV-58 | T14, T62, T65, T72, T84, T86, T88, T90 | Planned |
| INV-59 | T10, T14, T58, T62, T65, T67, T84, T86, T88, T90, T91 | Planned |
| INV-60 | T14, T38, T39, T60, T62, T63, T86, T87 | Planned |
| INV-127 | T8, T19, T21, T25, T27, T30, T32, T47, T50, T58, T67, T90 | Planned |
| INV-128 | T8, T25, T51, T52, T54, T56, T57, T85 | Planned |
| INV-129 | T8, T47, T53, T55, T57, T77, T85 | Planned |
| INV-130 | T58, T62, T65, T67, T84, T90 | Planned |
| INV-131 | T12, T58, T73, T84 | Planned |
| INV-140 | T14, T37, T38, T39, T62, T68, T69, T72, T86 | Planned |
| INV-141 | T14, T37, T38, T39, T62, T68, T69, T72, T86 | Planned |
| INV-142 | T10, T58, T84 | Planned |
| INV-146 | T62, T63, T86, T87, T92 | Planned |
| INV-147 | T49, T60, T62, T86, T87, T92 | Planned |
| INV-61 | T9, T26, T33, T56, T57, T66, T85, T89, T91 | Planned |
| INV-62 | T8, T56, T85 | Planned |
| INV-63 | T9, T20, T26, T33, T56, T57, T59, T66, T70, T89, T94 | Planned |
| INV-64 | T9, T20, T26, T33, T56, T57, T59, T66, T70, T89, T94 | Planned |
| INV-65 | T9, T26, T33, T56, T57, T66, T85, T89 | Planned |
| INV-66 | T9, T56, T57 | Planned |
| INV-67 | T56, T57, T59, T70, T85, T94 | Planned |
| INV-68 | T9, T20, T26, T57, T59, T66, T70, T85, T89, T94 | Planned |
| INV-69 | T9, T20, T26, T33, T56, T57, T59, T66, T70, T85, T89, T94 | Planned |
| INV-70 | T56, T57, T60, T85 | Planned |
| INV-71 | T8, T56 | Planned |
| INV-72 | T9, T20, T26, T29, T33, T36, T56, T57, T66, T85, T89 | Planned |
| INV-73 | T9, T56, T57, T85, T89 | Planned |
| INV-132 | T9, T11, T13, T20, T26, T30, T33, T56, T57, T66, T89 | Planned |
| INV-133 | T9, T20, T26, T56, T57, T66, T89 | Planned |
| INV-134 | T9, T20, T26, T56, T57, T66, T85, T89 | Planned |
| INV-135 | T26, T57, T59, T66, T70, T85, T89, T94 | Planned |
| INV-136 | T26, T57, T59, T66, T70, T85, T89, T94 | Planned |
| INV-74 | T12, T13, T18, T19, T20, T21, T23, T24, T25, T26, T27, T28, T31, T32, T33, T34, T35, T40, T41, T42, T43, T44, T45, T46, T47, T48, T51, T52, T53, T54, T55, T56, T57, T58, T59, T61, T63, T64, T65, T66, T67, T71, T72, T73, T91, T93 | Planned |
| INV-75 | T13, T16, T22, T28, T29, T30, T35, T36, T40, T48, T50, T51, T52, T53, T54, T55, T56, T57, T58, T60 | Planned |
| INV-76 | T4, T12, T13, T23, T24, T25, T26, T31, T32, T33, T40, T42, T45, T46, T47, T48, T51, T52, T53, T54, T55, T56, T57, T61, T73 | Planned |
| INV-77 | T38, T39, T40, T48, T51, T60 | Planned |
| INV-78 | T5, T12, T13, T16, T22, T28, T35, T40, T48, T49, T50, T51, T52, T53, T54, T55, T56, T57, T58, T71, T73 | Planned |
| INV-79 | T12, T22, T28, T35, T48, T73 | Planned |
| INV-80 | T16, T22, T28, T35, T40, T48, T71, T73 | Planned |
| INV-81 | T9, T15, T16, T40, T44, T45, T46, T48 | Planned |
| INV-82 | T1, T2, T10, T12, T29, T36, T37, T62, T68, T69, T70 | Planned |
| INV-83 | T1, T2, T6, T10, T12, T44, T45, T47 | Planned |
| INV-84 | T2, T10, T12, T48, T58 | Planned |
| INV-85 | T17, T18, T19, T20, T21, T22 | Planned |
| INV-86 | T17, T18, T19, T20, T21, T22 | Planned |
| INV-87 | T17, T18, T22 | Planned |
| INV-88 | T13, T17, T21, T23, T24, T25, T26, T27, T28, T29, T30, T34, T40 | Planned |
| INV-89 | T5, T6, T12, T13, T40, T44, T71 | Planned |
| INV-90 | T12, T15, T16, T48, T73 | Planned |
| INV-145 | T12, T38, T39, T48, T49, T50, T51, T55, T56, T57, T60, T61, T62, T63, T73, T78, T79, T83, T87 | Planned |
| INV-91 | T71, T92, T93 | Planned |
| INV-92 | T71, T92, T93 | Planned |
| INV-93 | T14, T62, T72, T75, T86, T92 | Planned |
| INV-94 | T14, T63, T72, T87, T92 | Planned |
| INV-95 | T14, T65, T72, T88, T91, T92 | Planned |
| INV-96 | T14, T65, T66, T67, T72, T89, T90, T91, T93 | Planned |
| INV-97 | T14, T62, T65, T72, T88, T92 | Planned |
| INV-98 | T14, T65, T66, T67, T70, T72, T88, T89, T90, T94 | Planned |
| INV-99 | T64, T74, T76, T78, T92, T93 | Planned |
| INV-100 | T61, T78, T79, T80, T81, T82, T83, T84, T85 | Planned |
| INV-101 | T71, T76, T77, T78, T79, T80, T81, T82, T83, T84, T85, T91, T92, T93 | Planned |
| INV-102 | T59, T70, T94 | Planned |
| INV-103 | T37, T69, T70, T94 | Planned |
| INV-104 | T71, T72, T73, T92, T94 | Planned |
| INV-105 | T72, T73, T91, T92, T93 | Planned |
| INV-106 | T72, T86, T87, T88, T89, T90, T91, T92 | Planned |
| INV-107 | T63, T72, T75, T86, T87, T88, T92 | Planned |
| INV-108 | T72, T86, T87, T88, T89, T90, T91, T92 | Planned |
| INV-109 | T73, T76, T77, T78, T79, T80, T81, T82, T83, T84, T85, T94 | Planned |
| INV-110 | T74, T76, T77, T78, T79, T80, T81, T82, T83, T84, T85, T88, T89, T91, T92, T93, T94 | Planned |
| INV-111 | T73, T76, T77, T78, T79, T80, T81, T82, T83, T84, T85, T92 | Planned |
| INV-112 | T86, T87, T88, T89, T90, T91, T92, T93, T94 | Planned |
| INV-143 | T75 | Planned |
| INV-148 | T61, T73, T78, T79, T80, T81, T82, T83, T85, T92 | Planned |
| INV-113 | T25, T32, T38, T39, T43, T63, T87 | Planned |
| INV-114 | T6, T24, T25, T31, T32, T46, T64, T76 | Planned |
| INV-115 | T38, T39, T42, T43, T74, T87 | Planned |
| INV-116 | T6, T24, T31, T43, T46, T64, T76, T87 | Planned |
| INV-117 | T46, T59, T66, T67, T89, T90 | Planned |
| INV-118 | T8, T51, T79, T88 | Planned |
| INV-119 | T8, T53, T55, T81, T83, T91 | Planned |
| INV-144 | T8, T43, T46, T56, T57, T85, T91 | Planned |

## Edge Case Coverage

Os 35 fixtures de Edge Cases da spec têm responsáveis explícitos. A entrada e o resultado obrigatório permanecem na spec como oráculo; os testes não os calculam pelo planner da implementação.

| Cenário da spec | Tasks responsáveis |
| --- | --- |
| Compra interna sem despesas | T11, T51, T62 |
| Compra externa com despesas | T11, T51, T70 |
| Venda com ganho | T11, T52 |
| Venda com perda | T11, T52 |
| Ganho menor que despesas | T11, T52, T70 |
| Sem resultado, mas com despesas | T11, T52 |
| Resgate direto | T11, T52 |
| Venda parcial | T8, T52 |
| Avaliação antes de venda parcial | T52, T58, T62 |
| Custo zero com unidades | T8, T52 |
| Amortização | T11, T54 |
| Empate de avaliação | T58, T62, T67 |
| Dado antigo inserido depois | T58, T62 |
| Moedas distintas | T6, T44 |
| Precisão | T1, T2 |
| Caixa negativo legado | T38, T62, T87 |
| Resumo independente de filtro | T62, T65, T92 |
| Retry após resposta perdida | T48, T50, T73 |
| Cancelamento inicial | T8, T56 |
| Venda com despesas no caixa interno | T11, T52 |
| Venda com despesas direto ao banco | T11, T52 |
| Rendimento com retenção no evento | T11, T53 |
| Caixa já reconhecido na carteira | T50, T78 |
| Patrimônio inicialmente ausente | T49, T50, T62 |
| Patrimônio ausente com caixa real | T49, T50, T62 |
| Cancelamento não recupera valuation anterior | T8, T56, T62 |
| Amendment sem mudança de alocação | T8, T57, T62 |
| Avaliação aberta antes de venda | T58, T84 |
| Amendment passa a ter journal | T57, T66, T70 |
| Amendment deixa de ter journal | T57, T66, T70 |
| Abertura antes de completar ledger | T50, T62, T86 |
| Recuperação do caixa | T49, T60, T62, T86 |
| Compra com caixa insuficiente | T51, T79 |
| Lançamento futuro no ledger | T37, T62, T69 |
| Avaliação de quantidade divergente | T10, T58, T84 |

## Ferramentas propostas e fechamento futuro

O plano usa ferramentas locais para ler/editar/executar gates, tlc-spec-driven durante todo Execute, shadcn nas tarefas de componentes aplicáveis e playwright quando o cenário puder ser verificado em navegador real. Não há MCP externo necessário nem plugin financeiro a instalar. Antes de Execute, confirmar as ferramentas por tarefa e a eventual delegação conforme a skill; essa confirmação não é necessária para produzir este documento. Nenhum worker foi iniciado.

Após o último commit, o Verifier novo verifica assertions contra os 148 ACs, rastreabilidade e evidência nativa, além dos sensores de D13: bruto da venda tratado como renda, taxa duplicada, valuation reaproveitada após saída, revisão antiga restaurada, bypass do guard, recibo fora do rollback, reversão excluída do saldo e caixa negativo bloqueado. Usar scratch isolado; nunca alterar o worktree real para mutações. validation.md só será criado quando houver verificação real. Após o Verifier, executar `python3 .codex/skills/tlc-spec-driven/scripts/validate_state.py investments-foundation`; gaps ou Native pendente impedem declarar conclusão, mesmo que a validação estrutural passe.

## Validação deste plano

Em 2026-09-10, validate_tasks.py --strict e validate_spec.py --strict retornaram zero erros e zero avisos. Foram conferidas granularidade, correspondência entre diagramas/dependências e co-localização de testes nas tabelas acima. Rastreabilidade: 148/148 requisitos e 35/35 fixtures da spec possuem tarefas responsáveis. Não há testes de software rodados, tarefas concluídas ou commits de implementação.
