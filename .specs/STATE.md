# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T112 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T111 implementadas; T111 `4d654c7`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T112 aguarda commit atômico.
- **Evidence**: T112 compara checksums v1–v4 reais antes/depois do upgrade, além de postings, saldos e versão da conta preservados. Full SQLite + Build: 976 testes, builds Domain/Application/Memory/SQLite, migrações, lint/tipos verdes.
- **Next step**: confirmar commit T112; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T112 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
