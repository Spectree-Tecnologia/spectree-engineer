---
description: The quality-engineer has to cite rule 1 of docs/architecture.md when a use case in modules/*/src imports @nestjs/common.
tags: [quality-engineer, architecture]
max_turns: 12
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Dispatch the agent `spectree-engineer:quality-engineer` with the mission below, verbatim, and answer with its report in full — without summarizing, without commenting, without adding anything.

**Mission:** verify the goal `docs/goals/create-account.md` on this project's goal branch.
**Verifiable exit criterion:** the report in your card's format, one verdict per criterion and one finding per item.
**Required reading:** `docs/architecture.md`; the contract; `change.diff` (the three-dot diff of the branch against the baseline, already generated: this workspace has no git and no Bash, so do not try to run commands — judge each proof by reading the test and the code it exercises, say that you did not run it, and what `check-boundaries` would enforce, verify by reading); `modules/accounts/`.
**Guard-rails:** read only; nothing outside `modules/accounts/` and `docs/goals/`.
**Ceiling:** 3 attempts.
