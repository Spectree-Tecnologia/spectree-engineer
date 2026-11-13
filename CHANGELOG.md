# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versão: [SemVer](https://semver.org/lang/pt-BR/) — `MAJOR` quando um projeto gerado pela versão anterior deixa de funcionar com a nova (layout, `skills.config.json`, `ARCHITECTURE.md`), `MINOR` para agente, skill, regra ou passo novo, `PATCH` para correção sem mudança de comportamento. **Todo merge na main é uma versão**: o PR já sobe `version` e escreve a seção dele aqui, e o merge leva a tag.

## [0.24.0] - 2026-11-12

Três achados das retros de ferramental do PILOT, nos scripts que o `config-project` grava no projeto.

### Added
- **`perf.config.json` mede rota de criação.** Em `path` e `body`, `{{uuid}}` vira um UUID novo por requisição (o mesmo em toda a requisição) e `{{n}}` um contador da rota: `{ "name": "perf-{{uuid}}" }` mede o caminho real do create, e não o 409 de chave duplicada que toda requisição depois da primeira recebia. `accept: [409]` lista os status além de 2xx que a rota pode responder sem falhar; status fora da lista continua falhando, e a segunda medição volta a valer para a rota. (#77)
- `scripts/clean-next.mjs` e `prebuild: node scripts/clean-next.mjs` na raiz: antes do `npm run build`, todo `apps/*/.next` é esvaziado, menos o `.next/cache`. (#78)
- `tests/dev-tooling.test.mjs`: roda o `perf.mjs` contra um servidor local, o `clean-next.mjs` e o `tooling-sync.mjs` num projeto antigo.

### Fixed
- **O `worktree.mjs` não entrega mais uma porta que o browser recusa.** Offset cuja porta de backend ou frontend cai na lista que Chromium e Firefox bloqueiam (`ERR_UNSAFE_PORT`: 6000, 6566, 6665-6669, 6697, 10080...) é pulado, com uma linha dizendo por quê; offset forçado nessa lista é recusado. No PILOT, o frontend em 6000 parecia bug do objetivo. (#76)
- **O restore do cache do turbo não mistura dois builds.** O `turbo.json` gerado tira o `.next/cache/**` dos outputs do build, e o `prebuild` limpa o `.next` que um build anterior deixou ao lado do restaurado. O `tooling-sync --apply` leva os dois a projeto existente: acrescenta `!.next/cache/**` ao `turbo.json` e o script `prebuild` quando o projeto não tem um (projeto com `prebuild` próprio encadeia `node scripts/clean-next.mjs` à mão). (#78)

## [0.23.0] - 2026-11-12

Tokens por objetivo. Medido nos dois objetivos reais do PILOT: o `manager-registry` ficou 61,6 das suas 82,4 horas parado no limite semanal do plano, e 85% dos tokens dele foram um `full-stack-developer` relendo um contexto que segurava o objetivo inteiro, 259 mil tokens por turno em 2.899 turnos.

### Added
- **`npm run goal -- spent <slug>`.** Lê os transcripts do Claude Code desta máquina, pela sessão aberta com `/engineer item <slug>`: relógio, horas no limite de uso do plano, horas esperando resposta, quanto tempo um agente rodou e com que paralelismo, e tokens e turnos por papel. `--write` grava a linha `Spent:` no contrato. `--session` nomeia a sessão quando ela não abriu por item. Só lê os transcripts.
- `goal stats` ganha as colunas `wall h`, `limit h` e `tokens M`, e os totais de tokens por objetivo e de horas no limite.
- `tests/tokens.test.mjs`.

### Changed
- **O plano é em tickets, e cada ticket é de um `full-stack-developer` novo.** A skill `to-tickets`, de Matt Pocock, volta adaptada ao Goal Driven: quem escreve os tickets é o `full-stack-developer` que planeja, a partir do contrato e olhando o código, nunca o Engineer. Um ticket é uma fatia vertical que cabe num contexto novo, com os tickets que o bloqueiam, num arquivo em `.scratch/<slug>/issues/<NN>-<nome>.md`; o `plan.md` é o índice. Quem planeja constrói o primeiro ticket; cada ticket seguinte e cada correção de verificação é de um agente novo, e o ticket fechado ganha `Status: done`, `Done: <sha>` e `Next needs:`. Antes, um agente só segurava o objetivo inteiro e recebia os achados por SendMessage.
- "Fatia" sai do vocabulário do comando e dos cards: a unidade de trabalho se chama ticket.
- O card do `full-stack-developer` manda ler e rodar em lote e mandar saída longa para arquivo: cada turno relê o contexto inteiro.
- O que um script ou o painel já impõe saiu da prosa: a regra do interpretador lendo a stdin ficou em uma frase, e o veredito com ressalva ficou só no `goal check`. As regras de como cortar o trabalho saíram do card para a skill, que só quem planeja carrega. O comando e os cards somados têm 93 palavras a menos que na 0.22.0.

## [0.22.0] - 2026-11-11

Código enxuto num squad goal driven, a partir da leitura do [ponytail](https://github.com/DietrichGebert/ponytail) de Dietrich Gebert (MIT). Lá o agente adivinha o que ninguém pediu; aqui o contrato decide: é o código que nenhum critério, limite ou regra exige.

### Added
- **Regra 15 da arquitetura: nada existe que o objetivo não peça.** Antes de criar, o que já existe, nesta ordem: o projeto, o `@<ns>/shared`, a plataforma, uma dependência instalada. Nada de abstração, opção ou código "para depois" além do que as regras pedem; scaffold que nenhum critério exercita sai antes do commit. Nunca se corta validação em fronteira de confiança, erro que evita perda de dado, segurança, acessibilidade nem o que um critério pede.
- **O plano diz o que reusa.** Cada fatia do `full-stack-developer` traz `Reuses:` e `New:`, e o `solutions-architect` em modo gate ganha o bloco `Reuse`: criar o que já existe é `violates rule 15`, antes de existir código.
- **O `quality-engineer` lê além do diff.** Para todo símbolo que muda de assinatura, retorno, nome ou comportamento, ele procura cada chamador no projeto; chamador que o diff não tocou e que quebra é `blocking`. E ganha o bloco `## Lean`: `delete`, `reuse`, `yagni`, `merge`, sempre `should`, que a política de risco manda para o objetivo de hardening sem gastar rodada. Caso novo de eval: `qe-caller-outside-the-diff`.
- **Atalho declarado.** `shortcut: <o limite>, <quando subir>` no código é decisão, não achado, salvo quando a carga do contrato já passa do limite ou quando adia o que a regra 15 proíbe cortar. O relato de estado do Engineer lista os atalhos abertos.
- **Achado em quatro partes para o fundador.** Numerado, e com o que é, o problema, a correção e o que acontece se pularmos. Todo relato fecha com o que não foi conferido.
- **`tooling-sync` leva regra nova a projeto antigo.** Regra numerada que o `docs/architecture.md` do projeto não tem é acrescentada abaixo das que ele tem, que ficam como estão.
- `tests/lean.test.mjs`: a regra em cada papel e o orçamento de palavras do comando e dos cards.

### Changed
- **O comando `/engineer` perdeu 416 palavras.** O passo 3 repetia o que a skill `to-goal`, carregada nesse mesmo passo, já diz; a regra de fechar a classe e o que cada verificador faz ficaram só nos cards. O comando e os cards somados têm 2 palavras a menos que na 0.21.1.

## [0.21.1] - 2026-11-11

### Fixed
- **As skills saem do menu de comandos.** As 32 skills do plugin são ferramentas dos agentes do squad, e apareciam como `/spectree-engineer:<skill>` no app desktop e na CLI. Toda `SKILL.md` declara agora `user-invocable: false`: some do menu e continua chamável pelo Engineer e pelos especialistas. O único comando que o fundador digita é `/engineer`. Guarda: `tests/skills.test.mjs`.

## [0.21.0] - 2026-11-11

Sete mudanças tiradas dos dois objetivos reais do PILOT, que gastaram as três rodadas num único critério e chamaram o fundador.

### Added
- **Ataque ao contrato antes do código.** O `quality-engineer` ganha o modo contrato: lê só o contrato e responde, por critério, `wrong system passes`, `unnamed case`, `not decidable` ou `ok`. O Engineer o despacha no passo 3, uma passada, e corrige o contrato enquanto é edição e não emenda. Caso novo de eval: `qe-contract-wrong-system-passes`.
- **Política de risco, decidida uma vez.** A entrevista fecha `docs/risk-policy.md`: com o orçamento gasto, o que sobra de `confirmed` `low` ou `informational` e de `should` vira critério de um objetivo de hardening, por emenda `narrowed` decidida pela política, e o PR segue. O resto continua gate 4.
- **Prova depois do merge.** Prova escrita como `in ci:` ou `after merge:` fica `pending`, o `check --ready` a aceita, `npm run goal -- prove <slug> --after-merge` a roda na main, e o contrato é `landed on <data>` até lá. `met` com prova pendente é recusado.
- **`npm run goal -- stats`.** Lê os contratos e imprime, por objetivo, rodadas contra o orçamento, critérios reprovados, decisões do fundador, decisões da política, subida para Fable, linhas de produto e minutos de CI, e os totais. O contrato ganha a linha `Landed: PR #<n>, <linhas> product lines, CI <min> min`.
- **`tooling-sync.mjs`.** Leva os scripts do squad a um projeto de versão anterior: `--check`, `--apply` e `--keep <arquivo>`. Copia o que falta, atualiza o que o projeto nunca mexeu e nunca sobrescreve o que ele alterou. O bootstrap grava `scripts/.squad-tooling.json`, e o `platform-engineer` roda o sync no primeiro commit da branch do objetivo, antes da baseline.
- Emenda `extended`, para rodadas além do orçamento.

### Changed
- **Fechar a classe, não o caso.** Critério reprovado pela segunda vez volta com `Class:` e `Closed by:` do `full-stack-developer`, e o `quality-engineer` e o `security-engineer` julgam primeiro a construção.
- **Rodada seguinte mais estreita.** A camada determinística roda inteira; os agentes recebem o diff da correção e os critérios reabertos, e o que não foi tocado segue `met` com a evidência `carried`. No checkpoint de fatia, o `security-engineer` só entra quando a fatia toca uma fronteira de confiança.
- A reprovação de uma rodada só vira `met` na mesma rodada por emenda `narrowed`: o `goal check` recusa a troca sem ela.

## [0.20.0] - 2026-11-11

### Changed
- **Opus em todos, Fable só na terceira rodada.** Todo card do squad declara `model: opus`, e o Engineer não passa mais `model` no despacho: o `full-stack-developer` deixa de nascer em `fable`. A única subida acontece quando duas rodadas de verificação em Opus não fecharam um critério: a correção e a verificação da rodada 3 em diante rodam em `fable`, com um `full-stack-developer` novo, que retoma de `.scratch/<slug>/plan.md` com os achados das duas rodadas, e com o `quality-engineer` e o `security-engineer` também em `fable`. A subida fica registrada em `decisions.md` e no relato ao fundador.
- A sessão de item nasce em Opus quando a sessão principal roda num modelo acima dele.
- O piso do painel sobe de Sonnet para Opus: um despacho que nomeia `haiku` ou `sonnet`, ou um agente do harness que cairia em Haiku, vai para `opus`. `fable` nomeado passa como está.
- `tests/models.test.mjs` guarda a política: os sete cards em Opus, um só pedido de `fable` no comando, o da terceira rodada, e o piso do painel.

## [0.19.1] - 2026-11-11

### Changed
- O squad nomeia cada agente pelo nome do papel, nunca por apelido. "O dono" sai do comando, dos cards, da skill `to-goal`, do README e das mensagens dos scripts, e vira `full-stack-developer`; "revisor" e "quem verifica" viram `quality-engineer` e `security-engineer`. O `/engineer` ganha a regra para o relato ao fundador e para as missões: o fundador acompanha pelo painel, que mostra esses nomes, e precisa ler quem é o responsável por cada atividade sem traduzir.
- `tests/vocabulary.test.mjs` guarda a regra: o comando e os cards não usam apelido para um agente.

## [0.19.0] - 2026-11-11

O que a primeira rodada real do Goal Driven Development mostrou (PILOT, `manager-registry`: 407 arquivos, 27 mil linhas, 100 commits, as três rodadas gastas, um critério fechado como "met, narrowed") e as issues abertas.

### Added
- **Provas executáveis.** A prova que um comando decide vai no contrato como ``run: `<comando>` ``. `npm run goal -- prove <slug>` roda todas da raiz, em UTC como o CI, e imprime o exit code de cada uma; prova sem `run:` aparece como manual. O dono confere com ela antes de cada relato, quem verifica roda a mesma linha, e o exit code é a evidência. (#57)
- **`npm run goal -- check`.** A forma do contrato por script: título, status, seções, de um a sete critérios numerados, cada um com prova, vereditos válidos. Com `--ready` exige o contrato aprovado e o último veredito de cada critério `met` ou `waived`; `--changed <ref>` olha só os contratos que a branch mexeu. Roda no `check:pr` e como passo do `ci.yml`: um PR não abre com contrato por cumprir.
- **Emenda de contrato.** Seção `## Amendments`: um critério só muda por uma linha com data, critério, tipo (`narrowed`, `waived`, `moved`, `added`, `reworded`), quem decidiu e onde o resto continua. Veredito novo `waived`, aceito só com a emenda. "Cumprido com ressalva" não existe mais.
- **Orçamento de tamanho.** `Size: 4000 changed lines of product code` no contrato; `npm run goal -- size <slug> --base <sha>` mede em todo checkpoint o código de produto alterado (teste, documento e lockfile não contam, e são relatados à parte) e sai 1 quando estoura. No objetivo que motivou a regra, 62% das 27 mil linhas eram teste e documento: contar tudo com 2 000 linhas o partiria em 14 PRs, e cada PR é um run de CI; contando só produto, com 4 000, são 3. O Engineer então entrega em partes: os critérios cumpridos vão a PR, os outros saem por emenda `moved` para um objetivo de continuação.
- **Banco descartável por comando.** `npm run db:scratch -- <nome> -- <comando>` cria `<db>_scratch_<nome>`, migra, aplica os papéis, semeia, entrega ao comando pelas duas URLs (cada uma com o seu usuário) e dropa no fim, qualquer que seja o exit code. Substitui os seis passos em prosa do perf e dá a cada revisor, ao perf e a cada suíte um banco próprio. (#60, #68)
- Guardas do painel: um interpretador sozinho, sem script (`python`, `node`), e `python - <arquivo>` passam a ser recusados; a recusa vale só em posição de comando, então uma mensagem de commit que cita `python -` passa. Um subagente não usa `git stash`. (#67)
- `perf.mjs` recusa medir com a máquina acima de 50% de CPU (exit 3, `PERF_MAX_CPU` ajusta) e mede uma segunda vez a rota acima do orçamento que respondeu certo: a segunda medida decide. (#49, #55)
- `worktree.mjs` reserva o offset de portas (pasta no git common dir, criada de forma atômica): dois `up` ao mesmo tempo nunca recebem as mesmas portas. (#56)

### Changed
- `/engineer`: o contrato passa pelo `goal check`; o checkpoint mede o tamanho; a verificação final roda as provas, o e2e e o perf cada um no seu banco; revisores não dividem banco; o Engineer não commita na branch enquanto uma missão roda nela; scripts e logs de cada agente em `.scratch/<slug>/<papel>/`; critério de tela cita o artboard e a geometria dele, nunca uma paráfrase; exemplo de fornecedor troca valor com cara de token por placeholder antes do primeiro commit; objetivo que mexe no design system republica o artefato. (#50, #58, #62, #63, #69)
- Cards: o dono confere as provas com `goal prove`, troca a própria porta em vez de matar quem a segura, para servidor no Windows com `taskkill /PID <pid> /T /F`, conta watcher como processo rodando e roda e2e em UTC com os limites do CI; o platform-engineer mergeia do checkout principal, nunca de uma worktree. (#56, #59, #62, #64)
- `config-new-module` lê a faixa do Vitest de um módulo que já existe, em vez de fixar a do template. (#54)

### Fixed
- A quarentena de versões (`min-release-age=3`) passa a valer desde a primeira instalação do bootstrap. O `.npmrc` só era gravado depois do `create-turbo` e do Nest CLI instalarem, e uma versão publicada horas antes entrava no lockfile: em 2026-11-11 foi um binário nativo tão novo que o Windows se recusou a carregá-lo, e o `npm test` do projeto recém-criado falhou.

## [0.18.0] - 2026-11-10

O squad deixa de ser spec-driven e passa a trabalhar em **Goal Driven Development**. O fundador dá o resultado; o squad decide o como e prova.

### Changed
- **`/engineer` tem um fluxo só:** entrevista → roadmap de objetivos → protótipo → contrato → dono constrói → verificação independente → PR → merge → próximo objetivo. O que desce para quem constrói é um contrato (`docs/goals/<slug>.md`) com o objetivo, de três a sete critérios de sucesso cada um com a prova que o decide, os limites e o orçamento de rodadas, e nenhum plano. Não há mais spec, tickets, fronteira de tickets nem worktree por ticket.
- **Menos perguntas ao fundador.** Objetivo do roadmap já está aprovado: o Engineer escreve os critérios a partir do que está decidido, relata e segue. Só para, com uma pergunta e o contrato já gravado, em pedido fora do roadmap e em critério que cria regra de negócio nova. O protótipo de tela nova continua sendo dele.
- **`full-stack-developer` é o dono do objetivo:** decide módulos, agregados, seams e fatias dentro de `docs/architecture.md`, grava o plano dele em `.scratch/<slug>/plan.md`, constrói test-first com critério primeiro, escreve o model e a migration do módulo. Roda no modelo mais capaz (`fable` pedido pelo Engineer, `opus` no card). Os achados da verificação voltam a ele mesmo, a única continuação de contexto do fluxo.
- **`quality-engineer` verifica critérios:** `## Criteria` vem antes de `## Standards` e `## Architecture`. Roda a prova de cada critério, julga se ela prova (`weak proof`) e tenta refutá-la; veredito `met`, `not met` ou `weak proof`. Quem preenche a tabela `Evidence` do contrato é o Engineer.
- `solutions-architect` serve ao Engineer para escrever o contrato e dizer se o objetivo cabe num dono; o handoff dele não vai para quem constrói. `platform-engineer` perde as missões de worktree e merge por ticket: branch e baseline, uma worktree só quando o checkout principal está ocupado, e a prova do merge da main dentro de PR e merge. Bug é um objetivo de um critério; os `confirmed` de uma auditoria viram um objetivo de correção.
- Roadmap: cada linha é um resultado que alguém de fora percebe, nunca uma tarefa ou camada.
- Capacidade: no banco descartável, cada URL mantém o seu usuário e troca só o nome do banco. (#60)

### Added
- **Contexto no contrato.** O contrato é a única coisa que desce, então carrega o que a spec carregava: atores e cenários, o que já foi decidido e por quê, o que existe hoje, fatos externos com fonte, o que já se pensou, o que não se sabe e o que vence quando duas coisas boas se opõem. Descreve, nunca prescreve.
- **Gate de arquitetura, do Engineer, antes do código.** A primeira volta do dono é só o plano; o `solutions-architect` em modo gate o julga contra as regras numeradas de `docs/architecture.md` (regra, grafo de módulos, shared e eventos, cobertura dos critérios). Só regra escrita reprova. Critério que só se cumpre violando uma regra é gate 2.
- **Checkpoint por fatia.** O dono volta ao fechar cada fatia; o Engineer roda o gate barato por exit code (fronteiras, build, teste do afetado, format; zero tarefas não prova nada) e despacha qualidade e segurança sobre a fatia enquanto o dono constrói a seguinte. (#52, #61)
- **Pipeline de qualidade e segurança como gate adversário.** Três camadas obrigatórias antes do PR: determinística por exit code, adversária (`quality-engineer` e `security-engineer`, que nunca veem o plano nem o relato do dono) e o CI. O objetivo só passa com todo critério `met`, zero `blocking`/`should`, zero `confirmed`. O Engineer não rebaixa severidade nem dispensa camada; achado contestado volta a um revisor novo; refutação que passou vira caso da prova.
- **Adoção de projeto em andamento.** Item que estava a meio caminho com spec e tickets é adotado como objetivo no primeiro `/engineer`: inventário pelo platform-engineer, contrato pelo `to-goal` a partir da spec e dos tickets, mesma branch, e retoma do estágio em que estava. Nada é apagado e o fundador não é perguntado de novo. Os cards atendem missão no formato antigo enquanto houver sessão antiga viva.
- Duas sessões de item ao mesmo tempo quando os objetivos são independentes; a segunda constrói numa worktree.
- O dono ganha o que os tickets ensinavam: prefactor primeiro, refactor largo por expandir e contrair, e a leitura do próprio diff antes do relato.
- Skill `to-goal`, **só do Engineer**: transforma o pedido no contrato, com as regras de um critério (observável de fora do código, decidido por prova, com os casos, nunca adjetivo, com o negativo, fechado na fronteira de confiança), o template, e como transformar uma spec e tickets antigos em contrato.
- Terceira guarda do painel: um subagente não chama `to-goal` nem escreve em `docs/goals/`. O dono constrói a partir do contrato e os revisores julgam contra ele; nenhum dos dois move critério ou preenche evidência.

### Replaced
- `to-spec`, `to-tickets` e `implement` deixam de existir como processo. O contrato substitui a spec, o plano do dono substitui os tickets e o card do dono substitui o `implement`. As três continuam instaladas só para redirecionar à adoção uma sessão que começou antes; saem numa versão futura.
- Eval `engineer-gate2-one-question`, substituído por `goal-engineer-contract`: diante de um pedido fora do roadmap o Engineer grava o contrato e faz uma pergunta só.
- Evals novos: `engineer-adopts-legacy-item` (um item com spec e tickets, um mergeado e dois abertos, vira contrato pelo `to-goal`) e `sa-plan-gate-refuses-cycle` (o gate reprova, com a regra, um plano em que dois módulos importam o código um do outro, e aponta o critério sem fatia).

### Evals
- Os casos do `quality-engineer` e do `security-engineer` passam a entregar um contrato no lugar do ticket. `qe-update-account-zeroes-balance` ganha a prova fraca do dono e exige o veredito por critério. `scripts/evals.mjs` concede `Write`, que o runner trata como ferramenta restrita, e o controle corta o card do `quality-engineer` a partir de `## Criteria`.

## [0.17.0] - 2026-11-10

Minutos de Actions como orçamento. O PILOT gastou 1 308 minutos cobrados em oito dias (16 PRs mergeados, 82 por PR) contra perto de 2 000 por mês do plano Free: 57% em runs de push na main que repetiam o PR, e cada run de PR pagando oito jobs.

### Changed
- O `config-project` grava o CI inteiro, `.github/workflows/ci.yml`: **um workflow, um job, só em `pull_request`**, mais um run completo por semana na main e `workflow_dispatch`. Nada roda em push. Os scanners deixam de ser um workflow à parte (`security.yml` sai): gitleaks sempre, `npm audit` e osv-scanner só quando o PR toca o lockfile (e toda semana), squawk nas migrations do PR. PR só de documentação para depois do gitleaks. Título do PR é o primeiro passo, lido da API. Perf roda antes do e2e, no banco em que ninguém escreveu. `timeout-minutes: 20`.
- `dependabot.yml`: um PR agrupado por mês por ecossistema (era semanal, e o de actions sem grupo); o platform-engineer liga alertas e security updates do Dependabot, que não esperam o mês.
- Card do platform-engineer: missão **CI** própria, com o porquê dos minutos, o que nunca entra no arquivo (segundo job, matrix, shard, `push:`), Playwright como passos do mesmo job com banco recriado, e a migração de projeto anterior à 0.17. **PR e merge:** um PR por item, um push, um run; só mergeia branch que contém a ponta da main, porque nada roda depois do merge.
- `/engineer`: passo 8 roda `npm run check:pr` antes de abrir o PR; o run semanal vermelho é ticket de correção antes de qualquer item.

### Added
- `npm run check:pr` no scaffold (`scripts/check-pr.mjs`, do PILOT): título, branch contendo a ponta da base, gitleaks nos commits da branch (binário local da versão pinada ou a imagem, com prova de que o scan leu a branch), squawk nas migrations dela e `format:check` quando existe; os pins vêm do `ci.yml`. (#51, #53)
- Smoke: forma do `ci.yml` (um job, sem push, sem matrix, todo script que ele chama existe, `.env.example` cobre o `.env`), actionlint pela imagem pinada, e o `check:pr` passando limpo e recusando segredo, título e base que andou.

### Fixed
- O painel recusava `cat > fix.py <<'EOF'` como se fosse heredoc para o interpretador: o nome de um arquivo não é o `py`.

## [0.16.0] - 2026-11-06

Retro dos itens `ci-hardening`, `deps-upgrade` e `tx-rollback` (PILOT): #42 #43 #44 #45 #46 #47. Os scripts endurecidos que o PILOT revisou (pilot-agent-system#9) voltam ao template.

### Fixed
- `worktree.mjs`: `up` recusa um `<db>_<slug>` que já existe e `down` só dropa quando `../<repo>-<slug>` é worktree registrada (banco órfão é relatado e mantido); filhos não herdam `DATABASE_URL`/`MIGRATION_DATABASE_URL` do shell; slug limitado aos 63 bytes do Postgres; `--branch` validado por `git check-ref-format`, `--from` por `rev-parse --verify`, flag sem valor recusada, HEAD detached recusado; git por array de argumentos sem shell e identificador SQL por `escapeIdentifier`; `db:roles` via `npm -w apps/backend`; a dica de dev server é `npm -w apps/backend run start:dev` e `npm -w apps/frontend run dev -- -p <porta>` (o `turbo run dev` em modo strict descarta `PORT`). O offset automático da 0.15.0 fica. Smoke prova as cinco recusas. (#42)
- `perf.mjs --changed`: git por `execFileSync` com `--end-of-options` e o ref verificado como commit (injeção de shell e ref em forma de opção viram uma linha e exit 1); qualquer arquivo de `apps/backend` fora de `src/modules/<m>/`, `test/` e `src/cli/` roda todas as rotas (`main.ts`, `db/`, `shared/`, `prisma/`, configs); `test/` e `src/cli/` sozinhos rodam nenhuma, dizendo isso; fixture que uma rota envia (`route.multipart.file`) seleciona a rota; `route.modules: [...]` para rota de composição, que o `config-new-module` já escreve. Smoke prova injeção, `main.ts` e arquivo de teste. (#43)
- `security.yml` gerado: `permissions: contents: read`, `persist-credentials: false`, `github.base_ref` só via `env:`, imagens pinadas por tag e digest (gitleaks v8.30.1, osv-scanner v2.7.0) e `squawk-cli@2.70.0`; o bump é do platform-engineer na vigilância de stack. Card: fingerprint do gitleaks só de commit na main (squash descarta os da branch), `gitleaks:allow` inline e `.gitleaks.toml` estreito, prova da branch squashada, prova local no Windows com `$(pwd -W)` e `--no-local`; job Playwright só eleva limites que a suíte não afirma, `forbidOnly` no CI, `tee frontend.log`, `retention-days` nos logs. Smoke recusa um scan de 0 commits. (#44)
- Passo 7 do Engineer: perf num banco descartável por `createdb` + env exportado + `migrate deploy` + `db:roles` + seed + `dropdb`; nunca `prisma migrate reset`, que o Prisma recusa a um agente sem consentimento do fundador. (#47)

### Added
- Ticket de major de dependência: versão exata dentro da janela do `min-release-age` (o integration-engineer traz data de publicação e marca `within window`/`too new`; o developer nunca espera a janela) e critério "todo consumidor resolve o major novo: `npm ls <pkg> --all` com uma versão só"; o quality-engineer prova com o traço de resolução de cada plugin. (#45 #46)

## [0.15.0] - 2026-11-05

Retro do item `pilot-memory` (PILOT): #38 #39.

### Added
- O painel recusa, antes de rodar, um comando Bash que manda heredoc ou pipe para a stdin de um interpretador (`python - <<EOF`, `python3 -`, `node -`, `node <<EOF`): no Windows o `python` do Git Bash é o stub da Store, que espera stdin para sempre e deixa processo que ninguém mata segurando a worktree. `python file.py`, `python -I file.py` e `node -e "…"` passam. Cards do developer e do platform-engineer dizem o porquê e o caminho (script em arquivo pelo Write tool). (#38)
- `worktree.mjs up <slug>` aloca o offset de portas sozinho: a primeira centena livre entre as worktrees do repositório, lida do `PORT` do `.env` de cada uma; `<offset>` passa a ser opcional e só força. A missão do developer deixa de carregar portas: elas estão no `.env` da worktree desde a 0.10.0. (#39)

## [0.14.0] - 2026-11-05

### Added
- Skill `to-wireframe` (de [rtadewald/skills](https://github.com/rtadewald/skills/tree/main/to-wireframe), commit 82fe5ed) vendorizada em `skills/design/`, com `disable-model-invocation` removido. Regra do `ui-ux-designer`: toda referência do fundador (imagem, print, link, descrição) vira wireframe tipado pela skill antes do artboard, gravado em `docs/design/<feature>/wireframes/` e listado no handoff; o design system vence a referência. Passo 3 do Engineer: imagem colada vai para `docs/design/<feature>/refs/` e a missão nomeia cada referência. O repositório de origem não tem arquivo de licença: a cópia está registrada em `THIRD-PARTY-LICENSES.md` com essa ressalva.

## [0.13.0] - 2026-11-04

Ferramentas gratuitas e de código aberto, primeira leva: um instrumento onde o squad usava só os olhos.

### Added
- `.github/workflows/security.yml` no projeto gerado (escrito uma vez pelo `config-project`): gitleaks (MIT) na história do git, osv-scanner (Apache 2.0) no lockfile, squawk (GPL 3) nas migrations Postgres que o PR adiciona (`--assume-in-transaction`, só no `pull_request`). Imagens Docker oficiais, sem a gitleaks-action, que pede licença para organizações. O `security-engineer` lê o run antes do diff e classifica (segredo em commit é `confirmed critical`; OSV é `confirmed` só em fronteira de confiança; squawk que trava tabela com dado é gate 3). O `platform-engineer` trata o que o OSV acusa por bump ou `osv-scanner.toml` com razão, nunca desligando o job.
- Mutation testing por módulo com StrykerJS (Apache 2.0): `@stryker-mutator/core` e `@stryker-mutator/vitest-runner` nas devDependencies da raiz, `scripts/mutation.mjs` (`npm run mutation -- <módulo>`), `stryker.config.json` por módulo do `config-new-module` (incremental, thresholds 80/60 sem break). O `quality-engineer` roda nos módulos do diff: mutante sobrevivente em arquivo do diff é `should` com arquivo, linha e mutante.
- Smoke: `mutation` no módulo de prova, `gitleaks` e `osv-scanner` pelas mesmas imagens do workflow.

Fora desta leva, por mudarem o projeto inteiro: Biome e pnpm; OpenTelemetry com SigNoz quando houver tráfego.

## [0.12.0] - 2026-11-04

Velocidade do loop, medida no PILOT (CI de 6m46 com o perf em 3m42; seis verificações completas por item, cinco na máquina do fundador; review só depois do último ticket).

### Changed
- **Cache do turbo, nunca `--force`.** O cache é por hash de conteúdo e de env declarada (modo strict do `turbo.json` gerado) e cada worktree tem o seu: `worktree.mjs`, `platform-engineer` e `full-stack-developer` deixam de rebuildar tudo a cada merge e a cada worktree.
- **Só o afetado no loop interno.** Entre tickets o platform-engineer prova com `npm run build && npx turbo run test --filter=...[<sha antes do merge>]`; o developer usa o mesmo filtro contra a integração enquanto itera; a suíte inteira (`npm test`) roda uma vez por item, na ponta do último ticket (passo 6 do Engineer).
- **Perf proporcional ao diff.** `perf.mjs --changed <ref>`: só as rotas dos módulos que o diff toca (módulo por primeiro segmento do path, ou `route.module`); mudança em shared, prisma, db ou config roda todas; sem mudança de backend não sobe servidor e sai 0. CI: `--changed origin/main` no `pull_request`, inteiro no push da main. Passo 7: `--changed <sha da baseline>`. O smoke prova os dois casos.
- **Review sobreposta ao build.** Mergeado um ticket, quality-engineer e security-engineer revisam o diff dele em paralelo com o próximo developer; correções entram na fila da fronteira antes do próximo ticket novo; a review do item (passo 7) cobre só o que mudou desde a última review de ticket, mais a coerência do conjunto.

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

[0.23.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.22.0...v0.23.0
[0.22.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.21.1...v0.22.0
[0.21.1]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.21.0...v0.21.1
[0.21.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.20.0...v0.21.0
[0.20.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.19.1...v0.20.0
[0.19.1]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.19.0...v0.19.1
[0.19.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.18.0...v0.19.0
[0.18.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/Spectree-Tecnologia/spectree-engineer/compare/v0.11.0...v0.12.0
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
