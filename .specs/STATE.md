# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T106 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T105 implementadas; T105 `25ce74a`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T106 aguarda commit atômico.
- **Evidence**: T106 reproduziu cinco falhas reais de INV-72 e adicionou guarda transacional de última operação efetiva nos cinco comandos. Compra após abertura anterior à última operação rejeitada; empate por data preserva sequências 2 e 3. Full Cross + Build: Domain 405, Application 261, Memory 649, SQLite 976, adapter Tauri 63, migrações, lint/tipos/build verdes.
- **Next step**: confirmar commit T106; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T106 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
