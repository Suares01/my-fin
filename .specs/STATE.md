# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 16 / T94 gate verde; Verifier independente é o próximo passo após o commit T94
- **Completed**: T1–T97 implementadas; T94 aguarda apenas commit atômico e validação independente. O ajuste autorizado de fixture anterior à T93 está em `4f2e6c8`.
- **Evidence**: T94 adiciona 19 cenários (React 86/1049→1066; Application 28/259→261) e registra UAT nativa em 360px/1280px, filtro/busca, menu por teclado, vínculo especializado e venda mista com receita R$ 100, despesa R$ 15 e fluxo R$ 1.085; detalhes em `tasks.md`. Full Cross passou com Memory 55/638, SQLite 53/974, adapter Tauri 3/63; Domain 20/404, Application 28/261 e React 86/1066 verdes. Lint, tipos, builds, migrações, `git diff --check`, `validate_tasks.py` e `validate_spec.py` verdes, sem teste removido/pulado. T93 mantém UAT N1–N6/N8 e N7 de Investimentos. O aviso de chunk Vite >500 kB permanece.
- **Next step**: confirmar commit T94 no Git; despachar Verifier fresco para checagem da spec, sensor de discriminação em scratch e `validation.md`; corrigir gaps reais em tarefas próprias, então rodar `validate_state.py` antes de declarar a feature pronta.
- **Open note**: amendment da última venda total pode ser rejeitado por `assertCanAllocate` no estado CLOSED; verificar no Verifier e corrigir em tarefa própria se confirmado. A divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa.
- **Uncommitted files**: somente T94 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
