# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 16 / T93 gate verde; T94 é a próxima tarefa
- **Completed**: T1–T93 e T95–T97; T93 está no commit corrente após o fechamento atômico. O ajuste autorizado de fixture anterior à T93 está em `4f2e6c8`.
- **Evidence**: T93 registra 13 cenários de rota/shell e UAT nativa N1–N6/N8 + N7 de Investimentos com Tauri/WebKitGTK e banco isolado; detalhes em `tasks.md`. Full React 86 arquivos/1049 testes; SQLite 53/974; builds de dependências, migrações, lint/tipos SQLite, UI e app, build Vite, `git diff --check`, `validate_tasks.py` e `validate_spec.py` verdes. Nenhum teste removido/pulado. O aviso de chunk Vite >500 kB permanece.
- **Next step**: iniciar T94 somente após confirmar o commit T93 no Git; integrar tipo/filtro/detalhe INVESTMENT em Transações, executar N7 completo e regressões nativas afetadas, gate Final e Verifier independente com sensor; rodar `validate_state.py` antes de declarar a feature pronta.
- **Open note**: amendment da última venda total pode ser rejeitado por `assertCanAllocate` no estado CLOSED; verificar no gate final/Verifier e corrigir em tarefa própria se confirmado. A tabela de Transações mostrou data 30/09 para transferência lançada em 01/10 na UAT; verificar no trabalho de integração T94 antes de fechar.
- **Uncommitted files**: nenhum esperado depois do commit T93; conferir `git status --short` antes de T94.
- **Branch**: main
