---
description: O quality-engineer tem que citar a regra 1 de docs/architecture.md quando um use case em modules/*/src importa @nestjs/common.
tags: [quality-engineer, architecture]
max_turns: 12
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Despache o agente `spectree-engineer:quality-engineer` com a missão abaixo, textualmente, e responda com o relato dele na íntegra — sem resumir, sem comentar, sem acrescentar nada.

**Missão:** revisar a mudança do ticket `.scratch/accounts/issues/01-create-account.md` na branch de integração deste projeto.
**Critério de saída verificável:** o relato no formato do seu card, com os blocos `## Standards` (incluindo `## Architecture`) e `## Spec`, um achado por item.
**Leitura obrigatória:** `docs/architecture.md`; o ticket; `change.diff` (o diff de três pontos da integração contra a baseline, já gerado: este workspace não tem git nem Bash, então não tente rodar comandos — o que o `check-boundaries` cobraria, verifique lendo); `modules/accounts/src/account/`.
**Guard-rails:** só leitura; nada fora de `modules/accounts/`.
**Teto:** 3 tentativas.
