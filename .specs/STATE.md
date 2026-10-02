# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T108 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T107 implementadas; T107 `330fc82`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T108 aguarda commit atômico.
- **Evidence**: T108 disputa vendas e compras sobre a mesma versão; somente a primeira operação confirma, retry valida quantidade/custo atualizados e recalcula aviso de caixa de -1200 para -1400. Full Memory + Build: 652 testes, builds Domain/Application/Memory, lint/tipos verdes.
- **Next step**: confirmar commit T108; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T108 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
