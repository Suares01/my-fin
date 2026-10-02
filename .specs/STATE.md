# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T118 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T117 implementadas; T117 `d161629`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T118 aguarda commit atômico.
- **Evidence**: T118 compõe abertura+compra+venda, substitui e cancela a saída, exigindo conjuntos efetivos explícitos e somas 7/700 e 12/1200 idênticas à posição. Full Memory + Build: 669 testes, builds Domain/Application/Memory, lint/tipos verdes.
- **Next step**: confirmar commit T118; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T118 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
