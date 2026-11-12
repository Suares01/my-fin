# Fluxo progressivo de cadastro de investimentos

## Problem Statement

O cadastro atual apresenta todas as decisões de abertura ao mesmo tempo e mistura dados essenciais, termos avançados e efeitos contábeis. O novo fluxo deve permitir que uma pessoa sem vocabulário financeiro registre uma posição existente ou uma nova compra em etapas curtas, sem alterar os comandos e as invariantes contábeis de `investments-foundation`.

## Goals

- [ ] Exibir inicialmente apenas cenário, instrumento e carteira.
- [ ] Exigir uma revisão legível da prévia e dos efeitos contábeis antes de confirmar.
- [ ] Preservar rascunho, requestId, idempotência e recuperação de falhas.
- [ ] Manter as regras de custo, quantidade, caixa e saldo inicial sem inferências.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar comandos, entidades ou fórmulas financeiras | O domínio aprovado continua sendo a fonte de verdade. |
| Registrar avaliação junto com a abertura | Avaliação é um comando separado e não substitui custo. |
| Criar transferências, aportes ou saldos sem confirmação | Todo efeito patrimonial permanece explícito. |
| Adicionar biblioteca de formulário, componentes ou gráficos | RHF, Zod e `@workspace/ui` já cobrem o fluxo. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Etapas do fluxo | Escolha, posição, origem e revisão | É o fluxo aprovado na etapa de UX e reduz carga inicial. | y |
| Busca de instrumento | Busca local por nome, tipo, emissor e identificadores; criação abre no mesmo drawer e retorna ao rascunho | O read model já fornece o catálogo ativo completo. | y |
| Valor atual na abertura | Não exibir campo; orientar registro posterior na posição | Impede a falsa expectativa de persistência de `valuationDisplay`. | y |
| Patrimônio ausente | Exigir confirmação dedicada do saldo inicial na revisão | O clique final sozinho não deve esconder um lançamento patrimonial. | y |
| Prévia indisponível | Bloquear confirmação final e oferecer nova tentativa | O usuário precisa revisar valores e efeitos antes de finalizar. | y |
| Campos avançados | Rótulo, descrição e termos de renda fixa ficam recolhidos | São opcionais e não devem atrasar o caso simples. | y |

**Open questions:** none - all resolved or logged above.

## User Stories

### P1: Cadastro progressivo

**User Story**: Como usuário, quero registrar o investimento em etapas curtas para informar apenas o necessário ao meu caso.

**Why P1**: Reduzir a carga cognitiva é o objetivo central do redesign.

**Acceptance Criteria**:

1. WHEN o formulário abrir THEN a UI SHALL exibir apenas cenário, busca de instrumento e carteira na primeira etapa. **IRF-01**
2. WHEN o usuário avançar ou voltar entre etapas THEN a UI SHALL preservar todos os valores já informados. **IRF-02**
3. WHEN o usuário buscar um instrumento THEN a UI SHALL filtrar os instrumentos ativos da moeda do livro por nome, tipo, emissor ou identificador. **IRF-03**
4. WHEN o usuário criar instrumento ou carteira dentro do fluxo THEN a UI SHALL retornar à primeira etapa com o cadastro criado selecionado e com o restante do rascunho preservado. **IRF-04**
5. WHEN o instrumento for STOCK, BDR, ETF, REAL_ESTATE_FUND, MUTUAL_FUND ou CRYPTO_ASSET THEN a UI SHALL exigir quantidade positiva em modo UNITS. **IRF-05**
6. WHEN o instrumento não exigir unidades THEN a UI SHALL permitir controle por valor ou por unidades sem inventar quantidade. **IRF-06**
7. WHEN o instrumento for de renda fixa THEN a UI SHALL manter termos parciais opcionais em uma seção avançada recolhida. **IRF-07**
8. WHEN o usuário abrir detalhes avançados THEN a UI SHALL oferecer somente rótulo, descrição aplicável e termos condicionais do instrumento. **IRF-08**

**Independent Test**: Abrir o formulário, escolher uma ação, criar um instrumento, voltar e concluir o cadastro sem redigitar os campos anteriores.

### P1: Origem contábil em linguagem simples

**User Story**: Como usuário, quero entender onde o investimento já aparece para não duplicar nem omitir patrimônio.

**Why P1**: A decisão altera ledger, caixa e patrimônio.

**Acceptance Criteria**:

1. WHEN o usuário escolher uma posição já existente contabilizada no caixa da carteira THEN a UI SHALL enviar `OpenInvestmentPosition` sem JournalEntry. **IRF-09**
2. WHEN o usuário escolher uma posição já existente contabilizada em outra conta THEN a UI SHALL enviar `OpenInvestmentPositionWithPurchase` como APPLICATION e EXTERNAL_ACCOUNT explícitos. **IRF-10**
3. WHEN o usuário declarar patrimônio ainda ausente THEN a UI SHALL apresentar o saldo inicial proposto como custo conhecido mais caixa real inicial e SHALL exigir confirmação dedicada antes de executar `SetInvestmentOpeningBalance`. **IRF-11**
4. IF a alocação falhar depois do saldo inicial confirmado THEN a UI SHALL preservar a confirmação e SHALL tentar apenas a alocação no retry. **IRF-12**
5. WHEN o usuário registrar nova compra ou aplicação THEN a UI SHALL enviar `OpenInvestmentPositionWithPurchase` como PURCHASE com INTERNAL_CASH ou EXTERNAL_ACCOUNT escolhidos explicitamente. **IRF-13**
6. IF uma conta externa for necessária e não estiver selecionada THEN a UI SHALL impedir o avanço e mostrar “Escolha a conta de origem.” no campo. **IRF-14**
7. IF o custo contábil estiver ausente ou inválido THEN a UI SHALL impedir o avanço com “Informe o custo contábil.” sem substituir o valor por avaliação. **IRF-15**
8. The UI SHALL omitir `valuationDisplay` do cadastro e SHALL informar que valor atual é registrado separadamente após a criação da posição. **IRF-16**

**Independent Test**: Executar os três caminhos de posição existente e os dois modos de financiamento de nova compra, verificando comandos e ausência de efeitos implícitos.

### P1: Revisão, erros e idempotência

**User Story**: Como usuário, quero revisar os efeitos e tentar novamente com segurança quando algo falhar.

**Why P1**: O cadastro pode produzir lançamentos contábeis e deve ser recuperável.

**Acceptance Criteria**:

1. WHEN todos os campos contextuais forem válidos THEN a UI SHALL apresentar uma etapa de revisão com cenário, instrumento, carteira, custo ou principal, quantidade aplicável, origem e data. **IRF-17**
2. WHEN a prévia retornar sucesso THEN a UI SHALL mostrar custo, fluxo líquido, caixa projetado, saldo inicial proposto aplicável, postings nomeados e avisos antes de habilitar a confirmação. **IRF-18**
3. IF a prévia estiver ausente, carregando ou falhar THEN a UI SHALL manter a confirmação final desabilitada e SHALL oferecer nova tentativa após falha. **IRF-19**
4. IF a submissão falhar THEN a UI SHALL preservar etapa e rascunho, anunciar o erro no formulário e manter o mesmo requestId para retry do mesmo intent. **IRF-20**
5. WHEN o usuário alterar o intent depois de uma falha THEN a UI SHALL usar o requestId correspondente ao novo intent sem reutilizar o anterior. **IRF-21**
6. WHILE uma submissão estiver pendente a UI SHALL bloquear navegação mutável e submissão duplicada. **IRF-22**
7. IF `OPENING_BALANCE_ALREADY_SET` ocorrer THEN a UI SHALL orientar a correção explícita do saldo inicial existente sem tentar a alocação. **IRF-23**
8. WHEN houver erros de validação THEN a UI SHALL manter erros junto aos campos e SHALL anunciar um resumo focável. **IRF-24**

**Independent Test**: Forçar falha, conferir campos e requestId preservados, corrigir o intent e concluir após uma nova prévia.

## Edge Cases

- IF não houver livro ativo THEN a UI SHALL manter o formulário indisponível com orientação para selecionar um livro. **IRF-25**
- IF a moeda do livro não carregar THEN a UI SHALL exibir estado recuperável sem assumir BRL para comandos. **IRF-26**
- WHEN custo zero for informado para posição existente com quantidade positiva THEN a UI SHALL permitir a abertura por unidades. **IRF-27**
- IF termos de renda fixa tiverem componentes incompletos ou datas invertidas THEN a UI SHALL impedir a revisão e explicar a correção. **IRF-28**
- WHEN a prévia indicar `INVESTMENT_CASH_NEGATIVE` THEN a UI SHALL mostrar aviso sem transformar o caso em erro destrutivo. **IRF-29**

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IRF-01 | Cadastro progressivo | Execute | Implementing |
| IRF-02 | Cadastro progressivo | Execute | Implementing |
| IRF-03 | Cadastro progressivo | Execute | Implementing |
| IRF-04 | Cadastro progressivo | Execute | Implementing |
| IRF-05 | Cadastro progressivo | Execute | Implementing |
| IRF-06 | Cadastro progressivo | Execute | Implementing |
| IRF-07 | Cadastro progressivo | Execute | Implementing |
| IRF-08 | Cadastro progressivo | Execute | Implementing |
| IRF-09 | Origem contábil | Execute | Implementing |
| IRF-10 | Origem contábil | Execute | Implementing |
| IRF-11 | Origem contábil | Execute | Implementing |
| IRF-12 | Origem contábil | Execute | Implementing |
| IRF-13 | Origem contábil | Execute | Implementing |
| IRF-14 | Origem contábil | Execute | Implementing |
| IRF-15 | Origem contábil | Execute | Implementing |
| IRF-16 | Origem contábil | Execute | Implementing |
| IRF-17 | Revisão e recuperação | Execute | Implementing |
| IRF-18 | Revisão e recuperação | Execute | Implementing |
| IRF-19 | Revisão e recuperação | Execute | Implementing |
| IRF-20 | Revisão e recuperação | Execute | Implementing |
| IRF-21 | Revisão e recuperação | Execute | Implementing |
| IRF-22 | Revisão e recuperação | Execute | Implementing |
| IRF-23 | Revisão e recuperação | Execute | Implementing |
| IRF-24 | Revisão e recuperação | Execute | Implementing |
| IRF-25 | Edge cases | Execute | Implementing |
| IRF-26 | Edge cases | Execute | Implementing |
| IRF-27 | Edge cases | Execute | Implementing |
| IRF-28 | Edge cases | Execute | Implementing |
| IRF-29 | Edge cases | Execute | Implementing |

**Coverage:** 29 total, 29 mapped to tasks, 0 unmapped.

## Success Criteria

- [ ] O caso “Já possuo” chega à revisão com no máximo cinco decisões essenciais antes da origem contábil.
- [ ] Nenhum caminho usa valor de mercado como custo ou cria lançamento implícito.
- [ ] Todos os 29 requisitos têm evidência automatizada ou UAT explícito.
