# 01: The workflow check (tracer bullet)

**What to build:** `scripts/workflow-proof.mjs workflow` reads `.github/workflows/ci.yml` on the branch and at the baseline, and exits 1 when a gate was dropped or weakened. It refuses three things: a step of the baseline whose `name` is no longer in the job, a step with `continue-on-error: true`, and a step whose `run:` ends with `|| true`. Anything else exits 0.

**Criteria:** 1, proved by `scripts/workflow-proof.test.mjs` with three cases, one per refusal: a workflow without the `Audit` step exits 1, a step with `continue-on-error: true` exits 1, and `npm test || true` exits 1. The baseline workflow exits 0.

**Blocked by:** None (can start immediately).

**Reuses:** `node:test` and `node:assert`, already used by the project's other script tests.

**New:** `scripts/workflow-proof.mjs` and its test, because nothing in the project compares the workflow with its baseline.

**Status:** ready
