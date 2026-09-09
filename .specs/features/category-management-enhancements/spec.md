# Metadados Visuais e Gestão de Categorias

**Status:** Confirmada em 2026-09-09
**Criada em:** 2026-09-09
**Escopo:** domínio, aplicação, persistência SQLite e gestão de categorias na aplicação Tauri

## Problem Statement

As categorias possuem hoje apenas nome, tipo, status e versão. A aplicação não persiste uma identidade visual por categoria, não permite editar uma categoria pela UI e mantém categorias arquivadas fora da experiência de gestão, apesar de os contratos de consulta e reativação já existirem.

Esta feature adiciona ícone e cor obrigatórios às categorias do usuário. Ela também cria limites de aplicação próprios para categorias e completa os fluxos de criação, edição, arquivamento, consulta de arquivadas e reativação na tela de categorias.

## Goals

- [ ] Persistir um ícone e uma cor hexadecimal opaca para cada categoria do usuário.
- [ ] Disponibilizar um catálogo tipado que liste e resolva os ícones da biblioteca local por chave estável.
- [ ] Refatorar a criação de categorias para o padrão React Hook Form, Zod e toast usado pelos formulários de transação.
- [ ] Reutilizar a camada de campos controlados da aplicação e adicionar um campo controlado para o seletor de cor.
- [ ] Permitir editar nome, ícone e cor sem alterar o tipo contábil da categoria.
- [ ] Permitir consultar categorias arquivadas e reativá-las pela UI.
- [ ] Manter migração, mutações e invalidações atômicas e isoladas pelo livro ativo.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar `INCOME` para `EXPENSE` ou vice-versa | O tipo é parte da identidade contábil e permanece imutável. |
| Adicionar metadados visuais a contas financeiras ou contas de sistema | Ícone e cor pertencem apenas às categorias gerenciáveis pelo usuário. |
| Exibir ícone e cor em formulários ou listas de transações | Esta entrega termina a gestão de categorias; consumidores externos ficam para uma feature posterior. |
| Upload, desenho ou importação de ícones personalizados | As opções vêm exclusivamente da biblioteca local `category-icons`. |
| Transparência, canal alpha ou cores hexadecimais de oito dígitos | Categorias usam somente cores opacas de seis dígitos. |
| Exclusão física de categorias | O ciclo continua baseado em arquivamento e reativação. |
| Ações em lote, ordenação manual ou busca textual | Não são necessárias para completar os fluxos solicitados. |
| Sincronização remota ou compartilhamento de catálogos | O produto permanece local-first e usa o SQLite local. |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida pela solicitação, pelo código existente ou pela confirmação do usuário em 2026-09-09.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Estrutura do catálogo de ícones | Um único objeto `readonly` tipado relaciona cada chave ao componente; nomes e entradas são derivados desse objeto. | Lookup por propriedade é direto, funciona bem com TypeScript e bundlers e evita a duplicação atual entre a lista de nomes e o objeto de componentes. | Sim, confirmado em 2026-09-09 |
| Persistência do ícone | Coluna `icon_key` com uma chave slug estável da biblioteca. | O banco armazena apenas a referência e a UI resolve o componente em memória. | Sim, solicitação do usuário |
| Persistência da cor | Coluna `color_hex` com exatamente seis caracteres hexadecimais minúsculos, sem `#`. | É uma forma canônica, opaca e sem prefixo repetitivo. | Sim, confirmado em 2026-09-09 |
| Compatibilidade com categorias existentes | Backfill `label-dollar`; cor `10b981` para receitas e `f43f5e` para despesas. | Preserva a distinção visual verde/rosa já usada nos cards e garante campos obrigatórios após a migração. | Sim, confirmado em 2026-09-09 |
| Chave de ícone desconhecida na leitura | Renderizar `label-dollar` como fallback e manter a categoria operável. | Uma versão futura da biblioteca não deve derrubar a tela por dados antigos ou corrompidos. | Sim, confirmado em 2026-09-09 |
| Padrões da criação | Categoria inicia como `EXPENSE`, com `label-dollar` e `f43f5e`. | Mantém o tipo padrão atual e oferece valores válidos antes da primeira interação. | Sim, confirmado em 2026-09-09 |
| Serviço de edição | Um `UpdateCategory` altera nome, ícone e cor em uma única transação e uma única versão. | Evita três mutações parciais e substitui o rename genérico no fluxo de categorias. | Sim, confirmado em 2026-09-09 |
| Serviços de ciclo de vida | Categorias usam `ArchiveCategory` e `ReactivateCategory` dedicados. | O facade atual reutiliza serviços de conta e não protege por si só o limite de tipo da categoria. | Sim, confirmado em 2026-09-09 |
| Formulário de edição | Reutilizar o formulário de categoria em modo de edição dentro do painel lateral controlado existente. | Mantém validação, feedback e campos em uma única fonte sem trocar o padrão atual da página. | Sim, confirmado em 2026-09-09 |
| Edição de categoria arquivada | Permitir editar nome, ícone e cor antes ou depois de reativar. | Arquivamento interrompe o uso em novos lançamentos, mas não precisa bloquear manutenção de metadados. | Sim, confirmado em 2026-09-09 |
| Navegação entre estados | Dois filtros exclusivos, `Ativas` e `Arquivadas`, coexistem com `Todas`, `Receitas` e `Despesas`; o padrão é `Ativas` e `Todas`. | Preserva o filtro atual por tipo e torna o arquivo descobrível sem nova rota. | Sim, confirmado em 2026-09-09 |
| Feedback de mutations | Falhas usam toast; sucesso é indicado pelo fechamento do painel e atualização da lista. | Replica o padrão dos formulários de transação sem acumular alertas persistentes nos cards. | Sim, confirmado em 2026-09-09 |
| Cor aplicada ao card | A cor alimenta o filete de destaque e o traço do ícone; o fundo continua semântico. | Usa a escolha do usuário sem criar problema de contraste para texto. | Sim, confirmado em 2026-09-09 |
| Campos controlados do formulário | Usar `ControlledInput` para nome, `ControlledField` com `Controller` nos seletores de tipo e ícone e o novo `ControlledColorPicker` para cor. | Reutiliza o contrato já consumido pelos formulários de transação e preserva o `ToggleGroup` apropriado para a escolha binária de tipo. | Sim, confirmado em 2026-09-09 |
| Local do campo controlado de cor | Criar `ControlledColorPicker` em `apps/tauri/src/components/forms/`. | O componente adapta o `ColorPicker` compartilhado ao contrato de formulário da aplicação Tauri. | Sim, confirmado em 2026-09-09 |

**Open questions:** none - todas as decisões foram confirmadas.

---

## User Stories

### P1: Persistir metadados visuais obrigatórios ⭐ MVP

**User Story**: Como pessoa que organiza um livro financeiro, quero que cada categoria tenha ícone e cor persistidos para reconhecê-la visualmente em todas as sessões.

**Why P1**: Os novos campos sustentam todos os fluxos de criação, edição e exibição desta feature.

**Acceptance Criteria**:

1. The system SHALL representar toda categoria do usuário com `iconKey` não vazio e `colorHex` não vazio nos contratos de domínio, aplicação e leitura. (`CAT-01`)
2. The system SHALL normalizar `colorHex` para exatamente seis caracteres minúsculos no intervalo `0-9a-f`. (`CAT-02`)
3. The system SHALL persistir `color_hex` sem o caractere `#` no SQLite. (`CAT-03`)
4. WHEN uma categoria for lida do SQLite THEN o sistema SHALL retornar `iconKey` e `colorHex` nos resumos de receita, despesa, gestão e detalhe. (`CAT-04`)
5. WHEN a migração encontrar uma categoria de receita existente THEN o sistema SHALL preencher `icon_key` com `label-dollar` e `color_hex` com `10b981`. (`CAT-05`)
6. WHEN a migração encontrar uma categoria de despesa existente THEN o sistema SHALL preencher `icon_key` com `label-dollar` e `color_hex` com `f43f5e`. (`CAT-06`)
7. WHILE um ledger account for financeiro ou de sistema, o sistema SHALL manter os metadados visuais ausentes de seus contratos públicos. (`CAT-07`)
8. IF a migração de metadados falhar THEN o sistema SHALL preservar o schema e os dados anteriores sem estado parcial. (`CAT-08`)
9. IF uma criação ou atualização receber cor fora do formato canônico THEN o sistema SHALL rejeitar a operação antes de persistir qualquer campo. (`CAT-09`)
10. IF uma criação ou atualização receber uma chave de ícone vazia ou fora do formato slug THEN o sistema SHALL rejeitar a operação antes de persistir qualquer campo. (`CAT-10`)
11. WHILE uma linha representar uma categoria gerenciável, o SQLite SHALL rejeitar `icon_key` ou `color_hex` nulos, vazios ou fora de seus formatos definidos. (`CAT-70`)

**Independent Test**: Migrar uma base com categorias de ambos os tipos e contas não categóricas; verificar backfill, formato sem `#`, read models completos, rejeição de valores inválidos e rollback de uma migração interrompida.

---

### P1: Listar e resolver a biblioteca de ícones ⭐ MVP

**User Story**: Como pessoa que escolhe ou visualiza uma categoria, quero acessar os ícones disponíveis e resolver o ícone salvo para ver a opção correta sem atraso perceptível.

**Why P1**: A chave persistida só é útil se houver uma fonte de verdade estável para seleção e renderização.

**Acceptance Criteria**:

1. The system SHALL manter uma única associação tipada entre cada chave de ícone e seu componente React. (`CAT-11`)
2. WHEN a UI solicitar um ícone por chave válida THEN o sistema SHALL retornar o componente associado por lookup direto sem percorrer a coleção. (`CAT-12`)
3. WHEN a UI solicitar todas as opções THEN o sistema SHALL retornar cada chave única e seu componente exatamente uma vez em ordem determinística. (`CAT-13`)
4. IF uma chave persistida não existir na versão atual da biblioteca THEN o sistema SHALL retornar o componente `label-dollar` como fallback. (`CAT-14`)
5. WHEN uma chave publicada precisar ser renomeada ou removida THEN o sistema SHALL exigir uma migração dos valores persistidos antes da mudança do catálogo. (`CAT-15`)
6. WHEN um componente consumidor receber um ícone resolvido THEN o sistema SHALL passar o componente React em vez da chave textual para a composição visual. (`CAT-16`)

**Independent Test**: Comparar chaves, entradas e componentes do catálogo; resolver primeira, intermediária, última e desconhecida; provar unicidade, ordem estável e fallback.

---

### P1: Criar categoria com formulário validado ⭐ MVP

**User Story**: Como pessoa com um livro ativo, quero criar uma categoria com nome, tipo, ícone e cor para usá-la imediatamente com uma identidade visual própria.

**Why P1**: Novas categorias não podem nascer sem os campos obrigatórios.

**Acceptance Criteria**:

1. WHEN o formulário de criação abrir THEN o sistema SHALL inicializar React Hook Form com o resolver Zod e os valores `EXPENSE`, `label-dollar` e `f43f5e`. (`CAT-17`)
2. WHEN o formulário de criação for renderizado THEN o sistema SHALL solicitar nome, tipo, ícone e cor como campos obrigatórios. (`CAT-18`)
3. WHEN o seletor de ícone abrir THEN o sistema SHALL exibir todas as opções fornecidas pelo catálogo tipado. (`CAT-19`)
4. WHEN o controle de cor for renderizado THEN o sistema SHALL omitir slider, percentual e formato de canal alpha. (`CAT-20`)
5. WHEN o usuário escolher uma cor THEN o sistema SHALL manter no estado do formulário somente o hexadecimal opaco canônico de seis caracteres. (`CAT-21`)
6. WHEN o valor controlado da cor mudar externamente THEN o sistema SHALL refletir exatamente essa cor no seletor sem alterar seus canais. (`CAT-22`)
7. IF nome, tipo, ícone ou cor forem inválidos THEN o sistema SHALL impedir a mutation e mostrar o erro junto ao campo correspondente. (`CAT-23`)
8. WHEN o formulário válido for submetido THEN o sistema SHALL enviar exatamente um comando com `bookId`, nome normalizado, tipo, `iconKey` e `colorHex`. (`CAT-24`)
9. WHILE a criação estiver pendente, o sistema SHALL desabilitar os controles e impedir uma segunda submissão concorrente. (`CAT-25`)
10. WHEN a criação concluir THEN o sistema SHALL fechar o painel e invalidar as listas de categorias do livro do comando. (`CAT-26`)
11. IF a criação falhar THEN o sistema SHALL manter os valores preenchidos e exibir um toast traduzido sem revelar detalhes internos. (`CAT-27`)
12. WHILE não houver livro ativo, o sistema SHALL substituir os campos por uma orientação para selecionar um livro. (`CAT-28`)
13. WHEN o campo de nome for renderizado THEN o sistema SHALL usar `ControlledInput` de `apps/tauri/src/components/forms/`. (`CAT-72`)
14. WHEN o tipo puder ser escolhido na criação THEN o sistema SHALL integrar o `ToggleGroup` a React Hook Form por `Controller` e `ControlledField` de `apps/tauri/src/components/forms/`. (`CAT-73`)
15. WHEN o seletor de ícone for renderizado THEN o sistema SHALL reutilizar `ControlledField` para rótulo, descrição, erro e estado desabilitado. (`CAT-74`)
16. The system SHALL disponibilizar `ControlledColorPicker` em `apps/tauri/src/components/forms/` com o contrato genérico `ControlledFieldProps` para valores `string`. (`CAT-75`)
17. WHEN `ControlledColorPicker` for renderizado THEN o sistema SHALL delegar rótulo, descrição, erro e estado desabilitado a `ControlledField`. (`CAT-76`)
18. WHEN o usuário alterar `ControlledColorPicker` THEN o sistema SHALL gravar o hexadecimal canônico no campo registrado do React Hook Form. (`CAT-77`)
19. WHEN React Hook Form aplicar valores iniciais ou `reset` THEN o sistema SHALL sincronizar `ControlledColorPicker` com o valor do formulário sem emitir uma alteração divergente. (`CAT-78`)
20. WHILE `ControlledColorPicker` estiver desabilitado, o sistema SHALL bloquear interações que alterem o valor registrado. (`CAT-79`)

**Independent Test**: Criar receita e despesa com opções diferentes, confirmar o comando e a persistência; repetir sem livro, com cada campo inválido, dupla submissão e falha de serviço; provar integração, reset, erro e estado desabilitado dos campos controlados.

---

### P1: Atualizar uma categoria por serviço dedicado ⭐ MVP

**User Story**: Como pessoa que alterou sua organização, quero atualizar nome, ícone e cor de uma categoria sem mudar seu significado contábil.

**Why P1**: A edição solicitada precisa de uma mutation atômica e protegida por versão.

**Acceptance Criteria**:

1. WHEN `UpdateCategory` receber um comando válido THEN o sistema SHALL localizar a categoria pelo `bookId` e `categoryId` informados. (`CAT-29`)
2. IF o identificador apontar para uma conta financeira, conta de sistema ou categoria de outro livro THEN o sistema SHALL rejeitar o comando sem persistir alterações. (`CAT-30`)
3. IF `expectedVersion` divergir da versão persistida THEN o sistema SHALL retornar `OPTIMISTIC_CONCURRENCY_FAILURE` sem persistir alterações. (`CAT-31`)
4. IF o nome normalizado já existir para outra categoria do mesmo livro e tipo THEN o sistema SHALL retornar `DUPLICATE_ENTITY` sem persistir alterações. (`CAT-32`)
5. WHEN nome, ícone ou cor mudar THEN o sistema SHALL persistir os três valores de forma atômica e incrementar a versão exatamente uma vez. (`CAT-33`)
6. WHEN uma atualização concluir THEN o sistema SHALL preservar identificador, livro, tipo, status e finalidade de sistema anteriores. (`CAT-34`)
7. WHEN uma atualização repetir os valores persistidos THEN o sistema SHALL concluir sem incrementar a versão nem publicar um novo fato de domínio. (`CAT-35`)
8. WHEN `UpdateCategory` concluir THEN o sistema SHALL retornar um `CategoryDto` com nome, tipo, status, ícone, cor e versão resultantes. (`CAT-36`)
9. WHEN uma categoria for arquivada ou reativada THEN o sistema SHALL executar um serviço dedicado que valide o limite de categoria antes da transição. (`CAT-37`)
10. IF uma mutation dedicada falhar em qualquer etapa THEN o sistema SHALL manter agregado, SQLite e fatos de domínio no estado anterior à tentativa. (`CAT-38`)
11. WHEN uma atualização alterar ao menos um campo THEN o sistema SHALL publicar exatamente um fato `CategoryUpdated` com o estado resultante da categoria. (`CAT-71`)

**Independent Test**: Atualizar cada campo isoladamente e em conjunto; provar incremento único, no-op, duplicidade, conflito, isolamento por livro, proteção de contas não categóricas e rollback integral.

---

### P1: Editar categoria na UI ⭐ MVP

**User Story**: Como pessoa que gerencia categorias, quero abrir uma categoria existente e editar seus dados para corrigir ou renovar sua identidade visual.

**Why P1**: A aplicação Tauri ainda não expõe a edição já esperada pela gestão de categorias.

**Acceptance Criteria**:

1. WHILE uma categoria ativa ou arquivada estiver listada, o sistema SHALL disponibilizar uma ação acessível `Editar <nome>`. (`CAT-39`)
2. WHEN o usuário acionar a edição THEN o sistema SHALL abrir o painel lateral com nome, ícone e cor atuais preenchidos. (`CAT-40`)
3. WHILE o formulário estiver em modo de edição, o sistema SHALL apresentar o tipo como informação imutável sem controle para alterá-lo. (`CAT-41`)
4. WHEN uma edição válida for submetida THEN o sistema SHALL enviar um único `UpdateCategoryCommand` com o `expectedVersion` carregado. (`CAT-42`)
5. WHILE a edição estiver pendente, o sistema SHALL desabilitar fechamento por ação do formulário e nova submissão. (`CAT-43`)
6. WHEN a edição concluir THEN o sistema SHALL fechar o painel e atualizar detalhe, listas de gestão e seletores do livro do comando. (`CAT-44`)
7. IF a edição falhar THEN o sistema SHALL manter o painel aberto, preservar os valores e exibir um toast traduzido. (`CAT-45`)
8. IF a edição falhar por conflito de versão THEN o sistema SHALL recarregar a categoria e exigir uma nova ação explícita antes de reenviar. (`CAT-46`)

**Independent Test**: Editar uma categoria ativa e uma arquivada; verificar preenchimento, payload, tipo imutável, sucesso, falha comum, conflito e atualização dos consumidores.

---

### P1: Consultar arquivadas e reativar categoria ⭐ MVP

**User Story**: Como pessoa que arquivou uma categoria, quero encontrá-la e reativá-la para voltar a usá-la sem recriá-la.

**Why P1**: O serviço existe, mas o ciclo de vida permanece incompleto sem descoberta e ação na UI.

**Acceptance Criteria**:

1. WHILE houver um livro ativo, o sistema SHALL consultar a gestão de categorias com `includeArchived: true`. (`CAT-47`)
2. WHEN a página abrir THEN o sistema SHALL selecionar `Ativas` e `Todas` como filtros padrão. (`CAT-48`)
3. WHEN o usuário selecionar `Arquivadas` THEN o sistema SHALL exibir somente categorias com status `ARCHIVED` que também satisfaçam o filtro de tipo. (`CAT-49`)
4. WHEN o usuário selecionar `Ativas` THEN o sistema SHALL exibir somente categorias com status `ACTIVE` que também satisfaçam o filtro de tipo. (`CAT-50`)
5. WHILE uma categoria estiver ativa, o sistema SHALL oferecer as ações `Editar` e `Arquivar`. (`CAT-51`)
6. WHILE uma categoria estiver arquivada, o sistema SHALL oferecer as ações `Editar` e `Reativar` sem oferecer `Arquivar`. (`CAT-52`)
7. WHEN o usuário reativar uma categoria THEN o sistema SHALL enviar `bookId`, `categoryId` e a versão atual exatamente uma vez. (`CAT-53`)
8. WHEN a reativação concluir THEN o sistema SHALL invalidar as consultas do livro e remover a categoria da visão `Arquivadas`. (`CAT-54`)
9. IF a reativação falhar THEN o sistema SHALL manter a categoria visível e exibir um toast traduzido sem detalhes internos. (`CAT-55`)
10. IF a combinação de status e tipo não tiver resultados THEN o sistema SHALL exibir um empty state que preserve acesso aos filtros e à criação quando aplicável. (`CAT-56`)
11. IF a consulta falhar THEN o sistema SHALL exibir um alerta com ação de tentar novamente sem representar a falha como lista vazia. (`CAT-57`)

**Independent Test**: Alternar status e tipo em um livro com categorias ativas e arquivadas; arquivar, reativar, simular erro e validar a movimentação entre visões após invalidação.

---

### P2: Exibir identidade visual com acessibilidade

**User Story**: Como pessoa que usa mouse, teclado ou tecnologia assistiva, quero reconhecer e operar categorias sem depender apenas da cor.

**Why P2**: Ícone e cor melhoram a experiência apenas quando nome, tipo, foco e ações continuam claros.

**Acceptance Criteria**:

1. WHEN um card de categoria for renderizado THEN o sistema SHALL resolver `iconKey` e exibir o componente com a cor formada por `#` mais `colorHex`. (`CAT-58`)
2. WHEN um card de categoria for renderizado THEN o sistema SHALL aplicar a cor ao filete de destaque sem substituir o nome ou o rótulo textual do tipo. (`CAT-59`)
3. WHEN uma opção de ícone receber foco ou seleção THEN o sistema SHALL expor nome acessível e estado selecionado para tecnologia assistiva. (`CAT-60`)
4. WHEN os filtros de status ou tipo receberem foco THEN o sistema SHALL permitir seleção por teclado e expor exatamente uma opção selecionada em cada grupo. (`CAT-61`)
5. WHILE um painel de criação ou edição estiver aberto, o sistema SHALL manter título acessível e devolver o foco ao acionador após fechar. (`CAT-62`)
6. IF o ícone não puder ser resolvido THEN o sistema SHALL manter nome, tipo e ações da categoria disponíveis. (`CAT-63`)

**Independent Test**: Operar criação, edição, filtros e ciclo de vida por teclado; inspecionar nomes e estados acessíveis; renderizar uma chave desconhecida e confirmar o fallback sem perda funcional.

---

## Edge Cases

- IF o livro ativo mudar com um painel aberto THEN o sistema SHALL fechar o painel, descartar o `expectedVersion` anterior e consultar o novo livro. (`CAT-64`)
- IF uma mutation concluir depois da troca de livro THEN o sistema SHALL invalidar somente caches identificados pelo `bookId` do comando. (`CAT-65`)
- IF a invalidação falhar depois de uma mutation persistida THEN o sistema SHALL manter o sucesso da mutation e exibir orientação para recarregar os dados. (`CAT-66`)
- IF o conta-gotas retornar uma cor com alpha THEN o sistema SHALL descartar o alpha e armazenar somente os seis caracteres RGB. (`CAT-67`)
- IF uma cor manual contiver `#`, três dígitos, oito dígitos ou caracteres fora de `0-9a-fA-F` THEN o sistema SHALL impedir a submissão e identificar o campo de cor como inválido. (`CAT-68`)
- IF uma categoria arquivada for reativada duas vezes com a mesma versão THEN o sistema SHALL manter uma única transição persistida. (`CAT-69`)

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | `CAT-02`, `CAT-09`, `CAT-10`, `CAT-20` a `CAT-23`, `CAT-67`, `CAT-68`, `CAT-70` e `CAT-72` a `CAT-79` definem formato, opacidade, validação e integração dos campos controlados. |
| Failure / partial-failure states | `CAT-08`, `CAT-27`, `CAT-38`, `CAT-45`, `CAT-55`, `CAT-57` e `CAT-66` cobrem rollback, falhas de mutation, consulta e invalidação. |
| Idempotency / retry / duplicate handling | `CAT-25`, `CAT-32`, `CAT-35`, `CAT-53` e `CAT-69` impedem duplicidade e definem no-op. |
| Auth boundaries & rate limits | N/A porque a aplicação é local-first, não introduz endpoint remoto e opera somente no livro ativo. |
| Concurrency / ordering | `CAT-13`, `CAT-31`, `CAT-42`, `CAT-46`, `CAT-53` e `CAT-65` cobrem ordem determinística, versão otimista e isolamento de caches. |
| Data lifecycle / expiry | `CAT-05`, `CAT-06`, `CAT-15` e `CAT-47` a `CAT-55` cobrem migração, estabilidade de chaves, arquivamento e reativação; N/A para expiração porque categorias não possuem TTL. |
| Observability | N/A porque não há processo em background ou integração externa; falhas ficam visíveis por alerta ou toast sem expor detalhes internos. |
| External-dependency failure | N/A porque biblioteca de ícones, serviços e SQLite são locais; suas falhas estão cobertas pelos critérios de fallback e rollback. |
| State-transition integrity | `CAT-30`, `CAT-31`, `CAT-34`, `CAT-37`, `CAT-46`, `CAT-51` a `CAT-55`, `CAT-69` e `CAT-71` protegem tipo, livro, versão, fatos e transições. |

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CAT-01 | P1: Persistir metadados | Tasks | T1/T4/T10 complete |
| CAT-02 | P1: Persistir metadados | Tasks | T1/T10 complete |
| CAT-03 | P1: Persistir metadados | Tasks | T9/T11 complete |
| CAT-04 | P1: Persistir metadados | Tasks | T2/T10/T12 complete |
| CAT-05 | P1: Persistir metadados | Tasks | T9 complete |
| CAT-06 | P1: Persistir metadados | Tasks | T9 complete |
| CAT-07 | P1: Persistir metadados | Tasks | T1/T10 complete |
| CAT-08 | P1: Persistir metadados | Tasks | T9 complete |
| CAT-09 | P1: Persistir metadados | Tasks | T1/T4 complete |
| CAT-10 | P1: Persistir metadados | Tasks | T1/T4 complete |
| CAT-11 | P1: Catálogo de ícones | Tasks | In Tasks |
| CAT-12 | P1: Catálogo de ícones | Tasks | In Tasks |
| CAT-13 | P1: Catálogo de ícones | Tasks | In Tasks |
| CAT-14 | P1: Catálogo de ícones | Tasks | In Tasks |
| CAT-15 | P1: Catálogo de ícones | Tasks | In Tasks |
| CAT-16 | P1: Catálogo de ícones | Tasks | In Tasks |
| CAT-17 | P1: Criar categoria | Tasks | In Tasks |
| CAT-18 | P1: Criar categoria | Tasks | In Tasks |
| CAT-19 | P1: Criar categoria | Tasks | In Tasks |
| CAT-20 | P1: Criar categoria | Tasks | In Tasks |
| CAT-21 | P1: Criar categoria | Tasks | In Tasks |
| CAT-22 | P1: Criar categoria | Tasks | In Tasks |
| CAT-23 | P1: Criar categoria | Tasks | In Tasks |
| CAT-24 | P1: Criar categoria | Tasks | T2/T4/T15 complete |
| CAT-25 | P1: Criar categoria | Tasks | T15 complete |
| CAT-26 | P1: Criar categoria | Tasks | T14/T15 complete; lifecycle coverage remains in T16 |
| CAT-27 | P1: Criar categoria | Tasks | In Tasks |
| CAT-28 | P1: Criar categoria | Tasks | In Tasks |
| CAT-29 | P1: Atualizar categoria | Tasks | T5 complete |
| CAT-30 | P1: Atualizar categoria | Tasks | T5/T6/T7/T13 complete |
| CAT-31 | P1: Atualizar categoria | Tasks | T5/T6/T7 complete |
| CAT-32 | P1: Atualizar categoria | Tasks | T5 complete |
| CAT-33 | P1: Atualizar categoria | Tasks | T1/T4/T5/T11 complete |
| CAT-34 | P1: Atualizar categoria | Tasks | T1/T5/T11 complete |
| CAT-35 | P1: Atualizar categoria | Tasks | T1/T5/T11 complete |
| CAT-36 | P1: Atualizar categoria | Tasks | T2/T4/T5 complete |
| CAT-37 | P1: Atualizar categoria | Tasks | T2/T6/T7/T13 complete |
| CAT-38 | P1: Atualizar categoria | Tasks | T3/T4/T5/T6/T7/T11 complete |
| CAT-39 | P1: Editar na UI | Tasks | In Tasks |
| CAT-40 | P1: Editar na UI | Tasks | In Tasks |
| CAT-41 | P1: Editar na UI | Tasks | In Tasks |
| CAT-42 | P1: Editar na UI | Tasks | In Tasks |
| CAT-43 | P1: Editar na UI | Tasks | In Tasks |
| CAT-44 | P1: Editar na UI | Tasks | T14 complete; lifecycle coverage remains in T16 |
| CAT-45 | P1: Editar na UI | Tasks | In Tasks |
| CAT-46 | P1: Editar na UI | Tasks | In Tasks |
| CAT-47 | P1: Arquivadas e reativação | Tasks | T12 complete; remaining UI coverage in T23 |
| CAT-48 | P1: Arquivadas e reativação | Tasks | In Tasks |
| CAT-49 | P1: Arquivadas e reativação | Tasks | In Tasks |
| CAT-50 | P1: Arquivadas e reativação | Tasks | In Tasks |
| CAT-51 | P1: Arquivadas e reativação | Tasks | In Tasks |
| CAT-52 | P1: Arquivadas e reativação | Tasks | In Tasks |
| CAT-53 | P1: Arquivadas e reativação | Tasks | In Tasks |
| CAT-54 | P1: Arquivadas e reativação | Tasks | T14 complete; lifecycle coverage remains in T16 |
| CAT-55 | P1: Arquivadas e reativação | Tasks | In Tasks |
| CAT-56 | P1: Arquivadas e reativação | Tasks | In Tasks |
| CAT-57 | P1: Arquivadas e reativação | Tasks | In Tasks |
| CAT-58 | P2: Acessibilidade visual | Tasks | In Tasks |
| CAT-59 | P2: Acessibilidade visual | Tasks | In Tasks |
| CAT-60 | P2: Acessibilidade visual | Tasks | In Tasks |
| CAT-61 | P2: Acessibilidade visual | Tasks | In Tasks |
| CAT-62 | P2: Acessibilidade visual | Tasks | In Tasks |
| CAT-63 | P2: Acessibilidade visual | Tasks | In Tasks |
| CAT-64 | Edge case: troca de livro | Tasks | In Tasks |
| CAT-65 | Edge case: cache por livro | Tasks | T14/T15 complete; lifecycle coverage remains in T16 |
| CAT-66 | Edge case: invalidação parcial | Tasks | T14/T15 complete; lifecycle coverage remains in T16 |
| CAT-67 | Edge case: conta-gotas | Tasks | In Tasks |
| CAT-68 | Edge case: cor manual | Tasks | In Tasks |
| CAT-69 | Edge case: reativação repetida | Tasks | T7/T11 complete |
| CAT-70 | P1: Persistir metadados | Tasks | T1/T9/T10/T11 complete |
| CAT-71 | P1: Atualizar categoria | Tasks | T1/T5 complete |
| CAT-72 | P1: Criar categoria | Tasks | In Tasks |
| CAT-73 | P1: Criar categoria | Tasks | In Tasks |
| CAT-74 | P1: Criar categoria | Tasks | In Tasks |
| CAT-75 | P1: Criar categoria | Tasks | In Tasks |
| CAT-76 | P1: Criar categoria | Tasks | In Tasks |
| CAT-77 | P1: Criar categoria | Tasks | In Tasks |
| CAT-78 | P1: Criar categoria | Tasks | In Tasks |
| CAT-79 | P1: Criar categoria | Tasks | In Tasks |

**Coverage:** 79 requisitos, 79 mapeados no design e em tasks, 0 pendentes de decomposição.

## Success Criteria

- [ ] Toda categoria gerenciável possui ícone e cor válidos após criar, migrar ou editar.
- [ ] A UI lista todos os ícones e resolve qualquer chave válida sem varredura da coleção.
- [ ] Criação e edição bloqueiam dados inválidos, preservam valores após falha e não duplicam mutations.
- [ ] Os campos de categoria reutilizam a camada controlada da aplicação e o seletor de cor permanece sincronizado com React Hook Form.
- [ ] Uma categoria arquivada pode ser encontrada, editada e reativada sem mudar tipo, livro ou histórico.
- [ ] Nenhuma falha ou conflito produz atualização parcial entre agregado, SQLite, eventos e cache visível.
- [ ] Os 79 requisitos possuem evidência automatizada ou UAT explícita antes da conclusão da feature.
