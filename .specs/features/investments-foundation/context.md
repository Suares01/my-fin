# Contexto de investimentos v1

**Gathered:** 2026-09-10
**Spec:** [spec.md](./spec.md)
**Status:** premissas A1–A14 e [design.md](./design.md) aprovados; [tasks.md](./tasks.md) elaborado para revisão.

## Feature Boundary

Nova tela de investimentos com manutenção manual e separação entre dinheiro disponível, alocação e patrimônio. Inclui contratos de domínio, aplicação, SQLite e UI necessários para o fluxo completo. Integrações e cotações automáticas serão posteriores.

## Orientação explícita do usuário

- Adicionar uma tela para centralizar o acompanhamento de investimentos.
- Distinguir patrimônio de dinheiro disponível.
- Distinguir gasto de transferência para corretora ou caixinha/cofrinho.
- Preparar a arquitetura para uma futura camada de tradução, como Pluggy.
- Analisar as três respostas fornecidas e produzir uma spec usando tlc-spec-driven.
- O pedido atual não inclui implementar a feature.

## Discussão de áreas cinzentas

O usuário confirmou uma v1 manual completa: cadastro, aportes/compras, vendas/resgates, rendimentos e atualização manual de valores. Integrações e cotações automáticas ficam para depois.

O usuário confirmou a separação por finalidade: “dinheiro disponível” inclui contas bancárias, contas de pagamento e dinheiro físico. Caixa de corretora e caixinhas ficam separados, mesmo com liquidez diária. As premissas A1 e A2 estão confirmadas em spec.md.

As demais áreas identificadas receberam interpretações explícitas com justificativas. As confirmações adicionais de produto estão registradas abaixo; a aprovação posterior de todas as premissas encerra essas pendências, conforme registro abaixo.

### Refinamento apresentado pelo usuário

O usuário forneceu um quarto anexo (`3165069a-ada7-4f1a-954f-f2d00c7adcf4`), apresentado como “uma possível solução”, focado em A6, A8, A10 e A12. A revisão incorpora essa solução na proposta de spec:

- Principal e resultado distintos; taxas/impostos não capitalizados; retenções do mesmo evento são componentes da própria operação, inclusive em rendimento.
- allocationRevision persistida, separada de version; cancelamento não recupera uma revisão antiga nem reaplica unitPrice.
- Correção da última operação com inversão dos deltas/postings persistidos, sem recalcular o original por políticas atuais.
- Cadastro distingue saldo na carteira, saldo em outra conta e patrimônio ausente; saldo inicial representa custo mais caixa real, avaliação fica separada.

A análise explicitou dois limites: amendment sem mudança econômica final conserva a revisão; saldo inicial ativo não pode ser duplicado, conforme o caso de uso existente. O envio de avaliação verifica a revisão que o usuário estava avaliando para impedir associação a uma posição modificada concorrentemente.

O texto anexado sugere marcar decisões como confirmadas, mas a mensagem do usuário apresenta uma possibilidade. Naquela etapa, a incorporação documental não marcou A6/A8/A10/A12 como integralmente aprovadas nem iniciou Design/Tasks. A aprovação posterior está registrada abaixo.

### Confirmações ao continuar a especificação

O usuário pediu “Continue a definição da especificação” e respondeu às decisões de produto:

- **A4:** valor bruto na consolidação; líquido no detalhe.
- **A13:** exigir quantidade para ações, ETFs, FIIs, fundos e cripto, incluindo STOCK, BDR, ETF, REAL_ESTATE_FUND, MUTUAL_FUND e CRYPTO_ASSET na taxonomia da spec.
- **A11:** permitir salvar registros com aviso de inconsistência quando faltar saldo inicial ou aporte e o caixa da carteira ficar negativo.

A11 substitui o bloqueio antes proposto. Isso alcança abertura, compra, transferência/despesa e correção: quantidade e custo continuam não negativos; saldo contábil e caixa negativo são preservados e sinalizados. Não há criação automática de contrapartida. A12 continua distinguindo as três origens contábeis, mas não exige completar o ledger antes de permitir registrar a posição. O cadastro pode ser completado posteriormente.

O agente concretizou também a data de referência de hoje no fuso do livro para o novo resumo, a apresentação de Outros ativos após migração, o fechamento de posições de custo zero e os vínculos arquivados em uma reabertura. Essas definições foram apresentadas como premissas e posteriormente aceitas na aprovação integral registrada abaixo.

## Aprovação da especificação

O usuário declarou: “Aceito todas as premissas, inci design.md.”. A aprovação abrange A1–A14, incluindo gravação com aviso de caixa negativo, as fórmulas patrimoniais e a correção pela última operação efetiva. Foi solicitado iniciar Design; não foi solicitado criar Tasks ou executar a implementação.

## Implementation Decisions

O núcleo proposto mantém LedgerAccount com perfis de conta, Instrument, Position, Operation e Valuation separados. As fórmulas e os limites comportamentais estão em spec.md. Interfaces, organização dos componentes e divisão das migrations estão concretizadas em [design.md](./design.md). A decomposição está em [tasks.md](./tasks.md), ainda em revisão; o Design foi aprovado explicitamente.

### Agent's Discretion

Todas as premissas A1–A14 estão aprovadas. O agente concretiza escolhas técnicas compatíveis no design.md, sem alterar os comportamentos aceitos.

### Declined / Undiscussed Gray Areas → Assumptions

Todas as premissas A1–A14 estão na tabela de spec.md, com padrão escolhido, motivo e confirmação. Nenhuma depende de interpretar silêncio como aceite.

## Specific References

Os quatro textos e sua análise crítica estão catalogados em [analysis.md](./analysis.md). O requisito de UI vem do pedido do usuário; os anexos se concentram principalmente na foundation técnica.

## Deferred Ideas

Pluggy/Open Finance, mappings externos, sincronização, cotações, conversão de moeda, cálculo fiscal, rentabilidade percentual, eventos corporativos, transferências de custódia, margem, short e conciliação automática. Manter posições em contas diferentes é permitido na v1; automatizar portabilidade entre elas é outro escopo.

## Aprovação do Design e planejamento de Tasks

O usuário declarou: “Aprovo design, siga para tasks.md”. O design está aprovado; 94 tarefas em 16 fases concretizam os 148 requisitos. A autorização desta etapa é produzir o plano, incluindo matriz de testes, gates e rastreabilidade; implementação não iniciada.
