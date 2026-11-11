# spectree-engineer

Plugin Claude Code da Spectree Tecnologia: um orquestrador em pt-BR (`/engineer`) com sub-agentes especialistas, para **monólitos modulares seguros e escaláveis na stack atual**.

- **Processo:** as skills de engenharia de [Matt Pocock](https://github.com/mattpocock/skills) — entrevista → roadmap → **design** → spec → tickets → TDD → code review → PR (branch, commits e título em Conventional Commits) → **merge automático com CI verde** → próxima spec. A tela é prototipada no artefato Design antes da spec, **em rodadas com você até aprovar**, não vista semanas depois do código. Fora da entrevista e do protótipo, o squad anda sozinho: a sessão em que você abriu o projeto coordena até o fim dele, e cada item do roadmap roda numa sessão de item linkada a ela, com contexto zerado (Claude Code Desktop); só sobem a você dinheiro/plataforma, mudança de escopo, impacto irreversível e o que nenhuma melhor prática decide.
- **Arquitetura:** as skills de monólito modular da Spectree — `config-*`, `module-*`, `backend-*`, `frontend-*` — e as regras de DDD tático que elas encodam: módulos puros em `modules/<m>/src/<agregado>/{dto,model,provider,use-case}`, um repositório por raiz de agregado, regra no VO > entidade > domain service, erro como código numa `Result`, `userId` do JWT. O documento canônico é [ARCHITECTURE.md](ARCHITECTURE.md), copiado para `docs/architecture.md` de todo projeto gerado e leitura obrigatória de toda missão.

## Stack gerada

Só majors com suporte, instalados como `@latest`, nunca pinados: Turborepo, **NestJS (ESM, `nodenext`, Vitest)**, **Next.js com Cache Components**, Prisma + PostgreSQL, Node LTS (`.nvmrc`), pacote `@<ns>/shared` em ESM + Vitest.

Seguro por padrão no que o bootstrap gera:

- `JwtGuard` como `APP_GUARD` — toda rota fechada salvo `@Public()`; `JWT_SECRET` sem valor padrão (o app não sobe sem ele).
- `@nestjs/throttler` com limite global, `helmet`, CORS restrito a `FRONTEND_URL`, `ValidationPipe` com `whitelist` + `forbidNonWhitelisted`, `ApiExceptionFilter` logando a causa dos 500.
- Review de segurança em toda mudança (`security-engineer`, em paralelo ao review de padrões) e auditoria completa em seis fases antes da primeira exposição pública e a cada cinco itens do roadmap — `confirmed` vira ticket, `needs_validation` vira teste.
- Supply chain: `.npmrc` com `min-release-age=3`, `.github/dependabot.yml` com o mesmo cooldown, `npm audit --audit-level=high` no CI.
- CI que cabe no plano Free: um workflow, um job, só em `pull_request` (`.github/workflows/ci.yml`, do scaffold), o run inteiro uma vez por semana na main, um PR do Dependabot por mês e `npm run check:pr` rodando local o que o CI só roda no PR.
- Scanners OSS como passos desse job: gitleaks (MIT) na história do git, `npm audit` e osv-scanner (Apache 2.0) no lockfile quando ele muda, squawk (GPL 3) nas migrations que o PR adiciona; o `security-engineer` lê o run antes do diff. Mutation testing por módulo com StrykerJS (Apache 2.0), `npm run mutation -- <módulo>`, que o `quality-engineer` roda nos módulos do diff.
- Fronteiras do monólito verificadas por `scripts/check-boundaries.mjs` no projeto gerado (`npm test` e CI): core puro em `modules/*/src`, módulo depende só do shared, teste fora de `src/`, rota do Next só importa a página do módulo, read é query, toda tabela com a mesma espinha (uuid, `createdAt`, `updatedAt`, `Decimal` e nunca `Float`).
- Fundação decidida uma vez, não por agregado: módulos conversam por `DomainEvent` (`InMemoryEventBus` no shared), o token carrega `roles` e `@Roles()` fecha rotas, `identity` é o primeiro item de todo roadmap, e tenants, papéis e tipo de login são perguntas fixas da entrevista.
- Autonomia de verdade: o bootstrap grava `.claude/settings.json` com a allowlist de `npm`, `git`, `gh`, `docker` (e nega `push --force`, `reset --hard`, `clean`); o release faz `pg_dump` antes de migrar e a primeira exposição pública exige restore provado.

## Instalação

```bash
claude plugin marketplace add Spectree-Tecnologia/spectree-engineer
```

```bash
claude plugin install spectree-engineer@spectree-engineer
```

## Uso

```
/engineer                      estado do projeto, próximo passo, decisões pendentes
/engineer <o que você quer>    leva o pedido pelo fluxo
/engineer goal <objetivo>      Goal Driven Development: você dá o objetivo e os critérios de sucesso, o squad decide o como
```

Na primeira vez num repositório, o Engineer roda o `setup-matt-pocock-skills` (tracker, labels, layout de domínio) antes de qualquer outra coisa.

### Duas modalidades de construção

| | Mudança (spec-driven) | Objetivo (Goal Driven Development) |
|---|---|---|
| O que desce para quem constrói | spec e tickets: módulo, agregado e skill nomeados | um contrato (`docs/goals/<slug>.md`): objetivo, critérios de sucesso com a prova de cada um, limites e orçamento |
| Quem decide o como | o Engineer, na spec | o dono do objetivo, olhando o código, dentro de `docs/architecture.md` |
| Quem constrói | um developer por ticket, até dois em paralelo, cada um na sua worktree | um developer só, no modelo mais capaz, na branch de integração |
| Como se sabe que acabou | critérios de aceite dos tickets e review em dois eixos | cada critério verificado por quem não construiu: roda a prova, julga se ela prova, tenta refutar; volta ao dono até cumprir ou o orçamento acabar |
| Cabe quando | o problema ainda pede desenho, ou há fatias independentes para construir em paralelo | o resultado se confere por comando ou número e um dono dá conta |

Nas duas valem os quatro gates, o protótipo aprovado pelo fundador para tela nova, as regras do monólito modular cobradas por `check-boundaries`, e um PR por entrega. No roadmap, o item `[goal]` roda como Objetivo.

### O painel do Engineer

O plugin traz um módulo de hooks do Claude Code, `hooks/engineer-desk/`: um painel lateral que acompanha a orquestração. No centro flutua o mascote da Spectree dentro do seu anel; enquanto um subagente roda, o desenho do especialista toma o lugar dele (o último despachado na frente); sozinho com um plano em andamento, é o próprio Engineer que aparece; plano concluído, o mascote sorri; um subagente que falhou ou foi interrompido o deixa em alerta. Abaixo, a barra de progresso do plano e um card por subagente com o mascote pequeno (a expressão do papel enquanto roda, sorrindo ao concluir, alerta se falhou), papel, modelo, tokens, duração, status e passos. No terminal, o plano também fica acima do prompt.

Abre sozinho uma vez por sessão no app desktop e no VS Code, numa pasta com `skills.config.json` ou `docs/roadmap.md`, ou no primeiro despacho de um especialista. `/engineer-desk` reabre. Não alcança rede e só recusa duas coisas: um despacho que cairia abaixo do Sonnet (sobe para `sonnet`) e um comando Bash que manda heredoc ou pipe para a stdin de um interpretador (`python -`, `node -`), que no Windows fica preso para sempre. Function hooks são uma API em early access do Claude Code. Os desenhos são a arte do fundador (PNGs de 2048 px) vetorizada em polígonos, porque o app descarta `<image>` dentro de um `Svg`; para trocar um, troque o PNG e rode `node scripts/trace-art.cjs <pasta dos PNGs> <pasta com imagetracerjs instalado>`, que regrava `mascot-art.ts`.

## O squad

| Agente | Faz | Não faz |
|---|---|---|
| `engineer` (comando) | fala com você em pt-BR, grill, spec, tickets, despacha | código |
| `solutions-architect` | mapa de módulos/agregados, seams, fronteira de perguntas | escrever arquivo |
| `ui-ux-designer` | protótipo das telas no artefato Design antes da spec, em rodadas com o fundador até a aprovação; design system do projeto; toda referência do fundador passa pelo `to-wireframe` antes do artboard | regra de negócio, código |
| `full-stack-developer` | um ticket, test-first, scaffold pelas skills de monólito; Sonnet por padrão, Opus quando o Engineer classifica a missão como complexa (correção de review, mais de um módulo, tela + backend, migration com dado, nova tentativa); em modo goal, dono de um objetivo no modelo mais capaz: decide módulos, agregados e fatias | sair do ticket; em modo goal, cruzar um limite do contrato ou uma regra da arquitetura |
| `quality-engineer` | review em dois eixos + fronteiras do monólito; em modo goal, verifica cada critério de sucesso rodando a prova e tentando refutá-la | editar |
| `security-engineer` | review como atacante com o `security-audit` da Cloudflare (guidance); achados só com fronteira violada e impacto | editar, rodar o alvo |
| `platform-engineer` | bootstrap, git, worktrees, merge, Prisma, PR | código de módulo, merge na main |
| `integration-engineer` | fatos sobre sistemas externos, com fonte; vigilância de suporte e advisories da stack | afirmar de memória |

## Layout

```
ARCHITECTURE.md            as catorze regras do monólito modular Spectree (vira docs/architecture.md no projeto)
CHANGELOG.md               o que mudou por versão
commands/engineer.md       o orquestrador
agents/*.md                os sete especialistas
hooks/engineer-desk/       o painel do Engineer (módulo de hooks do Claude Code); hooks/hooks.json o nomeia
tests/                     os testes do painel: guarda estrutural (node --test) e kit do Claude Code (claude plugin test)
skills/engineering/        skills de Matt Pocock (MIT, vendorizadas — ver THIRD-PARTY-LICENSES.md)
skills/monolith/           skills de monólito modular (config-*, module-*, backend-*, frontend-*)
skills/security/           security-audit da Cloudflare (MIT, vendorizada): review por mudança e auditoria completa
skills/design/             to-wireframe de rtadewald (vendorizada, ver THIRD-PARTY-LICENSES.md): referência → wireframe tipado
templates/shared           o pacote @<ns>/shared copiado no bootstrap
scripts/smoke.mjs          prova: bootstrap inteiro num projeto temporário, build, testes, 401 sem token
scripts/evals.mjs          prova: o julgamento dos agentes, com `claude plugin eval` sobre evals/
scripts/desk-test.mjs      prova: o painel, com `claude plugin test` numa cópia sem os testes Vitest do template
evals/                     um caso por diretório (prompt.md + graders/), fixtures sintéticos em evals/fixtures/
```

## Prova

```bash
node scripts/smoke.mjs
```

Roda todas as skills de monólito a partir deste repo num projeto temporário (`project-init` → shared → Prisma → backend → frontend → módulo → agregado), `npm run build`, `npm test` (inclui `check-boundaries`) e, com Docker disponível, sobe o Postgres e o backend, exige `401` em `GET /` sem token, prova o `npm run worktree -- up/down` (worktree de ticket com banco, portas e build próprios) e o `npm run perf -- --changed` (só as rotas dos módulos tocados), e roda o mutation testing do módulo de prova e os scanners gitleaks e osv-scanner pelas mesmas imagens Docker do `ci.yml` gerado, que passa pelo actionlint, e o `npm run check:pr` (passa limpo, recusa segredo, título fora do padrão e branch atrás da base). `SMOKE_KEEP=1` preserva o projeto gerado.

```bash
node scripts/evals.mjs
```

Prova o **julgamento** dos agentes, não o scaffold: é o [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals) sobre `evals/`, um caso por diretório, cada um montando um projeto pequeno de `evals/fixtures/` num workspace vazio e aprovando por critério que o runner verifica (regex, ferramenta chamada, arquivo criado), nunca por "parece bom". Os casos: o `quality-engineer` bloqueia um `UpdateAccount` que zera o saldo num PATCH parcial (com `arquivo:linha`) e cita a regra 1 de `docs/architecture.md` para um use case que importa `@nestjs/common`; o `security-engineer` dá `confirmed` `high` a um controller que lê `userId` do body e zero `confirmed` ao mesmo controller lendo do JWT; o `solutions-architect` devolve mapa, grafo acíclico, seams, shared e fronteira sem gravar arquivo; `/engineer` faz exatamente uma pergunta (gate 2) a um pedido fora do roadmap; e, no Goal Driven Development, `/engineer goal` transforma um objetivo em contrato pelo `to-goal` e faz uma pergunta só de aprovação, e o `quality-engineer` em modo goal dá `weak proof` ou `not met`, bloqueante e com `arquivo:linha`, a um critério cuja prova passa com o defeito.

```bash
node --test tests/engineer-desk.test.mjs
```

```bash
node scripts/desk-test.mjs
```

O primeiro guarda a estrutura do painel (módulo nomeado, estado sob o nome do plugin, um desenho por card de `agents/`, arte vetorizada dentro dos limites do engine, nada de rede, sem colidir com `/engineer`). O segundo roda `tests/engineer-desk.test.tsx` com `claude plugin test` a partir de uma cópia só com manifesto, `hooks/` e `tests/`, porque o comando varre todo `*.test.ts` da pasta e os testes Vitest de `templates/shared` não carregam nele.

Roda como você, na sua credencial do Claude Code — por isso não está no CI: custa cerca de US$ 3,50 por passada completa (oito casos, uma run cada): uns 6 minutos com `-j 3`, uns 14 em sequência. `--runs 3` mede variância; `--case se-*` filtra; qualquer outra flag vai para o `claude plugin eval`. `node scripts/evals.mjs --control` prova que a suíte mede o card: roda o caso 1 contra uma cópia do plugin com o card do `quality-engineer` sem a lista de regras e exige que ele **falhe**.

## Versão

A versão vive em `.claude-plugin/plugin.json` e segue SemVer (regra no topo do [CHANGELOG.md](CHANGELOG.md)). **Todo merge na main é uma versão**, porque `claude plugin update` compara versão, não commit: o PR sobe `version` (`PATCH` para correção, `MINOR` para comportamento novo) e escreve a seção `## [x.y.z] - <data>` no CHANGELOG; depois do merge, a tag `v<versão>` vai no merge commit (`git tag v<versão> <merge> && git push origin v<versão>`). Antes de subir `MINOR` que toca skills, templates ou scripts, rode `claude plugin validate . --strict` e `node scripts/smoke.mjs`. Quem instalou atualiza com `claude plugin update spectree-engineer`.

Melhorias que o `/engineer` descobre nos projetos (retro) chegam aqui como [issues](https://github.com/Spectree-Tecnologia/spectree-engineer/issues).
