# Global Transaction Drawer Specification

## Problem Statement

Criar transações exige hoje uma ação local e um overlay parcialmente desconectado da página. A criação deve ficar disponível no cabeçalho do My Fin, sem trocar de rota, e seguir a interação lateral do Orca AI.

## Goals

- [ ] Disponibilizar a criação de receita, despesa e transferência em todo o shell com livro ativo.
- [ ] Reutilizar os formulários e hooks de mutação existentes dentro de um Drawer Vaul controlado.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Fluxo dedicado para mobile | O pedido exclui tratamento mobile nesta entrega. |
| Edição ou exclusão globais | O drawer global cobre somente criação. |
| Alterar regras de validação ou mutação | Os formulários e hooks existentes são a fonte de verdade. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Sem livro ativo | Ocultar a ação global. | Uma criação não pode existir sem `bookId`. | y |
| Fechamento do drawer | Limpar o tipo selecionado ao fechar. | Uma nova abertura não deve reusar estado anterior. | y |
| Interação responsiva | Usar o mesmo drawer em qualquer largura, sem rota alternativa. | Mobile está explicitamente fora de escopo. | y |

**Open questions:** none - all resolved or logged above.

## User Stories

### P1: Criar uma transação de qualquer tela ⭐ MVP

**User Story**: Como pessoa com um livro ativo, quero abrir a criação de transações pelo cabeçalho para registrar uma movimentação sem sair da tela atual.

**Why P1**: A criação deixa de ser restrita à página de Transações.

**Acceptance Criteria**:

1. WHEN um livro estiver ativo THEN o sistema SHALL exibir no cabeçalho uma ação global com as opções `Receita`, `Despesa` e `Transferência`. (`GTD-01`)
2. WHEN o usuário escolher uma opção THEN o sistema SHALL abrir um Drawer Vaul controlado à direita com `modal={false}` e backdrop próprio. (`GTD-02`)
3. WHEN o tipo selecionado for receita, despesa ou transferência THEN o sistema SHALL renderizar exclusivamente o formulário dedicado correspondente. (`GTD-03`)
4. WHEN um formulário válido concluir sua mutation THEN o sistema SHALL fechar o drawer e manter a invalidação de consultas executada pelo hook existente. (`GTD-04`)
5. IF a mutation falhar THEN o sistema SHALL manter o drawer aberto e preservar o tratamento de erro do formulário existente. (`GTD-05`)
6. WHEN o drawer for fechado por cancelamento ou mudança controlada de abertura THEN o sistema SHALL limpar o tipo selecionado. (`GTD-06`)
7. WHILE não houver livro ativo THEN o sistema SHALL ocultar a ação global de criação. (`GTD-07`)

**Independent Test**: Com livro ativo, escolher cada tipo no cabeçalho, confirmar o formulário correspondente e testar sucesso, falha e fechamento; repetir sem livro ativo.

## Edge Cases

- IF uma mutation falhar THEN o drawer permanece aberto e não perde os valores que o formulário controla.
- WHEN o drawer fechar e abrir novamente THEN nenhum tipo anterior permanece selecionado.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| GTD-01 | P1: Criar uma transação | Tasks | Pending |
| GTD-02 | P1: Criar uma transação | Tasks | Verified |
| GTD-03 | P1: Criar uma transação | Tasks | Verified |
| GTD-04 | P1: Criar uma transação | Tasks | Verified |
| GTD-05 | P1: Criar uma transação | Tasks | Verified |
| GTD-06 | P1: Criar uma transação | Tasks | Pending |
| GTD-07 | P1: Criar uma transação | Tasks | Pending |

## Success Criteria

- [ ] Uma pessoa com livro ativo inicia qualquer uma das três criações pelo cabeçalho sem mudar de rota.
- [ ] O drawer fecha apenas após sucesso ou ação explícita de fechamento.
