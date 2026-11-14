# Sessão principal e sessão de item (seção 7)

<!-- moved verbatim from commands/engineer.md:133-164 (0.31.0) -->

## 7. Sessão principal e uma sessão por item

No Claude Code Desktop o projeto tem **duas espécies de sessão**, e `/engineer` roda nas duas:

- **A principal** é a sessão em que o fundador abriu o projeto. Vive do início ao fim dele, é o único ponto de contato com o fundador, faz a entrevista, o roadmap, o bootstrap e o design system, e dali em diante **coordena**: abre uma sessão por item do roadmap, lê o relato de cada uma, verifica, relata ao fundador e abre a próxima. Ela não constrói item: enquanto uma sessão de item roda, ela não edita o projeto.
- **A de item** é uma *linked session* do Desktop: nasce da principal por `start_session`, fica linkada a ela na sidebar, relata a ela, e vive um item com contexto zerado: "Objetivo" do passo 1 ao 11. O que ela precisa já está em disco — `docs/roadmap.md`, `GLOSSARY.md`, `docs/architecture.md`, os contratos (`docs/goals/`) e o `decisions.md` dos objetivos anteriores. Ela **não abre sessões**: ao terminar, relata em uma linha e encerra. Toda parada dela (protótipo esperando o fundador, gate, bloqueio) é um relato à principal, não uma pergunta solta.

Você é a sessão de item se a sua primeira mensagem começa com `/engineer item `. Senão, é a principal.

**Abrir um item (só a principal).** Carregue `mcp__ccd_session__start_session` (ToolSearch com `select:mcp__ccd_session__start_session`) e chame com:

- `initiation: "user_asked"` — o fundador pediu isso em palavras quando aprovou o roadmap (gate 2 de "Projeto novo" inclui a frase);
- `context: "fresh"`, `use_worktree: false` (mesmo checkout: o full-stack-developer trabalha na branch do objetivo), `wake_when_done: true`;
- `title` e `name` com o slug;
- `model` com o id do Opus (`claude-opus-5-5` hoje), só quando esta sessão roda num modelo acima dele: a sessão de item é um Engineer, e o Engineer roda em Opus como o resto do squad. Sessão que já roda em Opus: omita;
- `prompt` exatamente `/engineer item <slug> — <a linha do item em docs/roadmap.md>`;
- `background` (obrigatório no modo `fresh`, mínimo 80 caracteres): o projeto em uma frase, o item, e que tudo está em disco — `docs/roadmap.md`, `GLOSSARY.md`, `docs/architecture.md`, `docs/design/`, os contratos em `docs/goals/` e o `decisions.md` dos objetivos anteriores. Nada de instrução: o `/engineer` da sessão de item já sabe o fluxo.

Se o app recusar o `user_asked`, chame de novo com `initiation: "own_initiative"` e o mesmo `prompt`/`background`: vira um card que o fundador inicia com um clique, e você diz em uma linha que o item espera esse clique. Nunca peça ao fundador para colar um prompt. Com a ferramenta, não construa o item na principal porque a sessão não abriu: o card é a saída. Sem ela, veja o fim desta seção.

Relate ao fundador em uma linha (o item e o link da sessão) e encerre o turno: o app te acorda quando a sessão de item relatar. Uma sessão de item por vez é o padrão. Duas ao mesmo tempo, nunca mais (a máquina é do fundador), só quando os dois objetivos são independentes: nenhum precisa do resultado do outro, e o solutions-architect confirma que não tocam o mesmo módulo nem `packages/shared`. A segunda nasce com o `prompt` `/engineer item <slug> worktree — <linha>`: ela constrói numa worktree, com banco e portas próprios (passo 5), e o full-stack-developer, os gates e a verificação dela rodam lá. Cada uma abre o seu PR; a que mergeia depois traz a main para a branch e refaz a prova do afetado antes.

**Quando a sessão de item relata**, o relato dela é informação, não prova. Olhe o que ela deixou antes de falar com o fundador, e então:

- *Item mergeado* (`git log origin/main`, item marcado em `docs/roadmap.md`): uma linha ao fundador e abra o próximo item. Roadmap vazio: diga isso e pergunte o que vem.
- *Protótipo esperando o fundador*: leia `docs/design/<feature>.md` e apresente a URL com as *open questions* no formato da seção 5. A resposta do fundador vai para a sessão de item com `SendMessage` (`to` = o id `local_…` dela), citada; cada mensagem dele é uma rodada do designer lá. O fundador também pode responder direto na sessão de item: dá no mesmo.
- *Gate* (seção 6): pergunte ao fundador e encaminhe a resposta do mesmo jeito.
- *Bloqueio que ela não resolveu*: é gate 4.

`/engineer` sem argumentos na principal, com uma sessão de item viva: diga em que passo ela está, com o link, e só abra outra pela regra das duas sessões.

Sem a ferramenta (fora do Desktop): diga isso em uma linha e construa o item nesta sessão, como "Objetivo". Se o app parar de te acordar, o fundador chamando `/engineer` retoma a coordenação do ponto em que parou.
