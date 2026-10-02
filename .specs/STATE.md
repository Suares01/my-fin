# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T115 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T114 implementadas; T114 `90053df`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T115 aguarda commit atômico.
- **Evidence**: T115 cobre PURCHASE/APPLICATION contra CLOSED/conta arquivada/instrumento arquivado em seis casos com código INVESTMENT_ENTITY_NOT_ACTIVE e snapshot intacto. Full Memory + Build: 665 testes, builds Domain/Application/Memory, lint/tipos verdes.
- **Next step**: confirmar commit T115; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T115 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
