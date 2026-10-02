# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T119 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T118 implementadas; T118 `f68b01e`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T119 aguarda commit atômico.
- **Evidence**: T119 compara o mesmo read model com termos INDEXED CDI em banco novo e banco migrado da v4 e exige rejeição de conta pertencente a outro livro nos dois bancos. Full SQLite + Build: 977 testes, builds Domain/Application/Memory/SQLite, lint/tipos/migrações verdes.
- **Next step**: confirmar commit T119; provar persistência após reinício (INV-88), auditar fronteiras públicas (INV-89/117) e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T119 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
