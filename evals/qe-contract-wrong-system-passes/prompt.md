---
description: The quality-engineer, in contract mode, attacks a contract before any code exists — it points out the wrong system that passes criterion 1's proof (the 404 asserted without the empty outbox), the unnamed case of criterion 2's refusal list and the proof that does not decide criterion 3.
tags: [quality-engineer, contract]
max_turns: 12
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Dispatch the agent `spectree-engineer:quality-engineer` with the mission below, verbatim, and answer with its report in full — without summarizing, without commenting, without adding anything.

**Mission:** contract mode. The contract `docs/goals/second-copy.md` has just been written and no code exists yet: say where it breaks.
**Verifiable exit criterion:** the report in the format of your card's contract mode, one block per criterion.
**Required reading:** `docs/architecture.md`; `GLOSSARY.md`; the contract.
**Guard-rails:** read only; this workspace has no git and no Bash, and there is no code to read.
**Ceiling:** 3 attempts.
