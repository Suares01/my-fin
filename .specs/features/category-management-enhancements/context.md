# Metadados Visuais e Gestão de Categorias - Contexto

**Coletado em:** 2026-09-09
**Spec:** `.specs/features/category-management-enhancements/spec.md`
**Status:** Pronto para design

---

## Feature Boundary

Esta feature adiciona ícone e cor obrigatórios às categorias do usuário, cria serviços de aplicação específicos para editar e proteger seu ciclo de vida e completa a gestão na aplicação Tauri com criação refatorada, edição, visualização de arquivadas e reativação. Ela não altera lançamentos, saldos, regras de débito/crédito ou o tipo contábil de uma categoria.

---

## Análise do Código Atual

### Estrutura de domínio e persistência

- Categorias não são um agregado separado. Elas são `LedgerAccount` com kind `INCOME` ou `EXPENSE`.
- `LedgerAccountSnapshot`, `AccountDto` e `CategorySummary` não possuem metadados visuais.
- `ledger_accounts` não possui colunas de ícone ou cor. Mapper, repository e queries selecionam explicitamente as colunas atuais.
- A base usa migrações SQL numeradas e gera `generated-migrations.ts`; a próxima alteração deve ser uma nova migração, sem editar as três já aplicadas.
- As categorias de sistema `UNCATEGORIZED_INCOME` e `UNCATEGORIZED_EXPENSE` compartilham os mesmos kinds, mas são excluídas das consultas de gestão por `system_purpose IS NULL`.

### Serviços e concorrência

- Criação usa `CreateIncomeCategory` e `CreateExpenseCategory`, ambos recebendo `CreateCategoryCommand` sem ícone ou cor.
- O facade `services.categories` reutiliza `RenameLedgerAccount`, `ArchiveLedgerAccount` e `ReactivateLedgerAccount`.
- Os serviços genéricos validam livro, versão e contas de sistema, mas o facade não transforma o grupo `categories` em um limite real: um ID de conta financeira ainda pode chegar ao serviço genérico.
- O repository exige incremento exato de uma versão em `save`, e os hooks já invalidam caches pelo `bookId` do comando.
- `useCategories` já suporta `includeArchived`, e `useReactivateCategory` já existe; a lacuna principal está na composição da UI.

### Formulário e feedback

- `CategoryForm` já usa React Hook Form e Zod, mas executa `safeParse` e validações manuais em vez de `zodResolver`.
- Falhas de criação são exibidas em `Alert` dentro do formulário. Os formulários de transação centralizam submissão e usam `toast.add` para erros.
- O formulário atual pede somente nome e tipo, inicia em `EXPENSE` e fecha o `Sheet` controlado após sucesso ou cancelamento.
- O `Toaster` Base UI já está montado no bootstrap da aplicação.
- `apps/tauri/src/components/forms/` já oferece `ControlledInput`, `ControlledSelect`, `ControlledCurrencyInput` e `ControlledDatePicker` sobre `ControlledFieldProps`.
- Todos esses adaptadores usam `Controller` e `ControlledField` para padronizar valor, blur, erro, descrição, acessibilidade e estado desabilitado.
- Ainda não existe um adaptador controlado para `ColorPicker`.

### Catálogo de ícones e cor

- `category-icons/index.tsx` já possui lookup por objeto, fallback e listagem.
- A lista `categoryIconNames` e o objeto `categoryIconsLibrary` repetem manualmente as mesmas chaves, criando risco de drift.
- O catálogo está no limite correto da aplicação Tauri: o domínio pode persistir uma chave opaca e a UI conhece os componentes React.
- `ColorPicker` é composável e exporta `ColorPickerAlpha` separadamente, portanto a UI de categoria pode omitir o slider.
- `ColorPickerFormat` sempre mostra alpha e oferece formatos com alpha; a composição de categorias deve usar saída hexadecimal opaca.
- A sincronização controlada atual converte RGB para os campos HSL diretamente. O fluxo de edição precisa corrigir esse seam para representar a cor carregada sem trocar canais.

### Tela de categorias

- `CategoriesPage` chama `useCategories(false)`, então categorias arquivadas nunca chegam à tela.
- O filtro local remove arquivadas mesmo que a query passe a incluí-las.
- `CategoryCard` usa ícone e cores fixos por tipo e oferece somente arquivamento.
- Não há estado de seleção nem painel de edição, embora `useCategoryDetail` e invalidadores de ciclo de vida já existam.

---

## Implementation Decisions

### Catálogo de ícones

- O catálogo continuará em memória, no bundle da aplicação Tauri.
- Um objeto `readonly` tipado será a única fonte de verdade `chave -> componente`.
- A lista para o seletor será derivada do objeto em ordem determinística.
- O `Map` não será usado: ele não melhora o custo assintótico do lookup e perde simplicidade de tipagem, declaração e bundling neste catálogo estático.
- Chaves persistidas são identificadores estáveis. Remoção ou rename exige migração de dados.
- Consumidores visuais recebem o componente resolvido, não a string persistida.

### Metadados e SQLite

- O domínio trata `iconKey` como slug opaco não vazio; conhecer a lista concreta de componentes continua sendo responsabilidade da UI.
- `colorHex` é validado e normalizado para seis caracteres minúsculos.
- O SQLite armazena `icon_key` e `color_hex`; `#` existe apenas na borda de renderização CSS.
- O SQLite protege a obrigatoriedade e o formato desses campos para linhas de categorias gerenciáveis.
- Contas financeiras e contas de sistema não passam a expor esses metadados.
- Categorias existentes recebem defaults por migração para que a obrigatoriedade seja verdadeira também para dados legados.

### Serviços de categoria

- Criações existentes passam a exigir e retornar os metadados visuais.
- `UpdateCategory` substitui a combinação de rename e mutações separadas para nome, ícone e cor.
- `ArchiveCategory` e `ReactivateCategory` validam explicitamente que o alvo é uma categoria gerenciável.
- `CategoryDto` representa o retorno das mutations de categoria; `AccountDto` continua sendo o contrato das contas financeiras.
- Toda atualização usa `expectedVersion`, é atômica e mantém o kind imutável.
- Uma alteração real publica um único fato `CategoryUpdated`; uma atualização sem mudanças não incrementa versão nem publica fato.

### Criação e edição

- Um schema Zod define nome, tipo, ícone e cor; React Hook Form usa `zodResolver` como fonte de erro dos campos.
- O formulário compartilha campos e validação entre os modos criar e editar.
- Nome reutiliza `ControlledInput`; tipo reutiliza `ControlledField` e `Controller` ao redor do `ToggleGroup` no modo de criação.
- O seletor visual de ícone permanece específico de categorias, mas reutiliza `ControlledField` e o estado do `Controller`.
- Cor usa um novo `ControlledColorPicker` em `apps/tauri/src/components/forms/`.
- O modo de edição recebe valores iniciais da categoria e não oferece controle para mudar o tipo.
- O painel lateral atual permanece controlado e fecha somente por sucesso ou ação explícita permitida.
- Erros de mutation usam toast Base UI, preservam os valores e nunca exibem mensagens internas.

### Cor opaca

- `ControlledColorPicker` segue `ControlledFieldProps<TValues, string, TOutput>` e mantém React Hook Form como fonte de verdade.
- O adaptador propaga rótulo, descrição, erro e estado desabilitado por `ControlledField`.
- Valores iniciais e `reset` atualizam o seletor sem trocar canais ou emitir um valor divergente.
- A composição não renderiza `ColorPickerAlpha`.
- A saída do formulário é somente `rrggbb`; alpha recebido do conta-gotas é descartado.
- O preview pode adicionar `#` em memória, mas o valor submetido e persistido nunca o inclui.
- A cor do usuário aparece no filete e no traço do ícone. Texto e superfícies continuam usando tokens semânticos.

### Arquivamento e reativação

- A página carrega ativas e arquivadas em uma consulta local por livro.
- Um filtro exclusivo alterna `Ativas` e `Arquivadas`; o filtro atual de tipo continua independente.
- Cards ativos oferecem editar e arquivar. Cards arquivados oferecem editar e reativar.
- Edição é permitida nos dois estados; o status não faz parte do formulário.
- Sucesso invalida consultas pelo livro do comando. Falha mantém o item visível e usa toast.

### Agent's Discretion

- Geometria exata do seletor de ícones, desde que todas as opções sejam acessíveis por teclado e tenham nome e estado selecionado.
- Quantidade de colunas responsivas do catálogo de ícones e dos cards.
- Cópia curta de descrições auxiliares, desde que mensagens de erro e ações definidas na spec permaneçam reconhecíveis.
- Extração de hooks e models internos necessária para respeitar `react-refresh/only-export-components`.

### Declined / Undiscussed Gray Areas -> Assumptions

- Nenhuma decisão permanece sem confirmação. Os defaults de migração e criação, filtros, edição de arquivadas, aplicação da cor e serviços dedicados foram confirmados em 2026-09-09.
- Toast de sucesso não foi solicitado. Fechamento e atualização da lista são o feedback padrão; falhas usam toast.
- Não foi solicitada confirmação antes de arquivar ou reativar. As ações continuam diretas, protegidas por versão e estado pendente.

---

## Specific References

- Biblioteca de ícones: `apps/tauri/src/components/category-icons/`
- Seletor de cor: `packages/ui/src/components/color-picker.tsx`
- Formulário atual: `apps/tauri/src/features/categories/components/category-form.tsx`
- Campos controlados: `apps/tauri/src/components/forms/`
- Referências de formulário: `apps/tauri/src/features/transactions/components/income-form.tsx` e `expense-form.tsx`
- Tela e card atuais: `apps/tauri/src/features/categories/components/categories-page.tsx` e `category-card.tsx`
- Serviços compostos: `apps/tauri/src/bootstrap/create-services.ts`

---

## Deferred Ideas

- Exibir ícone e cor nos seletores e listas de transações.
- Permitir ícones personalizados.
- Adicionar busca, ordenação manual e ações em lote para categorias.
- Aplicar identidade visual semelhante a contas financeiras.
