# spectree-engineer

Plugin Claude Code da Spectree Tecnologia: um orquestrador em pt-BR (`/engineer`) com sub-agentes especialistas, para **monólitos modulares seguros e escaláveis na stack atual**.

- **Processo:** as skills de engenharia de [Matt Pocock](https://github.com/mattpocock/skills) — entrevista → roadmap → **design** → spec → tickets → TDD → code review → PR → **merge automático com CI verde** → próxima spec. A tela é prototipada no artefato Design antes da spec, não vista semanas depois do código. Depois da entrevista o squad anda sozinho; só sobem a você dinheiro/plataforma, mudança de escopo, impacto irreversível e o que nenhuma melhor prática decide.
- **Arquitetura:** as skills de monólito modular da Spectree — `config-*`, `module-*`, `backend-*`, `frontend-*` — e as regras de DDD tático que elas encodam: módulos puros em `modules/<m>/src/<agregado>/{dto,model,provider,use-case}`, um repositório por raiz de agregado, regra no VO > entidade > domain service, erro como código numa `Result`, `userId` do JWT. O documento canônico é [ARCHITECTURE.md](ARCHITECTURE.md), copiado para `docs/architecture.md` de todo projeto gerado e leitura obrigatória de toda missão.

## Stack gerada

Só majors com suporte, instalados como `@latest`, nunca pinados: Turborepo, **NestJS (ESM, `nodenext`, Vitest)**, **Next.js com Cache Components**, Prisma + PostgreSQL, Node LTS (`.nvmrc`), pacote `@<ns>/shared` em ESM + Vitest.

Seguro por padrão no que o bootstrap gera:

- `JwtGuard` como `APP_GUARD` — toda rota fechada salvo `@Public()`; `JWT_SECRET` sem valor padrão (o app não sobe sem ele).
- `@nestjs/throttler` com limite global, `helmet`, CORS restrito a `FRONTEND_URL`, `ValidationPipe` com `whitelist` + `forbidNonWhitelisted`, `ApiExceptionFilter` logando a causa dos 500.
- Review de segurança em toda mudança (`security-engineer`, em paralelo ao review de padrões) e auditoria completa em seis fases antes da primeira exposição pública e a cada cinco itens do roadmap — `confirmed` vira ticket, `needs_validation` vira teste.
- Supply chain: `.npmrc` com `min-release-age=3`, `.github/dependabot.yml` com o mesmo cooldown, `npm audit --audit-level=high` no CI.
- Fronteiras do monólito verificadas por `scripts/check-boundaries.mjs` no projeto gerado (`npm test` e CI): core puro em `modules/*/src`, módulo depende só do shared, teste fora de `src/`, rota do Next só importa a página do módulo.

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
```

Na primeira vez num repositório, o Engineer roda o `setup-matt-pocock-skills` (tracker, labels, layout de domínio) antes de qualquer outra coisa.

## O squad

| Agente | Faz | Não faz |
|---|---|---|
| `engineer` (comando) | fala com você em pt-BR, grill, spec, tickets, despacha | código |
| `solutions-architect` | mapa de módulos/agregados, seams, fronteira de perguntas | escrever arquivo |
| `ui-ux-designer` | protótipo das telas no artefato Design antes da spec, design system do projeto | regra de negócio, código |
| `full-stack-developer` | um ticket, test-first, scaffold pelas skills de monólito | sair do ticket |
| `quality-engineer` | review em dois eixos + fronteiras do monólito | editar |
| `security-engineer` | review como atacante com o `security-audit` da Cloudflare (guidance); achados só com fronteira violada e impacto | editar, rodar o alvo |
| `platform-engineer` | bootstrap, git, worktrees, merge, Prisma, PR | código de módulo, merge na main |
| `integration-engineer` | fatos sobre sistemas externos, com fonte; vigilância de suporte e advisories da stack | afirmar de memória |

## Layout

```
ARCHITECTURE.md            as dez regras do monólito modular Spectree (vira docs/architecture.md no projeto)
CHANGELOG.md               o que mudou por versão
commands/engineer.md       o orquestrador
agents/*.md                os sete especialistas
skills/engineering/        skills de Matt Pocock (MIT, vendorizadas — ver THIRD-PARTY-LICENSES.md)
skills/monolith/           skills de monólito modular (config-*, module-*, backend-*, frontend-*)
skills/security/           security-audit da Cloudflare (MIT, vendorizada): review por mudança e auditoria completa
templates/shared           o pacote @<ns>/shared copiado no bootstrap
scripts/smoke.mjs          prova: bootstrap inteiro num projeto temporário, build, testes, 401 sem token
scripts/evals.mjs          prova: o julgamento dos agentes, com `claude plugin eval` sobre evals/
evals/                     um caso por diretório (prompt.md + graders/), fixtures sintéticos em evals/fixtures/
```

## Prova

```bash
node scripts/smoke.mjs
```

Roda todas as skills de monólito a partir deste repo num projeto temporário (`project-init` → shared → backend → Prisma → frontend → módulo → agregado), `npm run build`, `npm test` (inclui `check-boundaries`) e, com Docker disponível, sobe o Postgres e o backend e exige `401` em `GET /` sem token. `SMOKE_KEEP=1` preserva o projeto gerado.

```bash
node scripts/evals.mjs
```

Prova o **julgamento** dos agentes, não o scaffold: é o [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals) sobre `evals/`, um caso por diretório, cada um montando um projeto pequeno de `evals/fixtures/` num workspace vazio e aprovando por critério que o runner verifica (regex, ferramenta chamada, arquivo criado), nunca por "parece bom". Os casos: o `quality-engineer` bloqueia um `UpdateAccount` que zera o saldo num PATCH parcial (com `arquivo:linha`) e cita a regra 1 de `docs/architecture.md` para um use case que importa `@nestjs/common`; o `security-engineer` dá `confirmed` `high` a um controller que lê `userId` do body e zero `confirmed` ao mesmo controller lendo do JWT; o `solutions-architect` devolve mapa, grafo acíclico, seams, shared e fronteira sem gravar arquivo; e `/engineer` faz exatamente uma pergunta (gate 2) a um pedido fora do roadmap.

Roda como você, na sua credencial do Claude Code — por isso não está no CI: custa cerca de US$ 2,50 por passada completa (seis casos, uma run cada): uns 5 minutos com `-j 3`, uns 12 em sequência. `--runs 3` mede variância; `--case se-*` filtra; qualquer outra flag vai para o `claude plugin eval`. `node scripts/evals.mjs --control` prova que a suíte mede o card: roda o caso 1 contra uma cópia do plugin com o card do `quality-engineer` sem a lista de regras e exige que ele **falhe**.

## Versão

A versão vive em `.claude-plugin/plugin.json` e segue SemVer (regra no topo do [CHANGELOG.md](CHANGELOG.md)). Para lançar: mova `[Unreleased]` para a versão nova com a data, suba `version`, rode `claude plugin validate . --strict` e `node scripts/smoke.mjs`, faça o commit e a tag `v<versão>` no mesmo commit, e dê push de ambos. Quem instalou atualiza com `claude plugin update spectree-engineer`.

Melhorias que o `/engineer` descobre nos projetos (retro) chegam aqui como [issues](https://github.com/Spectree-Tecnologia/spectree-engineer/issues).
