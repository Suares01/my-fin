# Ciclo de Vida de Transações e Transferências

**Status:** Confirmada em 2026-09-03
**Criada em:** 2026-09-03
**Escopo:** `apps/tauri/src/features/transactions/`

## Problem Statement

O My Fin já possui no domínio e na camada de aplicação os contratos para registrar receitas, despesas e transferências, corrigir lançamentos por amendment e cancelá-los por reversal. A aplicação Tauri ainda não oferece uma experiência única para consultar e operar esse ciclo de vida.

Esta feature cria uma tela unificada de transações, inspirada na composição visual do `shadcn-fintech`, sem copiar contratos fictícios do template. A tela usa o journal consolidado existente e mantém formulários dedicados para receita, despesa e transferência dentro do módulo `transactions`.

## Goals

- [ ] Permitir criar receita, despesa e transferência a partir da tela `/transactions`.
- [ ] Exibir receitas, despesas e transferências do livro ativo em uma lista consolidada, filtrável e paginada.
- [ ] Permitir editar o lançamento efetivo de uma cadeia sem sobrescrever o histórico contábil.
- [ ] Permitir excluir uma transação na linguagem da interface por meio de cancelamento contábil, sem apagar registros físicos.
- [ ] Manter saldos, extratos, insights e a lista de transações coerentes após cada mutação.

## Out of Scope

| Feature                                                     | Reason                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Exclusão física de journal entries ou postings              | O ledger é append-only; remoção funcional ocorre por reversal.                              |
| Saldo inicial na tela de transações                         | A tela reúne somente receita, despesa e transferência.                                      |
| Criação ou edição de postings arbitrários                   | A UI envia comandos de negócio discriminados e não manipula partidas contábeis diretamente. |
| Troca do tipo durante uma edição                            | Cada lançamento mantém seu tipo de negócio e usa o formulário dedicado correspondente.      |
| Transações recorrentes, parcelamentos e agendamentos        | Não existem contratos de domínio ou aplicação para essas capacidades.                       |
| Anexos, comprovantes e merchant enrichment                  | Esses dados não existem no read model atual.                                                |
| Importação, exportação CSV e ações em lote                  | São capacidades do template visual, mas não fazem parte do ciclo de vida solicitado.        |
| Novas moedas ou conversão cambial                           | Cada lançamento usa a moeda-base do livro e contas compatíveis.                             |
| Alterações nas regras contábeis de `domain` e `application` | Os casos de uso existentes já cobrem o ciclo solicitado; a feature deve consumi-los.        |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here; nothing is left silently unclear.

| Assumption / decision                | Chosen default                                                                                                                                           | Rationale                                                                                 | Confirmed?                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| Nome e endereço da tela unificada    | Rota `/transactions`, item de navegação `Transações` no grupo `Visão Geral`                                                                              | A tela reúne três tipos; usar `/transfers` representaria apenas um deles.                 | Sim, confirmado em 2026-09-03           |
| Responsabilidade de rota e navegação | `app-routes.tsx` declara a rota; `app-shell.tsx` declara o item da sidebar e o breadcrumb derivado                                                       | Esse é o contrato atual do React Router e do shell.                                       | Sim, código existente                   |
| Significado de deleção               | A interface oferece `Excluir`, mas executa um reversal confirmado e mantém a cadeia como `CANCELLED`                                                     | Preserva o ledger append-only e usa `ReverseJournalEntry`.                                | Sim, confirmado em 2026-09-03           |
| Local dos formulários                | `IncomeForm`, `ExpenseForm` e `TransferForm` pertencem a `features/transactions/components` e são abertos sobre a própria tela                           | Mantém o escopo unificado e permite reutilizar cada formulário em criação e edição.       | Sim, confirmado em 2026-09-03           |
| Apresentação dos formulários         | Um seletor de tipo abre um único formulário por vez em diálogo responsivo; a lista permanece como contexto de fundo                                      | Evita três formulários simultâneos e mantém todas as operações na mesma rota.             | Sim, confirmado em 2026-09-03           |
| Tipos listados                       | A consulta fixa `INCOME`, `EXPENSE` e `TRANSFER`; `OPENING_BALANCE` não aparece                                                                          | Corresponde ao escopo solicitado.                                                         | Sim, solicitação e contratos existentes |
| Cadeias editadas                     | Uma cadeia `EDITED` continua editável ou cancelável enquanto seu `presentedEntryId` for efetivo                                                          | O amendment cria um replacement efetivo e o comando já protege a concorrência por versão. | Sim, confirmado em 2026-09-03           |
| Mudança de tipo na edição            | A edição mantém o tipo apresentado e abre o formulário correspondente preenchido                                                                         | Reduz ambiguidade e evita converter semanticamente receita, despesa e transferência.      | Sim, confirmado em 2026-09-03           |
| Data do cancelamento                 | O diálogo inicia com a data local atual e aceita somente data igual ou posterior à ocorrência do lançamento apresentado                                  | É a restrição de `JournalEntry.createReversal`.                                           | Sim, domínio existente                  |
| Indicadores inspirados no template   | Os quatro cards mostram receitas, despesas, maior valor absoluto e quantidade apenas dos resultados carregados; os rótulos deixam esse recorte explícito | O read model é paginado e não fornece agregados globais.                                  | Sim, confirmado em 2026-09-03           |
| Status do template                   | `ACTIVE`, `EDITED` e `CANCELLED` substituem `completed`, `pending` e `failed`                                                                            | São os estados reais de `JournalChainListItem`.                                           | Sim, contrato existente                 |
| Detalhe na lista                     | A expansão da linha mostra contas/categorias ou origem/destino; ações operacionais ficam na mesma linha expandida                                        | Adapta a expansão do template aos dados existentes sem criar uma página paralela.         | Sim, confirmado em 2026-09-03           |
| Recarregamento após conflito         | A UI preserva o formulário, informa o conflito e recarrega a cadeia antes de permitir nova submissão                                                     | Evita sobrescrever alteração concorrente e usa `expectedVersion`.                         | Sim, confirmado em 2026-09-03           |
| Autenticação e rate limit            | N/A: a feature opera localmente dentro do livro ativo e não introduz endpoint remoto                                                                     | Não há fronteira HTTP ou identidade remota neste escopo.                                  | Sim, arquitetura existente              |
| Expiração de dados                   | N/A: transações e histórico não expiram                                                                                                                  | O ledger mantém histórico permanente.                                                     | Sim, domínio existente                  |
| Observabilidade adicional            | N/A: não serão criados logs, métricas ou tracing específicos                                                                                             | A feature não adiciona integração externa ou processo em background.                      | Sim, confirmado em 2026-09-03           |

**Open questions:** none; all ambiguities are resolved or logged as defaults above.

---

## User Stories

### P1: Consultar transações do livro ativo ⭐ MVP

**User Story**: Como pessoa que controla um livro financeiro, quero consultar receitas, despesas e transferências em uma única tela para entender e operar meu histórico.

**Why P1**: A lista consolidada é o ponto de entrada para todo o ciclo de vida.

**Acceptance Criteria**:

1. WHEN o usuário navegar para `/transactions` THEN o sistema SHALL renderizar a tela dentro de `ApplicationShell` e destacar `Transações` na sidebar. (`TXL-01`)
2. WHILE houver um livro ativo, o sistema SHALL consultar `ListJournalChains` com o `bookId` ativo, `types` iguais a `INCOME`, `EXPENSE` e `TRANSFER`, e `limit` igual a `20`. (`TXL-02`)
3. WHEN a consulta retornar uma cadeia THEN o sistema SHALL exibir uma linha com descrição, tipo, data de ocorrência, valor na moeda do lançamento, contexto financeiro e status da cadeia. (`TXL-03`)
4. WHEN a linha representar uma receita ou despesa THEN o sistema SHALL exibir a conta financeira e a categoria apresentadas pelo read model. (`TXL-04`)
5. WHEN a linha representar uma transferência THEN o sistema SHALL exibir `origem → destino` e não SHALL exigir categoria. (`TXL-05`)
6. WHEN o usuário expandir uma linha THEN o sistema SHALL mostrar os dados contextuais da cadeia e as ações permitidas sem navegar para outra rota. (`TXL-06`)
7. WHILE a consulta inicial estiver pendente, o sistema SHALL exibir um skeleton com a geometria da lista e `aria-busy="true"`. (`TXL-07`)
8. IF a consulta inicial falhar THEN o sistema SHALL exibir um alerta com a ação `Tentar novamente` e não SHALL apresentar a falha como lista vazia. (`TXL-08`)
9. IF a consulta retornar zero itens sem filtros ativos THEN o sistema SHALL exibir um empty state com a ação `Nova transação`. (`TXL-09`)
10. IF a consulta retornar zero itens com filtros ativos THEN o sistema SHALL exibir um empty state de filtro com a ação `Limpar filtros`. (`TXL-10`)

**Independent Test**: Abrir `/transactions` com um livro contendo os três tipos e verificar uma única lista com seus contextos, estados de carregamento, erro e vazio.

---

### P1: Criar receita, despesa e transferência ⭐ MVP

**User Story**: Como pessoa que registra sua movimentação financeira, quero escolher o tipo e preencher um formulário próprio para criar o lançamento correto.

**Why P1**: Sem criação, a tela não completa o primeiro estágio do ciclo de vida.

**Acceptance Criteria**:

1. WHEN o usuário acionar `Nova transação` THEN o sistema SHALL oferecer exatamente `Receita`, `Despesa` e `Transferência`. (`TXL-11`)
2. WHEN o usuário escolher um tipo THEN o sistema SHALL abrir o formulário dedicado correspondente sobre a tela `/transactions`. (`TXL-12`)
3. WHEN o formulário de receita ou despesa abrir THEN o sistema SHALL solicitar conta, categoria compatível com o tipo, valor, data e descrição. (`TXL-13`)
4. WHEN o formulário de transferência abrir THEN o sistema SHALL solicitar conta de origem, conta de destino, valor, data e descrição. (`TXL-14`)
5. WHILE um formulário estiver aberto, o sistema SHALL listar somente contas financeiras `ACTIVE` do livro e da moeda-base ativos. (`TXL-15`)
6. WHILE um formulário de receita ou despesa estiver aberto, o sistema SHALL listar somente categorias `ACTIVE` do livro e do tipo correspondente. (`TXL-16`)
7. IF valor não representar inteiro positivo de unidades menores entre `1` e `9223372036854775807` THEN o sistema SHALL impedir a submissão e exibir erro no campo de valor. (`TXL-17`)
8. IF data não representar uma data civil válida no formato `YYYY-MM-DD` ou descrição ficar vazia após `trim` THEN o sistema SHALL impedir a submissão e exibir erro no campo correspondente. (`TXL-18`)
9. IF a conta de origem for igual à conta de destino THEN o sistema SHALL impedir a transferência e exibir `Escolha contas diferentes.` no campo de destino. (`TXL-19`)
10. WHEN um formulário válido for submetido THEN o sistema SHALL enviar exatamente um `JournalEntryCommand` para receita ou despesa, ou exatamente um `TransferMoneyCommand` para transferência. (`TXL-20`)
11. WHILE uma criação estiver em andamento, o sistema SHALL desabilitar os controles de submissão, rejeitar uma segunda submissão concorrente e não SHALL repetir a mutation automaticamente. (`TXL-21`)
12. WHEN a criação concluir THEN o sistema SHALL fechar o formulário, atualizar a lista e invalidar saldos, extratos e insights afetados. (`TXL-22`)
13. IF a criação falhar THEN o sistema SHALL manter os valores preenchidos, reabilitar os controles e exibir uma mensagem traduzida sem fechar o formulário. (`TXL-23`)
14. IF faltar conta ou categoria necessária THEN o sistema SHALL substituir o formulário por uma orientação com link para criar o recurso ausente. (`TXL-24`)

**Independent Test**: Criar cada tipo com dados válidos, confirmar o comando exato e verificar o novo item e as projeções afetadas; repetir com cada validação e falha de serviço.

---

### P1: Editar uma transação sem perder histórico ⭐ MVP

**User Story**: Como pessoa que identificou um erro, quero corrigir a transação atual para manter os dados certos e o histórico auditável.

**Why P1**: Edição é parte explícita do ciclo de vida solicitado e deve respeitar o modelo append-only.

**Acceptance Criteria**:

1. WHILE uma cadeia tiver um lançamento apresentado efetivo e status `ACTIVE` ou `EDITED`, o sistema SHALL disponibilizar a ação `Editar`. (`TXL-25`)
2. WHEN o usuário escolher `Editar` THEN o sistema SHALL abrir o formulário do tipo apresentado preenchido com conta, categoria ou destino, valor, data e descrição atuais. (`TXL-26`)
3. WHEN uma edição válida for submetida THEN o sistema SHALL enviar `AmendJournalEntryCommand` com `bookId`, `presentedEntryId`, `presentedVersion` e um replacement do mesmo tipo. (`TXL-27`)
4. WHEN o amendment concluir THEN o sistema SHALL atualizar a cadeia para os valores do replacement, exibir status `EDITED` e manter o histórico original acessível. (`TXL-28`)
5. IF qualquer etapa do amendment falhar THEN o sistema SHALL preservar original, reversal, replacement, sequência e eventos no estado anterior à tentativa. (`TXL-29`)
6. IF o serviço retornar `OPTIMISTIC_CONCURRENCY_FAILURE` THEN o sistema SHALL manter o formulário aberto, informar que o lançamento mudou e recarregar a cadeia antes de liberar nova submissão. (`TXL-30`)
7. IF a cadeia estiver `CANCELLED` THEN o sistema SHALL ocultar ou desabilitar a ação `Editar`. (`TXL-31`)

**Independent Test**: Editar cada tipo, verificar o payload discriminado e confirmar que a lista apresenta o replacement enquanto o detalhe mantém original e reversal.

---

### P1: Excluir por cancelamento contábil ⭐ MVP

**User Story**: Como pessoa que não quer mais considerar uma transação, quero excluí-la da posição financeira sem apagar seu histórico.

**Why P1**: A ação completa o ciclo de vida e preserva as invariantes contábeis.

**Acceptance Criteria**:

1. WHILE uma cadeia tiver um lançamento apresentado efetivo e status `ACTIVE` ou `EDITED`, o sistema SHALL disponibilizar a ação `Excluir`. (`TXL-32`)
2. WHEN o usuário escolher `Excluir` THEN o sistema SHALL abrir confirmação que explique que a ação cancela o efeito financeiro e preserva o histórico. (`TXL-33`)
3. WHEN a confirmação abrir THEN o sistema SHALL preencher a data de cancelamento com a data civil local atual e permitir sua alteração. (`TXL-34`)
4. IF a data de cancelamento for anterior à data de ocorrência do lançamento apresentado THEN o sistema SHALL impedir a confirmação e exibir erro no campo de data. (`TXL-35`)
5. WHEN o usuário confirmar uma exclusão válida THEN o sistema SHALL enviar exatamente um `ReverseJournalEntryCommand` com `bookId`, `presentedEntryId`, `presentedVersion`, data e descrição de cancelamento. (`TXL-36`)
6. WHILE o cancelamento estiver em andamento, o sistema SHALL manter a linha visível, desabilitar nova confirmação e não SHALL remover o item de forma otimista. (`TXL-37`)
7. WHEN o cancelamento concluir THEN o sistema SHALL manter a cadeia na lista com status `CANCELLED`, atualizar os saldos e remover as ações `Editar` e `Excluir`. (`TXL-38`)
8. IF o cancelamento falhar THEN o sistema SHALL manter a cadeia efetiva, manter o diálogo aberto e exibir o erro sem perda de dados. (`TXL-39`)
9. IF o serviço retornar `OPTIMISTIC_CONCURRENCY_FAILURE` THEN o sistema SHALL impedir nova confirmação até recarregar a cadeia apresentada. (`TXL-40`)

**Independent Test**: Cancelar uma cadeia ativa e uma editada, confirmar o reversal e o estado final; provar que data inválida, conflito e falha não removem nem alteram a cadeia.

---

### P2: Filtrar e percorrer o histórico consolidado

**User Story**: Como pessoa com muitos lançamentos, quero encontrar transações por critérios financeiros para agir sobre a cadeia correta.

**Why P2**: Melhora a operação em livros com volume sem alterar o núcleo do ciclo de vida.

**Acceptance Criteria**:

1. WHEN o usuário informar uma busca THEN o sistema SHALL consultar o journal pela busca normalizada em descrição, conta e categoria suportada pelo read model. (`TXL-41`)
2. WHEN o usuário escolher filtros THEN o sistema SHALL oferecer período, tipo, status, conta e categoria usando os valores do livro ativo. (`TXL-42`)
3. WHEN um filtro suportado pelo query contract mudar THEN o sistema SHALL reiniciar o cursor e consultar a primeira página com os filtros selecionados. (`TXL-43`)
4. WHEN o status selecionado mudar THEN o sistema SHALL filtrar os itens carregados por `ACTIVE`, `EDITED` ou `CANCELLED` e SHALL informar que o recorte se limita aos resultados carregados. (`TXL-44`)
5. WHEN `nextCursor` não for nulo e o usuário acionar `Carregar mais` THEN o sistema SHALL anexar a próxima página sem duplicar `chainId` e preservar os filtros. (`TXL-45`)
6. IF o cursor for rejeitado por mudança de filtros THEN o sistema SHALL descartar o cursor, manter os filtros visíveis e recarregar a primeira página. (`TXL-46`)

**Independent Test**: Combinar filtros, avançar duas páginas e verificar parâmetros, reinício do cursor, deduplicação e recuperação de cursor incompatível.

---

### P2: Adaptar a referência visual sem falsear dados

**User Story**: Como pessoa usuária do My Fin, quero uma tela densa, responsiva e consistente para interpretar e operar transações com clareza.

**Why P2**: A referência define a hierarquia visual, mas precisa refletir os contratos reais do produto.

**Acceptance Criteria**:

1. WHEN a tela tiver resultados carregados THEN o sistema SHALL exibir cards de receitas, despesas, maior valor absoluto e quantidade calculados somente sobre os itens carregados após os filtros locais. (`TXL-47`)
2. WHILE os cards representarem um conjunto parcial paginado, o sistema SHALL rotulá-los como `resultados carregados`. (`TXL-48`)
3. WHEN um valor for exibido THEN o sistema SHALL usar a moeda do lançamento e sinal positivo para receita, negativo para despesa e direção neutra para transferência. (`TXL-49`)
4. WHILE a largura for menor que `640px`, o sistema SHALL apresentar filtros e ações em largura total e SHALL preservar acesso a descrição, valor, data, status e expansão sem rolagem horizontal obrigatória. (`TXL-50`)
5. WHILE a largura for igual ou maior que `1024px`, o sistema SHALL apresentar a lista em tabela com colunas de contexto, valor, data, status e ações. (`TXL-51`)
6. WHEN foco ou ativação ocorrer por teclado THEN o sistema SHALL permitir abrir a linha, escolher ações, preencher formulários e confirmar ou cancelar sem depender de hover. (`TXL-52`)
7. WHILE um diálogo de formulário ou confirmação estiver aberto, o sistema SHALL manter nome acessível, foco contido e retorno do foco ao acionador após fechar. (`TXL-53`)

**Independent Test**: Renderizar a tela em 375 px, 768 px e 1280 px; verificar hierarquia, campos essenciais, teclado, foco e cálculo explícito dos itens carregados.

---

## Edge Cases

- IF o livro ativo mudar THEN o sistema SHALL fechar qualquer formulário ou confirmação aberto, limpar seleção, filtros e cursores do livro anterior e consultar o novo livro. (`TXL-54`)
- IF uma conta ou categoria selecionada for arquivada antes da submissão THEN o sistema SHALL apresentar o erro do serviço e atualizar as opções antes de permitir nova tentativa. (`TXL-55`)
- IF uma conta ou categoria tiver sido renomeada THEN o sistema SHALL exibir o nome retornado pelo read model após a invalidação, sem alterar o identificador enviado ao comando. (`TXL-56`)
- IF uma transferência não tiver duas contas financeiras ativas e distintas disponíveis THEN o sistema SHALL bloquear o formulário e oferecer acesso à criação de conta. (`TXL-57`)
- IF uma mutation for resolvida depois de o livro ativo mudar THEN o sistema SHALL atualizar somente caches identificados pelo `bookId` do comando e não SHALL inserir o resultado na tela do novo livro. (`TXL-58`)
- IF a invalidação de uma projeção falhar após a mutation concluir THEN o sistema SHALL manter o sucesso da mutation, sinalizar que os dados precisam ser recarregados e oferecer nova consulta. (`TXL-59`)

## Implicit-Requirement Dimensions

| Dimension                                | Resolution                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Input validation & bounds                | `TXL-15` a `TXL-19`, `TXL-35` e `TXL-55` definem opções, limites e validações.                                                    |
| Failure / partial-failure states         | `TXL-08`, `TXL-23`, `TXL-29`, `TXL-39` e `TXL-59` definem falha inicial, falha de mutation e consistência atômica.                |
| Idempotency / retry / duplicate handling | `TXL-21`, `TXL-37` e `TXL-45` impedem duplicidade de commands e itens.                                                            |
| Auth boundaries & rate limits            | N/A porque a feature é local-first, restrita ao livro ativo e não cria endpoint remoto.                                           |
| Concurrency / ordering                   | `TXL-27`, `TXL-30`, `TXL-36`, `TXL-40`, `TXL-43` e `TXL-46` cobrem versão otimista e cursores.                                    |
| Data lifecycle / expiry                  | `TXL-28` e `TXL-38` preservam o histórico; N/A para expiração porque o ledger não possui TTL.                                     |
| Observability                            | N/A porque não há dependência externa ou processo em background novo; erros permanecem visíveis na UI.                            |
| External-dependency failure              | N/A porque a feature consome apenas os serviços locais existentes; falhas desses serviços estão em `TXL-08`, `TXL-23` e `TXL-39`. |
| State-transition integrity               | `TXL-25` a `TXL-40` definem os estados editável, cancelável e terminal.                                                           |

## Requirement Traceability

| Requirement ID | Story                                 | Phase  | Status  |
| -------------- | ------------------------------------- | ------ | ------- |
| TXL-01         | P1: Consultar transações              | Design | Pending |
| TXL-02         | P1: Consultar transações              | Design | Pending |
| TXL-03         | P1: Consultar transações              | Design | Pending |
| TXL-04         | P1: Consultar transações              | Design | Pending |
| TXL-05         | P1: Consultar transações              | Design | Pending |
| TXL-06         | P1: Consultar transações              | Design | Pending |
| TXL-07         | P1: Consultar transações              | Design | Pending |
| TXL-08         | P1: Consultar transações              | Design | Pending |
| TXL-09         | P1: Consultar transações              | Design | Pending |
| TXL-10         | P1: Consultar transações              | Design | Pending |
| TXL-11         | P1: Criar transações                  | Design | Pending |
| TXL-12         | P1: Criar transações                  | Design | Pending |
| TXL-13         | P1: Criar transações                  | Design | Pending |
| TXL-14         | P1: Criar transações                  | Design | Pending |
| TXL-15         | P1: Criar transações                  | Design | Pending |
| TXL-16         | P1: Criar transações                  | Design | Pending |
| TXL-17         | P1: Criar transações                  | Design | Pending |
| TXL-18         | P1: Criar transações                  | Design | Pending |
| TXL-19         | P1: Criar transações                  | Design | Pending |
| TXL-20         | P1: Criar transações                  | Design | Pending |
| TXL-21         | P1: Criar transações                  | Design | Pending |
| TXL-22         | P1: Criar transações                  | Design | Pending |
| TXL-23         | P1: Criar transações                  | Design | Pending |
| TXL-24         | P1: Criar transações                  | Design | Pending |
| TXL-25         | P1: Editar transação                  | Design | Pending |
| TXL-26         | P1: Editar transação                  | Design | Pending |
| TXL-27         | P1: Editar transação                  | Design | Pending |
| TXL-28         | P1: Editar transação                  | Design | Pending |
| TXL-29         | P1: Editar transação                  | Design | Pending |
| TXL-30         | P1: Editar transação                  | Design | Pending |
| TXL-31         | P1: Editar transação                  | Design | Pending |
| TXL-32         | P1: Excluir transação                 | Design | Pending |
| TXL-33         | P1: Excluir transação                 | Design | Pending |
| TXL-34         | P1: Excluir transação                 | Design | Pending |
| TXL-35         | P1: Excluir transação                 | Design | Pending |
| TXL-36         | P1: Excluir transação                 | Design | Pending |
| TXL-37         | P1: Excluir transação                 | Design | Pending |
| TXL-38         | P1: Excluir transação                 | Design | Pending |
| TXL-39         | P1: Excluir transação                 | Design | Pending |
| TXL-40         | P1: Excluir transação                 | Design | Pending |
| TXL-41         | P2: Filtrar histórico                 | Design | Pending |
| TXL-42         | P2: Filtrar histórico                 | Design | Pending |
| TXL-43         | P2: Filtrar histórico                 | Design | Pending |
| TXL-44         | P2: Filtrar histórico                 | Design | Pending |
| TXL-45         | P2: Filtrar histórico                 | Design | Pending |
| TXL-46         | P2: Filtrar histórico                 | Design | Pending |
| TXL-47         | P2: Adaptar referência visual         | Design | Pending |
| TXL-48         | P2: Adaptar referência visual         | Design | Pending |
| TXL-49         | P2: Adaptar referência visual         | Design | Pending |
| TXL-50         | P2: Adaptar referência visual         | Design | Pending |
| TXL-51         | P2: Adaptar referência visual         | Design | Pending |
| TXL-52         | P2: Adaptar referência visual         | Design | Pending |
| TXL-53         | P2: Adaptar referência visual         | Design | Pending |
| TXL-54         | Edge case: livro ativo                | Design | Pending |
| TXL-55         | Edge case: recurso arquivado          | Design | Pending |
| TXL-56         | Edge case: recurso renomeado          | Design | Pending |
| TXL-57         | Edge case: transferência indisponível | Design | Pending |
| TXL-58         | Edge case: mutation tardia            | Design | Pending |
| TXL-59         | Edge case: invalidação parcial        | Design | Pending |

**Coverage:** 59 requisitos no total, 0 mapeados para tasks e 59 pendentes de Design.

## Success Criteria

- [ ] Receita, despesa e transferência podem ser criadas em `/transactions` usando os casos de uso existentes.
- [ ] Uma cadeia efetiva pode ser corrigida e cancelada sem mutação ou exclusão física do histórico.
- [ ] Cada mutation atualiza a lista e todas as projeções financeiras afetadas sem duplicidade de command.
- [ ] A tela distingue carregamento, erro, vazio sem filtros e vazio com filtros.
- [ ] A experiência funciona por teclado e nos breakpoints de 375 px, 768 px e 1280 px.
- [ ] Todos os 59 requisitos possuem testes derivados dos outcomes definidos antes da implementação correspondente.
