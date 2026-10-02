# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T117 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T116 implementadas; T116 `e7148fe`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T117 aguarda commit atômico.
- **Evidence**: T117 abre posição com termos INDEXED 105% CDI por comando real e prova operação inicial integralmente preservada após editar nome, emissor, identificador e rótulo. Full Memory + Build: 668 testes, builds Domain/Application/Memory, lint/tipos verdes.
- **Next step**: confirmar commit T117; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T117 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
