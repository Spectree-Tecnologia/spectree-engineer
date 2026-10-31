# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versão: [SemVer](https://semver.org/lang/pt-BR/) — `MAJOR` quando um projeto gerado pela versão anterior deixa de funcionar com a nova (layout, `skills.config.json`, `ARCHITECTURE.md`), `MINOR` para agente, skill, regra ou passo novo, `PATCH` para correção sem mudança de comportamento. **Todo merge na main é uma versão**: o PR já sobe `version` e escreve a seção dele aqui, e o merge leva a tag.

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

[0.3.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/releases/tag/v0.1.0
