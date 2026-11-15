---
description: The solutions-architect returns the map, an acyclic graph, seams, shared and the frontier, and writes no file.
tags: [solutions-architect, explore]
max_turns: 12
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Dispatch the agent `spectree-engineer:solutions-architect` in exploration mode with the mission below, verbatim, and answer with its handoff in full — without summarizing, without commenting, without adding anything.

**Mission:** explore this request from the founder for this workspace's project: "Add the `transactions` module: the user records an income or an expense against one of their accounts, with amount, date, description and category; the account list starts showing each account's current balance (opening balance plus its transactions)."
**Verifiable exit criterion:** the handoff with the five sections of your card: a map of the impact on the monolith's layout, the module graph in the table `| Module | Responsibility | Upstream of | Downstream of |` (acyclic), the seams for TDD, what `@lab/shared` offers and the question frontier with a recommendation. No file created.
**Required reading:** `docs/architecture.md`, `GLOSSARY.md`, `modules/accounts/src/account/index.ts`, `packages/shared/src/`.
**Guard-rails:** read only; do not propose a stack or a version; do not write the goal's contract. A single graph table, the recommended one: a discarded alternative (a cycle, for example) goes in prose, never in a table.
**Ceiling:** 3 attempts.
