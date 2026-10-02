# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T114 gate verde; continuar auditoria dos critérios não atestados.
- **Completed**: T1–T113 implementadas; T113 `b091207`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T114 aguarda commit atômico.
- **Evidence**: T114 exige INVALID_INVESTMENT_CATEGORY e snapshot intacto para categoria arquivada, system, de outro livro e kind incorreto em venda com ganho. Full Memory + Build: 659 testes, builds Domain/Application/Memory, lint/tipos verdes.
- **Next step**: confirmar commit T114; concluir auditoria dos critérios sem prova, criar reparos atômicos para gaps reais e repetir Verifier/sensor antes de fechar a feature.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T114 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
