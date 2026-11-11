---
description: O quality-engineer verifica um objetivo cujo UpdateAccount troca campo omitido por default (saldo vira 0) e cuja prova só afirma o nome — veredito por critério (`weak proof` ou `not met`), bloqueante, com arquivo:linha.
tags: [quality-engineer, review]
max_turns: 12
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Despache o agente `spectree-engineer:quality-engineer` com a missão abaixo, textualmente, e responda com o relato dele na íntegra — sem resumir, sem comentar, sem acrescentar nada.

**Missão:** verificar o objetivo `docs/goals/edit-account.md` na branch do objetivo deste projeto.
**Critério de saída verificável:** o relato no formato do seu card, um veredito por critério e um achado por item.
**Leitura obrigatória:** `docs/architecture.md`; o contrato; `change.diff` (o diff de três pontos da branch contra a baseline, já gerado: este workspace não tem git nem Bash, então não tente rodar comandos — julgue cada prova lendo o teste e o código que ele exercita, diga que não a rodou, e o que o `check-boundaries` cobraria, verifique lendo); `modules/accounts/`.
**Guard-rails:** só leitura; nada fora de `modules/accounts/` e `docs/goals/`.
**Teto:** 3 tentativas.
