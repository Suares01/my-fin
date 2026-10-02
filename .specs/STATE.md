# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T111 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T110 implementadas; T110 `90e1ffb`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T111 aguarda commit atômico.
- **Evidence**: T111 prova descarte de unitPrice 120 da revisão 1 ao consultar posição com 20 unidades na revisão 2: valor consolidado 1000, resultado 0, nenhuma avaliação aplicável. Full SQLite + Build: 976 testes, builds Domain/Application/Memory/SQLite, migrações, lint/tipos verdes.
- **Next step**: confirmar commit T111; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T111 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
