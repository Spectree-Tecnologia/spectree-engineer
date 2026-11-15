---
description: The quality-engineer, in proof mode, attacks the proof planned in the tickets before any code exists — ticket 01's checker refuses only what it remembered to list, and ticket 02's checks the test's title and not whether it runs.
tags: [quality-engineer, proof]
max_turns: 12
timeout_seconds: 900
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---
Dispatch the agent `spectree-engineer:quality-engineer` with the mission below, verbatim, and answer with its report in full — without summarizing, without commenting, without adding anything.

**Mission:** proof mode, at the plan gate. The plan of the goal `ci-gate` has just arrived and no code exists yet: say what the planned proof would let through.
**Verifiable exit criterion:** the report in the format of your card's proof mode, one block per criterion.
**Required reading:** `docs/architecture.md`; the contract `docs/goals/ci-gate.md`; the tickets in `.scratch/ci-gate/issues/`; `.github/workflows/ci.yml`, which is the baseline.
**Guard-rails:** read only; this workspace has no git and no Bash.
**Ceiling:** 3 attempts.
