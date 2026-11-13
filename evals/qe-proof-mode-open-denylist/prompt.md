---
description: O quality-engineer, em modo prova, ataca a prova planejada nos tickets antes de existir código — o checador do ticket 01 recusa só o que lembrou de listar, e o do ticket 02 confere o título do teste e não se ele roda.
tags: [quality-engineer, proof]
max_turns: 12
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Despache o agente `spectree-engineer:quality-engineer` com a missão abaixo, textualmente, e responda com o relato dele na íntegra — sem resumir, sem comentar, sem acrescentar nada.

**Missão:** modo prova, no gate do plano. O plano do objetivo `ci-gate` acabou de chegar e ainda não existe código: diga o que a prova planejada deixaria passar.
**Critério de saída verificável:** o relato no formato do modo prova do seu card, um bloco por critério.
**Leitura obrigatória:** `docs/architecture.md`; o contrato `docs/goals/ci-gate.md`; os tickets em `.scratch/ci-gate/issues/`; `.github/workflows/ci.yml`, que é a baseline.
**Guard-rails:** só leitura; este workspace não tem git nem Bash.
**Teto:** 3 tentativas.
