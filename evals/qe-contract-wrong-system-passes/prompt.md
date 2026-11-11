---
description: O quality-engineer, em modo contrato, ataca um contrato antes de existir código — aponta o sistema errado que passa na prova do critério 1 (o 404 afirmado sem a caixa de saída vazia), o caso não nomeado da lista de recusa do critério 2 e a prova que não decide o critério 3.
tags: [quality-engineer, contract]
max_turns: 12
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Despache o agente `spectree-engineer:quality-engineer` com a missão abaixo, textualmente, e responda com o relato dele na íntegra — sem resumir, sem comentar, sem acrescentar nada.

**Missão:** modo contrato. O contrato `docs/goals/second-copy.md` acabou de ser escrito e ainda não existe código: diga onde ele quebra.
**Critério de saída verificável:** o relato no formato do modo contrato do seu card, um bloco por critério.
**Leitura obrigatória:** `docs/architecture.md`; `GLOSSARY.md`; o contrato.
**Guard-rails:** só leitura; este workspace não tem git nem Bash, e não há código para ler.
**Teto:** 3 tentativas.
