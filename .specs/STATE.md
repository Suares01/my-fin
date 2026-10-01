# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 17 / T100 gate verde; re-verificação independente é a próxima etapa.
- **Completed**: T1–T100 implementadas; primeira validação independente FAIL preservada em `562ae9e`. Reparos T98 `371bb5c` e T99 `1405396`; T100 aguarda commit atômico.
- **Evidence**: T98 corrige a substituição da última venda total CLOSED; T99 prova saldos e postings não zero no backfill; T100 prova caixa -1000→0, aviso removido e operações/posição históricas idênticas. Memory 640/640, React focado 17/17, lint/tipos/builds verdes. `validation.md` da primeira rodada registra 56 ACs com prova direta, 1 falha funcional corrigida, 3 gaps de asserção reparados e 88 ACs ainda não atestados; sensor 3/3 antes dos reparos.
- **Next step**: confirmar commit T100; repetir Verifier independente e sensor com matriz completa, então executar `validate_state.py` se o veredito for PASS.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T100 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
