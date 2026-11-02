# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versão: [SemVer](https://semver.org/lang/pt-BR/) — `MAJOR` quando um projeto gerado pela versão anterior deixa de funcionar com a nova (layout, `skills.config.json`, `ARCHITECTURE.md`), `MINOR` para agente, skill, regra ou passo novo, `PATCH` para correção sem mudança de comportamento. **Todo merge na main é uma versão**: o PR já sobe `version` e escreve a seção dele aqui, e o merge leva a tag.

## [0.11.0] - 2026-11-01

### Added
- `integration-engineer`: todo contrato de entrada (webhook, callback) vem com o payload de exemplo documentado ao pé da letra, a URL e o formato de cada campo de id como o exemplo mostra; o passo 4 do Engineer põe esse payload no ticket e faz dele um critério de aceite (fixture passa pela validação). Retro do item `billing` (PILOT). (#34; #33 era a regra de segredo em `.env`, já na 0.10.0)

## [0.10.0] - 2026-11-01

Retro do item `approval` (PILOT): #26 #27 #28 #29 #30.

### Added
- `scripts/worktree.mjs` no projeto gerado (`npm run worktree -- up <slug> <offset> [--branch] [--from]` / `down <slug>`): branch, `.env` copiados, portas e URLs movidas pelo offset, banco `<db>_<slug>` criado a partir da URL do owner, `npm install`, `prisma generate`, `migrate deploy` (ou `db push` sem migrations), `db:roles`, seed e `npm run build -- --force`; para no primeiro exit code diferente de zero e imprime portas e `PLAYWRIGHT_BASE_URL` sem nenhuma URL com senha. `down` dropa o banco e remove a worktree. O `platform-engineer` passa a chamá-lo; o smoke prova `up` e `down`. (#28)
- CI gerado: job `playwright` em estado zerado quando o projeto tem `playwright.config.*` (Postgres novo, migrate, roles, seed, backend com limites de teste elevados e `tee backend.log`, frontend buildado contra ele, `PLAYWRIGHT_BASE_URL`/`BACKEND_LOG`); helper de login lê a credencial de teste de rota só de teste ou do log. `quality-engineer`: asserção de ausência sem esperar a leitura que a preencheria é `blocking`. (#29)
- `integration-engineer`: referência de API (OpenAPI, `/reference/`) manda sobre guia em path, parâmetros e auth; discordância vira `Confidence: conflicting` com os dois lados; `llms.txt` e MCP de docs do fornecedor são a primeira fonte quando existem. (#30)

### Fixed
- `platform-engineer` e `full-stack-developer`: valor de `.env` nunca vai para a saída (leitura por nome ou com o valor cortado, edição com `sed -i` sem ecoar, relato `KEY db=<nome>`). (#26)
- `full-stack-developer`: nada fica rodando ao relatar (processos parados pelo PID e listados), sem loop esperando arquivo, sem heredoc para interpretador (Edit tool); o contrato de despacho põe "nada fica rodando" em todo guard-rail. A worktree chega pronta pelo script, e o developer não dropa nem remove nada. (#27)

## [0.9.0] - 2026-11-01

### Added
- Piso de modelo `sonnet` para todo subagente: o painel (`agent.spawn`) sobe para `sonnet` qualquer despacho que nomeie Haiku ou que seja de um agente do harness que cai em Haiku por padrão (`web-fetch`, `Explore`, `claude-code-guide`, `statusline-setup`); um papel com modelo próprio ou herdado fica como está. Sessão que força um modelo em todos os subagentes passa por cima do piso, e o painel registra isso no log. Contrato de despacho: nunca `haiku`, e nada de agentes do harness para o que um papel do squad faz (página externa é o integration-engineer).

## [0.8.0] - 2026-10-31

### Added
- Modelo por complexidade da missão (contrato de despacho, seção 4): o `full-stack-developer` continua em `sonnet` por padrão, e o Engineer passa `model: "opus"` só em missão de correção de `blocking`/`confirmed`, ticket multi-módulo, tela + backend, migration com dado existente, ou nova tentativa depois de bloqueio ou CI vermelho não reproduzido. A primeira linha da missão diz o modelo e o motivo. Os outros papéis seguem o modelo da sessão, como antes.

## [0.7.1] - 2026-10-31

### Fixed
- Painel: o centro e os avatares saíam borrados e sem definição. O brilho desfocado sobreposto ao desenho (`<use>` com blur) e o filtro de suavização foram removidos; o traçado passou de 227 para 341 px com 20 cores e piso de alpha 200 (o halo translúcido não vira polígono); o avatar do card é o visor com os olhos recortado num círculo com aro (azul rodando, verde concluído, âmbar falhou), não o corpo inteiro em 40 px. `scripts/trace-art.cjs` ganha o recorte das faces.

## [0.7.0] - 2026-10-31

### Added
- O painel do Engineer: `hooks/engineer-desk/` + `hooks/hooks.json`, o módulo de hooks do Claude Code replicado do painel do Invoker (spectree-invoker). Mascote da Spectree no centro, no seu anel, flutuando como no clipe do fundador; o especialista em execução no lugar dele (sete desenhos, um por card de `agents/`); o próprio Engineer quando só o loop principal trabalha num plano; feliz com o plano concluído; alerta depois de uma falha. Barra de progresso do plano (ferramenta `mcp__spectree-engineer__plan`, instrução injetada só no loop principal; `TaskCreate`/`TaskUpdate`/`TodoWrite` também alimentam), um card por subagente com expressão, papel, modelo, esforço, tokens, duração e passos, seções recolhíveis, `/engineer-desk`, status line, e o plano acima do prompt no terminal. Abre sozinho no desktop e no VS Code em pasta com `skills.config.json` ou `docs/roadmap.md`. `plugin.json` aponta o contrato de estado (`types`).
- A arte do fundador (13 PNGs de 2048 px com alpha) vetorizada em polígonos em `hooks/engineer-desk/mascot-art.ts`, porque o app descarta `<image>` num `Svg`; paleta nova (preto fosco, brilho azul frio).
- `tests/engineer-desk.test.mjs` (guarda estrutural, `node --test`) e `tests/engineer-desk.test.tsx` (nove casos no kit do Claude Code); `scripts/desk-test.mjs` roda o segundo a partir de uma cópia sem os testes Vitest do template.

## [0.6.0] - 2026-10-31

### Added
- Conventional Commits em todo o squad: branch de integração `<tipo>/<feature-slug>` e branch de ticket `<tipo>/<feature-slug>-<ticket-slug>` (`platform-engineer`, passo 5 do Engineer); commit do `full-stack-developer` como `<tipo>(<módulo>): …`; a skill `pr` ganha a seção **Title** (`<tipo>(<escopo>): …`, um tipo por PR), e o squash merge leva esse título para a main.
- CI do projeto gerado: job `pr-title` que falha se o título do PR não casar com `^(feat|fix|chore|docs|refactor|test|build|ci|perf|style)(\([a-z0-9-]+\))?!?: .+`. O `dependabot.yml` gerado já abre PRs com `chore(deps)` e `chore(ci)`.

### Removed
- `skills/monolith/utils/update-git-repo.js`: script interativo (readline) que ninguém referenciava; a convenção que ele encodava agora vive nos cards.

## [0.5.0] - 2026-10-31

Fecha o backlog de retros anteriores: #1 #2 #3 #4 #5 #6 #7 #8 #11 #12.

### Added
- Dois papéis de banco no projeto gerado: `MIGRATION_DATABASE_URL` (owner: migrate, seed, `db:roles`) e `DATABASE_URL` como `app_runtime`, que não é dono de nada. `apps/backend/db/roles.sql` (idempotente, com a lista de tabelas append-only) + `db/roles.mjs` (`npm run db:roles`), serviço `roles` no `docker-compose.prod.yml`, `APP_DB_PASSWORD` no `.env`, e o `PrismaService` recusa subir em produção conectado como owner. Regra 12 do `ARCHITECTURE.md` ampliada. (#11)
- `perf.mjs`: hook `setup` em `perf.config.json` (semeia e devolve `claims` ou `headers` reais), rotas com `method`/`body`/`headers`; qualquer não-2xx continua falhando. (#5)
- `config-shared-backend`: `src/cli/run-cli.ts` — contexto Nest só com os módulos do comando, `.env` validado pelo `envSchema` restrito às chaves lidas, exit 0/1/2; roda do `dist`, nunca por `tsx`. Seção "CLI de operação" no SKILL. (#8)
- `config-new-module --backend-only`: sem módulo frontend, rota, menu, controller de exemplo e e2e. (#7)
- `config-shared-backend` deixa o vitest do e2e com `fileParallelism: false`; `platform-engineer` prepara a worktree inteira (install, banco próprio, generate, migrate deploy, `db:roles`, seed, build) e dropa o banco ao remover. (#4)

### Changed
- Bootstrap: `config-prisma` antes de `config-shared-backend`, porque `shared.module.ts` e `health.controller.ts` importam o que só o Prisma cria. (#1)
- `/engineer`: verificação por exit code, nunca por `grep` antes de `&&`; missão de correção lista toda expectativa de teste alterada; `blocking` introduzido pela própria correção ganha um ciclo extra antes do gate 4. (#6, #12)

### Fixed
- Gerado: `postgres:18-alpine` com volume em `/var/lib/postgresql`; `prebuild: prisma generate` no backend (Dockerfile só roda `turbo run build`); `!.env.example` no `.gitignore` do create-next-app; `JWT_SECRET` do `.env.example` com 32+ caracteres; o `config-project` formata só o que gerou (`docs/` fora). (#2)
- `templates/shared`: `Entity.cloneWith` copia `Date` (e qualquer instância de classe) por valor em vez de fundir em `{}`; `Id.tryCreate('')` falha em vez de gerar um id novo; `typescript` e `@types/node` como devDependencies. Com testes. (#3)

## [0.4.0] - 2026-10-31

### Added
- `full-stack-developer`: banco próprio por worktree (`CREATE DATABASE <db>_<ticket>`, `DATABASE_URL` da worktree, migrate + seed, drop no fim) e browser próprio quando outro developer roda (script `playwright-core`, nunca o MCP compartilhado). Fecha #18.
- `ui-ux-designer`: renderiza todo artboard alterado num browser headless a partir do disco e anexa o screenshot ao relato antes de publicar; CSS por concatenação ou substituição exata, nunca regex; comentário do fundador numa tela é regra do produto, propagada e nunca sobrescrita. Fecha #16.
- `/engineer`: depois de cada merge na integração, `npm run build && npm test` antes do próximo despacho; perf só na integração, sem developer rodando, em banco recém-criado; `integration-engineer` e `solutions-architect` relatam inline e o Engineer grava. Fecha #17.

## [0.3.2] - 2026-10-31

### Changed
- Build (passo 6): no máximo dois `full-stack-developer` em paralelo; os outros tickets da fronteira esperam na fila. Sete worktrees simultâneas, cada uma com `npm install`, `tsc` e Vitest, derrubaram a máquina do fundador no `agent-shell`.

## [0.3.1] - 2026-10-31

### Fixed
- Spec e tickets são gravados com o Write tool, nunca por heredoc no shell: a sessão de item do `agent-shell` perdeu um comando com `unexpected EOF while looking for matching \`'\`` ao gravar um ticket com crase e apóstrofo.

## [0.3.0] - 2026-10-31

### Added
- Fundação transversal, decidida uma vez: regras 12–14 em `ARCHITECTURE.md` (espinha das tabelas, eventos de domínio, identidade como módulo); `check-boundaries` regra 6 (uuid, `createdAt`, `updatedAt`, nunca `Float`); `DomainEvent`/`EventPublisher`/`InMemoryEventBus` no shared; `roles` no token e `@Roles()` no guard (403 `FORBIDDEN_ROLE`); tenants, papéis e tipo de login como perguntas fixas da entrevista; `identity` como primeiro item do roadmap.
- Bootstrap grava `.claude/settings.json` com a allowlist que o loop autônomo precisa (`npm`, `npx`, `node`, `turbo`, `git`, `gh`, `docker`, `curl`) e nega git destrutivo.
- Release: `pg_dump` antes de migrar banco com dado; gate 3 (primeira exposição pública) exige restore provado com contagem de linhas.

### Changed
- Prototipação interativa: o design system e o protótipo de cada mudança com tela são definidos em rodadas com o fundador, e o fluxo espera a aprovação explícita dele (`Approved by founder on <data>` no handoff) antes da spec. Depois disso, autonomia total até o merge e o próximo item.
- Sessão principal e uma sessão por item (`commands/engineer.md` §7): no Claude Code Desktop, a sessão em que o fundador abriu o projeto vive até o fim dele e coordena; cada item do roadmap roda numa sessão de item linkada a ela (`start_session`, contexto zerado, `/engineer item <slug>`), que relata e encerra; a principal verifica, fala com o fundador, encaminha as respostas dele (protótipo, gates) e abre o próximo. A chamada leva `background` (obrigatório no modo `fresh`) e, se o app recusar o `user_asked`, vira card `own_initiative` que o fundador inicia com um clique; o Engineer nunca pede para colar um prompt nem constrói o item na principal. Fora do Desktop, tudo na mesma sessão.

### Fixed
- O modelo bootstrap do Prisma usava `cuid()`, mas o `Id` do shared só aceita UUID: primeira entidade hidratada quebraria. Agora `uuid()` com `@db.Uuid` e `@db.Timestamptz`.
- Produção pelas skills: log JSON por requisição (`nestjs-pino`, `requestId`, `userId`, segredos redigidos), `.env` validado no boot (zod, `JWT_SECRET` 32+), `GET /health` e `GET /ready`, shutdown gracioso, Dockerfiles multi-stage, `docker-compose.prod.yml` com `migrate` one-shot, `npm run release`; missão Release do `platform-engineer` com rollback por imagem anterior.
- Capacidade como teste: `PrismaService` com log de queries e `expectQueryBudget` (falha listando as SQL), e2e por módulo com budget, `scripts/perf.mjs` + `perf.config.json` (p95 por rota, sai 1 acima do orçamento), `npm run perf` no CI depois de `npm test`; regra 11 em `ARCHITECTURE.md`.
- `scripts/evals.mjs` + `evals/`: suíte de evals do squad com `claude plugin eval` — seis casos que medem o julgamento dos agentes (quality-engineer, security-engineer, solutions-architect, gate 2 do `/engineer`) por critério verificável pelo runner; `--control` prova que o caso 1 falha sem a lista de regras do card.

## [0.2.0] - 2026-10-30

### Added
- Retro: candidato que é do plugin vira issue em `Spectree-Tecnologia/spectree-engineer`, sem perguntar.
- `CHANGELOG.md` e processo de release (README › Versão).
- `security-engineer`: review como atacante em toda mudança, em paralelo ao `quality-engineer`, com o `security-audit` da Cloudflare (MIT) em modo guidance; fluxo "Auditoria" (full-audit) antes da primeira exposição pública e a cada cinco itens do roadmap; wrapper `skills/security/validate-findings.cjs` para Windows.
- `ARCHITECTURE.md`: as dez regras do monólito modular, copiado para `docs/architecture.md` de todo projeto gerado; leitura obrigatória de toda missão.
- `scripts/check-boundaries.mjs` no projeto gerado (`npm test` e CI): core puro, dependência só do shared, teste fora de `src/`, rota do Next só importa a página, read é query e não use case.
- `scripts/smoke.mjs`: prova do bootstrap inteiro a partir do plugin (build, testes, Postgres, `401` sem token).
- Supply chain no projeto gerado: `.npmrc min-release-age=3`, Dependabot com cooldown, `npm audit --audit-level=high` no CI; `integration-engineer` vigia suporte e advisories da stack.
- `docs/roadmap.md` e `.scratch/<feature>/decisions.md`: o Engineer decide sozinho depois da entrevista; quatro gates sobem ao fundador.

### Changed
- Squad autônomo: spec, tickets, review, PR e merge com CI verde sem aprovação; próxima spec começa sozinha.
- Stack gerada sem pins: NestJS em ESM + Vitest, Next.js com Cache Components, Prisma + PostgreSQL, Node LTS por `.nvmrc`; `JwtGuard` global, `JWT_SECRET` obrigatório, throttler, helmet, CORS por `FRONTEND_URL`, `ValidationPipe` estrito.
- Skills de monólito reescritas sem referência a material de curso; `create-module` resolve a raiz por `cwd`; `resolve-skill-config` procura `skills.config.json` nos lugares certos.

### Fixed
- Bootstrap no Windows; pacote `@<ns>/shared` incluído no plugin; designer grava os arquivos de Design.

## [0.1.0] - 2026-10-30

### Added
- `/engineer` em pt-BR, seis agentes, skills de engenharia de Matt Pocock (MIT) e skills de monólito modular da Spectree.

[0.11.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/releases/tag/v0.1.0
