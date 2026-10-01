# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 17 / T98 gate verde; T99 é a próxima tarefa.
- **Completed**: T1–T98 implementadas; primeira validação independente FAIL foi preservada em `562ae9e` e gerou T98–T100. T98 aguarda commit atômico. O ajuste autorizado de fixture anterior à T93 está em `4f2e6c8`.
- **Evidence**: T98 corrige a substituição da última SALE/REDEMPTION total em posição CLOSED e preserva allocationRevision quando o estado final não muda. Domain 405 (+1), Memory 640 (+2), Application 261, SQLite 974, adapter Tauri 63 passaram com Full Cross, lint, tipos, builds, migrações e `git diff --check`. `validation.md` registra 56 ACs com prova direta, 1 falha funcional agora corrigida, 3 gaps de asserção (T99/T100) e 88 ACs não atestados na primeira rodada; sensor 3/3 e Build 3406/3406 antes da correção. T93/T94 mantêm relato nativo N1–N8 em `tasks.md`.
- **Next step**: confirmar commit T98 no Git; executar T99 e T100 em sequência com gates/commits atômicos; resolver a matriz de evidência e repetir Verifier/sensor até PASS, então rodar `validate_state.py`.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T98 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
