# spectree-engineer

Plugin Claude Code da Spectree Tecnologia: um orquestrador em pt-BR (`/engineer`) com sub-agentes especialistas, para **monólitos modulares seguros e escaláveis na stack atual**.

- **Processo: Goal Driven Development.** Você diz o resultado que quer. O Engineer o transforma num contrato (`docs/goals/<slug>.md`): o objetivo, os critérios de sucesso, cada um com a prova que o decide, os limites e um orçamento de rodadas. O **como** (módulos, agregados, fatias) é de um agente só, o dono do objetivo, no modelo mais capaz, que decide olhando o código. Quem verifica não construiu: roda cada prova, julga se ela prova o critério e tenta refutá-la, até cumprir. Ninguém escreve spec nem quebra o trabalho em tickets. O fluxo: entrevista → roadmap de objetivos → **protótipo** → contrato → construção → verificação → PR (branch, commits e título em Conventional Commits) → **merge automático com CI verde** → próximo objetivo. A tela é prototipada no artefato Design antes do contrato, **em rodadas com você até aprovar**. Fora da entrevista e do protótipo, o squad anda sozinho: a sessão em que você abriu o projeto coordena até o fim dele, e cada objetivo do roadmap roda numa sessão de item linkada a ela, com contexto zerado (Claude Code Desktop); só sobem a você dinheiro/plataforma, mudança de escopo, impacto irreversível e o que nenhuma melhor prática decide. As skills de engenharia de [Matt Pocock](https://github.com/mattpocock/skills) (grilling, domain modeling, TDD, code review, PR, retro) seguem no processo.
- **Arquitetura:** as skills de monólito modular da Spectree — `config-*`, `module-*`, `backend-*`, `frontend-*` — e as regras de DDD tático que elas encodam: módulos puros em `modules/<m>/src/<agregado>/{dto,model,provider,use-case}`, um repositório por raiz de agregado, regra no VO > entidade > domain service, erro como código numa `Result`, `userId` do JWT. O documento canônico é [ARCHITECTURE.md](ARCHITECTURE.md), copiado para `docs/architecture.md` de todo projeto gerado e leitura obrigatória de toda missão.

## Stack gerada

Só majors com suporte, instalados como `@latest`, nunca pinados: Turborepo, **NestJS (ESM, `nodenext`, Vitest)**, **Next.js com Cache Components**, Prisma + PostgreSQL, Node LTS (`.nvmrc`), pacote `@<ns>/shared` em ESM + Vitest.

Seguro por padrão no que o bootstrap gera:

- `JwtGuard` como `APP_GUARD` — toda rota fechada salvo `@Public()`; `JWT_SECRET` sem valor padrão (o app não sobe sem ele).
- `@nestjs/throttler` com limite global, `helmet`, CORS restrito a `FRONTEND_URL`, `ValidationPipe` com `whitelist` + `forbidNonWhitelisted`, `ApiExceptionFilter` logando a causa dos 500.
- Review de segurança em toda mudança (`security-engineer`, em paralelo ao review de padrões) e auditoria completa em seis fases antes da primeira exposição pública e a cada cinco itens do roadmap — `confirmed` vira objetivo de correção, `needs_validation` vira critério de teste.
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
/engineer                                estado do projeto, próximo passo, decisões pendentes
/engineer <o resultado que você quer>    vira objetivo com critérios de sucesso; o squad decide o como e prova
```

Na primeira vez num repositório, o Engineer roda o `setup-matt-pocock-skills` (tracker, labels, layout de domínio) antes de qualquer outra coisa.

### Goal Driven Development

| | |
|---|---|
| O que você dá | o resultado que quer; na entrevista, o roadmap de objetivos; para tela nova, a aprovação do protótipo |
| O que desce para quem constrói | um contrato: objetivo, de três a sete critérios de sucesso com a prova de cada um, limites e orçamento de rodadas. Nenhum plano |
| Quem escreve o contrato | só o Engineer, pela skill `to-goal`; o painel recusa a skill e a escrita em `docs/goals/` a qualquer subagente |
| Quem decide o como | o dono do objetivo (`full-stack-developer`), olhando o código, dentro de `docs/architecture.md`; o plano dele fica em `.scratch/<slug>/plan.md` |
| Como se sabe que acabou | cada critério verificado por quem não construiu: roda a prova, julga se ela prova, tenta refutar. Os achados voltam ao mesmo dono até cumprir; orçamento esgotado sobe a você |
| Quando você é perguntado | pedido fora do roadmap, critério que cria regra de negócio nova, e os quatro gates |

O que não se negocia no como: as regras do monólito modular, cobradas por `check-boundaries`, e prova por exit code.

### O painel do Engineer

O plugin traz um módulo de hooks do Claude Code, `hooks/engineer-desk/`: um painel lateral que acompanha a orquestração. No centro flutua o mascote da Spectree dentro do seu anel; enquanto um subagente roda, o desenho do especialista toma o lugar dele (o último despachado na frente); sozinho com um plano em andamento, é o próprio Engineer que aparece; plano concluído, o mascote sorri; um subagente que falhou ou foi interrompido o deixa em alerta. Abaixo, a barra de progresso do plano e um card por subagente com o mascote pequeno (a expressão do papel enquanto roda, sorrindo ao concluir, alerta se falhou), papel, modelo, tokens, duração, status e passos. No terminal, o plano também fica acima do prompt.

Abre sozinho uma vez por sessão no app desktop e no VS Code, numa pasta com `skills.config.json` ou `docs/roadmap.md`, ou no primeiro despacho de um especialista. `/engineer-desk` reabre. Não alcança rede e só recusa três coisas: um despacho que cairia abaixo do Sonnet (sobe para `sonnet`), um comando Bash que manda heredoc ou pipe para a stdin de um interpretador (`python -`, `node -`), que no Windows fica preso para sempre, e um subagente chamando a skill `to-goal` ou escrevendo em `docs/goals/`: o contrato do objetivo é do Engineer. Function hooks são uma API em early access do Claude Code. Os desenhos são a arte do fundador (PNGs de 2048 px) vetorizada em polígonos, porque o app descarta `<image>` dentro de um `Svg`; para trocar um, troque o PNG e rode `node scripts/trace-art.cjs <pasta dos PNGs> <pasta com imagetracerjs instalado>`, que regrava `mascot-art.ts`.

## O squad

| Agente | Faz | Não faz |
|---|---|---|
| `engineer` (comando) | fala com você em pt-BR, transforma o pedido em contrato (`to-goal`), despacha, roda os critérios permanentes e registra os vereditos | código; dizer ao dono como construir |
| `solutions-architect` | para o Engineer escrever o contrato: o que já existe, seams onde um critério se prova, se cabe num dono, fronteira de perguntas | escrever arquivo; orientar o dono |
| `ui-ux-designer` | protótipo das telas no artefato Design antes do contrato, em rodadas com o fundador até a aprovação; design system do projeto; toda referência do fundador passa pelo `to-wireframe` antes do artboard | regra de negócio, código |
| `full-stack-developer` | dono de um objetivo, no modelo mais capaz: decide módulos, agregados e fatias, constrói test-first com scaffold pelas skills de monólito, entrega a evidência de cada critério | cruzar um limite do contrato ou uma regra da arquitetura; alterar o contrato |
| `quality-engineer` | verifica cada critério de sucesso (roda a prova, julga se prova, tenta refutar) e revisa padrões e fronteiras do monólito | editar; ver o plano ou o relato do dono |
| `security-engineer` | review como atacante com o `security-audit` da Cloudflare (guidance); achados só com fronteira violada e impacto | editar, rodar o alvo |
| `platform-engineer` | bootstrap, CI, branch e baseline, PR e merge, release | código de módulo; alterar o contrato |
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

Roda todas as skills de monólito a partir deste repo num projeto temporário (`project-init` → shared → Prisma → backend → frontend → módulo → agregado), `npm run build`, `npm test` (inclui `check-boundaries`) e, com Docker disponível, sobe o Postgres e o backend, exige `401` em `GET /` sem token, prova o `npm run worktree -- up/down` (worktree isolada com banco, portas e build próprios) e o `npm run perf -- --changed` (só as rotas dos módulos tocados), e roda o mutation testing do módulo de prova e os scanners gitleaks e osv-scanner pelas mesmas imagens Docker do `ci.yml` gerado, que passa pelo actionlint, e o `npm run check:pr` (passa limpo, recusa segredo, título fora do padrão e branch atrás da base). `SMOKE_KEEP=1` preserva o projeto gerado.

```bash
node scripts/evals.mjs
```

Prova o **julgamento** dos agentes, não o scaffold: é o [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals) sobre `evals/`, um caso por diretório, cada um montando um projeto pequeno de `evals/fixtures/` num workspace vazio e aprovando por critério que o runner verifica (regex, ferramenta chamada, arquivo criado), nunca por "parece bom". Os casos: o `quality-engineer` dá `weak proof` ou `not met`, bloqueante e com `arquivo:linha`, a um `UpdateAccount` que zera o saldo num PATCH parcial e cuja prova passa com o defeito, e cita a regra 1 de `docs/architecture.md` para um use case que importa `@nestjs/common`; o `security-engineer` dá `confirmed` `high` a um controller que lê `userId` do body e zero `confirmed` ao mesmo controller lendo do JWT; o `solutions-architect` devolve mapa, grafo acíclico, seams, shared e fronteira sem gravar arquivo; e `/engineer`, diante de um pedido fora do roadmap, grava o contrato pelo `to-goal` e faz exatamente uma pergunta (gate 2).

```bash
node --test tests/engineer-desk.test.mjs
```

```bash
node scripts/desk-test.mjs
```

O primeiro guarda a estrutura do painel (módulo nomeado, estado sob o nome do plugin, um desenho por card de `agents/`, arte vetorizada dentro dos limites do engine, nada de rede, sem colidir com `/engineer`). O segundo roda `tests/engineer-desk.test.tsx` com `claude plugin test` a partir de uma cópia só com manifesto, `hooks/` e `tests/`, porque o comando varre todo `*.test.ts` da pasta e os testes Vitest de `templates/shared` não carregam nele.

Roda como você, na sua credencial do Claude Code — por isso não está no CI: custa cerca de US$ 3 por passada completa (seis casos, uma run cada): uns 5 minutos com `-j 3`, uns 12 em sequência. `--runs 3` mede variância; `--case se-*` filtra; qualquer outra flag vai para o `claude plugin eval`. `node scripts/evals.mjs --control` prova que a suíte mede o card: roda o caso do `UpdateAccount` contra uma cópia do plugin com o card do `quality-engineer` sem o procedimento de verificação nem a lista de regras e exige que ele **falhe**.

## Versão

A versão vive em `.claude-plugin/plugin.json` e segue SemVer (regra no topo do [CHANGELOG.md](CHANGELOG.md)). **Todo merge na main é uma versão**, porque `claude plugin update` compara versão, não commit: o PR sobe `version` (`PATCH` para correção, `MINOR` para comportamento novo) e escreve a seção `## [x.y.z] - <data>` no CHANGELOG; depois do merge, a tag `v<versão>` vai no merge commit (`git tag v<versão> <merge> && git push origin v<versão>`). Antes de subir `MINOR` que toca skills, templates ou scripts, rode `claude plugin validate . --strict` e `node scripts/smoke.mjs`. Quem instalou atualiza com `claude plugin update spectree-engineer`.

Melhorias que o `/engineer` descobre nos projetos (retro) chegam aqui como [issues](https://github.com/Spectree-Tecnologia/spectree-engineer/issues).
