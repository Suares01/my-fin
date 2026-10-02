# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T124 gate verde; restam provas de UAT real.
- **Completed**: T1–T123 implementadas; T123 `ed38b25`. Relatórios FAIL em `562ae9e`, `6d12f04` e `e5f47a9`; a rodada 3 atestou 144/148 ACs e matou 5/5 mutações. T124 aguarda commit atômico.
- **Evidence**: T124 usa carteira, posição, avaliação e operação INCOME com journal no mesmo livro: GetNetWorth asOf retorna 6000 antes e 6200 depois, enquanto resumo de mercado separa os 200 não realizados. Full SQLite + Build verde com 979 testes, lint/tipos/migrações.
- **Next step**: confirmar commit T124; executar UAT real de teclado/foco e 360/1280 para INV-110/112 em ambiente com WebKitGTK ou servidor local permitido. Rodada 3 do Verifier foi o limite de revalidações previsto pela skill.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: somente T124 e documentação de execução antes do commit atômico; conferir `git status --short`.
- **Branch**: main
