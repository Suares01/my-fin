# Account Form RHF/Zod Specification

## Problem Statement

O formulário de conta duplica a ligação entre React Hook Form e Zod e exibe falhas de envio em um alerta local. O seletor de tipo também repete um adaptador de ToggleGroup já necessário na criação de categorias.

## Goals

- [ ] Unificar o formulário de conta no padrão RHF/Zod e campos controlados compartilhados.
- [ ] Exibir falhas de criação de conta em um toast seguro sem descartar o rascunho.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Edição, arquivamento ou saldo inicial de contas | Não fazem parte da criação de conta. |
| Alteração de comandos, hooks ou invalidação de query | O contrato de criação existente permanece. |
| Correção dos testes preexistentes de cor/ícone da categoria | Não é causada pela migração do seletor. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Campo de escolha compartilhado | `ControlledToggleGroup` recebe opções textuais e seleção única | Cobre os enums de conta e categoria sem mudar contratos de domínio. | y |
| Falha de envio | Um toast é emitido por tentativa de envio rejeitada | Mantém o padrão atual das categorias e preserva o rascunho. | y |

**Open questions:** none - all resolved or logged above.

## User Stories

### P1: Criar conta com campos validados e reutilizáveis

**User Story**: As a user, I want preencher uma conta com validação consistente so that eu possa criar uma conta sem mensagens redundantes ou perder meu rascunho.

**Why P1**: A criação de conta depende diretamente deste formulário.

**Acceptance Criteria**:

1. WHEN o usuário envia nome vazio ou tipo de conta sem seleção THEN o sistema SHALL bloquear a criação e exibir a mensagem definida no schema ao lado do campo inválido.
2. WHEN o usuário envia uma conta válida THEN o sistema SHALL chamar a criação com o `bookId` ativo, o nome sem espaços externos e o tipo selecionado.
3. WHEN a criação falha THEN o sistema SHALL manter os valores do formulário e emitir um toast de erro com título `Não foi possível criar a conta` e descrição segura de `accountErrorMessage`.
4. WHILE a criação está pendente THEN o sistema SHALL desabilitar os campos e as ações do formulário.
5. WHEN um formulário usa `ControlledToggleGroup` THEN o sistema SHALL sincronizar a opção única, o erro, a descrição, o estado desabilitado e o desfoque com React Hook Form.
6. WHEN a categoria está em modo de criação THEN o sistema SHALL usar `ControlledToggleGroup` para o tipo sem alterar a opção inicial ou o comando criado.

**Independent Test**: Enviar contas e categorias válidas, inválidas e com mutação rejeitada nos testes de componente.

## Edge Cases

- IF não há livro ativo THEN o sistema SHALL mostrar o alerta existente e não renderizar os campos de conta.
- WHEN o usuário desmarca a única opção do seletor THEN o sistema SHALL armazenar valor vazio para que o schema exiba o erro de tipo obrigatório.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ACRHF-01 | P1: Criar conta com campos validados e reutilizáveis | Execute | Verified |
| ACRHF-02 | P1: Criar conta com campos validados e reutilizáveis | Execute | Verified |
| ACRHF-03 | P1: Criar conta com campos validados e reutilizáveis | Execute | Verified |
| ACRHF-04 | P1: Criar conta com campos validados e reutilizáveis | Execute | Verified |
| ACRHF-05 | P1: Criar conta com campos validados e reutilizáveis | Execute | Verified |
| ACRHF-06 | P1: Criar conta com campos validados e reutilizáveis | Execute | Verified |
| ACRHF-07 | P1: Criar conta com campos validados e reutilizáveis | Execute | Verified |
| ACRHF-08 | P1: Criar conta com campos validados e reutilizáveis | Execute | Verified |

**Coverage:** 8 total, 8 mapped to implementation.

## Success Criteria

- [ ] O formulário de conta usa `zodResolver` e os campos compartilhados.
- [ ] Conta e categoria compartilham o seletor controlado de escolha única.
- [ ] Os testes focados passam, exceto falhas comprovadamente preexistentes fora do seletor.
