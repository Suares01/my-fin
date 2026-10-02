# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T121 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T120 implementadas; T120 `3713d13`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T121 aguarda commit atômico.
- **Evidence**: T121 verifica dependências de produção e varre o código de Domain/Application para impedir IDs e credenciais de provedor. Domain 405 testes, Application 262, builds/lint/tipos verdes.
- **Next step**: confirmar commit T121; auditar exclusão pública de hard delete (INV-117) e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T121 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
