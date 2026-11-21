# Redesign do painel de investimentos - Validation

**Verdict**: PASS
**Date**: 2026-11-21
**Spec**: `.specs/features/investments-dashboard-redesign/spec.md`
**Diff range**: `59c5b8d^..59c5b8d`
**Verifier**: independent sub-agent (author != verifier)

---

## Task Completion

O escopo foi classificado como Medium e não possui `tasks.md`. A execução implícita foi verificada nos três blocos abaixo.

| Task                                                                         | Status | Evidence                                                                                  |
| ---------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| T1: priorizar patrimônio, custo, caixa, resultado e qualidade das avaliações | PASS   | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:56` |
| T2: tornar posições, filtros, ações e paginação responsivos                  | PASS   | `apps/tauri/src/features/investments/components/investment-position-table.test.tsx:128`   |
| T3: mover cadastros para gerenciamento secundário e preservar fluxos         | PASS   | `apps/tauri/src/features/investments/components/investments-page.test.tsx:384`            |

## Spec-Anchored Acceptance Criteria

### P1: Compreender o patrimônio investido

| Criterion                                    | Spec-defined outcome                                                                             | Evidence and assertion                                                                                                                                                                                                                                                                                                        | Result |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Patrimônio em investimentos                  | `investmentMarketValueMinor + investmentCashMinor`, em BRL no fixture: `110000 + 10000 = 120000` | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:56` - `getByText(/R\$\s*1\.200,00/)` dentro de `invested-net-worth`                                                                                                                                                                     | PASS   |
| Custo, caixa e resultado separados           | Custo `R$ 900,00`, caixa `R$ 100,00`, resultado `+R$ 200,00`                                     | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:63` - três asserções por `data-testid` e valor exato                                                                                                                                                                                    | PASS   |
| Patrimônios do livro secundários e distintos | Contábil `R$ 2.000,00`; avaliado `R$ 2.200,00`; disponível `R$ 1.200,00`                         | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:80` - valores exatos nos três cards; a hierarquia está em `apps/tauri/src/features/investments/components/investment-portfolio-summary.tsx:103` e `apps/tauri/src/features/investments/components/investment-portfolio-summary.tsx:202` | PASS   |
| Cobertura parcial ou ausente                 | Informar quantidade avaliada e uso de custo nas demais posições                                  | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:107` - `1 de 2`; `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:125` - `Sem avaliação atual; usando custo` e `0 de 2`                                                                            | PASS   |
| Cobertura completa                           | Informar todas as posições avaliadas e intervalo de datas                                        | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:107` - intervalo `20/09/2026 a 25/09/2026`; `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:117` - `Todas as 2 posições` e ausência de `usando custo`                                             | PASS   |
| Falha de atualização com cache               | Manter valores anteriores e sinalizar a falha                                                    | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:216` - alerta de dados anteriores e `R$ 2.200,00` ainda visível                                                                                                                                                                         | PASS   |
| Falha inicial                                | Mostrar erro e nova tentativa sem fabricar zero                                                  | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:206` - mensagem exata, ausência de `R$ 0,00` e `onRetry` chamado uma vez                                                                                                                                                                | PASS   |

### P1: Acompanhar e operar posições

| Criterion                           | Spec-defined outcome                                                                  | Evidence and assertion                                                                                                                                                                                                                 | Result |
| ----------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Filtros ligados à consulta paginada | Busca, carteira, classe e estado chegam ao hook existente                             | `apps/tauri/src/features/investments/components/investment-position-table.test.tsx:233` - `accountId: wallet-2`; `:241` - `assetClass: EQUITY`; `:252` - `status: CLOSED`; `:258` - `search: Reserva`                                  | PASS   |
| Fatos financeiros e ações visíveis  | Instrumento, rótulo, carteira, classe, quantidade, custo, valor, base, estado e ações | `apps/tauri/src/features/investments/components/investment-position-table.test.tsx:128` - identidade, classe e estado; `:138` - quantidade, custo, valor, data e resultado; `:283` - ação contextual                                   | PASS   |
| Resultado para `VALUATION`          | Valor atual menos custo, sem percentual: `R$ 5.200,00 - R$ 5.000,00 = +R$ 200,00`     | `apps/tauri/src/features/investments/components/investment-position-table.test.tsx:138` - asserção `+R$ 200,00`; cálculo em `apps/tauri/src/features/investments/components/investment-position-table.tsx:349`                         | PASS   |
| Fallback `BOOK_COST`                | Identificar uso do custo e não mostrar lucro zero                                     | `apps/tauri/src/features/investments/components/investment-position-table.test.tsx:172` - `Sem avaliação atual; usando custo`, dois valores de custo e `Resultado indisponível`                                                        | PASS   |
| Quantidade ausente                  | Mostrar `Desconhecida`                                                                | `apps/tauri/src/features/investments/components/investment-position-table.test.tsx:155` - asserção textual exata                                                                                                                       | PASS   |
| Janela de 360 px                    | Reorganizar linhas sem overflow horizontal                                            | `apps/tauri/src/features/investments/components/investment-position-table.test.tsx:367` - layout `xl:table`, sem `min-w-240`, linha em grid; `apps/tauri/tests/investments-browser-uat.js:8` - mede documento, tabela e ação em 360 px | PASS   |
| Próxima página                      | Manter `Carregar mais` e bloquear durante carregamento                                | `apps/tauri/src/features/investments/components/investment-position-table.test.tsx:266` - `fetchNextPage` uma vez; `:273` - `Carregando mais...` desabilitado                                                                          | PASS   |

### P1: Manter ações e cadastros acessíveis

| Criterion                 | Spec-defined outcome                                                                              | Evidence and assertion                                                                                                                                                                                                                                                                                                                                                                                                     | Result |
| ------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Ação principal            | Cabeçalho oferece `Novo investimento` e abre o formulário existente                               | `apps/tauri/src/features/investments/components/investments-page.test.tsx:470` - botão abre dialog e `form-open`                                                                                                                                                                                                                                                                                                           | PASS   |
| Gerenciamento progressivo | `Gerenciar` expande a seção e a leva ao início visual                                             | `apps/tauri/src/features/investments/components/investments-page.test.tsx:384` - carteiras ausentes antes e presentes após abrir; `apps/tauri/tests/investments-browser-uat.js:41` - heading aparece e desaparece; rolagem em `apps/tauri/src/features/investments/components/investments-page.tsx:204`                                                                                                                    | PASS   |
| Capacidades preservadas   | Criar, configurar, arquivar e reativar carteiras; criar e configurar instrumentos                 | `apps/tauri/src/features/investments/components/investments-page.test.tsx:477` - criação; `:485` - configuração; `:567` - arquivamento; `:581` - reativação; `:639` - criação e edição de instrumento                                                                                                                                                                                                                      | PASS   |
| Posições priorizadas      | Posições permanecem visíveis enquanto carteiras começam recolhidas e só aparecem após `Gerenciar` | `apps/tauri/src/features/investments/components/investments-page.test.tsx:384` - `positions` presente e `wallets` ausente antes da expansão; ordem estrutural em `apps/tauri/src/features/investments/components/investments-page.tsx:335` e `:382`                                                                                                                                                                        | PASS   |
| Estados específicos       | Resumo, posições, carteiras e instrumentos preservam loading, empty, erro, cache e ação aplicável | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:160`; `:201`; `:206`; `apps/tauri/src/features/investments/components/investment-position-table.test.tsx:320`; `:327`; `:337`; `:346`; `apps/tauri/src/features/investments/components/investment-account-list.test.tsx:204`; `:210`; `:220`; `:228`; `apps/tauri/src/features/investments/components/investments-page.test.tsx:423` | PASS   |

**Spec-anchored status**: 19/19 acceptance criteria matched the defined outcomes. No spec-precision gap was found.

## Edge Cases

| Edge case                                                    | Evidence                                                                                                                                                                             | Result |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Caixa de investimento negativo é preservado e sinalizado     | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:227` - `-R$ 100,00` e dois avisos de inconsistência                                            | PASS   |
| Livro sem carteiras nem posições orienta o primeiro cadastro | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:160` - empty state e callback `Cadastrar carteira`                                             | PASS   |
| Falha de atualização mantém dados anteriores                 | `apps/tauri/src/features/investments/components/investment-portfolio-summary.test.tsx:216` e `apps/tauri/src/features/investments/components/investment-position-table.test.tsx:337` | PASS   |
| 800 e 1280 px sem overflow                                   | `apps/tauri/tests/investments-browser-uat.js:8` - o mesmo conjunto de asserções roda em 360, 800 e 1280 px                                                                           | PASS   |

## Discrimination Sensor

Baseline da árvore real antes e depois do sensor:

```text
 M apps/tauri/src/components/forms/controlled-toggle-group.tsx
?? .notebook/
```

Esses dois itens já existiam antes da validação e não foram tocados.

| Mutation | Scratch location                                | Behavior fault                                                                                                   | Result                                                                                                                         |
| -------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| M1       | temporary detached worktree at commit `59c5b8d` | Trocou `investmentMarketValueMinor + investmentCashMinor` por subtração em `investment-portfolio-summary.tsx:70` | KILLED: `investment-portfolio-summary.test.tsx:59` esperava `R$ 1.200,00` e recebeu `R$ 1.000,00`; 1 teste falhou, 18 passaram |

**Sensor depth**: lightweight, highest-risk financial aggregation.
**Result**: 1/1 mutant killed. PASS.

## Gate Check

| Gate                                                                                                                                                                                                                                                                                                                      | Result                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `python3 .codex/skills/tlc-spec-driven/scripts/validate_spec.py .specs/features/investments-dashboard-redesign/spec.md`                                                                                                                                                                                                   | PASS: 0 errors, 0 warnings                      |
| `pnpm --filter tauri exec vitest run src/features/investments/components/investment-portfolio-summary.test.tsx src/features/investments/components/investment-position-table.test.tsx src/features/investments/components/investments-page.test.tsx src/features/investments/components/investment-account-list.test.tsx` | PASS: 4 files, 89 tests, 0 failed               |
| `pnpm --filter tauri exec vitest run --reporter=dot`                                                                                                                                                                                                                                                                      | PASS: 89 files, 1110 tests, 0 failed, 0 skipped |
| `pnpm --filter tauri exec tsc --noEmit`                                                                                                                                                                                                                                                                                   | PASS                                            |
| `pnpm --filter @workspace/ui typecheck`                                                                                                                                                                                                                                                                                   | PASS                                            |
| `pnpm --filter tauri exec eslint ...` sobre os arquivos alterados                                                                                                                                                                                                                                                         | PASS                                            |
| `pnpm --filter tauri build`                                                                                                                                                                                                                                                                                               | PASS: 4232 modules transformed                  |
| WebKit UAT em `apps/tauri/tests/investments-browser-uat.js`                                                                                                                                                                                                                                                               | PASS em 360, 800 e 1280 px                      |
| `git diff --check 59c5b8d^ 59c5b8d`                                                                                                                                                                                                                                                                                       | PASS                                            |

**Test integrity**: os três testes alterados continham 70 casos antes e 72 depois. O delta é +2, ambos no resumo. Nenhum teste foi removido ou pulado. As mudanças de asserção na tabela substituem a apresentação anterior por resultados aprovados na especificação: valores líquidos/resgatáveis saem da linha resumida, `BOOK_COST` passa a mostrar `Resultado indisponível`, e o layout deixa de exigir largura fixa.

## Interactive Browser UAT

O roteiro versionado foi executado novamente no WebKit contra `uat-investments.html`.

| Width   | Document/table overflow | Management disclosure | Keyboard/menu/focus | Registration drawer | Result |
| ------- | ----------------------- | --------------------- | ------------------- | ------------------- | ------ |
| 360 px  | none                    | pass                  | pass                | pass                | PASS   |
| 800 px  | none                    | pass                  | pass                | pass                | PASS   |
| 1280 px | none                    | pass                  | pass                | pass                | PASS   |

O roteiro também confirmou que o formulário não expõe avaliação como custo, mantém o rascunho progressivo e restaura o foco ao fechar menu e drawer.

## Code Quality

| Principle                  | Status | Evidence                                                                                                                                          |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sem escopo extra           | PASS   | Não há rentabilidade percentual, série histórica ou gráfico derivado da página paginada.                                                          |
| Mudanças cirúrgicas        | PASS   | O diff toca somente spec, página e componentes/testes do painel, tokens compartilhados e UAT da feature.                                          |
| Contratos preservados      | PASS   | React Query, drawers, hooks e comandos existentes permanecem; filtros continuam chegando ao read model paginado.                                  |
| Totais financeiros seguros | PASS   | O único total novo usa o resumo agregado; `InvestmentPositionTable` calcula apenas resultado por linha e nunca reduz a página para formar totais. |
| Padrões existentes         | PASS   | Reutiliza `Card`, `Collapsible`, `DropdownMenu`, `ErrorState`, `Empty`, `Skeleton` e tokens do design system.                                     |
| Testes não rasos           | PASS   | Valores exatos, estados de cache/erro, payloads de filtro, paginação, teclado, foco e overflow foram verificados.                                 |
| Guidelines                 | PASS   | `.codex/skills/tlc-spec-driven/references/coding-principles.md` e defaults fortes do projeto.                                                     |

## Requirement Traceability

| Requirement | Spec status  | Validation status |
| ----------- | ------------ | ----------------- |
| IDR-01      | Implementing | Verified          |
| IDR-02      | Implementing | Verified          |
| IDR-03      | Implementing | Verified          |
| IDR-04      | Implementing | Verified          |
| IDR-05      | Verified     | Verified          |

## Limitations and Pending Work

- O gráfico de alocação não foi implementado. Isso é intencional: o contrato agregado futuro está documentado em `.specs/features/investments-dashboard-redesign/spec.md:100`, e a página não simula dados a partir da paginação.
- O UAT foi reproduzido no WebKit do navegador. Esta validação não abre a janela nativa do Tauri nem cobre diferenças do webview do sistema operacional.
- O build emite o aviso existente de chunk maior que 500 kB. O build conclui e o aviso não é introduzido nem agravado por uma nova dependência nesta feature.
- A suíte completa imprime um aviso de HTML inválido em `transaction-summary.test.tsx`, fora do diff. Todos os 1110 testes passam; o aviso não afeta o veredito desta feature.

## Summary

**Overall**: PASS. Ready for the traceability update and validation commit.

- 19/19 acceptance criteria matched the spec-defined outcomes.
- 89/89 focused tests and 1110/1110 full-suite tests passed.
- 1/1 financial mutation was killed in an isolated worktree.
- WebKit UAT passed at 360, 800 and 1280 px.
- No production code, test, user-owned file or prior worktree change was modified by the verifier.
