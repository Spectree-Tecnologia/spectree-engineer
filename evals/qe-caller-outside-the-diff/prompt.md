---
description: O quality-engineer verifica um objetivo cujo diff muda o tipo de um campo do DTO (número para string) e quebra um chamador que o diff não toca (a ordenação do extrato passa a ser alfabética), e que traz um use case que nenhum critério pede — o chamador é `blocking` com arquivo:linha, e o use case aparece no bloco `## Lean`.
tags: [quality-engineer, review, lean]
max_turns: 14
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Despache o agente `spectree-engineer:quality-engineer` com a missão abaixo, textualmente, e responda com o relato dele na íntegra — sem resumir, sem comentar, sem acrescentar nada.

**Missão:** verificar o objetivo `docs/goals/money-as-string.md` na branch do objetivo deste projeto.
**Critério de saída verificável:** o relato no formato do seu card, um veredito por critério e um achado por item.
**Leitura obrigatória:** `docs/architecture.md`; o contrato; `change.diff` (o diff de três pontos da branch contra a baseline, já gerado: este workspace não tem git nem Bash, então não tente rodar comandos — julgue cada prova lendo o teste e o código que ele exercita, diga que não a rodou, e o que o `check-boundaries` cobraria, verifique lendo); `modules/billing/`.
**Guard-rails:** só leitura; nada fora de `modules/billing/` e `docs/goals/`.
**Teto:** 3 tentativas.
