# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T105 gate verde; próxima tarefa será a guarda cronológica INV-72 após auditoria.
- **Completed**: T1–T104 implementadas; T101 `8add2c9`, T102 `787b816`, T103 `8859274`, T104 `f764efc`. Relatórios independentes FAIL preservados em `562ae9e` e `6d12f04`. T105 aguarda commit atômico.
- **Evidence**: T105 prova custo 5000, avaliação bruto 5200/líquido 5180/resgatável 3000 e consolidado 5200/resultado 200 no SQLite; 976/976 testes, migrações, lint/tipos/build verdes. Auditoria independente em leitura indicou provável falha INV-72: comandos de operação não verificam occurredOn contra a última operação efetiva.
- **Next step**: confirmar commit T105; reproduzir INV-72 com teste e corrigir guarda transacional em tarefa atômica; continuar auditoria dos critérios sem prova antes da próxima verificação completa.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T105 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
