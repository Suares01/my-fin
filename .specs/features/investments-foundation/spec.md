# Investimentos v1 Specification

**Feature:** investments-foundation
**Data:** 2026-09-10
**Complexidade:** Complex, novo domínio com persistência, operações contábeis e UI.
**Status:** Approved. Premissas A1–A14 e Design aprovados pelo usuário; Tasks elaboradas para revisão. Execute não iniciado.
**Contexto:** [context.md](./context.md). **Análise dos anexos e código:** [analysis.md](./analysis.md).

## Problem Statement

O usuário precisa acompanhar seus investimentos no My Fin e entender quanto tem para usar no dia a dia, quanto está investido e qual é seu patrimônio. Hoje ASSET/LIABILITY não distinguem a finalidade das contas; não existem posições, avaliações ou operações de investimento. Um aporte precisa continuar sendo transferência patrimonial, enquanto renda realizada, taxas e perdas precisam ter seu próprio significado.

## Goals

- [ ] Entregar uma tela funcional de investimentos operada manualmente, sem dependência de rede.
- [ ] Distinguir dinheiro disponível, caixa da carteira, custo alocado, valor avaliado e patrimônio líquido.
- [ ] Registrar aplicações, compras, vendas, resgates, rendimentos, amortizações, taxas e impostos com efeitos contábeis verificáveis.
- [ ] Preservar histórico, precisão monetária e dados existentes ao migrar.
- [ ] Expor contratos próprios reutilizáveis por uma futura camada de integração.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Pluggy/Open Finance, conexão, credenciais, mappings e sincronização | O usuário confirmou integração posterior. Preparar fronteiras não inclui implementá-la. |
| Cotações automáticas, cálculo diário de juros, previsão de resgate | V1 registra observações manuais; taxas são metadados. |
| Câmbio, posição em moeda diferente do livro e ledger multimoeda | Consolidação só na moeda-base; não somar moedas sem conversão. |
| IR, preço médio fiscal, FIFO/LIFO, lotes fiscais, come-cotas e relatórios tributários | Custo reduzido e valores pagos são informados pelo usuário. |
| Rentabilidade percentual, TWR, IRR, benchmarks, gráficos patrimoniais históricos | Ganho absoluto e histórico de observações não representam performance ajustada por fluxos. |
| Transferência de custódia, split, bonificação, subscrição, ajuste arbitrário de quantidade/custo | Exigem matrizes de efeitos próprias; não expor operações genéricas sem contrato. |
| Opções, futuros, alavancagem, short e margem | Posição e custo não negativos na v1. |
| Ordens pendentes e liquidação futura | Apenas fatos já efetivados; settledOn é informação histórica. |
| Recomendações, rebalanceamento e metas de caixinhas | Acompanhamento, não aconselhamento ou planejamento automático. |
| Reescrita do dashboard e reclassificação automática de transações antigas | Alterações de UI limitadas a investimentos e superfícies necessárias de contas/transações. |
| Reconciliação externa automática e preenchimento inventado de custo ausente | Exige dados externos independentes e política própria. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| A1: recorte da primeira entrega | Tela manual completa, incluindo manutenção e operações; sem integração/cotação automática | Entrega valor ao usuário antes da integração | Sim, aprovação explícita de todas as premissas |
| A2: dinheiro disponível | Somente BANK_ACCOUNT, PAYMENT_ACCOUNT e CASH; corretora/caixinhas separadas | Finalidade do saldo prevalece sobre liquidez do produto | Sim, aprovação explícita de todas as premissas |
| A3: nomenclatura patrimonial | Preservar GetNetWorth contábil e adicionar resumo de hoje no fuso do livro com valor avaliado bruto | Evita quebra silenciosa, dupla contagem e uso de lançamento futuro como caixa atual | Sim, aprovação explícita de todas as premissas |
| A4: política de avaliação | Bruto na consolidação; líquido e resgatável opcionais apenas no detalhe | Não misturar bases de avaliação entre posições | Sim, aprovação explícita de todas as premissas |
| A5: moedas | Instrumentos e valores na moeda-base do livro | Sem FX, um total multimoeda seria indefinido | Sim, aprovação explícita de todas as premissas |
| A6: custo de saída e despesas | Custo de alocação, não fiscal; taxas/impostos não capitalizados. Componentes da mesma liquidação integram uma operação; pagamento posterior independente usa FEE/TAX | Preserva principal, resultado bruto e líquido sem deduzir despesas duas vezes | Sim, aprovação explícita de todas as premissas |
| A7: classificação de contas antigas | OTHER_ASSET/OTHER_LIABILITY; excluir OTHER_ASSET do disponível até classificação manual | A migração não conhece a finalidade real | Sim, aprovação explícita de todas as premissas |
| A8: correções e ordenação | Corrigir a última operação efetiva invertendo deltas e postings persistidos; reversal e replacement coordenados em uma transação | Evita recalcular fatos antigos com regras novas ou alterar somente seu efeito contábil | Sim, aprovação explícita de todas as premissas |
| A9: fechamento | Saída que zera posição fecha automaticamente; reversão dessa saída pode reabrir de forma auditada | Torna venda total corrigível sem edição livre de estado | Sim, aprovação explícita de todas as premissas |
| A10: avaliações após operação | allocationRevision persistida, independente de version; avança uma vez por mudança econômica final confirmada. Avaliação de revisão anterior não retorna após cancelamento | Impede reaplicar valor da posição inteira à quantidade restante e reutilizar revisão antiga | Sim, aprovação explícita de todas as premissas |
| A11: caixa insuficiente | Permitir salvar registros válidos mesmo que criem ou agravem caixa negativo, com aviso de inconsistência | Permite registrar fatos antes de completar saldo inicial/aportes no aplicativo | Sim, aprovação explícita de todas as premissas |
| A12: posição existente | Distinguir saldo na carteira, saldo em outra conta e patrimônio ausente; reconhecer custo mais caixa real, nunca valuation. A alocação pode ser registrada antes de completar o ledger, com aviso | Evita duplicar patrimônio ou criar caixa fictício a partir de valorização | Sim, aprovação explícita de todas as premissas |
| A13: quantidades | Modo por quantidade obrigatório para STOCK, BDR, ETF, REAL_ESTATE_FUND, MUTUAL_FUND e CRYPTO_ASSET; opcional nos demais, fixado na abertura | Permite validar vendas parciais por unidades | Sim, aprovação explícita de todas as premissas |
| A14: dados incompletos | Custo informado é obrigatório; termos e valores opcionais ausentes continuam desconhecidos | Mercado/provento não fornece automaticamente custo contábil | Sim, aprovação explícita de todas as premissas |

**Open questions:** none — todas as premissas A1–A14 foram aceitas pelo usuário com “Aceito todas as premissas, inci design.md.”. Os comportamentos aprovados constituem a base do Design.

## Modelo e vocabulário normativos

Estes contratos descrevem comportamento; assinaturas finais, tabelas e arquivos serão definidos no Design.

| Conceito | Responsabilidade |
| --- | --- |
| FinancialBook | Fronteira de dados, moeda-base e fuso. |
| LedgerAccount + FinancialAccountProfile | Identidade única da conta, nome, tipo contábil, finalidade, instituição opcional e lifecycle/versionamento. |
| InvestmentAccountProfile | Especialização INVESTMENT_ACCOUNT com conta padrão de origem/destino opcional; mesmo LedgerAccountId. |
| InvestmentInstrument | Produto independente da custódia, com tipo, moeda, emissor e identificadores opcionais. |
| InvestmentPosition | Alocação em uma conta e instrumento, com custo, modo de quantidade, termos, status, version e allocationRevision persistida. |
| InvestmentOperation | Fato auditável com efeitos normalizados persistidos, datas occurredOn/recordedAt e vínculo opcional com lançamento. |
| InvestmentValuation | Observação imutável da posição inteira, com allocationRevision persistida, instante observado e instante registrado; não é cotação do instrumento. |

Tipos financeiros: BANK_ACCOUNT, PAYMENT_ACCOUNT, INVESTMENT_ACCOUNT, CASH, OTHER_ASSET mapeiam para ASSET; CREDIT_CARD e OTHER_LIABILITY mapeiam para LIABILITY. Somente INVESTMENT_ACCOUNT possui InvestmentAccountProfile. Categorias e contas de sistema não possuem perfil financeiro.

Tipos de instrumento e classe derivada:

| Classe | Tipos |
| --- | --- |
| FIXED_INCOME | CDB, RDB, LCI, LCA, LC, CRI, CRA, DEBENTURE, LF, LIG, TREASURY |
| EQUITY | STOCK, BDR |
| FUND | ETF, REAL_ESTATE_FUND, MUTUAL_FUND |
| PENSION | PGBL, VGBL |
| STRUCTURED | COE |
| CRYPTO | CRYPTO_ASSET |
| OTHER | OTHER |

Suporte a um tipo significa cadastro, avaliação e operações comuns desta spec. Não promete regras particulares de tributação, remuneração ou resgate daquele produto. Caixinha/cofrinho é o rótulo da posição; o tipo vem do produto informado.

### Valores e datas

Money permanece bigint no domínio e string inteira em DTOs. Valores monetários novos persistidos individualmente ficam entre -9.223.372.036.854.775.807 e +9.223.372.036.854.775.807 unidades menores; excluir o mínimo assimétrico de int64 permite reversão exata. Totais usam soma exata e não podem depender de SUM inteiro que transborde. Essa restrição não autoriza alterar postings legados.

Decimal usa string sem exponencial, sinal negativo opcional, ponto decimal, até 38 dígitos de precisão e 18 casas após normalização. `0010.5000 → 10.5`, `-0.00 → 0`. Precisão conta dígitos do coeficiente normalizado, ignorando zeros à esquerda; escala conta todas as casas fracionárias. Entradas canônicas têm até 80 caracteres antes da normalização. Quantidade e preço unitário são não negativos. UI converte a notação local antes de enviar o contrato canônico. Valor monetário total informado é autoritativo; quantidade × preço é informativo, sem arredondamento implícito para criar lançamentos.

Campos de nome/rótulo/emissor/instituição/referência de exibição aceitam até 120 caracteres após trim. Nome obrigatório: 1–120. Descrição de operação: 1–500. Identificador: 1–120; mercado: 1–40 quando presente; no máximo 20 identificadores por instrumento. Texto opcional vazio vira ausente. Comparações de nomes seguem a normalização existente; nome de instrumento não é chave única.

occurredOn/settledOn usam LocalDate. Data de operação não pode ser futura no fuso do livro. settledOn, quando informado, está entre occurredOn e hoje. O efeito no ledger ocorre em occurredOn, como no contrato atual; settledOn não agenda nem duplica lançamento. Instantes de avaliação são normalizados para UTC; recordedAt e ordem persistida são atribuídos pelo sistema. O usuário informa valuedAt, não pode informar um instante futuro.

### Fórmulas de apresentação

O novo resumo usa D=hoje no fuso do livro, calculado uma vez por consulta, e expõe essa data de referência. Saldos incluem postings com occurredOn≤D, preservando originais e reversões. A base de patrimônio contábil coincide com GetNetWorth(asOf=D); chamadas existentes sem asOf mantêm a semântica anterior. Isso não cria navegação patrimonial histórica nem altera lançamentos futuros já armazenados.

Para cada carteira, L é seu saldo contábil até D, C a soma do custo de posições abertas e V a soma do valor bruto vigente dessas posições, usando custo quando não houver avaliação aplicável:

```text
caixaDaCarteira = L - C
resultadoNaoRealizado = V - C
valorAvaliadoDaCarteira = L + (V - C) = caixaDaCarteira + V
patrimonioContabil = ativosContabeis - passivosContabeis
patrimonioAvaliado = patrimonioContabil + soma(resultadoNaoRealizado)
dinheiroDisponivel = soma(saldos de BANK_ACCOUNT, PAYMENT_ACCOUNT e CASH)
```

Saldos negativos conservam o sinal. Dívida de cartão entra nos passivos e no patrimônio; limite de crédito não entra no disponível. Contas arquivadas continuam compondo patrimônio; disponível considera apenas contas ativas. Saldos de contas de uso diário arquivadas aparecem como saldo fora do disponível. OTHER_ASSET aparece em “Outros ativos”, sem ser chamado de disponível. Filtros de lista não alteram totais do livro.

Após a migração, a UI orienta revisar a finalidade das contas antigas e explica que “Dinheiro disponível” exclui Outros ativos. OTHER_ASSET também é uma escolha legítima para um ativo que não é dinheiro de uso diário; o tipo isoladamente não prova cadastro incompleto. Reclassificar uma conta não gera journal nem reclassifica despesas históricas. Os saldos em Contas continuam contábeis e seu resumo recebe o rótulo “Patrimônio contábil” em vez do ambíguo “Saldo consolidado”; valor avaliado só aparece quando fornecido pela query específica.

Uma carteira com L=5.000 e C=5.100 tem caixa calculado -100. A UI apresenta inconsistência, não a corrige para zero. Não existe reconciliationGap calculável sem um valor independente de caixa observado; essa v1 não oferece tal métrica.

Caixa negativo não bloqueia abertura, compra, transferência, despesa ou correção manual válida. A consulta e o resultado de gravação identificam a carteira afetada, caixa calculado e aviso INVESTMENT_CASH_NEGATIVE. O resultado continua sendo sucesso; não exige segunda confirmação para salvar. Quantidade/custo negativos, valores inválidos, conflito de versão e erro de persistência continuam sendo falhas.

Na carteira e nos totais que a incluem, exibir “Valores calculados com inconsistências; revise saldos e aportes”, além do caixa negativo. Não excluir a carteira do patrimônio nem substituir seu caixa por zero. O valor avaliado segue a fórmula, mas não é apresentado sem o aviso de inconsistência. Registrar uma alocação de custo 10.000 com L=0 resulta em caixa=-10.000 e patrimônio contábil da carteira=0; com avaliação 11.500, o valor avaliado calculado é 1.500, acompanhado do aviso. Após reconhecer explicitamente os 10.000 ausentes, caixa=0 e valor avaliado=11.500. Não criar uma contrapartida fictícia para exibir 11.500 antes de completar o ledger.

O aviso de caixa negativo é derivado do estado atual de cada carteira e desaparece quando caixa≥0 após atualização. Isso não declara reconciliação externa nem comprova que todo histórico foi cadastrado. A mesma política vale para todas as carteiras envolvidas em uma transferência e para suas correções.

### Matriz de efeitos das operações

Valores abaixo são unidades monetárias; números positivos nos postings são débitos, negativos são créditos. I = conta de investimento; B = conta financeira externa selecionada; G = receita de ganho/rendimento; P = despesa de perda; F = categoria de taxas; T = categoria de impostos. Linhas da mesma conta são agregadas e postings zero são omitidos.

C = custo acrescentado/removido; R = recebimento bruto; f/t = taxas/impostos; N=R-f-t; g=R-C; Δq = unidades compradas/vendidas. Na venda N deve ser não negativo. `netCashFlow` descreve pagamento/recebimento pela posição, não a variação total do ledger da carteira. Campos de custo e fluxo têm valores explícitos, inclusive zero, quando aplicáveis.

| Operação | Delta de custo | Delta de quantidade | Postings | netCashFlow |
| --- | --- | --- | --- | --- |
| Abertura sobre saldo já contabilizado (OPENING_ALLOCATION) | +C | +q quando controlada | Nenhum | 0 |
| Compra/aplicação com caixa interno | +C | +Δq quando controlada | I=-(f+t), F=+f, T=+t; nenhum se f=t=0 | -(C+f+t) |
| Compra/aplicação com origem B | +C | +Δq quando controlada | B=-(C+f+t), I=+C, F=+f, T=+t | -(C+f+t) |
| Venda/resgate para caixa interno, g≥0 | -C | -Δq quando controlada | I=g-f-t, G=-g, F=+f, T=+t | +N |
| Venda/resgate para caixa interno, g<0 | -C | -Δq quando controlada | I=g-f-t, P=-g, F=+f, T=+t | +N |
| Venda/resgate direto para B | -C | -Δq quando controlada | Mesma composição acima, acrescentando I=-N e B=+N; I agregado=-C | +N |
| INCOME para caixa interno | 0 | 0/ausente | I=R-f-t, G=-R, F=+f, T=+t | +N |
| FEE paga pelo caixa interno | 0 | 0/ausente | I=-f, F=+f | -f |
| TAX pago pelo caixa interno | 0 | 0/ausente | I=-t, T=+t | -t |
| AMORTIZATION para caixa interno | -C | 0/ausente | Mesma composição de resultado da venda, com R recebido e C reduzido | +N |
| Transferência de dinheiro B↔I sem operação de posição | 0 | 0/ausente | Origem=-valor, destino=+valor | Não cria InvestmentOperation |
| Avaliação | 0 | 0/ausente | Nenhum | Não cria InvestmentOperation |

Compra/APPLICATION difere no nome de negócio, não na matemática. Na UI renda fixa usa “Aplicar / Resgatar”; produtos negociados usam “Comprar / Vender”. AMORTIZATION exige 0<C≤custo atual; em posição com quantidade, não altera unidades. INCOME/FEE/TAX têm valor estritamente positivo. Compra/aplicação tem C>0. Venda admite 0≤C≤custo atual, inclusive ativo de custo zero, e R≥0. Uma posição nova pode ter custo zero se tiver quantidade positiva; abertura por valor exige custo positivo.

Resultado realizado bruto = R-C. Resultado realizado líquido = R-C-f-t. A categoria de ganho recebe o resultado bruto positivo, nunca todo o recebimento R de uma venda; resultado bruto negativo usa a categoria de perda. Taxas/impostos recebem suas parcelas separadas. Categorias são exigidas apenas para parcelas não zero, devem ser gerenciadas, ativas e do mesmo livro. Nenhuma categoria é criada silenciosamente.

bookCost é custo contábil de alocação do My Fin, não custo fiscal: taxas e impostos de compra não são capitalizados. f/t representam apenas despesas liquidadas no próprio evento, não estimativas de encargos futuros. Componentes retidos na venda, resgate, amortização ou INCOME integram a mesma InvestmentOperation e seu único JournalEntry. Pagamento posterior independente usa FEE/TAX. A UI não gera operações FEE/TAX extras para componentes já incluídos; valores iguais em datas distintas, isoladamente, não provam duplicidade. INCOME usa C=0 e R bruto, N=R-f-t; não inferir bruto a partir do líquido. N deve ser não negativo também em INCOME e AMORTIZATION.

Todas as linhas de uma operação são um único JournalEntry quando houver postings. A soma deve ser zero e devem existir ao menos duas contas distintas. Venda ou amortização sem ganho/perda/taxas para caixa interno não cria lançamento de valor zero. Operação e posição ainda são persistidas. Em modo por quantidade, compra e venda exigem magnitude de quantidade estritamente positiva; em modo por valor, quantityDelta permanece ausente. INCOME/FEE/TAX/AMORTIZATION não alteram quantidade.

### Cadastro de patrimônio existente

O fluxo “Já possuo” distingue a origem contábil antes de escolher o comando:

| Origem | Ação explícita | Exemplo e efeito |
| --- | --- | --- |
| Saldo já está na carteira | OPENING_ALLOCATION sobre o saldo reconhecido; insuficiência produz aviso, não contrapartida automática | L=10.000; alocar custo 4.000 → L=10.000, custo=4.000, caixa=6.000; nenhum journal |
| Saldo está em outra conta | APPLICATION EXTERNAL_ACCOUNT; ou transferência explícita seguida de OPENING_ALLOCATION, sem executar ambos os caminhos para o mesmo aporte | Banco=10.000, I=0; aplicar 4.000 → banco=6.000, I=4.000, custo=4.000; patrimônio inalterado |
| Patrimônio ainda não consta no livro | SetOpeningBalance explícito contra a conta de sistema OPENING_BALANCE, depois OPENING_ALLOCATION | Banco=5.000, I=0; reconhecer investimento de custo 10.000 → patrimônio contábil=15.000; alocar não o aumenta novamente |

O saldo inicial representa custo das posições mais caixa real inicial. Se custo=10.000, caixa real=0 e avaliação=11.500, registrar saldo inicial 10.000 e custo 10.000; registrar 11.500 separadamente como avaliação. O resultado é caixa=0, patrimônio contábil da carteira=10.000 e avaliado=11.500. Com caixa real adicional de 500, saldo inicial=10.500, custo=10.000 e valor avaliado da carteira=12.000.

OpenInvestmentPosition não cria saldo inicial nem transferência como fallback. O caminho recomendado completa o ledger antes da alocação; por A11, o usuário pode registrar a alocação primeiro e corrigir o caixa negativo posteriormente, com aviso. Se falta custo conhecido, a abertura é rejeitada sem inferência de mercado. A UI permite informar custo e avaliação separadamente, preservando essas etapas explícitas.

SetOpeningBalance registra o valor do lançamento inicial; não é uma atribuição automática do saldo atual. Se já houver saldo inicial ativo, conservar OPENING_BALANCE_ALREADY_SET e oferecer acesso à correção explícita do lançamento existente. A correção considera o valor inicial já reconhecido, não reaplica o total como novo aporte. Transferências e outros movimentos posteriores não são substituídos pelo valor inicial informado. Se o saldo inicial confirmar e a alocação falhar, o saldo confirmado permanece como caixa não alocado; repetir a alocação não executa novamente SetOpeningBalance.

### Revisão econômica e inversão histórica

allocationRevision é inteiro positivo persistido na posição e em cada avaliação. A posição começa na revisão 1 após a abertura confirmada. version continua controlando concorrência do aggregate; seus incrementos não determinam revisões de avaliação.

A revisão avança exatamente uma unidade por comando confirmado cujo estado final de quantidade/bookCost difira do estado anterior ao comando. Em amendment, comparar o estado confirmado antes da correção com o estado final após inversão e substituição. Estados intermediários não são publicados nem recebem avaliações. Amendment apenas de descrição, data, taxas, destino ou bruto recebido, com mesma quantidade/custo final, conserva allocationRevision. A correção de data ainda revalida a elegibilidade temporal da avaliação prevista em INV-52.

Venda da revisão 1 para 2 seguida de cancelamento gera revisão 3, mesmo que quantidade/custo voltem aos números da revisão 1. A avaliação da revisão 1 não volta a ser atual. unitPrice de avaliação antiga não é reaplicado à nova quantidade; eventual InstrumentQuote pertence a outra feature.

A avaliação é gravada com a revisão vigente, validada atomicamente contra expectedAllocationRevision exibida ao usuário. Se uma venda confirmar enquanto o formulário estava aberto, o envio obsoleto falha e exige atualização, em vez de atribuir o valor antigo à revisão nova. Renomear a posição sem mudar sua alocação não torna essa avaliação obsoleta por si só.

Em posição com controle de unidades, a avaliação da posição inteira usa a quantidade corrente. Se uma quantidade opcional for informada no formulário de avaliação, ela deve ser igual à quantidade da revisão; divergência não é ajuste de posição. Em posição acompanhada por valor, quantidade/preço unitário não são solicitados na avaliação. Valores bruto, líquido e resgatável são observações independentes não negativas; a v1 não deduz imposto nem garante que o bruto seja imediatamente resgatável.

Operações preservam quantityDelta, bookCostDelta, grossAmount, fees, taxes, netCashFlow, modo de financiamento/liquidação, conta externa quando aplicável e journalEntryId quando existir. A reversão inverte os deltas assinados originais e cada posting persistido do journal original, preservando contas e moedas; não recalcula o original pela matriz vigente. Os montantes descritivos originais permanecem consultáveis. Os guards atuais de livro, integridade e concorrência ainda se aplicam à correção; caixa final negativo produz o aviso definido em A11.

Recompor o estado anterior à operação é etapa de cálculo e validação de quantidade/custo. Não é uma transação independente nem uma revalidação da regra histórica de caixa. O diagnóstico de caixa considera somente o estado final da unidade, não a reversão intermediária antes da substituição. OperationReversal.occurredOn é original.occurredOn; JournalReversal.occurredOn é a data do journal original; recordedAt é o instante real da correção. A substituição obedece à ordem efetiva anterior e ao limite de hoje.

### Transições e recuperação

| Situação | Comportamento |
| --- | --- |
| Posição por quantidade com q>0 e custo=0 | Continua OPEN; patrimônio avaliado depende de avaliação manual aplicável. |
| Saída com q=0 e custo=0, ou custo=0 no modo por valor | Fecha automaticamente. Não existe comando para zerar saldos remanescentes ao fechar. |
| Saída com q=0 e custo>0 | Rejeita; o usuário precisa corrigir o custo retirado. |
| AMORTIZATION reduz custo a zero mas q>0 | Permanece OPEN; amortização não remove as unidades. |
| Compra adicional em posição encerrada | Rejeita; abrir nova posição no mesmo instrumento é permitido. |
| Cancelamento de venda reabriria posição, mas conta/instrumento está arquivado | Rejeita até reativar os cadastros envolvidos; não cria posição aberta sob cadastro arquivado. |
| Erro em metadata de posição | Corrigir rótulo sem alterar custo, quantidade ou revisão de alocação. |
| Erro em termos imutáveis de contratação | Corrigir operações dependentes em ordem inversa, cancelar abertura e cadastrar a posição correta; preservar a posição cancelada no histórico. |

Contas e instrumentos arquivados permanecem disponíveis em consultas históricas. Os seletores de novos registros usam somente cadastros ativos; um formulário já aberto revalida essa condição na confirmação. A remoção de vínculo de liquidação pode ser explícita; não acontece silenciosamente durante arquivamento de conta.

### Fronteira da v1 manual

A moeda-base é a unidade de todos os valores monetários, inclusive custo zero e campos opcionais. Um livro USD permite registrar investimentos em USD; isso não autoriza consolidação entre livros USD e BRL. Não inferir câmbio nem usar BRL como fallback de livro vazio. A moeda de negociação informada no instrumento precisa coincidir com a do livro; localização da corretora e símbolo do ativo não determinam moeda.

Moeda, quantidade, principal e categorias são validados antes de confirmar. Termos desconhecidos continuam ausentes; rendimento estimado, nome de caixinha, vencimento e valor de mercado não preenchem custo. O formulário de saída diferencia “Custo da parte vendida/resgatada” e “Valor bruto recebido”. Em saída total, pode preencher o custo restante exato da posição; em saída parcial, exige o custo informado sem escolher preço médio/FIFO. Informar preço unitário não autoriza calcular automaticamente o custo fiscal ou reconciliar o bruto recebido.


## User Stories

### P1: S1 — Classificar contas e separar disponível de patrimônio

**User Story:** Como usuário, quero identificar a finalidade das minhas contas para saber o que posso usar no dia a dia.

**Why P1:** A distinção é uma motivação central da feature e permite migrar contas existentes.

**Acceptance Criteria**:
1. WHEN uma conta financeira for criada com um tipo da tabela normativa THEN o sistema SHALL derivar seu LedgerAccountKind conforme essa tabela. **INV-01**
2. The sistema SHALL preservar exclusivamente ASSET, LIABILITY, INCOME, EXPENSE e EQUITY em LedgerAccountKind. **INV-02**
3. IF um perfil financeiro for associado a categoria, EQUITY ou conta de sistema THEN o sistema SHALL rejeitar a associação com INVALID_FINANCIAL_ACCOUNT_PROFILE. **INV-03**
4. The sistema SHALL usar o mesmo LedgerAccountId e a mesma versão do aggregate para os perfis financeiro e de investimento. **INV-04**
5. WHEN a migração atingir uma conta ASSET não-system preexistente THEN o sistema SHALL atribuir OTHER_ASSET sem alterar seu saldo. **INV-05**
6. WHEN a migração atingir uma conta LIABILITY não-system preexistente THEN o sistema SHALL atribuir OTHER_LIABILITY sem alterar seu saldo. **INV-06**
7. WHEN o usuário reclassificar uma conta entre tipos compatíveis com o mesmo kind THEN o sistema SHALL preservar IDs, postings e histórico da conta. **INV-07**
8. IF a reclassificação mudar kind, retirar INVESTMENT_ACCOUNT de conta com qualquer posição histórica ou invalidar um vínculo ativo de liquidação THEN o sistema SHALL rejeitar a mudança com FINANCIAL_ACCOUNT_TYPE_CHANGE_NOT_ALLOWED. **INV-08**
9. WHEN o usuário consultar dinheiro disponível THEN o sistema SHALL somar somente BANK_ACCOUNT, PAYMENT_ACCOUNT e CASH ativas, preservando sinais. **INV-09**
10. WHEN existirem saldos em OTHER_ASSET ou contas de uso diário arquivadas THEN o sistema SHALL apresentá-los separadamente como valores fora do disponível. **INV-10**
11. WHEN apresentar contas OTHER_ASSET após migração THEN a UI SHALL explicar sua exclusão do disponível e permitir classificar sua finalidade sem gerar lançamentos. **INV-138**

**Independent Test:** Migrar um livro com banco 10.000, carteira 5.000 e cartão 1.000; antes da classificação disponível=0 com classificação pendente; após banco→BANK_ACCOUNT e carteira→INVESTMENT_ACCOUNT, disponível=10.000 e patrimônio contábil=14.000.

### P1: S2 — Manter carteiras, instrumentos e caixinhas

**User Story:** Como usuário, quero cadastrar produtos e posições em minhas carteiras, inclusive aplicações distintas do mesmo produto.

**Why P1:** Constitui o cadastro usado pelo acompanhamento manual.

**Acceptance Criteria**:
1. WHEN uma conta INVESTMENT_ACCOUNT for criada THEN o sistema SHALL aceitar instituição e conta padrão de liquidação ausentes. **INV-11**
2. IF a conta padrão de liquidação for a própria carteira, estiver inativa, for de outro livro ou não for BANK_ACCOUNT/PAYMENT_ACCOUNT THEN o sistema SHALL rejeitar o vínculo com INVALID_SETTLEMENT_ACCOUNT. **INV-12**
3. WHEN houver conta padrão de liquidação THEN a UI SHALL apenas pré-selecioná-la nos fluxos externos, exigindo envio explícito do modo e da conta efetivamente escolhidos. **INV-13**
4. WHEN o usuário cadastrar um instrumento sem posições e sem identificadores THEN o sistema SHALL persistir nome, tipo, moeda-base e emissor opcional com status ACTIVE. **INV-14**
5. The sistema SHALL derivar a classe do instrumento exclusivamente da tabela normativa de tipos. **INV-15**
6. IF um instrumento tiver moeda diferente da moeda-base do livro THEN o sistema SHALL rejeitá-lo com INVESTMENT_CURRENCY_MISMATCH. **INV-16**
7. WHEN identificadores forem informados THEN o sistema SHALL normalizar TICKER/ISIN e mercado com trim e maiúsculas, e REGISTRATION_NUMBER/OTHER com trim e preservação do conteúdo interno. **INV-17**
8. IF houver identificador equivalente repetido no mesmo livro THEN o sistema SHALL rejeitar a gravação com DUPLICATE_INSTRUMENT_IDENTIFIER, considerando ISIN sem mercado e os demais por scheme+valor normalizado+mercado normalizado ou vazio. **INV-18**
9. WHEN duas posições forem abertas para o mesmo instrumento na mesma carteira THEN o sistema SHALL mantê-las como posições distintas com IDs próprios. **INV-19**
10. The sistema SHALL preservar bookId, investmentAccountId, instrumentId e modo de quantidade da posição após sua abertura. **INV-20**
11. WHEN uma posição for aberta THEN o sistema SHALL aplicar a regra de quantidade e custo inicial definida na matriz, sem inferir quantidade ausente como zero. **INV-21**
12. WHEN o usuário informar renda fixa THEN o sistema SHALL aceitar termos parciais com PREFIXED(annualRate), INDEXED(index,indexPercentage) ou HYBRID(index,indexPercentage,annualSpreadRate). **INV-22**
13. IF termos de renda fixa forem usados fora de FIXED_INCOME, faltarem componentes da taxa escolhida ou datas presentes violarem issueDate≤gracePeriodDate≤maturityDate em qualquer par conhecido THEN o sistema SHALL rejeitar com INVALID_FIXED_INCOME_TERMS. **INV-23**
14. The sistema SHALL aceitar indexPercentage de 105 e taxas/spreads decimais não negativos, sem limitar percentuais a 100. **INV-24**
15. WHEN a data de vencimento passar THEN o sistema SHALL preservar a posição até uma operação de saída efetivamente registrada. **INV-25**
16. WHEN nome, emissor, identificadores ou rótulo forem editados THEN o sistema SHALL preservar os valores de operações anteriores; tipo/moeda do instrumento e termos da contratação tornam-se imutáveis após a primeira posição. **INV-26**

**Independent Test:** Cadastrar “CDB Banco ABC” e duas posições “Reserva” e “Viagem”, com 100% CDI e 105% CDI, datas diferentes e quantidade ausente; listar e recarregar ambas separadamente.

### P1: S3 — Registrar aplicações e alocar saldo existente

**User Story:** Como usuário, quero cadastrar o que já possuo ou registrar uma nova aplicação sem tratá-la como gasto.

**Why P1:** A primeira utilização precisa funcionar tanto para carteira existente quanto para novo aporte.

**Acceptance Criteria**:
1. WHEN o usuário escolher “Já possuo” com saldo já contabilizado na carteira THEN o sistema SHALL criar posição e OPENING_ALLOCATION sem criar JournalEntry. **INV-27**
2. WHEN o custo da abertura superar caixa contabilizado disponível para alocação THEN o sistema SHALL salvar a alocação válida com aviso INVESTMENT_CASH_NEGATIVE, sem inventar saldo inicial ou transferência. **INV-28**
3. WHEN o usuário registrar compra/aplicação com caixa interno THEN o sistema SHALL aplicar exatamente os deltas e postings da matriz, incluindo despesas apenas quando informadas. **INV-29**
4. WHEN o usuário registrar compra/aplicação financiada externamente THEN o sistema SHALL aplicar exatamente a linha externa da matriz em uma única operação. **INV-30**
5. WHEN o usuário apenas transferir dinheiro para uma carteira THEN o sistema SHALL alterar saldos entre contas sem criar posição, receita ou despesa. **INV-31**
6. WHEN um comando manual válido criar ou agravar caixa negativo THEN o sistema SHALL confirmar o registro com aviso de inconsistência, preservando as demais invariantes. **INV-32**
7. WHEN uma posição for criada junto de uma primeira aplicação THEN o sistema SHALL confirmar posição, operação e lançamento como uma única unidade persistida. **INV-33**
8. The sistema SHALL usar modo explícito INTERNAL_CASH ou EXTERNAL_ACCOUNT, sem interpretar conta ausente como autorização de financiamento externo. **INV-34**
9. WHEN o usuário escolher “Já possuo” THEN a UI SHALL distinguir saldo na carteira, saldo em outra conta e patrimônio ausente conforme a tabela de cadastro inicial. **INV-120**
10. IF faltar saldo para abrir uma posição THEN OpenInvestmentPosition SHALL excluir saldo inicial ou transferência implícitos de seus efeitos. **INV-121**
11. WHEN reconhecer patrimônio ausente no fluxo de investimento THEN o sistema SHALL contabilizar custo conhecido mais caixa real inicial, excluindo valorização informada. **INV-122**
12. IF o custo contábil não for conhecido THEN o sistema SHALL rejeitar a abertura com INVESTMENT_BOOK_COST_REQUIRED, sem usar avaliação como custo. **INV-123**
13. IF já existir saldo inicial ativo na carteira THEN o fluxo de cadastro SHALL preservar OPENING_BALANCE_ALREADY_SET e direcionar para correção explícita do saldo inicial existente. **INV-124**
14. IF a alocação falhar após confirmação explícita de saldo inicial THEN o sistema SHALL preservar esse saldo como caixa não alocado, sem repeti-lo ao tentar novamente a alocação. **INV-137**

**Independent Test:** Banco=10.000, carteira=0; aplicar 5.000 cria banco=5.000, carteira=5.000, posição=5.000 e despesa=0. Comprar internamente 500 após transferir mais 1.000 deixa carteira=6.000, custo=5.500 e caixa=500.

### P1: S4 — Registrar saídas e resultados realizados

**User Story:** Como usuário, quero registrar resgate ou venda, distinguindo principal, ganho/perda e despesas.

**Why P1:** Evita que todo resgate seja receita e que todo aporte seja despesa.

**Acceptance Criteria**:
1. WHEN uma venda/resgate for registrada THEN o sistema SHALL exigir custo contábil reduzido explícito, sem calcular política fiscal. **INV-35**
2. IF uma saída exceder custo ou quantidade atuais, tiver líquido negativo ou omitir quantidade em posição que a controla THEN o sistema SHALL rejeitar com INVALID_INVESTMENT_OPERATION. **INV-36**
3. WHEN uma venda/resgate for destinada ao caixa interno THEN o sistema SHALL aplicar os postings de resultado bruto, taxas e impostos definidos na matriz. **INV-37**
4. WHEN uma venda/resgate for destinada diretamente a conta externa válida THEN o sistema SHALL aplicar os postings combinados da matriz sem uma segunda transferência automática. **INV-38**
5. WHEN houver venda parcial THEN o sistema SHALL reduzir apenas o custo e as unidades explicitamente informados. **INV-39**
6. WHEN uma saída zerar custo e quantidade controlada, ou zerar custo em posição por valor THEN o sistema SHALL marcar CLOSED com closedOn=occurredOn. **INV-40**
7. IF uma saída zerar quantidade mas deixar custo positivo THEN o sistema SHALL rejeitar com INVALID_INVESTMENT_OPERATION. **INV-41**
8. WHEN houver INCOME, FEE, TAX ou AMORTIZATION THEN o sistema SHALL aplicar a respectiva linha normativa da matriz. **INV-42**
9. IF uma parcela não zero exigir categoria ausente, inativa, system, de outro livro ou com kind incorreto THEN o sistema SHALL rejeitar com INVALID_INVESTMENT_CATEGORY. **INV-43**
10. WHEN o ganho bruto for 100 e imposto 20 THEN o sistema SHALL apresentar ganho líquido 80, receita 100 e despesa 20. **INV-44**
11. WHEN uma venda ao caixa interno tiver bruto igual ao custo e nenhuma despesa THEN o sistema SHALL persistir a saída sem criar JournalEntry. **INV-45**
12. WHEN houver amortização em posição por quantidade THEN o sistema SHALL preservar unidades e reduzir apenas o custo informado. **INV-46**
13. WHEN uma compra tiver capital alocado 1.000, taxa 10 e imposto 5 THEN o sistema SHALL aumentar bookCost em exatamente 1.000, sem capitalizar os 15 de despesas. **INV-125**
14. WHEN taxas/impostos forem componentes liquidados da mesma operação THEN o sistema SHALL persistir suas despesas no journal dessa operação sem gerar operações FEE/TAX adicionais. **INV-126**
15. WHEN o usuário selecionar saída total THEN a UI SHALL preencher o custo restante da posição, mantendo a confirmação explícita do valor bruto recebido e das despesas. **INV-139**

**Independent Test:** CDB com custo 5.000, resgate bruto 5.100 e imposto 20 direto ao banco: banco +5.080, carteira -5.000, receita -100, imposto +20; soma dos postings=0, posição fechada, patrimônio +80.

### P1: S5 — Avaliar posições e entender patrimônio

**User Story:** Como usuário, quero registrar valores observados e comparar custo e patrimônio atual sem inventar renda realizada.

**Why P1:** Esta é a experiência principal de acompanhamento.

**Acceptance Criteria**:
1. WHEN uma avaliação manual for registrada THEN o sistema SHALL acrescentar observação histórica sem alterar custo, quantidade ou ledger. **INV-47**
2. IF bruto, líquido opcional, resgatável opcional ou preço unitário forem negativos, ou houver moeda divergente THEN o sistema SHALL rejeitar a avaliação com INVALID_INVESTMENT_VALUATION. **INV-48**
3. WHEN o usuário corrigir uma observação THEN o sistema SHALL acrescentar nova avaliação para o instante informado sem sobrescrever a anterior. **INV-49**
4. WHEN selecionar a avaliação vigente THEN o sistema SHALL escolher entre observações aplicáveis a maior tupla valuedAt, recordedAt e ordem persistida de registro. **INV-50**
5. WHEN custo ou quantidade final mudar por operação ou correção confirmada THEN o sistema SHALL deixar de usar avaliações de revisões anteriores no valor atual. **INV-51**
6. IF não houver avaliação da revisão atual com valuedAt na data ou após a última mudança de alocação THEN o sistema SHALL usar o custo com indicação “Sem avaliação atual; usando custo”. **INV-52**
7. WHEN a posição estiver CLOSED THEN o sistema SHALL atribuir zero ao valor atual consolidado, preservando avaliações no histórico. **INV-53**
8. WHEN houver avaliação bruta 5.200, líquida 5.180 e resgatável 3.000 para custo 5.000 THEN o sistema SHALL consolidar 5.200 e resultado não realizado 200. **INV-54**
9. WHEN consultar uma carteira THEN o sistema SHALL calcular caixa, custo, valor avaliado e resultado não realizado pelas fórmulas normativas. **INV-55**
10. WHEN consultar o patrimônio do livro THEN o sistema SHALL adicionar somente o resultado não realizado das carteiras ao patrimônio contábil. **INV-56**
11. The sistema SHALL preservar a semântica e os resultados de GetNetWorth, inclusive consultas contábeis asOf. **INV-57**
12. WHEN avaliações tiverem datas diferentes THEN o sistema SHALL exibir as datas e a cobertura de posições com avaliação atual, sem apresentar o total como cotação sincronizada. **INV-58**
13. WHEN líquido ou resgatável não forem informados THEN o sistema SHALL apresentá-los como desconhecidos, sem preencher com zero ou bruto. **INV-59**
14. WHEN caixa calculado for negativo THEN o sistema SHALL exibir o valor negativo e a mensagem “Saldo da carteira menor que o custo alocado; revise os registros”. **INV-60**
15. WHEN posição e avaliações forem persistidas e reconstruídas THEN o sistema SHALL preservar allocationRevision independentemente de version, iniciando a posição na revisão 1. **INV-127**
16. WHEN o estado final confirmado de quantidade/bookCost diferir do estado anterior ao comando THEN o sistema SHALL incrementar allocationRevision em exatamente 1, inclusive em cancelamento que restaure números de uma revisão antiga. **INV-128**
17. WHEN um amendment preservar quantidade/bookCost finais THEN o sistema SHALL conservar allocationRevision mesmo que altere metadados ou componentes financeiros da operação. **INV-129**
18. WHEN faltar avaliação aplicável à revisão atual THEN o sistema SHALL descartar unitPrice de revisão anterior como fonte automática de reavaliação. **INV-130**
19. IF expectedAllocationRevision do envio de avaliação diferir da revisão vigente na transação THEN o sistema SHALL rejeitar a observação com INVESTMENT_ALLOCATION_CHANGED sem persistir valuation. **INV-131**
20. WHEN gerar o novo resumo patrimonial THEN o sistema SHALL considerar somente postings com occurredOn até a data de referência de hoje no fuso do livro. **INV-140**
21. WHEN gerar o novo resumo patrimonial THEN o sistema SHALL expor uma única data de referência para seus saldos contábeis, disponível e caixa das carteiras. **INV-141**
22. IF uma avaliação informar quantidade diferente da posição na revisão declarada THEN o sistema SHALL rejeitar com INVALID_INVESTMENT_VALUATION sem alterar a posição. **INV-142**
23. WHEN o patrimônio avaliado incluir carteira com caixa negativo THEN a UI SHALL manter o total calculado pela fórmula e apresentar o aviso “Valores calculados com inconsistências; revise saldos e aportes”. **INV-146**
24. WHEN uma atualização tornar o caixa da carteira não negativo THEN a UI SHALL retirar o aviso de caixa negativo sem modificar operações históricas. **INV-147**

**Independent Test:** Carteira com ledger=10.000, custos 4.000+5.000 e avaliações 4.400+5.300: caixa=1.000 e valor=10.700. Após vender metade da primeira posição, sua avaliação anterior deixa de representar o saldo restante.

### P1: S6 — Corrigir com histórico e proteger o vínculo contábil

**User Story:** Como usuário, quero corrigir um registro errado mantendo posição e transações coerentes.

**Why P1:** Uma tela manual precisa de recuperação de erros desde a primeira entrega.

**Acceptance Criteria**:
1. WHEN uma operação for corrigida THEN o sistema SHALL preservar o original e acrescentar reversão e substituição vinculadas, aplicando efeito líquido uma única vez. **INV-61**
2. WHEN uma operação for cancelada THEN o sistema SHALL acrescentar reversão sem substituição e recompor o estado anterior da posição. **INV-62**
3. IF o alvo não for a última operação efetiva da posição, já estiver revertido/substituído ou for uma reversão THEN o sistema SHALL rejeitar com INVESTMENT_OPERATION_NOT_CORRECTABLE. **INV-63**
4. WHEN uma venda total for cancelada THEN o sistema SHALL reabrir a posição com o custo e quantidade anteriores e remover closedOn, registrando essa transição no histórico. **INV-64**
5. WHEN a operação corrigida possuir JournalEntry THEN o sistema SHALL corrigir seu efeito contábil na mesma transação da posição e da operação. **INV-65**
6. IF AmendJournalEntry ou ReverseJournalEntry genérico receber lançamento pertencente a uma operação de investimento THEN o sistema SHALL rejeitar com INVESTMENT_OPERATION_REQUIRED. **INV-66**
7. WHEN uma transação vinculada a investimento for exibida THEN a UI SHALL oferecer “Ver operação de investimento” como acesso à correção especializada. **INV-67**
8. WHEN reconstruir alocação THEN o sistema SHALL somar somente operações efetivas de negócio, excluindo originais substituídos/cancelados e registros de reversão. **INV-68**
9. WHEN calcular saldos contábeis THEN o sistema SHALL incluir todos os postings persistidos, inclusive originais e reversões, conforme o ledger existente. **INV-69**
10. WHEN uma correção válida retirar recursos já utilizados e deixar caixa negativo THEN o sistema SHALL confirmar a correção coordenada com aviso INVESTMENT_CASH_NEGATIVE. **INV-70**
11. WHEN o usuário cancelar a operação inicial sem operações efetivas posteriores THEN o sistema SHALL preservar a posição histórica com custo/quantidade zero e status CLOSED. **INV-71**
12. WHEN registrar operação posterior THEN o sistema SHALL exigir occurredOn igual ou posterior à data da última operação efetiva, ordenando empates por sequência persistida. **INV-72**
13. WHEN corrigir uma operação THEN o sistema SHALL datar a reversão contábil na data do original e validar a data da substituição contra a operação efetiva anterior; recordedAt preserva o momento real da correção. **INV-73**
14. WHEN uma operação for confirmada THEN o sistema SHALL persistir seus efeitos normalizados autoritativos conforme o contrato de inversão histórica. **INV-132**
15. WHEN cancelar ou substituir uma operação THEN o sistema SHALL inverter deltas assinados e postings originais persistidos, sem recalcular esses efeitos por regras atuais. **INV-133**
16. WHEN criar OperationReversal THEN o sistema SHALL usar occurredOn da operação original e recordedAt do momento real da correção. **INV-134**
17. WHEN apenas a operação substituta possuir efeito contábil THEN o sistema SHALL criar seu journal sem inventar journal de reversão para o original sem lançamento. **INV-135**
18. WHEN apenas a operação original possuir efeito contábil THEN o sistema SHALL reverter seu journal sem criar journal vazio para a operação substituta. **INV-136**

**Independent Test:** Comprar 10 unidades por 1.000, vender todas por 1.100 e cancelar a venda: quantidade=10, custo=1.000, OPEN, ganho realizado líquido acumulado=0; repetir cancelamento não cria efeitos adicionais.

### P1: S7 — Manter integridade, persistência e recuperação

**User Story:** Como usuário, quero que meus registros permaneçam exatos e consistentes após falhas, repetição de envio ou reinício.

**Why P1:** Cada operação pode alterar várias entidades financeiras.

**Acceptance Criteria**:
1. IF uma referência pertencer a outro livro THEN o sistema SHALL rejeitar o comando com BOOK_MISMATCH sem gravar alterações. **INV-74**
2. IF alguma gravação da unidade operação/posição/journal/idempotência falhar antes do commit THEN o sistema SHALL reverter todas as gravações dessa unidade. **INV-75**
3. IF expectedVersion não corresponder à versão atual de aggregate mutável THEN o sistema SHALL rejeitar com OPTIMISTIC_CONCURRENCY_FAILURE sem sobrescrever dados. **INV-76**
4. WHEN duas operações concorrentes consumirem o mesmo caixa ou quantidade THEN o sistema SHALL validar quantidade/custo dentro da transação e calcular os avisos de caixa sobre o estado resultante, preservando controle de versão. **INV-77**
5. WHEN um comando de abertura, operação, correção ou avaliação for repetido com mesmo bookId, requestId e conteúdo semântico THEN o sistema SHALL retornar os IDs/resultado previamente persistidos sem novos efeitos, mesmo com expectedVersion antigo. **INV-78**
6. IF um requestId já persistido for reutilizado com conteúdo semântico diferente THEN o sistema SHALL rejeitar com IDEMPOTENCY_CONFLICT. **INV-79**
7. WHEN a publicação de eventos falhar após o commit de investimento THEN o sistema SHALL preservar resultado consultável como salvo e impedir que retry duplique a operação. **INV-80**
8. WHEN registrar fatos de investimento THEN o sistema SHALL publicar somente após commit, com tipo suportado pelo dispatcher, bookId, aggregateId e aggregateVersion. **INV-81**
9. The sistema SHALL preservar dinheiro exato por bigint/string e decimal canônico nos limites normativos, rejeitando overflow com INVESTMENT_VALUE_OUT_OF_RANGE. **INV-82**
10. IF um campo exceder limites normativos de texto, precisão ou escala THEN o sistema SHALL rejeitar com INVALID_INVESTMENT_INPUT antes de gravar. **INV-83**
11. IF datas/instantes forem inválidos ou contrariarem os limites temporais normativos THEN o sistema SHALL rejeitar com INVALID_INVESTMENT_DATE. **INV-84**
12. WHEN migrations de investimentos forem aplicadas THEN o sistema SHALL preservar dados e checksums das migrations anteriores. **INV-85**
13. WHEN migrations forem executadas em banco novo ou banco na versão anterior THEN o sistema SHALL produzir relações de investimento com integridade por bookId e resultados equivalentes para os dados de teste. **INV-86**
14. WHEN uma migration falhar THEN o sistema SHALL manter as migrations já confirmadas e permitir retomar a partir da migration falha sem backfill duplicado. **INV-87**
15. WHEN a aplicação reiniciar THEN o sistema SHALL reconstruir perfis, termos, posições, avaliações, operações e lineage com os mesmos valores/IDs persistidos. **INV-88**
16. The domínio e a aplicação de investimentos SHALL operar sem imports, credenciais ou IDs específicos de provedores externos. **INV-89**
17. WHEN um erro ocorrer THEN o sistema SHALL devolver código estável e contexto local de requestId/operação para diagnóstico, sem registrar descrições ou valores financeiros completos por padrão. **INV-90**
18. WHEN confirmar gravação com caixa negativo THEN o sistema SHALL retornar sucesso com aviso INVESTMENT_CASH_NEGATIVE contendo o ID e o caixa calculado de cada carteira afetada. **INV-145**

**Independent Test:** Forçar falha entre salvar posição e journal, confirmar rollback; executar retry após commit com falha de publicação e confirmar uma única operação; reiniciar SQLite/Tauri e conferir valores.

### P1: S8 — Consultar e operar pela nova tela

**User Story:** Como usuário, quero acessar Investimentos e completar meus registros sem conhecer o ledger interno.

**Why P1:** Completa a entrega vertical pedida pelo usuário.

**Acceptance Criteria**:
1. WHEN houver livro ativo e o usuário acessar /investments THEN a aplicação SHALL exibir a tela Investimentos pelo shell existente com item de navegação correspondente. **INV-91**
2. WHEN não houver livro ativo THEN a aplicação SHALL usar o fluxo existente de seleção/criação de livro antes de consultar investimentos. **INV-92**
3. WHEN o resumo carregar THEN a UI SHALL apresentar dinheiro disponível, patrimônio contábil e patrimônio avaliado do livro, com moeda-base explícita. **INV-93**
4. WHEN exibir uma carteira THEN a UI SHALL apresentar saldo contábil, custo alocado, caixa da carteira, valor avaliado e ganho/perda não realizado. **INV-94**
5. WHEN listar posições THEN a UI SHALL apresentar instrumento, rótulo, carteira, classe, quantidade conhecida, custo, valor atual, data/base de avaliação e estado. **INV-95**
6. WHEN abrir o detalhe da posição THEN a UI SHALL disponibilizar termos conhecidos, histórico paginado de avaliações e histórico paginado de operações com lineage. **INV-96**
7. WHEN o usuário filtrar posições por carteira, classe, status ou nome/rótulo THEN o sistema SHALL executar busca/paginação no read model com ordem estável e isolamento por livro. **INV-97**
8. WHEN uma lista de posições/avaliações/operações for consultada THEN o sistema SHALL usar limite padrão 25, máximo 100 e cursor validado para o mesmo livro/filtros. **INV-98**
9. WHEN o usuário abrir “Novo investimento” THEN a UI SHALL oferecer os modos “Já possuo” e “Comprar/Aplicar”, com seleção ou cadastro de carteira/instrumento. **INV-99**
10. WHEN um formulário de operação for apresentado THEN a UI SHALL solicitar apenas campos aplicáveis e mostrar antes de salvar o custo, fluxo líquido e efeito em contas/categorias. **INV-100**
11. WHEN o usuário operar investimentos THEN a UI SHALL oferecer cadastro, aplicação/compra, venda/resgate, rendimento, amortização, taxa, imposto, avaliação e correção pelos casos de uso especializados. **INV-101**
12. WHEN uma transação de investimento com receita e despesa simultâneas aparecer em Transações THEN o sistema SHALL identificar a operação sem reduzir seu significado à primeira categoria encontrada. **INV-102**
13. WHEN calcular receitas/despesas de um período que contenha operações mistas THEN o sistema SHALL somar suas parcelas contábeis por kind, incluindo ambas uma única vez nos resumos da tela e insights. **INV-103**
14. WHEN uma mutação confirmar THEN a aplicação SHALL atualizar posições, carteiras, saldos, transações e resumos afetados do livro correspondente. **INV-104**
15. WHEN o livro ativo mudar durante consulta ou formulário THEN a aplicação SHALL fechar o formulário e impedir que resposta do livro anterior substitua dados do novo livro. **INV-105**
16. WHILE dados estiverem carregando THEN a UI SHALL apresentar estado de carregamento em vez de saldos zero fictícios. **INV-106**
17. WHEN não houver carteiras/posições THEN a UI SHALL apresentar estado vazio com ação de cadastro e moeda obtida do livro. **INV-107**
18. IF uma consulta falhar THEN a UI SHALL apresentar erro com ação de tentar novamente sem substituir dados válidos por zero. **INV-108**
19. IF um envio falhar antes da confirmação THEN a UI SHALL preservar campos e exibir erro acionável, mantendo o requestId para retry do mesmo conteúdo. **INV-109**
20. WHEN usar formulários e ações de linha THEN a UI SHALL seguir o padrão transacional local de Drawer, formulários controlados e DropdownMenu com operação por teclado e retorno de foco ao acionador. **INV-110**
21. WHILE uma submissão estiver pendente THEN a UI SHALL impedir novo envio do mesmo formulário. **INV-111**
22. WHEN a tela for usada em viewport de 360px ou 1280px THEN a UI SHALL manter ações acessíveis e conteúdo sem transbordamento horizontal da página, permitindo rolagem interna em listas tabulares. **INV-112**
23. WHEN o resumo de Contas apresentar ativos menos passivos contábeis THEN a UI SHALL usar o rótulo “Patrimônio contábil”, sem denominá-lo dinheiro disponível. **INV-143**
24. WHEN a prévia de operação válida indicar caixa negativo THEN a UI SHALL mostrar o aviso sem desabilitar Salvar ou exigir confirmação adicional por essa condição. **INV-148**

**Independent Test:** No Tauri, criar carteira e CDB, aplicar a partir de banco, informar avaliação, resgatar com imposto, corrigir e reiniciar. Executar também troca de livro com operação pendente e navegação por teclado.

### P1: S9 — Encerrar e arquivar sem apagar patrimônio

**User Story:** Como usuário, quero retirar cadastros sem uso das listas ativas e continuar acessando seu histórico.

**Why P1:** Completa a manutenção das entidades introduzidas.

**Acceptance Criteria**:
1. IF uma carteira tiver posição OPEN ou saldo contábil diferente de zero THEN o sistema SHALL rejeitar seu arquivamento com INVESTMENT_ACCOUNT_IN_USE. **INV-113**
2. IF um instrumento tiver posição OPEN THEN o sistema SHALL rejeitar seu arquivamento com INVESTMENT_INSTRUMENT_IN_USE. **INV-114**
3. IF uma conta financeira for liquidação padrão de carteira ativa THEN o sistema SHALL rejeitar arquivamento ou reclassificação incompatível até remover/alterar o vínculo. **INV-115**
4. WHEN conta/instrumento arquivado for reativado THEN o sistema SHALL preservar identidade e revalidar os vínculos que passam a ficar ativos. **INV-116**
5. The sistema SHALL excluir hard delete público de posições, operações, avaliações, instrumentos e carteiras desta feature. **INV-117**
6. IF uma compra/aplicação tentar usar posição CLOSED ou conta/instrumento arquivado THEN o sistema SHALL rejeitar com INVESTMENT_ENTITY_NOT_ACTIVE. **INV-118**
7. WHEN houver rendimento, taxa ou imposto posterior ao encerramento da posição em conta e instrumento ativos THEN o sistema SHALL registrar o fluxo sem reabrir a alocação. **INV-119**
8. IF uma correção reabrir posição vinculada a conta ou instrumento arquivado THEN o sistema SHALL rejeitar com INVESTMENT_ENTITY_NOT_ACTIVE até a reativação explícita dos cadastros. **INV-144**

**Independent Test:** Fechar posição, tentar arquivar carteira com caixa residual e receber erro; transferir o caixa, arquivar e consultar histórico; reativar preservando IDs.

## Edge Cases

As regras de borda já estão identificadas nos critérios anteriores. Estes fixtures normativos fixam resultados e não criam comportamentos implícitos.

| Cenário | Entrada | Resultado obrigatório | Requisitos |
| --- | --- | --- | --- |
| Compra interna sem despesas | L=10.000, C=9.000; compra 500 | L=10.000, C=9.500, caixa=500, zero novo journal | INV-29, INV-55 |
| Compra externa com despesas | Banco=10.000; C=1.000,f=10,t=5 | Banco=8.985; carteira aumenta 1.000; despesas=15; patrimônio cai 15 | INV-30, INV-103 |
| Venda com ganho | C retirado=4.000,R=4.500,f=t=0 | Carteira +500; receita=500; caixa aumenta 4.500 | INV-37 |
| Venda com perda | C=4.000,R=3.500 | Carteira -500; perda=500; caixa aumenta 3.500 | INV-37 |
| Ganho menor que despesas | C=1.000,R=1.010,f=20 | Receita=10; despesa=20; delta ledger=-10; caixa +990 | INV-37, INV-44, INV-103 |
| Sem resultado, mas com despesas | C=1.000,R=1.000,f=10 | Carteira -10, despesa=10; journal existe | INV-37, INV-45 |
| Resgate direto | C=5.000,R=5.100,t=20 | Banco +5.080,I=-5.000,G=-100,T=20 | INV-38 |
| Venda parcial | 10 unidades, custo 1.000; vender 4 com custo 400 e bruto 500 | 6 unidades, custo 600, ganho bruto 100 | INV-39 |
| Avaliação antes de venda parcial | Avaliação 1.200 para 10 unidades; vender 4 | Valor atual restante=600 com aviso até nova avaliação; não usar 1.200 nem inferir 720 | INV-51, INV-52 |
| Custo zero com unidades | 10 unidades e custo 0; vender 4 por 100 | 6 unidades, custo 0, OPEN, receita 100 | INV-21, INV-35, INV-40 |
| Amortização | Custo atual 1.000, reduzir 200, receber 220 | Custo 800, mesmas unidades, receita 20, caixa +220 | INV-42, INV-46 |
| Empate de avaliação | Mesmo valuedAt/recordedAt, registros ordenados 7 e 8 | Registro 8 vence; ambos permanecem históricos | INV-49, INV-50 |
| Dado antigo inserido depois | Avaliação de dia 9 registrada após avaliação de dia 10 | Dia 10 continua vigente se revisão aplicável | INV-50 |
| Moedas distintas | Livro BRL, instrumento USD | Rejeição, sem conversão ou soma | INV-16 |
| Precisão | Quantidade 0.1 + 0.2 | 0.3 exato, sem float persistido | INV-82 |
| Caixa negativo legado | L=5.000,C=5.100 | Caixa=-100; diagnóstico; leitura continua | INV-60 |
| Resumo independente de filtro | Duas carteiras; filtrar uma | Lista filtrada, patrimônio do livro inalterado | INV-56, INV-97 |
| Retry após resposta perdida | Mesmo requestId/payload duas vezes | Mesmos IDs; uma operação e um conjunto de postings | INV-78, INV-80 |
| Cancelamento inicial | Abertura única cancelada | Zero alocação, histórico CLOSED, ledger não duplicado | INV-62, INV-71 |
| Venda com despesas no caixa interno | C=4.000,R=4.500,f=20,t=30 | I=+450,G=-500,F=20,T=30; custo -4.000, caixa +4.450 | INV-37, INV-126 |
| Venda com despesas direto ao banco | C=4.000,R=4.500,f=20,t=30 | I=-4.000,B=4.450,G=-500,F=20,T=30 | INV-38, INV-126 |
| Rendimento com retenção no evento | R=100,f=2,t=10 | I=88,G=-100,F=2,T=10; uma INCOME e um journal, nenhuma FEE/TAX extra | INV-42, INV-126 |
| Caixa já reconhecido na carteira | L=10.000; alocar 4.000 | L=10.000,custo=4.000,caixa=6.000; patrimônio inalterado | INV-27, INV-120 |
| Patrimônio inicialmente ausente | Banco=5.000,I=0; custo=10.000,valor=11.500,caixa real=0 | Saldo inicial I=10.000; custo=10.000; caixa=0; patrimônio contábil=15.000, avaliado=16.500 | INV-122 |
| Patrimônio ausente com caixa real | Custo=10.000,valor=11.500,caixa real=500 | Saldo inicial I=10.500; custo=10.000; caixa=500; valor avaliado da carteira=12.000 | INV-122 |
| Cancelamento não recupera valuation anterior | Revisão 1: 10 unidades/custo 1.000/valor 1.200; venda → revisão 2; cancelar | Revisão 3: 10/custo 1.000, usando custo e aviso; avaliação da revisão 1 segue histórica | INV-51, INV-128 |
| Amendment sem mudança de alocação | Venda deixa 6/custo 600 na revisão 2; alterar só bruto de 500 para 550 | Revisão 2; versão do aggregate avança; avaliação aplicável dessa revisão continua elegível | INV-129 |
| Avaliação aberta antes de venda | Formulário espera revisão 1; venda confirma revisão 2 | INVESTMENT_ALLOCATION_CHANGED; nenhuma avaliação na revisão 2 com os valores do formulário antigo | INV-131 |
| Amendment passa a ter journal | Venda interna ao custo C=400,R=400 sem taxas → corrigir R para 450 | Reversão/substituição de operação; journal I=50,G=-50; nenhum journal original/reversão artificial | INV-135 |
| Amendment deixa de ter journal | Venda interna C=400,R=450 → corrigir R para 400 | Journal de reversão I=-50,G=+50; substituta sem journal | INV-136 |
| Abertura antes de completar ledger | I=0; abrir custo 10.000, avaliar em 11.500 | Sucesso com aviso; caixa=-10.000, patrimônio contábil da carteira=0, avaliado calculado=1.500 sinalizado como inconsistente | INV-28, INV-145, INV-146 |
| Recuperação do caixa | Cenário anterior; registrar saldo inicial explícito 10.000 | Caixa=0; patrimônio contábil da carteira=10.000, avaliado=11.500; aviso de caixa negativo removido | INV-147 |
| Compra com caixa insuficiente | L=100,C=0; compra interna C=200, sem taxas | L=100,C=200,caixa=-100; operação salva, sem novo journal, com aviso | INV-29, INV-32 |
| Lançamento futuro no ledger | D=dia 10; L até D=100; crédito 900 no dia 11 | Disponível/caixa atuais=100, não 1.000; patrimônio contábil equivale a GetNetWorth(asOf=dia 10) | INV-140, INV-141 |
| Avaliação de quantidade divergente | Revisão atual possui 6 unidades; avaliação informa 10 | INVALID_INVESTMENT_VALUATION; nenhuma mudança de posição | INV-142 |

## Contratos transversais para Design

O Design deverá concretizar os contratos abaixo sem ampliar o recorte de produto.

- **Commands:** criação/classificação de conta, configuração de liquidação, manutenção de instrumento, abertura/alocação, compra/aplicação, venda/resgate, renda/amortização/taxa/imposto, avaliação e correção. Operações existentes em posição recebem expectedPositionVersion; correções também expectedOperationVersion. IDs referenciados são validados no mesmo livro.
- **Idempotência:** requestId local UUID válido, independente de fornecedor, armazenado com resultado na mesma transação. Chave bookId+requestId; conteúdo canônico inclui tipo de comando e versões, exclui relógio/IDs gerados pelo servidor. Retry é consultado antes da validação de versão. Resultado salvo é imutável mesmo que a operação depois seja corrigida. Não expira na v1. Alterar conteúdo de um formulário após erro cria novo requestId; repetir conteúdo preserva o anterior.
- **Revisão de alocação:** seguir a seção de revisão econômica, com allocationRevision persistida e expectedAllocationRevision na avaliação. Não muda por rename, INCOME/FEE/TAX ou avaliação. Se operação e avaliação compartilham o mesmo dia, a avaliação é aceita como observação daquela revisão declarada. Histórico de revisão anterior permanece consultável; não há comando de importar avaliação sobre revisão passada na v1.
- **Correções:** apenas a última operação efetiva da posição; modificar tipo econômico, posição ou carteira por amendment é proibido. Para isso, cancelar e cadastrar outra operação. Inverter efeitos persistidos conforme a seção de inversão histórica. Datas retroagem contabilmente conforme INV-73/134; relatórios históricos podem mudar, e recordedAt preserva quando a correção foi registrada. Uma substituição inválida não deixa reversão órfã. Se apenas a substituição precisar de journal, criar journal sem replacementOf contábil fictício; se apenas o original tiver journal, revertê-lo sem criar substituição contábil vazia. O lineage de operação existe em ambos os casos, sem exigir cardinalidade idêntica à cadeia contábil.
- **Transferências comuns:** crédito/débito puro de caixa continua em TransferMoney. O diagnóstico de caixa negativo também se aplica a RecordExpense, SetOpeningBalance, transferências e correções genéricas que alterem o saldo da carteira; produzir aviso, não bloqueio por essa condição. Contas externas de compra/resgate devem ser financeiras ASSET ativas do mesmo livro e diferentes da carteira; a restrição BANK/PAYMENT vale apenas para o vínculo padrão de liquidação. Arquivamento, reclassificação e validação de referências ocorrem na mesma transação que suas verificações de uso.
- **Estado fechado:** não pode receber nova compra/aplicação; pode receber INCOME/FEE/TAX nas condições de INV-119. Cancelar/corrigir a saída que fechou exige primeiro corrigir operações efetivas posteriores. Não existe botão livre de reabrir/fechar; fechamento decorre de saída/cancelamento e sua recomposição auditável.
- **Persistência:** profiles pertencem ao repositório de LedgerAccount; termos pertencem à posição; identificadores pertencem ao instrumento. Valuation usa store append-only. Não carregar arrays de todo o histórico dentro do aggregate. Relações incluem bookId; unicidade de ISIN ignora mercado, que deve estar ausente nesse scheme. Para TICKER, mercado é obrigatório. Ausência de mercado nos demais schemes usa chave canônica vazia; não depender da semântica SQL de NULL para unicidade.
- **Queries:** resumos em uma leitura consistente, sem carregar aggregates para relatórios; valores atuais do livro, sem novo asOf patrimonial. Listas de posições ordenadas por nome normalizado do instrumento, rótulo e ID; históricos por data desc, sequência desc e ID. Novo filtro reinicia cursor; snapshot consistente por página, sem promessa de snapshot duradouro entre mutações concorrentes.
- **Transações mistas:** DTOs/read models expõem vínculo e tipo de investimento; totais de receitas/despesas se baseiam em postings. Operação sem journal aparece em investimentos, sem linha fictícia em Transações. As alterações preservam paginação/busca atuais de Transações.
- **Eventos:** FinancialAccountConfigured, InvestmentSettlementAccountChanged, InvestmentInstrumentCreated/Updated/Archived/Reactivated, InvestmentPositionOpened/Changed/Closed/Reopened, InvestmentOperationRecorded/Reversed/Amended e Journal facts aplicáveis. Evento não representa outra gravação do fato financeiro. Valuation invalida suas queries por resultado do comando; não requer aggregate/fact próprio.
- **UI:** novos formulários seguem hooks/facade de serviços existentes e componentes compartilhados; React não consulta SQLite diretamente. Avaliações não solicitam profit: resultado não realizado é derivado. Seleção de categorias oferece acesso ao cadastro já existente quando necessário, sem criar padrões silenciosos. Mensagens traduzem códigos para Português e orientam recuperação.
- **Renda fixa:** índices permitidos são CDI, SELIC, IPCA, IGPM e OTHER. Remuneração é descritiva e não dispara cálculo. Alterar termos de contratação já utilizada exige cancelar a abertura quando permitido e cadastrar a posição correta; não sobrescrever silenciosamente o histórico.

## Dimensões implícitas

| Dimensão | Tratamento dentro do escopo |
| --- | --- |
| Input validation & bounds | Limites normativos, INV-16–24, INV-36, INV-48 e INV-82–84. |
| Failure / partial-failure states | Rollback e falha pós-commit distintos, INV-75, INV-80 e INV-137; feedback INV-108–109. |
| Idempotency / retry / duplicate handling | RequestId persistido, INV-78–79; identificadores INV-18. |
| Auth boundaries & rate limits | Livro ativo e bookId, INV-74 e INV-92/105. Login multiusuário e rate limiting N/A porque a feature é local e não expõe serviço remoto. |
| Concurrency / ordering | CAS, saldo transacional, sequência de operação e revisão de avaliação, INV-50–51, INV-72–79 e INV-127–131. |
| Data lifecycle / expiry | Histórico sem hard delete, arquivamento/fechamento explícitos, INV-113–119. Expiração N/A para histórico financeiro e chaves de retry. |
| Observability | Erro estável e IDs locais, INV-90. Telemetria remota N/A porque não existe integração na entrega. |
| External-dependency failure | Rede/cotação/provider N/A; operações manuais locais, INV-89. Falha do SQLite coberta por INV-75/85–88. |
| State-transition integrity | Última operação, correção coordenada, reabertura auditada e lifecycle, INV-61–73 e INV-113–119. |

## Requirement Traceability

| Requirement ID | Story | Phase | Status | Tasks |
| --- | --- | --- | --- | --- |
| INV-01 | S1 | Tasks | In progress: T3 profiles | T3, T17, T23, T41, T74 |
| INV-02 | S1 | Tasks | In progress: T3 profiles; T4 aggregate | T3, T4, T41 |
| INV-03 | S1 | Tasks | In progress: T3 profiles; T4 aggregate | T3, T4, T17, T23, T41 |
| INV-04 | S1 | Tasks | In progress: T4 aggregate | T4, T15, T23, T30, T41, T42 |
| INV-05 | S1 | Tasks | Planned | T17, T23, T68 |
| INV-06 | S1 | Tasks | Planned | T17, T23, T68 |
| INV-07 | S1 | Tasks | In progress: T4 aggregate | T4, T23, T42, T68, T74 |
| INV-08 | S1 | Tasks | Planned | T42, T43, T74 |
| INV-09 | S1 | Tasks | Planned | T14, T62, T63, T75, T86 |
| INV-10 | S1 | Tasks | Planned | T14, T62, T63, T75, T86 |
| INV-11 | S2 | Tasks | In progress: T3 profiles | T3, T4, T23, T41, T42, T63, T74, T87 |
| INV-12 | S2 | Tasks | In progress: T3 profiles | T3, T38, T39, T42, T43, T74 |
| INV-13 | S2 | Tasks | Planned | T42, T61, T74, T79, T80 |
| INV-14 | S2 | Tasks | In progress: T6 instrument | T6, T18, T24, T31, T44, T64, T76 |
| INV-15 | S2 | Tasks | In progress: T6 instrument | T6, T44, T64, T76 |
| INV-16 | S2 | Tasks | In progress: T6 instrument | T6, T24, T44, T45, T76 |
| INV-17 | S2 | Tasks | In progress: T6 instrument | T6, T18, T24, T31, T44, T45, T64, T76 |
| INV-18 | S2 | Tasks | In progress: T6 instrument | T6, T18, T24, T31, T44, T45, T64, T76 |
| INV-19 | S2 | Tasks | In progress: T5 identities | T5, T8, T19, T25, T32, T50, T65, T78, T88 |
| INV-20 | S2 | Tasks | Planned | T8, T12, T19, T25, T32, T47, T50, T65, T77, T91 |
| INV-21 | S2 | Tasks | In progress: T2 values | T2, T8, T19, T25, T50, T78 |
| INV-22 | S2 | Tasks | In progress: T7 fixed-income terms | T7, T19, T25, T65, T78, T91 |
| INV-23 | S2 | Tasks | In progress: T7 fixed-income terms | T7, T19, T25, T78 |
| INV-24 | S2 | Tasks | In progress: T2 values; T7 fixed-income terms | T2, T7 |
| INV-25 | S2 | Tasks | In progress: T7 fixed-income terms | T7, T8, T65, T88, T91 |
| INV-26 | S2 | Tasks | In progress: T6 instrument; T7 fixed-income terms | T6, T7, T8, T24, T25, T31, T45, T47, T64, T65, T76, T77, T88, T91 |
| INV-27 | S3 | Tasks | Planned | T11, T50, T78 |
| INV-28 | S3 | Tasks | Planned | T38, T39, T50, T60, T78 |
| INV-29 | S3 | Tasks | Planned | T11, T50, T51, T79 |
| INV-30 | S3 | Tasks | Planned | T11, T50, T51, T79 |
| INV-31 | S3 | Tasks | Planned | T60, T68, T70, T94 |
| INV-32 | S3 | Tasks | Planned | T38, T39, T50, T51, T55, T60, T79, T83 |
| INV-33 | S3 | Tasks | Planned | T50, T78 |
| INV-34 | S3 | Tasks | Planned | T9, T50, T51 |
| INV-35 | S4 | Tasks | Planned | T8, T11, T51, T52, T54, T80 |
| INV-36 | S4 | Tasks | In progress: T2 values | T2, T11, T12, T51, T52, T61, T79, T80 |
| INV-37 | S4 | Tasks | Planned | T11, T52, T69, T80 |
| INV-38 | S4 | Tasks | Planned | T11, T52, T69, T80 |
| INV-39 | S4 | Tasks | Planned | T8, T11, T52, T80 |
| INV-40 | S4 | Tasks | Planned | T8, T11, T52, T80 |
| INV-41 | S4 | Tasks | Planned | T11, T52, T80 |
| INV-42 | S4 | Tasks | Planned | T11, T53, T54, T69, T81, T82 |
| INV-43 | S4 | Tasks | Planned | T11, T55, T69, T83 |
| INV-44 | S4 | Tasks | Planned | T11, T51, T52, T53, T54, T55, T69, T81, T82, T83 |
| INV-45 | S4 | Tasks | Planned | T11, T51, T52, T70, T94 |
| INV-46 | S4 | Tasks | Planned | T8, T11, T52, T54, T82 |
| INV-47 | S5 | Tasks | Planned | T10, T21, T27, T34, T58, T67, T84, T90 |
| INV-48 | S5 | Tasks | In progress: T2 values | T2, T10, T27, T58, T84 |
| INV-49 | S5 | Tasks | Planned | T10, T21, T27, T34, T58, T67, T84, T90 |
| INV-50 | S5 | Tasks | Planned | T14, T21, T27, T29, T34, T36, T58, T62, T65, T67, T72, T90 |
| INV-51 | S5 | Tasks | Planned | T8, T52, T58, T62, T65, T67, T90 |
| INV-52 | S5 | Tasks | Planned | T14, T62, T65, T86, T88, T91 |
| INV-53 | S5 | Tasks | Planned | T8, T52, T62, T65, T67, T86, T88, T90, T91 |
| INV-54 | S5 | Tasks | Planned | T14, T62, T86 |
| INV-55 | S5 | Tasks | Planned | T14, T37, T38, T39, T62, T63, T68, T69, T87 |
| INV-56 | S5 | Tasks | Planned | T14, T37, T62, T69, T86 |
| INV-57 | S5 | Tasks | Planned | T14, T37, T62, T68, T69, T75 |
| INV-58 | S5 | Tasks | Planned | T14, T62, T65, T72, T84, T86, T88, T90 |
| INV-59 | S5 | Tasks | Planned | T10, T14, T58, T62, T65, T67, T84, T86, T88, T90, T91 |
| INV-60 | S5 | Tasks | Planned | T14, T38, T39, T60, T62, T63, T86, T87 |
| INV-61 | S6 | Tasks | Planned | T9, T26, T33, T56, T57, T66, T85, T89, T91 |
| INV-62 | S6 | Tasks | Planned | T8, T56, T85 |
| INV-63 | S6 | Tasks | Planned | T9, T20, T26, T33, T56, T57, T59, T66, T70, T89, T94 |
| INV-64 | S6 | Tasks | Planned | T9, T20, T26, T33, T56, T57, T59, T66, T70, T89, T94 |
| INV-65 | S6 | Tasks | Planned | T9, T26, T33, T56, T57, T66, T85, T89 |
| INV-66 | S6 | Tasks | Planned | T9, T56, T57 |
| INV-67 | S6 | Tasks | Planned | T56, T57, T59, T70, T85, T94 |
| INV-68 | S6 | Tasks | Planned | T9, T20, T26, T57, T59, T66, T70, T85, T89, T94 |
| INV-69 | S6 | Tasks | Planned | T9, T20, T26, T33, T56, T57, T59, T66, T70, T85, T89, T94 |
| INV-70 | S6 | Tasks | Planned | T56, T57, T60, T85 |
| INV-71 | S6 | Tasks | Planned | T8, T56 |
| INV-72 | S6 | Tasks | Planned | T9, T20, T26, T29, T33, T36, T56, T57, T66, T85, T89 |
| INV-73 | S6 | Tasks | Planned | T9, T56, T57, T85, T89 |
| INV-74 | S7 | Tasks | Planned | T12, T13, T18, T19, T20, T21, T23, T24, T25, T26, T27, T28, T31, T32, T33, T34, T35, T40, T41, T42, T43, T44, T45, T46, T47, T48, T51, T52, T53, T54, T55, T56, T57, T58, T59, T61, T63, T64, T65, T66, T67, T71, T72, T73, T91, T93 |
| INV-75 | S7 | Tasks | Planned | T13, T16, T22, T28, T29, T30, T35, T36, T40, T48, T50, T51, T52, T53, T54, T55, T56, T57, T58, T60 |
| INV-76 | S7 | Tasks | In progress: T4 aggregate | T4, T12, T13, T23, T24, T25, T26, T31, T32, T33, T40, T42, T45, T46, T47, T48, T51, T52, T53, T54, T55, T56, T57, T61, T73 |
| INV-77 | S7 | Tasks | Planned | T38, T39, T40, T48, T51, T60 |
| INV-78 | S7 | Tasks | In progress: T5 identities | T5, T12, T13, T16, T22, T28, T35, T40, T48, T49, T50, T51, T52, T53, T54, T55, T56, T57, T58, T71, T73 |
| INV-79 | S7 | Tasks | Planned | T12, T22, T28, T35, T48, T73 |
| INV-80 | S7 | Tasks | Planned | T16, T22, T28, T35, T40, T48, T71, T73 |
| INV-81 | S7 | Tasks | Planned | T9, T15, T16, T40, T44, T45, T46, T48 |
| INV-82 | S7 | Tasks | In progress: T1 Decimal; T2 values | T1, T2, T10, T12, T29, T36, T37, T62, T68, T69, T70 |
| INV-83 | S7 | Tasks | In progress: T1 Decimal; T2 values | T1, T2, T6, T10, T12, T44, T45, T47 |
| INV-84 | S7 | Tasks | In progress: T2 values | T2, T10, T12, T48, T58 |
| INV-85 | S7 | Tasks | Planned | T17, T18, T19, T20, T21, T22 |
| INV-86 | S7 | Tasks | Planned | T17, T18, T19, T20, T21, T22 |
| INV-87 | S7 | Tasks | Planned | T17, T18, T22 |
| INV-88 | S7 | Tasks | Planned | T13, T17, T21, T23, T24, T25, T26, T27, T28, T29, T30, T34, T40 |
| INV-89 | S7 | Tasks | In progress: T5 identities | T5, T6, T12, T13, T40, T44, T71 |
| INV-90 | S7 | Tasks | Planned | T12, T15, T16, T48, T73 |
| INV-91 | S8 | Tasks | Planned | T71, T92, T93 |
| INV-92 | S8 | Tasks | Planned | T71, T92, T93 |
| INV-93 | S8 | Tasks | Planned | T14, T62, T72, T75, T86, T92 |
| INV-94 | S8 | Tasks | Planned | T14, T63, T72, T87, T92 |
| INV-95 | S8 | Tasks | Planned | T14, T65, T72, T88, T91, T92 |
| INV-96 | S8 | Tasks | Planned | T14, T65, T66, T67, T72, T89, T90, T91, T93 |
| INV-97 | S8 | Tasks | Planned | T14, T62, T65, T72, T88, T92 |
| INV-98 | S8 | Tasks | Planned | T14, T65, T66, T67, T70, T72, T88, T89, T90, T94 |
| INV-99 | S8 | Tasks | Planned | T64, T74, T76, T78, T92, T93 |
| INV-100 | S8 | Tasks | Planned | T61, T78, T79, T80, T81, T82, T83, T84, T85 |
| INV-101 | S8 | Tasks | Planned | T71, T76, T77, T78, T79, T80, T81, T82, T83, T84, T85, T91, T92, T93 |
| INV-102 | S8 | Tasks | Planned | T59, T70, T94 |
| INV-103 | S8 | Tasks | Planned | T37, T69, T70, T94 |
| INV-104 | S8 | Tasks | Planned | T71, T72, T73, T92, T94 |
| INV-105 | S8 | Tasks | Planned | T72, T73, T91, T92, T93 |
| INV-106 | S8 | Tasks | Planned | T72, T86, T87, T88, T89, T90, T91, T92 |
| INV-107 | S8 | Tasks | Planned | T63, T72, T75, T86, T87, T88, T92 |
| INV-108 | S8 | Tasks | Planned | T72, T86, T87, T88, T89, T90, T91, T92 |
| INV-109 | S8 | Tasks | Planned | T73, T76, T77, T78, T79, T80, T81, T82, T83, T84, T85, T94 |
| INV-110 | S8 | Tasks | Planned | T74, T76, T77, T78, T79, T80, T81, T82, T83, T84, T85, T88, T89, T91, T92, T93, T94 |
| INV-111 | S8 | Tasks | Planned | T73, T76, T77, T78, T79, T80, T81, T82, T83, T84, T85, T92 |
| INV-112 | S8 | Tasks | Planned | T86, T87, T88, T89, T90, T91, T92, T93, T94 |
| INV-113 | S9 | Tasks | Planned | T25, T32, T38, T39, T43, T63, T87 |
| INV-114 | S9 | Tasks | Planned | T6, T24, T25, T31, T32, T46, T64, T76 |
| INV-115 | S9 | Tasks | Planned | T38, T39, T42, T43, T74, T87 |
| INV-116 | S9 | Tasks | Planned | T6, T24, T31, T43, T46, T64, T76, T87 |
| INV-117 | S9 | Tasks | Planned | T46, T59, T66, T67, T89, T90 |
| INV-118 | S9 | Tasks | Planned | T8, T51, T79, T88 |
| INV-119 | S9 | Tasks | Planned | T8, T53, T55, T81, T83, T91 |
| INV-120 | S3 | Tasks | Planned | T49, T50, T78 |
| INV-121 | S3 | Tasks | Planned | T49, T50, T78 |
| INV-122 | S3 | Tasks | Planned | T49, T78 |
| INV-123 | S3 | Tasks | In progress: T2 values | T2, T49, T50, T78 |
| INV-124 | S3 | Tasks | Planned | T49, T78 |
| INV-125 | S4 | Tasks | Planned | T11, T51, T79 |
| INV-126 | S4 | Tasks | Planned | T11, T51, T52, T53, T54, T55, T79, T80, T81, T82, T83 |
| INV-127 | S5 | Tasks | Planned | T8, T19, T21, T25, T27, T30, T32, T47, T50, T58, T67, T90 |
| INV-128 | S5 | Tasks | Planned | T8, T25, T51, T52, T54, T56, T57, T85 |
| INV-129 | S5 | Tasks | Planned | T8, T47, T53, T55, T57, T77, T85 |
| INV-130 | S5 | Tasks | Planned | T58, T62, T65, T67, T84, T90 |
| INV-131 | S5 | Tasks | Planned | T12, T58, T73, T84 |
| INV-132 | S6 | Tasks | Planned | T9, T11, T13, T20, T26, T30, T33, T56, T57, T66, T89 |
| INV-133 | S6 | Tasks | Planned | T9, T20, T26, T56, T57, T66, T89 |
| INV-134 | S6 | Tasks | Planned | T9, T20, T26, T56, T57, T66, T85, T89 |
| INV-135 | S6 | Tasks | Planned | T26, T57, T59, T66, T70, T85, T89, T94 |
| INV-136 | S6 | Tasks | Planned | T26, T57, T59, T66, T70, T85, T89, T94 |
| INV-137 | S3 | Tasks | Planned | T49, T50, T78 |
| INV-138 | S1 | Tasks | Planned | T42, T74, T75, T78, T92 |
| INV-139 | S4 | Tasks | Planned | T52, T61, T80 |
| INV-140 | S5 | Tasks | Planned | T14, T37, T38, T39, T62, T68, T69, T72, T86 |
| INV-141 | S5 | Tasks | Planned | T14, T37, T38, T39, T62, T68, T69, T72, T86 |
| INV-142 | S5 | Tasks | Planned | T10, T58, T84 |
| INV-143 | S8 | Tasks | Planned | T75 |
| INV-144 | S9 | Tasks | Planned | T8, T43, T46, T56, T57, T85, T91 |
| INV-145 | S7 | Tasks | Planned | T12, T38, T39, T48, T49, T50, T51, T55, T56, T57, T60, T61, T62, T63, T73, T78, T79, T83, T87 |
| INV-146 | S5 | Tasks | Planned | T62, T63, T86, T87, T92 |
| INV-147 | S5 | Tasks | Planned | T49, T60, T62, T86, T87, T92 |
| INV-148 | S8 | Tasks | Planned | T61, T73, T78, T79, T80, T81, T82, T83, T85, T92 |

**Coverage:** 148 requisitos mapeados para seções e evidência futura em [design.md](./design.md) e para as 94 tarefas de [tasks.md](./tasks.md). Design aprovado; Tasks em revisão, nenhum requisito implementado. IDs anteriores preservados. INV-28/32/70/77/121 revisados pela decisão explícita A11; INV-120–148 detalham os refinamentos desta discussão.

## Success Criteria

- [ ] Todos os critérios INV possuem evidência de resultado exato derivada desta spec.
- [ ] Fixtures contábeis confirmam somas zero, efeitos líquidos, precisão e ausência de duplicação.
- [ ] Migração, rollback, CAS, retry pós-commit e roundtrip SQLite passam em testes integrados.
- [ ] A jornada manual completa funciona no Tauri, inclusive persistência após reiniciar, troca de livro e teclado.
- [ ] GetNetWorth contábil e fluxos existentes de receita/despesa/transferência mantêm sua semântica, com os guards de investimento explicitamente introduzidos.
- [ ] Verificador independente produz validation.md com resultado PASS após a implementação, incluindo discriminação de falhas contábeis e de avaliações.

## Validação desta fase

Specify é validado pelo script da skill e por conferência de IDs, matrizes e premissas. Isso não constitui teste de software nem aprovação do usuário. Testes automatizados de implementação, verificação independente e UAT serão executados nas fases correspondentes; não há alegação de funcionalidade pronta.
