# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T110 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T109 implementadas; T109 `c89d460`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T110 aguarda commit atômico.
- **Evidence**: T110 prova compra interna com principal 200, taxa 10 e imposto 5: custo +200, fluxo -215, journal de despesas -15/+10/+5 e aviso de caixa -1215. Full Memory + Build: 653 testes, builds Domain/Application/Memory, lint/tipos verdes.
- **Next step**: confirmar commit T110; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T110 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
