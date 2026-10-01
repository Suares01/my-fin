# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 17 / T99 gate verde; T100 é a próxima tarefa.
- **Completed**: T1–T99 implementadas; primeira validação independente FAIL foi preservada em `562ae9e` e gerou T98–T100. T98 está em `371bb5c`; T99 aguarda commit atômico.
- **Evidence**: T99 fortalece o teste de backfill v4→v5: ASSET ativo +1000, ASSET arquivado +200 e LIABILITY -300 minor preservam os mesmos saldos/postings e recebem perfis corretos; SQLite 53/974 passou com migrações, lint, tipos e build. T98 corrige a substituição da última venda total CLOSED (Domain 405, Memory 640, Full Cross verde). `validation.md` da primeira rodada registra 56 ACs com prova direta, 1 falha funcional agora corrigida, 3 gaps de asserção (T99/T100) e 88 ACs não atestados; sensor 3/3 e Build 3406/3406 antes dos reparos.
- **Next step**: confirmar commit T99 no Git; executar T100 com gate/commit atômico; resolver a matriz de evidência e repetir Verifier/sensor até PASS, então rodar `validate_state.py`.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T99 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
