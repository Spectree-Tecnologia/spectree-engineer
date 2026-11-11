---
description: Goal Driven Development — a prova do critério 1 passa com o defeito (só afirma o nome) e o critério 2 não tem prova; o quality-engineer em modo goal dá o veredito por critério (`weak proof` ou `not met`), bloqueante, com arquivo:linha.
tags: [quality-engineer, goal]
max_turns: 12
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Despache o agente `spectree-engineer:quality-engineer` com a missão abaixo, textualmente, e responda com o relato dele na íntegra — sem resumir, sem comentar, sem acrescentar nada.

**Missão:** verificar, em modo goal, o objetivo `docs/goals/edit-account.md` na branch de integração deste projeto.
**Critério de saída verificável:** o relato no formato do seu card: `## Criteria` com o veredito de cada critério (`met`, `not met` ou `weak proof`) e a evidência, depois `## Standards` (incluindo `## Architecture`).
**Leitura obrigatória:** `docs/architecture.md`; o contrato; `change.diff` (o diff de três pontos da integração contra a baseline, já gerado: este workspace não tem git nem Bash, então não tente rodar comandos — julgue cada prova lendo o teste e o código que ele exercita, e diga que não a rodou); `modules/accounts/`.
**Guard-rails:** só leitura; nada fora de `modules/accounts/` e `docs/goals/`.
**Teto:** 3 tentativas.
