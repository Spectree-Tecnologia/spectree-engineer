---
description: The quality-engineer verifies a goal whose diff changes the type of a DTO field (number to string) and breaks a caller the diff does not touch (the statement's sorting becomes alphabetical), and that brings a use case no criterion asks for — the caller is `blocking` with file:line, and the use case shows up in the `## Lean` block.
tags: [quality-engineer, review, lean]
max_turns: 14
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Dispatch the agent `spectree-engineer:quality-engineer` with the mission below, verbatim, and answer with its report in full — without summarizing, without commenting, without adding anything.

**Mission:** verify the goal `docs/goals/money-as-string.md` on this project's goal branch.
**Verifiable exit criterion:** the report in your card's format, one verdict per criterion and one finding per item.
**Required reading:** `docs/architecture.md`; the contract; `change.diff` (the three-dot diff of the branch against the baseline, already generated: this workspace has no git and no Bash, so do not try to run commands — judge each proof by reading the test and the code it exercises, say that you did not run it, and what `check-boundaries` would enforce, verify by reading); `modules/billing/`.
**Guard-rails:** read only; nothing outside `modules/billing/` and `docs/goals/`.
**Ceiling:** 3 attempts.
