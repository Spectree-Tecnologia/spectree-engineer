---
description: O solutions-architect devolve mapa, grafo acíclico, seams, shared e fronteira, e não grava arquivo.
tags: [solutions-architect, explore]
max_turns: 12
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Despache o agente `spectree-engineer:solutions-architect` em modo exploração com a missão abaixo, textualmente, e responda com o handoff dele na íntegra — sem resumir, sem comentar, sem acrescentar nada.

**Missão:** explorar este pedido do fundador para o projeto deste workspace: "Adicionar o módulo `transactions`: o usuário registra uma receita ou despesa contra uma das suas contas, com valor, data, descrição e categoria; a lista de contas passa a mostrar o saldo atual de cada conta (saldo inicial mais as suas transações)."
**Critério de saída verificável:** o handoff com as cinco seções do seu card: mapa do impacto no layout do monólito, o grafo de módulos na tabela `| Module | Responsibility | Upstream of | Downstream of |` (acíclico), as seams para TDD, o que `@lab/shared` oferece e a fronteira de perguntas com recomendação. Nenhum arquivo criado.
**Leitura obrigatória:** `docs/architecture.md`, `GLOSSARY.md`, `modules/accounts/src/account/index.ts`, `packages/shared/src/`.
**Guard-rails:** só leitura; não proponha stack nem versão; não escreva spec. Uma única tabela de grafo, a recomendada: alternativa descartada (um ciclo, por exemplo) vai em prosa, nunca em tabela.
**Teto:** 3 tentativas.
