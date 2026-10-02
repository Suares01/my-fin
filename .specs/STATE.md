# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T120 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T119 implementadas; T119 `2036a71`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T120 aguarda commit atômico.
- **Evidence**: T120 fecha e reabre arquivo SQLite migrado; perfil, instrumento, posição/termos, avaliação e operações com lineage são lidos com os mesmos snapshots, valores e IDs. Full SQLite + Build: 978 testes, builds Domain/Application/Memory/SQLite, lint/tipos/migrações verdes.
- **Next step**: confirmar commit T120; auditar fronteiras públicas (INV-89/117) e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T120 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
