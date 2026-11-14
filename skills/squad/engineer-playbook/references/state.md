# Ler o estado e relatar (seções 1 e 2)

<!-- moved verbatim from commands/engineer.md:14-36 (0.31.0) -->

## 1. Leia o estado antes de agir

Leia, nesta ordem, e trate o que não leu como **desconhecido**, nunca como presumido:

1. `CLAUDE.md` / `AGENTS.md` do projeto — a seção `## Agent skills` aponta para o tracker e o layout de domínio. Se ela não existir, chame o Skill tool com `setup-matt-pocock-skills` antes de qualquer outra coisa (tracker local em `.scratch/` é a resposta padrão para projeto solo).
2. `docs/architecture.md` — as regras numeradas do monólito modular Spectree; o que o `check-boundaries` cobra e o que o review cobra. `GLOSSARY.md` e `docs/adr/` — o vocabulário do projeto. Use os termos dele em tudo que escrever.
3. `docs/roadmap.md` — a lista ordenada de objetivos que a entrevista fechou, com o status de cada um. É o escopo aprovado; o que não está nele é gate 2. `docs/risk-policy.md` — o que o fundador já decidiu sobre o que pode ficar aberto quando o orçamento de um objetivo acaba (passo 9). `docs/goals/*.md` — os contratos: `Status:` diz onde cada objetivo está (`proposed` espera o fundador, `approved` está em construção ou verificação, `landed` está mergeado com uma prova `after merge:` ainda por rodar, `met`, `stopped`), e a tabela `Evidence` diz o que já foi provado. `docs/design/*.md` — um handoff com `Prototype:` e sem `Approved by founder` é um protótipo esperando o fundador: o objetivo dele está parado no passo 2 e retoma de lá.
4. `skills.config.json` (ou `.env/skills.config.json`) — namespace e caminhos do monólito. Sem ele não há projeto bootstrapado.
5. A pasta de trabalho do objetivo em curso, `.scratch/<slug>/`: `plan.md` (o plano do full-stack-developer), `issues/` (os tickets dele, cada um com o seu `Status:`) e `decisions.md`. Projeto de antes da 0.18 tem `.scratch/*/spec.md` e tickets em `.scratch/*/issues/` (`Status:`, `Blocked by:`): leia-os também. Item aberto que tem spec e não tem contrato é trabalho em andamento do fluxo antigo, e se adota antes de retomar ("Projeto em andamento de antes do Goal Driven", seção 3).
6. `git status`, branch atual, worktrees (`git worktree list`), PRs abertos (`gh pr list`).
7. A raiz do plugin: o Skill tool imprime `Base directory for this skill: …` — a pasta `<versão>/` três níveis acima é `${CLAUDE_PLUGIN_ROOT}`. Os subagentes não têm essa variável no shell: passe o caminho absoluto em toda missão que roda script de skill.

Um critério que o full-stack-developer relata como cumprido é o auto-relato de um agente. Só está verificado o que **você** provou rodando o comando nesta sessão, e a prova é o **exit code** do comando, nunca o que um `grep` achou na saída: `cmd | grep ok && git merge` mergeia com a suíte vermelha, porque o `&&` vê o exit do `grep`. Comando de gate roda sozinho, sem pipe antes do `&&`.

## 2. Sem argumentos: relate e continue

Emita a tabela de estado com o que verificou e nada mais, e abaixo dela uma linha com os atalhos abertos no código (`git grep -nE "(//|#) ?shortcut:"`), quando houver:

```
| Objetivo | Status | Critérios cumpridos | Prova rodada |
```

Depois, **sem perguntar**: item em andamento do fluxo antigo é adotado como objetivo (seção 3), sem refazer nem apagar nada; PRs do Dependabot com CI verde vão para o **platform-engineer** mergear (major vira item do roadmap); o run noturno do CI na main vermelho (`gh run list --workflow ci.yml --event schedule --limit 1`) é correção antes de qualquer objetivo; contrato `landed` tem prova esperando a main: rode-a (`npm run goal -- prove <slug> --after-merge`) e feche o objetivo (passo 10); então retome de onde o fluxo parou — full-stack-developer construindo, verificação pendente, PR esperando CI. Se o que falta é **começar** o próximo objetivo do roadmap, a sessão principal abre uma sessão de item para ela (seção 7). Só pare se houver um gate aberto (seção 6) ou um protótipo sem aprovação; aí a pergunta ou a URL com as open questions, no formato da seção 5 — e o texto do fundador em resposta é a próxima rodada do designer. Projeto vazio: diga isso e pergunte o que o fundador quer construir. Não invente um roadmap.
