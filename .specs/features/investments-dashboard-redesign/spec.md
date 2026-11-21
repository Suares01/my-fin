# Redesign do painel de investimentos

## Problem Statement

A página principal de investimentos dilui as informações de acompanhamento entre muitos cards equivalentes e coloca cadastros administrativos antes das posições. O redesign deve tornar o patrimônio investido, seu custo e a qualidade das avaliações imediatamente compreensíveis, sem alterar o domínio financeiro nem calcular totais a partir da paginação.

## Goals

- [ ] Priorizar o patrimônio em investimentos, o custo alocado e o resultado não realizado.
- [ ] Tornar posições, filtros e ações mais claros em janelas desktop redimensionáveis.
- [ ] Manter carteiras, instrumentos e classificação acessíveis fora do fluxo principal.
- [ ] Comunicar carregamento, falha, ausência de avaliação e dados desatualizados sem fabricar valores.

## Out of Scope

| Feature                                                                       | Reason                                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Rentabilidade percentual, série histórica ou performance ajustada por aportes | Os contratos atuais não fornecem metodologia nem série temporal suficiente.    |
| Gráfico de alocação por classe calculado no cliente                           | A lista de posições é paginada e não representa o universo completo.           |
| Nova biblioteca de componentes ou gráficos                                    | Os componentes atuais e barras CSS/SVG são suficientes para o escopo aprovado. |
| Alterações em comandos, lançamentos ou regras contábeis                       | O redesign é uma mudança de apresentação e interação.                          |

## Assumptions & Open Questions

| Assumption / decision                           | Chosen default                                                                                | Rationale                                                                                         | Confirmed? |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| Definição visual de patrimônio em investimentos | Soma de `investmentMarketValueMinor` e `investmentCashMinor`                                  | O total reúne posições avaliadas e caixa real das carteiras, preservando ambos no detalhamento.   | yes        |
| Tratamento de posições sem avaliação            | Mostrar o custo como base do valor atual e identificar explicitamente a ausência de avaliação | O read model usa `BOOK_COST` e não autoriza transformar esse valor em cotação.                    | yes        |
| Local dos cadastros auxiliares                  | Seção secundária recolhível no fim da página, acessível por “Gerenciar” no cabeçalho          | Mantém as funções disponíveis sem interromper o acompanhamento.                                   | yes        |
| Alocação por classe nesta entrega               | Não renderizar gráfico sem agregado completo                                                  | Somar a página carregada produziria uma distribuição incorreta.                                   | yes        |
| Dimensões implícitas restantes                  | N/A para este escopo                                                                          | Não há nova persistência, autenticação, concorrência, integração externa ou transição de domínio. | yes        |

**Open questions:** none - all resolved or logged above.

## User Stories

### P1: Compreender o patrimônio investido

**User Story**: As a pessoa que acompanha suas finanças, I want ver o patrimônio em investimentos e sua composição so that eu diferencie posições, caixa, custo e avaliação do patrimônio geral do livro.

**Why P1**: Esta é a informação central da página.

**Acceptance Criteria**:

1. The page SHALL mostrar “Patrimônio em investimentos” como `investmentMarketValueMinor + investmentCashMinor` na moeda-base do resumo.
2. The page SHALL mostrar `positionCostMinor`, `investmentCashMinor` e `unrealizedResultMinor` como métricas distintas.
3. The page SHALL mostrar `bookNetWorthMinor` e `marketNetWorthMinor` como referências do livro, visualmente secundárias ao patrimônio em investimentos.
4. WHILE alguma posição aberta usa `BOOK_COST`, the page SHALL informar quantas posições têm avaliação e que as demais usam custo.
5. WHILE todas as posições abertas têm avaliação, the page SHALL informar a cobertura completa e o intervalo de datas usado.
6. IF a atualização do resumo falhar com dados em cache, THEN the page SHALL preservar os valores e identificá-los como anteriores.
7. IF o resumo não puder ser carregado, THEN the page SHALL mostrar falha e nova tentativa sem substituir valores por zero.

**Independent Test**: Renderizar o resumo com cobertura completa, parcial, ausente e falha, verificando valores e mensagens exatas.

### P1: Acompanhar e operar posições

**User Story**: As a pessoa que mantém investimentos, I want filtrar e operar posições em uma lista legível so that eu encontre o ativo certo sem interpretar uma tabela excessivamente larga.

**Why P1**: Posições são o principal fluxo recorrente da página.

**Acceptance Criteria**:

1. The position list SHALL manter filtros por busca, carteira, classe e estado ligados à consulta paginada existente.
2. The position list SHALL mostrar instrumento, rótulo, carteira, classe, quantidade, custo, valor atual, base da avaliação, estado e ações sem esconder fatos financeiros.
3. WHILE a posição usa `VALUATION`, the position list SHALL mostrar o resultado não realizado da posição como valor atual menos custo, sem percentual.
4. WHILE a posição usa `BOOK_COST`, the position list SHALL identificar “Sem avaliação atual; usando custo” e não apresentar resultado como lucro zero.
5. IF a posição não tem quantidade, THEN the position list SHALL mostrar “Desconhecida”.
6. WHEN a janela tiver 360 px de largura, THEN the position list SHALL reorganizar cada posição sem causar overflow horizontal na página.
7. WHEN houver outra página, THEN the position list SHALL manter a ação “Carregar mais” e seu estado de carregamento.

**Independent Test**: Filtrar posições, abrir o menu por teclado e comparar as representações avaliadas, sem avaliação e encerradas.

### P1: Manter ações e cadastros acessíveis

**User Story**: As a pessoa que organiza investimentos, I want acessar cadastro e gerenciamento sem que essas funções dominem a página so that o acompanhamento permaneça prioritário.

**Why P1**: O redesign não pode remover capacidades existentes.

**Acceptance Criteria**:

1. The page SHALL oferecer “Novo investimento” como ação principal do cabeçalho.
2. WHEN a pessoa acionar “Gerenciar”, THEN the page SHALL expandir e levar o foco visual à seção de carteiras, instrumentos e contas a classificar.
3. The management section SHALL preservar criação, configuração, arquivamento e reativação de carteiras e instrumentos.
4. The page SHALL mostrar as posições antes da seção de gerenciamento.
5. IF carteiras, instrumentos ou posições estiverem carregando, vazios ou com falha, THEN each section SHALL mostrar um estado específico e uma ação aplicável.

**Independent Test**: Abrir a seção secundária, acionar cadastros e confirmar que os drawers e o retorno de foco continuam funcionando.

## Edge Cases

- IF `investmentCashMinor` for negativo, THEN the page SHALL preservar o valor e mostrar o aviso de inconsistência existente.
- IF não houver carteiras nem posições, THEN the page SHALL mostrar uma orientação para cadastrar a primeira carteira.
- IF a avaliação tiver falhado durante uma atualização, THEN the page SHALL manter os dados anteriores visíveis.
- WHEN a janela tiver 800 px ou 1280 px de largura, THEN the page SHALL manter hierarquia e ações sem overflow do documento.

## Future Read Model Contract: Allocation by Asset Class

O gráfico só deve ser habilitado quando `InvestmentPortfolioSummary` fornecer um agregado completo e consistente com o mesmo `bookId`, `currency` e `asOf` do resumo:

```ts
interface InvestmentAssetClassAllocation {
  readonly totalCurrentValueMinor: string
  readonly items: readonly {
    readonly assetClass: string
    readonly positionCostMinor: string
    readonly currentValueMinor: string
    readonly openPositionCount: number
    readonly valuedPositionCount: number
  }[]
}
```

`currentValueMinor` deve somar o valor corrente consolidado de todas as posições abertas da classe, respeitando `VALUATION` ou `BOOK_COST` de cada posição. O agregado não inclui caixa das carteiras e não pode ser produzido a partir de `ListInvestmentPositionsQuery`. A interface deve ordenar as classes por valor corrente, usar barras horizontais com rótulos diretos e informar a cobertura das avaliações.

## Requirement Traceability

| Requirement ID | Story                               | Status       |
| -------------- | ----------------------------------- | ------------ |
| IDR-01         | Compreender o patrimônio investido  | Implementing |
| IDR-02         | Acompanhar e operar posições        | Implementing |
| IDR-03         | Manter ações e cadastros acessíveis | Implementing |
| IDR-04         | Estados e responsividade            | Implementing |
| IDR-05         | Contrato futuro de alocação         | Verified     |

**Coverage:** 5 total, 5 mapped, 0 unmapped.

## Success Criteria

- [ ] A primeira viewport prioriza patrimônio em investimentos, custo, resultado e qualidade da avaliação.
- [ ] Posições e ações permanecem utilizáveis por teclado em 360, 800 e 1280 px.
- [ ] Nenhum total financeiro é derivado da página de posições.
- [ ] Testes focados, suíte React, typecheck, lint e build passam sem regressões.
