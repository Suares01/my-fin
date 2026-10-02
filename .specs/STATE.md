# STATE

## Decisions

## Handoff

- **Feature**: investments-foundation (`.specs/features/investments-foundation/`)
- **Phase / Task**: Phase 19 / T124 concluída; fechamento da feature bloqueado por prova visual independente.
- **Completed**: T1–T124 implementadas; T124 `aed2dfa`. Relatórios FAIL em `562ae9e`, `6d12f04` e `e5f47a9`; a rodada 3 (em HEAD `676885a`) atestou 144/148 ACs e matou 5/5 mutações. T123/T124 repararam os gaps INV-44/57 após o relatório, sem nova verificação independente.
- **Evidence**: gate automatizado posterior a T124: Domain 405, Application 263, Memory 669, SQLite 979, adapter Tauri 63 e React 1067; total 3446/3446 testes. Lint, tipos, builds, migrações e `git diff --check` passaram nos gates de T123/T124. WebKitGTK 4.1 ausente; o Chromium abriu o Vite local fora do sandbox, mas o app mostrou recuperação `ipc-unknown` por falta de IPC Tauri. Prova real de foco/teclado e 360/1280 (INV-110/112) segue ausente.
- **Next step**: reproduzir N7/INV-110/112 em Tauri nativo com WebKitGTK ou em harness browser com runtime equivalente; registrar foco devolvido ao acionador e overflow/ações em 360px e 1280px. O ciclo de três rodadas do Verifier previsto pela skill foi atingido; antes de declarar PASS, obter nova direção do usuário para a revalidação independente após UAT.
- **Open note**: a divergência de data civil em Transações foi corrigida por `parseISO` e conferida na UAT nativa. A primeira rodada do Verifier não repetiu UAT nativa independentemente; preservar captura/trilha adicional antes de fechar.
- **Uncommitted files**: nenhum após o commit do handoff; conferir `git status --short`.
- **Branch**: main
