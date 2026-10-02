# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T123 gate verde; reparar gaps da auditoria final.
- **Completed**: T1–T122 implementadas; T122 `676885a`. Relatórios FAIL em `562ae9e`, `6d12f04` e `e5f47a9`; a rodada 3 atestou 144/148 ACs e matou 5/5 mutações. T123 aguarda commit atômico.
- **Evidence**: T123 exibe receita 100, imposto 20 e resultado líquido 80 no mesmo detalhe de resgate; Full React + Build verde com 1067 testes, lint/tipos e build Vite.
- **Next step**: confirmar commit T123; provar GetNetWorth asOf com investimento (INV-57); INV-110/112 ainda exigem UAT real de teclado/foco e 360/1280.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T123 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
