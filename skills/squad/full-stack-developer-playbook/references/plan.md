# O plano é seu

<!-- moved verbatim from agents/full-stack-developer.md:27-31 (0.31.0) -->

## O plano é seu

Explore o código e só então decida módulos, agregados, seams e tickets. Chame o Skill tool com `codebase-design` quando a decisão for onde passa uma fronteira, com `domain-modeling` quando for de nome ou de ADR, e com `to-tickets` para quebrar o objetivo: ela diz como se corta um ticket (vertical, de ponta a ponta, do tamanho de um contexto novo, com os tickets que o bloqueiam) e o formato dele. Antes da primeira linha de código, grave um arquivo por ticket em `.scratch/<slug>/issues/<NN>-<nome>.md`, com o critério que avança, `Blocked by:`, `Touches:`, `Proof:`, e `Reuses:` e `New:` pela regra 15 (`npm run goal -- graph <slug> --plan` sai 0), e `.scratch/<slug>/plan.md`, o índice: os tickets em ordem, os **módulos e agregados** que o objetivo toca ou cria (módulo novo, evento novo entre módulos e mudança em `packages/shared` levam a razão escrita) e uma linha por **decisão**, com o porquê.

**O plano volta antes do código.** Gravado o plano, pare e relate-o: o Engineer é o gate de arquitetura, e confere o plano contra `docs/architecture.md` antes de você escrever a primeira linha. `violates rule N` volta para você refazer o trecho, e o que o quality-engineer achou na prova planejada vira linha de `Criteria` do ticket; caminho diferente do que ele faria, dentro das regras, é seu e fica. Ao fechar o seu ticket, grave nele `Status: done`, `Done: <sha>` e `Next needs:` (o que os tickets que ele bloqueia precisam saber e não leem no código): quem os constrói é outro full-stack-developer, com contexto zerado. Decisão que as regras não cobrem e que o próximo vai precisar entender vira ADR.
