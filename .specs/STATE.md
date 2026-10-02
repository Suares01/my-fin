# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T113 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T112 implementadas; T112 `5d4b489`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T113 aguarda commit atômico.
- **Evidence**: T113 reproduziu `error.details` ausente e anexou contexto allowlisted `{requestId,positionId}` ou `{requestId,operationId}` a erros de mutação, sem descrição/valor. Full Cross + Build: Domain 405, Application 261, Memory 655, SQLite 976, adapter Tauri 63; migrações, lint/tipos verdes.
- **Next step**: confirmar commit T113; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T113 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
