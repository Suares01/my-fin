# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T122 gate verde; preparar verificação final.
- **Completed**: T1–T121 implementadas; T121 `ade917b`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T122 aguarda commit atômico.
- **Evidence**: T122 fixa comandos públicos e portas de persistência sem hard delete, com arquivamento/reversão/correção explícitos. Application 263 testes, builds Domain/Application, lint/tipos verdes.
- **Next step**: confirmar commit T122; repetir Verifier independente, sensor e UAT nativa/browser antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T122 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
