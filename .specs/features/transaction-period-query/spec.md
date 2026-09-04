# Consulta mensal de transacoes Specification

## Problem Statement

A tela de transacoes carrega apenas uma pagina de 20 cadeias e exige cursor para
acessar o restante do historico. A consulta deve carregar todas as transacoes
do periodo corrente, sem expor ainda a escolha de periodo ao usuario.

## Goals

- [ ] Retornar todas as cadeias de transacao do periodo solicitado, sem cursor.
- [ ] Usar o mes-calendario atual no fuso do livro quando nenhum periodo for informado.
- [ ] Manter os filtros de busca, tipo, conta e categoria, sem controles visuais de data.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Seletor visual de periodo | O usuario solicitou que o filtro permanecesse oculto por enquanto. |
| Alterar extratos e ListJournalEntries | Essas consultas continuam com contrato paginado proprio. |
| Limitar silenciosamente meses grandes | O requisito exige todas as transacoes do periodo. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Semantica de mes atual | Primeiro ao ultimo dia do mes no fuso IANA do livro, inclusive datas futuras ja lancadas | E a leitura literal de mes-calendario e evita depender do fuso do dispositivo | y |
| Atualizacao apos a virada do mes | A proxima montagem ou invalidacao da consulta calcula o novo periodo | A solicitacao nao inclui mecanismo de atualizacao em tempo real | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Consultar todas as transacoes mensais ⭐ MVP

**User Story**: Como usuario de um livro financeiro, quero ver todas as minhas
transacoes do mes atual para analisar o periodo sem carregar paginas extras.

**Why P1**: A pagina deve representar o periodo completo por padrao.

**Acceptance Criteria**:

1. WHEN a consulta de cadeias recebe `from` e `to` validos THEN o sistema SHALL retornar todas as cadeias consolidadas cuja data apresentada esteja inclusivamente nesse intervalo, em ordem decrescente de data e sequencia. <!-- event-driven -->
2. WHEN a consulta de cadeias nao recebe periodo THEN o sistema SHALL consultar do primeiro ao ultimo dia do mes que contem `Clock.localDate(book.timezone)`. <!-- event-driven -->
3. The sistema SHALL retornar a lista sem `limit`, `cursor`, `nextCursor` ou qualquer continuacao de pagina. <!-- ubiquitous -->
4. WHILE filtros de texto, tipo, conta ou categoria estiverem presentes THEN o sistema SHALL aplica-los junto com o periodo sem alterar a semantica de cadeia consolidada. <!-- state-driven -->
5. IF o livro nao existir ou o periodo for invalido THEN o sistema SHALL retornar o erro de aplicacao atual antes de executar a consulta SQLite. <!-- unwanted-behavior -->

**Independent Test**: Consultar um livro com mais de duas cadeias no mes e
confirmar que todas sao retornadas em uma unica resposta, sem cursor.

### P1: Carregar a lista sem paginacao

**User Story**: Como usuario da tela de transacoes, quero que a interface
busque uma unica lista para que nao haja fluxo de carregar mais resultados.

**Why P1**: A interface deve refletir o novo contrato local.

**Acceptance Criteria**:

1. WHEN a tela possui um livro ativo THEN o hook SHALL executar uma unica consulta sem `limit` ou `cursor` e disponibilizar os itens retornados. <!-- event-driven -->
2. The hook SHALL manter a chave de cache limitada ao livro e aos filtros de servidor, incluindo o periodo quando ele for fornecido. <!-- ubiquitous -->
3. The interface SHALL not render a controle de periodo enquanto o filtro permanecer interno. <!-- ubiquitous -->

**Independent Test**: Montar o hook com livro ativo e confirmar uma unica chamada
sem cursor, com os itens da resposta expostos diretamente.

## Edge Cases

- WHEN the current date is in February of a leap year THEN the default upper boundary SHALL be February 29.
- IF only one date boundary is supplied THEN the system SHALL reject the query as `INVALID_QUERY` before reading the SQLite port.
- WHEN no chain matches the period THEN the system SHALL return an empty list.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| TPQ-01 | P1: Consultar todas as transacoes mensais | Application | Verified |
| TPQ-02 | P1: Consultar todas as transacoes mensais | Application | Verified |
| TPQ-03 | P1: Consultar todas as transacoes mensais | Application | Verified |
| TPQ-04 | P1: Consultar todas as transacoes mensais | Application | Verified |
| TPQ-05 | P1: Consultar todas as transacoes mensais | Application | Verified |
| TPQ-06 | P1: Carregar a lista sem paginacao | React | Verified |
| TPQ-07 | P1: Carregar a lista sem paginacao | React | Verified |
| TPQ-08 | P1: Carregar a lista sem paginacao | React | Verified |

**Coverage:** 8 total, 8 mapped to implementation.

## Success Criteria

- [ ] A consulta mensal devolve todas as cadeias do periodo em uma resposta.
- [ ] A tela nao possui estado ou chamada de proxima pagina.
