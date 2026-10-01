# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 18 / T101 gate verde; T102 é a próxima tarefa.
- **Completed**: T1–T100 implementadas; relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T101 aguarda commit atômico.
- **Evidence**: segunda validação: 110/148 critérios PASS, quatro GAP (INV-09/65/81/144), 34 não atestados, sem falha funcional confirmada; Gate Build 3409/3409 e sensor scratch 3/3. T101 prova disponível -125 com BANK +100, PAYMENT -250 e CASH +25, mantendo arquivado/outros ativos/carteira separados; SQLite 975/975, migrações, lint/tipos/build verdes.
- **Next step**: confirmar commit T101; executar T102–T104 em ordem com gate/commit; auditar os 34 critérios sem prova, repetir Verifier/sensor e fechar apenas com PASS.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T101 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
