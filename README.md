# spectree-engineer

Plugin Claude Code da Spectree Tecnologia: um orquestrador em pt-BR (`/engineer`) com sub-agentes especialistas, para **monólitos modulares seguros e escaláveis na stack atual**.

- **Processo: Goal Driven Development.** Você diz o resultado que quer. O Engineer o transforma num contrato (`docs/goals/<slug>.md`): o objetivo, os critérios de sucesso, cada um com a prova que o decide, os limites e um orçamento de rodadas. O **como** (módulos, agregados, tickets) é do full-stack-developer, que decide olhando o código: ele quebra o objetivo em tickets, e cada ticket é construído por um full-stack-developer novo, que retoma do plano. Todo o squad roda em Opus; só a terceira rodada de verificação de um objetivo, quando duas em Opus não fecharam um critério, sobe para Fable. O `quality-engineer` e o `security-engineer` verificam sem ter construído: rodam cada prova, julgam se ela prova o critério e tentam refutá-la, até cumprir. Ninguém escreve spec nem quebra o trabalho em tickets. O fluxo: entrevista → roadmap de objetivos → **protótipo** → contrato → construção → verificação → PR (branch, commits e título em Conventional Commits) → **merge automático com CI verde** → próximo objetivo. A tela é prototipada no artefato Design antes do contrato, **em rodadas com você até aprovar**. Fora da entrevista e do protótipo, o squad anda sozinho: a sessão em que você abriu o projeto coordena até o fim dele, e cada objetivo do roadmap roda numa sessão de item linkada a ela, com contexto zerado (Claude Code Desktop); só sobem a você dinheiro/plataforma, mudança de escopo, impacto irreversível e o que nenhuma melhor prática decide. As skills de engenharia de [Matt Pocock](https://github.com/mattpocock/skills) (grilling, domain modeling, TDD, code review, PR, retro) seguem no processo.
- **Arquitetura:** as skills de monólito modular da Spectree — `config-*`, `module-*`, `backend-*`, `frontend-*` — e as regras de DDD tático que elas encodam: módulos puros em `modules/<m>/src/<agregado>/{dto,model,provider,use-case}`, um repositório por raiz de agregado, regra no VO > entidade > domain service, erro como código numa `Result`, `userId` do JWT. O documento canônico é [ARCHITECTURE.md](ARCHITECTURE.md), copiado para `docs/architecture.md` de todo projeto gerado e leitura obrigatória de toda missão.

## Stack gerada

Só majors com suporte, instalados como `@latest`, nunca pinados: Turborepo, **NestJS (ESM, `nodenext`, Vitest)**, **Next.js com Cache Components**, Prisma + PostgreSQL, Node LTS (`.nvmrc`), pacote `@<ns>/shared` em ESM + Vitest.

Seguro por padrão no que o bootstrap gera:

- `JwtGuard` como `APP_GUARD` — toda rota fechada salvo `@Public()`; `JWT_SECRET` sem valor padrão (o app não sobe sem ele).
- `@nestjs/throttler` com limite global, `helmet`, CORS restrito a `FRONTEND_URL`, `ValidationPipe` com `whitelist` + `forbidNonWhitelisted`, `ApiExceptionFilter` logando a causa dos 500.
- Review de segurança em toda mudança (`security-engineer`, em paralelo ao review de padrões) e auditoria completa em seis fases antes da primeira exposição pública e a cada cinco itens do roadmap — `confirmed` vira objetivo de correção, `needs_validation` vira critério de teste.
- Supply chain: `.npmrc` com `min-release-age=3`, `.github/dependabot.yml` com o mesmo cooldown, `npm audit --audit-level=high` no CI.
- Um banco descartável por comando, `npm run db:scratch -- <nome> -- <comando>`: cria ao lado do de desenvolvimento, migra, aplica os papéis, semeia, entrega ao comando e dropa no fim, qualquer que seja o exit code. O `quality-engineer`, o `security-engineer`, o perf e cada suíte rodam cada um no seu.
- O orçamento de latência pergunta à base antes de bloquear: rota duas vezes acima do p95 é medida também no código da base, na mesma máquina. Só falha a que ficou mais de 1,25 vez mais lenta; a que a base serve igual de devagar vira um aviso e uma linha do roadmap. Rota nova continua presa ao orçamento.
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
| O que desce para quem constrói | um contrato e mais nada: objetivo, **contexto** (atores e cenários, o que já foi decidido e por quê, o que existe hoje, fatos externos com fonte, o que não se sabe, prioridades), de três a sete critérios de sucesso com a prova de cada um, limites e orçamento de rodadas. Nenhum plano |
| Quem escreve o contrato | só o Engineer, pela skill `to-goal`; o painel recusa a skill e a escrita em `docs/goals/` a qualquer subagente |
| Quem decide o como | o full-stack-developer (`full-stack-developer`), olhando o código; o plano fica em `.scratch/<slug>/plan.md`, com um arquivo por ticket em `.scratch/<slug>/issues/` (skill `to-tickets`, de Matt Pocock, adaptada: fatia vertical que cabe num contexto novo, com os tickets que a bloqueiam). É a memória do objetivo: quem planeja constrói o primeiro ticket, e cada ticket seguinte e cada correção é de um full-stack-developer novo, que retoma dela |
| Gate de arquitetura | do Engineer, **antes do código**: o plano do full-stack-developer é julgado contra as regras numeradas de `docs/architecture.md`. Só regra escrita reprova; preferência não. Critério que só se cumpre violando uma regra sobe a você |
| Loop | checkpoint por ticket: gate barato por exit code, e qualidade e segurança revisando o ticket enquanto um full-stack-developer novo constrói o seguinte |
| Gate adversário | o pipeline de qualidade e segurança, antes do PR: camada determinística por exit code, `quality-engineer` (roda a prova, julga se prova, tenta refutar, mutantes) e `security-engineer` (atacante), sem ver o plano nem o relato do full-stack-developer. O Engineer não rebaixa severidade nem dispensa camada |
| Provas executáveis | a prova que um comando decide vai no contrato como ``run: `<comando>` ``, e `npm run goal -- prove <slug>` roda todas, em UTC como o CI. O full-stack-developer, o quality-engineer, o security-engineer e o Engineer rodam a mesma linha, e o exit code é a evidência |
| Contrato pronto | `npm run goal -- check --ready` exige o contrato aprovado e todo critério `met`, ou dispensado por emenda. Roda no `check:pr` e no CI: sem isso o PR não abre |
| Ataque ao contrato | antes do código, o `quality-engineer` lê só o contrato e diz, por critério, o sistema errado que passaria na prova, o caso que falta e a prova que não decide. Uma passada: prova fraca achada ali custa uma leitura, não uma rodada |
| Fechar a classe | critério reprovado pela segunda vez não recebe remendo: o `full-stack-developer` nomeia a classe do defeito e a construção que a torna impossível, e a rodada seguinte julga a construção |
| Rodada seguinte | a camada determinística roda inteira de novo; os agentes adversários olham o diff da correção e os critérios reabertos, e o que não foi tocado segue `met` pela prova |
| Política de risco | decidida uma vez na entrevista, em `docs/risk-policy.md`: com o orçamento gasto, resíduo `low` do `security-engineer` ou `should` do `quality-engineer` vira critério de um objetivo de hardening e o PR segue, sem perguntar |
| Prova depois do merge | o que só o run do PR ou a main mergeada provam vai como `in ci:` ou `after merge:`, fica `pending`, e o contrato é `landed` até a prova rodar (`npm run goal -- prove <slug> --after-merge`) |
| Números | `npm run goal -- stats` lê os contratos: rodadas por objetivo, quantos passaram na primeira, quantos gastaram o orçamento, decisões que subiram a você, subidas para Fable, linhas e minutos de CI |
| Código enxuto | regra 15 da arquitetura: nada existe que o objetivo não peça. O plano do `full-stack-developer` diz o que reusa e o que cria, o gate de arquitetura recusa criar o que já existe, o `quality-engineer` lê os chamadores que o diff não tocou e aponta, no bloco `Lean`, o código que nenhum critério exige. Atalho consciente fica no código como `shortcut: <limite>, <quando subir>`. Validação em fronteira de confiança, erro que evita perda de dado, segurança e acessibilidade nunca se cortam |
| Custo do objetivo | `npm run goal -- spent <slug>` lê os transcripts do Claude Code desta máquina: relógio, horas paradas no limite de uso do plano, horas paradas por erro da API, horas esperando você, a parte dos tokens em correção depois de verificação, tokens e turnos por papel. `--write` grava a linha `Spent:` no contrato, `--agents` imprime uma linha por agente (turnos, quanto o contexto cresceu, o que o encheu), e o `goal stats` soma os objetivos |
| Missão curta | cada chamada de ferramenta relê o contexto inteiro, e missão longa custa mais por chamada. Na 60ª chamada de um `full-stack-developer`, o painel recusa a chamada uma vez, como aviso: ele fecha o que tem na mão, grava no ticket o que falta e relata `handoff`, e um novo continua o ticket. No checkpoint só voltam `blocking` e `confirmed`; `should` espera a verificação final |
| Retomada automática | sessão de objetivo que parou no limite de uso ou por erro da API é retomada pelo painel, sem você: um minuto depois de a janela reabrir, ou em intervalos de 2 a 60 minutos, até nove tentativas. Só em projeto do Engineer com plano em andamento. Turno que terminou em resposta nunca é retomado, porque pode ser uma pergunta sua; escrever qualquer coisa cancela |
| Ataque à prova | no gate do plano, em objetivo de mais de um ticket, o `quality-engineer` lê o contrato e os tickets e diz o que a prova planejada deixaria passar. O achado vira critério do ticket antes de existir código |
| Ferramentas em dia | `tooling-sync.mjs` leva a um projeto antigo os scripts do squad que vieram depois, no primeiro commit da branch do objetivo. Script que o projeto alterou nunca é sobrescrito |
| Emenda | um critério só muda por uma linha em `## Amendments`, com data, quem decidiu e onde o resto continua. Não existe "cumprido com ressalva" |
| Tamanho | o contrato tem orçamento de linhas alteradas de código de produto (4 000 por padrão; teste, documento e lockfile não contam), medido em todo checkpoint. Estourou, o que está cumprido vai a PR e o resto vira um objetivo de continuação. Cada parte é um run de CI, então o orçamento não é para fatiar miúdo |
| Quando você é perguntado | pedido fora do roadmap, critério que cria regra de negócio nova, estreitar ou dispensar um critério fora da política de risco, orçamento de rodadas esgotado com resíduo que a política não cobre, e os quatro gates |

**O que substituiu o quê.** O contrato substitui a spec (`to-spec`); os tickets continuam, mas mudaram de dono: quem os escreve é o full-stack-developer, a partir do contrato e olhando o código (`to-tickets`, adaptada), nunca o Engineer a partir de uma spec; o card do full-stack-developer substitui o `implement`. As três skills continuam instaladas só para redirecionar uma sessão antiga.

**Projeto em andamento.** Um projeto que começou com spec e tickets não quebra nem recomeça. No primeiro `/engineer` depois da atualização, cada item aberto é adotado como objetivo: o contrato nasce da spec e dos tickets, o que já foi construído entra como contexto, a mesma branch continua, e o item retoma do estágio em que estava. Nada é apagado, e você não é perguntado de novo pelo que já aprovou.

### O painel do Engineer

O plugin traz um módulo de hooks do Claude Code, `hooks/engineer-desk/`: um painel lateral que acompanha a orquestração. No centro flutua o mascote da Spectree dentro do seu anel; enquanto um subagente roda, o desenho do especialista toma o lugar dele (o último despachado na frente); sozinho com um plano em andamento, é o próprio Engineer que aparece; plano concluído, o mascote sorri; um subagente que falhou ou foi interrompido o deixa em alerta. Abaixo, a barra de progresso do plano e um card por subagente com o mascote pequeno (a expressão do papel enquanto roda, sorrindo ao concluir, alerta se falhou), papel, modelo, tokens, duração, status e passos. No terminal, o plano também fica acima do prompt.

Abre sozinho uma vez por sessão no app desktop e no VS Code, numa pasta com `skills.config.json` ou `docs/roadmap.md`, ou no primeiro despacho de um especialista. `/engineer-desk` reabre. Não alcança rede e só recusa quatro coisas: um despacho que cairia abaixo do Opus (sobe para `opus`); um comando Bash que roda um interpretador lendo a stdin, por heredoc, por pipe ou sozinho sem script (`python -`, `node -`, `python`), que no Windows fica preso para sempre; um subagente chamando a skill `to-goal` ou escrevendo em `docs/goals/`, porque o contrato do objetivo é do Engineer; e um subagente usando `git stash`, cuja lista é compartilhada por todas as worktrees. Function hooks são uma API em early access do Claude Code. Os desenhos são a arte do fundador (PNGs de 2048 px) vetorizada em polígonos, porque o app descarta `<image>` dentro de um `Svg`; para trocar um, troque o PNG e rode `node scripts/trace-art.cjs <pasta dos PNGs> <pasta com imagetracerjs instalado>`, que regrava `mascot-art.ts`.

## O squad

| Agente | Faz | Não faz |
|---|---|---|
| `engineer` (comando) | fala com você em pt-BR, transforma o pedido em contrato (`to-goal`), despacha, roda os critérios permanentes e registra os vereditos | código; dizer ao full-stack-developer como construir |
| `solutions-architect` | para o Engineer escrever o contrato: o que já existe, seams onde um critério se prova, se cabe num full-stack-developer, fronteira de perguntas; em modo gate, julga o plano do full-stack-developer contra as regras da arquitetura | escrever arquivo; reescrever o plano |
| `ui-ux-designer` | protótipo das telas no artefato Design antes do contrato, em rodadas com o fundador até a aprovação; design system do projeto; toda referência do fundador passa pelo `to-wireframe` antes do artboard | regra de negócio, código |
| `full-stack-developer` | decide módulos, agregados e tickets, constrói test-first com scaffold pelas skills de monólito, entrega a evidência de cada critério | cruzar um limite do contrato ou uma regra da arquitetura; alterar o contrato |
| `quality-engineer` | verifica cada critério de sucesso (roda a prova, julga se prova, tenta refutar) e revisa padrões e fronteiras do monólito | editar; ver o plano ou o relato do full-stack-developer |
| `security-engineer` | review como atacante com o `security-audit` da Cloudflare (guidance); achados só com fronteira violada e impacto | editar, rodar o alvo |
| `platform-engineer` | bootstrap, CI, branch e baseline, PR e merge, release | código de módulo; alterar o contrato |
| `integration-engineer` | fatos sobre sistemas externos, com fonte; vigilância de suporte e advisories da stack | afirmar de memória |

## Layout

```
ARCHITECTURE.md            as quinze regras do monólito modular Spectree (vira docs/architecture.md no projeto)
CHANGELOG.md               o que mudou por versão
commands/engineer.md       o orquestrador
agents/*.md                os sete especialistas
hooks/engineer-desk/       o painel do Engineer (módulo de hooks do Claude Code); hooks/hooks.json o nomeia
tests/                     os testes do painel: guarda estrutural (node --test) e kit do Claude Code (claude plugin test)
skills/                    ferramentas dos agentes: toda skill declara `user-invocable: false` e fica fora do menu de comandos
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

Roda todas as skills de monólito a partir deste repo num projeto temporário (`project-init` → shared → Prisma → backend → frontend → módulo → agregado), `npm run build`, `npm test` (inclui `check-boundaries`) e, com Docker disponível, sobe o Postgres e o backend, exige `401` em `GET /` sem token, prova o `npm run worktree -- up/down` (worktree isolada com banco, portas e build próprios) e o `npm run perf -- --changed` (só as rotas dos módulos tocados), e roda o mutation testing do módulo de prova e os scanners gitleaks e osv-scanner pelas mesmas imagens Docker do `ci.yml` gerado, que passa pelo actionlint, o `npm run check:pr` (passa limpo, recusa segredo, título fora do padrão, branch atrás da base e contrato de objetivo que ainda não está pronto), o `npm run goal` (forma do contrato, provas em UTC, veredito com ressalva recusado, dispensa só com emenda, orçamento de tamanho), o `npm run db:scratch` (o comando vê o banco descartável como o papel de runtime, o banco some com qualquer exit code, nome em uso nunca é reaproveitado, o e2e passa nele) e o perf recusando medir numa máquina ocupada. `SMOKE_KEEP=1` preserva o projeto gerado.

```bash
node scripts/evals.mjs
```

Prova o **julgamento** dos agentes, não o scaffold: é o [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals) sobre `evals/`, um caso por diretório, cada um montando um projeto pequeno de `evals/fixtures/` num workspace vazio e aprovando por critério que o runner verifica (regex, ferramenta chamada, arquivo criado), nunca por "parece bom". Os casos: o `quality-engineer` dá `weak proof` ou `not met`, bloqueante e com `arquivo:linha`, a um `UpdateAccount` que zera o saldo num PATCH parcial e cuja prova passa com o defeito, e cita a regra 1 de `docs/architecture.md` para um use case que importa `@nestjs/common`; o `security-engineer` dá `confirmed` `high` a um controller que lê `userId` do body e zero `confirmed` ao mesmo controller lendo do JWT; o `solutions-architect` devolve mapa, grafo acíclico, seams, shared e fronteira sem gravar arquivo; o mesmo `solutions-architect`, em modo gate, reprova com a regra numerada um plano em que dois módulos importam o código um do outro e aponta o critério sem ticket; `/engineer`, diante de um pedido fora do roadmap, grava o contrato pelo `to-goal` e faz exatamente uma pergunta (gate 2); num projeto com um item em andamento por spec e tickets, adota o item como objetivo sem refazer nada; o `quality-engineer`, em modo contrato, aponta num contrato sem código o sistema errado que passa na prova, o caso que a lista de recusa não nomeia e a prova que não decide; e o mesmo `quality-engineer` acha, com `arquivo:linha`, o chamador que quebra num arquivo que o diff não tocou, e põe no bloco `Lean` o use case que nenhum critério pede.

```bash
node --test tests/engineer-desk.test.mjs
```

```bash
node --test tests/vocabulary.test.mjs
```

```bash
node --test tests/models.test.mjs
```

```bash
node scripts/desk-test.mjs
```

O `tests/dev-tooling.test.mjs` roda as correções dos scripts do projeto gerado: offset de worktree fora das portas que o browser recusa, rota de criação medida pelo `perf` sem o 409 de chave duplicada, e `.next` limpo antes do build. O `tests/perf-base.test.mjs` roda a comparação do `perf` com a base: igual à base não bloqueia, mais lenta bloqueia, sem base vale o orçamento. O `tests/tokens.test.mjs` guarda a regra de um `full-stack-developer` por ticket, a skill `to-tickets` e o comando `goal spent`. O `tests/lean.test.mjs` guarda a regra do código enxuto em cada papel e o orçamento de palavras do comando e dos cards: texto novo se paga com texto que sai. O `tests/skills.test.mjs` guarda as skills fora do menu de comandos. O teste de vocabulário guarda uma regra de linguagem: o comando e os cards chamam cada agente pelo nome do papel, nunca por apelido. O teste de modelos guarda a política de modelos: todo card declara Opus, o comando só pede Fable a partir da terceira rodada de verificação, e o piso do painel é Opus. Dos outros dois, o primeiro guarda a estrutura do painel (módulo nomeado, estado sob o nome do plugin, um desenho por card de `agents/`, arte vetorizada dentro dos limites do engine, nada de rede, sem colidir com `/engineer`). O segundo roda `tests/engineer-desk.test.tsx` com `claude plugin test` a partir de uma cópia só com manifesto, `hooks/` e `tests/`, porque o comando varre todo `*.test.ts` da pasta e os testes Vitest de `templates/shared` não carregam nele.

Roda como você, na sua credencial do Claude Code — por isso não está no CI: custa cerca de US$ 5 por passada completa (dez casos, uma run cada): uns 4 minutos com `-j 4`, uns 15 em sequência. `--runs 3` mede variância; `--case se-*` filtra; qualquer outra flag vai para o `claude plugin eval`. `node scripts/evals.mjs --control` prova que a suíte mede o card: roda o caso do `UpdateAccount` contra uma cópia do plugin com o card do `quality-engineer` sem o procedimento de verificação nem a lista de regras e exige que ele **falhe**.

## Versão

A versão vive em `.claude-plugin/plugin.json` e segue SemVer (regra no topo do [CHANGELOG.md](CHANGELOG.md)). **Todo merge na main é uma versão**, porque `claude plugin update` compara versão, não commit: o PR sobe `version` (`PATCH` para correção, `MINOR` para comportamento novo) e escreve a seção `## [x.y.z] - <data>` no CHANGELOG; depois do merge, a tag `v<versão>` vai no merge commit (`git tag v<versão> <merge> && git push origin v<versão>`). Antes de subir `MINOR` que toca skills, templates ou scripts, rode `claude plugin validate . --strict` e `node scripts/smoke.mjs`. Quem instalou atualiza com `claude plugin update spectree-engineer`.

Melhorias que o `/engineer` descobre nos projetos (retro) chegam aqui como [issues](https://github.com/Spectree-Tecnologia/spectree-engineer/issues).
