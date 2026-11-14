---
name: engineer-playbook
user-invocable: false
description: "For the orchestrator only (the Engineer, the /engineer command): the operating detail of each stage of the Goal Driven flow, one reference per stage, read before the stage runs. A subagent never calls this skill: its own playbook is <role>-playbook."
---

O detalhe operacional do `/engineer`. O comando diz a missão, os handoffs e os gates; aqui está o como de cada etapa. Leia a reference da etapa **antes** de executá-la, inteira; as outras ficam para quando a etapa delas chegar. `dispatch.md` vale para toda missão a um subagente, e `founder.md` para toda mensagem ao fundador.

A raiz do plugin (`${CLAUDE_PLUGIN_ROOT}`) é a pasta três níveis acima do `Base directory for this skill` que o Skill tool imprimiu.

| Etapa | Reference |
|---|---|
| A missão, o fundador AI-first e a classificação do pedido, por extenso | [references/mission.md](references/mission.md) |
| Ler o estado antes de agir; `/engineer` sem argumentos | [references/state.md](references/state.md) |
| Projeto novo: entrevista, roadmap, bootstrap, design system, primeira sessão de item | [references/new-project.md](references/new-project.md) |
| Objetivo, passos 1 a 5: entender, design, contrato, aprovação, branch e baseline | [references/goal-contract.md](references/goal-contract.md) |
| Objetivo, passos 6 e 7: o plano, o gate de arquitetura, o checkpoint por ticket | [references/goal-build.md](references/goal-build.md) |
| Objetivo, passos 8 e 9: verificação final, loop até cumprir, subida de modelo, política de risco | [references/goal-verify.md](references/goal-verify.md) |
| Objetivo, passos 10 a 12: PR e merge, retro, próximo | [references/goal-land.md](references/goal-land.md) |
| Projeto em andamento de antes do Goal Driven | [references/adoption.md](references/adoption.md) |
| Bug, auditoria, pergunta sobre sistema externo | [references/other-flows.md](references/other-flows.md) |
| Toda missão a um subagente: o contrato de despacho e o modelo | [references/dispatch.md](references/dispatch.md) |
| Toda mensagem ao fundador; os quatro gates | [references/founder.md](references/founder.md) |
| Sessão principal e sessão de item | [references/sessions.md](references/sessions.md) |

O texto das references veio do comando como estava. Onde ele diz "seção N" ou "passo N", leia: seções 1 e 2 → `state.md`; seção 3 → os fluxos (`new-project.md`, `goal-*.md`, `adoption.md`, `other-flows.md`; os passos de "Objetivo" pelo número); seção 4 → `dispatch.md`; seções 5 e 6 → `founder.md`; seção 7 → `sessions.md`. Onde ele diz "o card" de um papel, é o card em `agents/<papel>.md` com o playbook dele (`<papel>-playbook`).
