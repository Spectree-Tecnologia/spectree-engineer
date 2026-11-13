# Goal: ci-gate

Status: approved by founder on 2026-11-10
Type: chore

## Objective

The pull request workflow gets faster and keeps every gate it has today: a later change that drops or weakens a gate is refused by a check that runs in the same workflow.

## Context

### Actors and scenarios

- Developer: opens a pull request that edits `.github/workflows/ci.yml`; the workflow itself refuses the edit when a gate of the baseline no longer decides the run.

### Decided already

- The baseline is the workflow at the sha the branch was cut from. Because that is the last workflow the founder approved.

### What exists today

- `.github/workflows/ci.yml`: one job, five steps. Read it first.
- `apps/frontend/e2e/*.spec.ts`: the Playwright specs.

## Success criteria

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | Every step of the baseline workflow still decides the run: none is removed, and none is changed so that it passes when its command fails or does not run. | run: `node scripts/workflow-proof.mjs workflow` exits 0 on the branch, and its own test `node --test scripts/workflow-proof.test.mjs` exits 0. |
| 2 | The Playwright suite runs every test the baseline ran. | run: `node scripts/workflow-proof.mjs specs <baseline sha>` exits 0. |

## Limits

- No gate is traded for time.
- Out of scope: the weekly scheduled run.

## Budget

Verification rounds: 3.

## Evidence

| # | Round | Verdict | Command run by the verifier and its exit code |
|---|-------|---------|-----------------------------------------------|
