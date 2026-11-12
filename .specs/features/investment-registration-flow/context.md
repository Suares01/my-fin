# Fluxo progressivo de cadastro de investimentos - Context

**Gathered:** 2026-11-12
**Spec:** `.specs/features/investment-registration-flow/spec.md`
**Status:** Ready for design

## Feature Boundary

Redesenhar somente a experiência React de abertura manual de posição. Os comandos, fórmulas, read models e garantias de `investments-foundation` permanecem inalterados.

## Implementation Decisions

### Estrutura

- Quatro etapas: escolha, dados da posição, origem contábil e revisão.
- O usuário pode voltar sem perder valores.
- A confirmação final só aparece na revisão.

### Catálogos rápidos

- A busca de instrumento combina seleção e ação “Cadastrar novo”.
- Instrumento e carteira são criados dentro do drawer atual.
- O formulário principal permanece montado e seleciona o item criado ao retornar.

### Contabilidade

- A UI pergunta “Como este valor já aparece no My Fin?” para uma posição existente.
- Saldo na carteira, outra conta e patrimônio ausente continuam caminhos distintos.
- Patrimônio ausente exige confirmação específica do saldo inicial proposto.
- Avaliação é removida da abertura e explicada como ação posterior.

### Agent's Discretion

- Microcopy curta, ícones Lucide já instalados e composição exata dos cards de opção.
- Breakpoints e compactação visual dentro dos tokens existentes.

### Declined / Undiscussed Gray Areas → Assumptions

- Nenhuma. As decisões relevantes foram definidas no diagnóstico e na proposta de UX aprovados.

## Specific References

- Reutilizar `OpenInvestmentPosition`, `OpenInvestmentPositionWithPurchase`, `SetInvestmentOpeningBalance` e `PreviewInvestmentPositionOpening`.
- Reutilizar `AccountForm`, `InvestmentInstrumentForm`, React Hook Form, Zod e `useInvestmentSubmission`.

## Deferred Ideas

- Draft persistido após fechar o drawer.
- Cotação automática ou importação por corretora.
- Avaliação encadeada após a abertura.

