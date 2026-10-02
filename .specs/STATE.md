# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T116 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T115 implementadas; T115 `8ca5c83`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T116 aguarda commit atômico.
- **Evidence**: T116 reproduziu INVALID_INVESTMENT_OPERATION incorreto para limites decimais e passou a preservar INVALID_INVESTMENT_INPUT sem gravação. Full Cross + Build: Domain 405, Application 261, Memory 667, SQLite 976, adapter Tauri 63; migrações, lint/tipos verdes.
- **Next step**: confirmar commit T116; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T116 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
