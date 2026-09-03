# Contexto do Ciclo de Vida de Transações e Transferências

**Gathered:** 2026-09-03
**Spec:** `.specs/features/transaction-lifecycle/spec.md`
**Status:** Ready for design

---

## Feature Boundary

A feature entrega uma tela unificada em `/transactions` para consultar, criar, editar e excluir funcionalmente receitas, despesas e transferências do livro ativo. Exclusão significa cancelamento por reversal. O histórico contábil permanece append-only.

---

## Implementation Decisions

### Tela, rota e navegação

- A rota canônica é `/transactions`.
- `app-routes.tsx` declara a rota dentro de `ApplicationShell`.
- `app-shell.tsx` adiciona `Transações` ao grupo `Visão Geral`; o breadcrumb continua derivado de `sidebarData`.
- A lista reúne apenas `INCOME`, `EXPENSE` e `TRANSFER`. `OPENING_BALANCE` não aparece.

### Formulários e criação

- `IncomeForm`, `ExpenseForm` e `TransferForm` pertencem a `apps/tauri/src/features/transactions/components/`.
- `Nova transação` apresenta exatamente os três tipos suportados.
- Um único formulário é aberto por vez em diálogo responsivo sobre `/transactions`.
- Receita e despesa usam conta financeira e categoria compatível. Transferência usa origem e destino financeiros distintos.
- A moeda vem do livro ativo; valor, data e descrição seguem as restrições existentes de domínio e aplicação.

### Consulta e apresentação

- A tela consome `ListJournalChains` e apresenta cadeias consolidadas, não journal entries técnicas isoladas.
- A consulta usa páginas de 20 itens, cursor opaco e deduplicação por `chainId`.
- A linha apresenta descrição, tipo, data, valor, contexto e status.
- A expansão da linha apresenta conta/categoria ou `origem → destino` e as ações do ciclo de vida.
- Os status visíveis são `ACTIVE`, `EDITED` e `CANCELLED`.
- Os cards de receita, despesa, maior valor absoluto e quantidade representam apenas os resultados carregados e recebem rótulo explícito desse recorte.
- Filtros suportados pelo query contract são aplicados no serviço. O status é aplicado somente aos resultados já carregados e essa limitação fica visível.

### Edição append-only

- `Editar` atua sobre `presentedEntryId` e `presentedVersion`.
- A UI abre o formulário do tipo apresentado com os valores atuais preenchidos.
- A edição mantém o tipo da transação.
- `AmendJournalEntry` cria reversal e replacement de forma atômica; a UI nunca edita postings diretamente.
- Cadeias `ACTIVE` e `EDITED` continuam editáveis enquanto o lançamento apresentado for efetivo.
- A cadeia passa a exibir o replacement, mantém o histórico e usa status `EDITED`.

### Exclusão por cancelamento

- A linguagem de ação na UI é `Excluir`.
- A confirmação explica que a operação cancela o efeito financeiro e preserva o histórico.
- A data inicia no dia civil local e não pode ser anterior à ocorrência apresentada.
- `ReverseJournalEntry` cria o reversal. Não existe exclusão física nem remoção otimista da linha.
- Após sucesso, a cadeia permanece visível como `CANCELLED` e perde as ações `Editar` e `Excluir`.

### Falhas, concorrência e cache

- Mutations não repetem automaticamente e rejeitam submissão concorrente do mesmo formulário.
- Falhas mantêm os valores e o formulário ou diálogo abertos.
- Conflito de versão preserva a edição, informa o usuário e exige recarregar a cadeia antes da próxima tentativa.
- Sucesso invalida a lista consolidada, saldos, extratos e insights afetados usando o `bookId` do comando.
- Trocar o livro ativo fecha overlays e limpa filtros, cursor e estado pertencentes ao livro anterior.

### Agent's Discretion

- Escolha dos ícones, variantes visuais e microcopy que não alterem os outcomes definidos na spec.
- Composição interna dos componentes e hooks, desde que permaneçam em `features/transactions` e consumam apenas os serviços públicos existentes.
- Técnica responsiva exata do diálogo, desde que preserve foco, teclado e a permanência na rota `/transactions`.

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma. Todos os defaults registrados na spec foram confirmados em 2026-09-03.

---

## Specific References

- `Suares01/open-coin`: comportamento dos formulários dedicados, mutations sem retry, invalidação de queries e manutenção append-only do journal.
- `abderrahimghazali/shadcn-fintech`: hierarquia visual de cards, filtros, tabela responsiva e expansão de linha.
- A referência visual é adaptada aos contratos do My Fin; exportação CSV, seleção em lote, merchant, comprovante e status remotos não são copiados.

---

## Deferred Ideas

- Agendamentos, recorrência e parcelamento.
- Importação ou exportação CSV e ações em lote.
- Anexos e comprovantes.
- Agregados globais independentes da paginação.
