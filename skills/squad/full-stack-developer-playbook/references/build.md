# Como construir

<!-- moved verbatim from agents/full-stack-developer.md:33-43 (0.31.0) -->

## Como construir

Primeiro confirme que a sua base é a branch do objetivo (`git log --oneline -1 <baseline>` aparece no seu histórico).

**Scaffold pelas skills de monólito**; o que nenhuma gera, à mão a partir do vizinho mais próximo, dito no relato. Quem escolhe qual é você: `config-new-module` para módulo novo (`--backend-only` quando não há tela), `module-aggregate` (modo `crud` ou `example`), `module-entity`, `module-value-object`, `module-use-case`, `module-repository`, `module-query-cqrs`, `module-dto`, `module-domain-service`, `backend-controller`, `backend-prisma-data`, `frontend-form-schema`. Os scripts delas vivem em `${CLAUDE_PLUGIN_ROOT}/skills/monolith/<skill>/scripts/` (a missão traz o caminho absoluto); rode-os da raiz do projeto. O que o scaffold gera e nenhum critério exercita sai antes do commit do ticket, com o teste dele.

**Critério primeiro.** Cada critério de sucesso vira a prova que o contrato nomeia, vermelha antes do código, na seam mais alta que o exercita. A prova escrita como ``run: `<comando>` `` é a linha que todo mundo vai rodar: faça o seu teste responder a ela, e confira você mesmo antes de cada relato com `npm run goal -- prove <slug>` (em UTC, como o CI; se a prova precisa de banco, `npm run db:scratch -- fsd -- npm run goal -- prove <slug>`). Ela tem de falhar pelo motivo certo quando o comportamento some: prova que passaria sem o comportamento volta da verificação como `weak proof`. Depois, chame o Skill tool com `tdd` para o que está abaixo dela. Teste de módulo em `modules/<m>/test/<agregado>/*.test.ts` com `InMemory<Agg>Repository` em `test/mock/`; nunca dentro de `src/`. Meta: 100% do código de negócio; ramo inalcançável se remove, não se testa.

**Ticket por ticket, com checkpoint.** Typecheck a cada passo, o arquivo de teste a cada passo, e ao fechar o ticket: a suíte afetada verde (`npx turbo run test --filter=...[<sha do checkpoint anterior>]`: os pacotes que você tocou e quem depende deles), `node scripts/check-boundaries.mjs`, `npm run format:check` quando existe, a prova do ticket (`npm run goal -- graph <slug> --prove <NN>`), um commit, o ticket atualizado, e o relato ao Engineer com o sha, os critérios que o ticket avançou e cada comando com o exit code que ele devolveu de verdade. **Um ticket por missão:** a sua termina aí. Você pode ser chamado de volta uma vez, pela mesma conversa, com os achados do checkpoint do seu ticket: corrija, rode a prova do ticket e relate o sha. A suíte inteira, `npm test`, é de quem fecha o último ticket. Build sempre pelo cache do turbo, nunca `--force`: ele é por hash de conteúdo e de env declarada, e verde do cache é verde.

**Schema.** O model Prisma (`apps/backend/prisma/models/<m>.model.prisma`) e a migration do seu módulo são seus, nomeada pelo que muda. Migration destrutiva (drop, rename de coluna com dado) é **gate 3**: pare e relate antes de rodar.
