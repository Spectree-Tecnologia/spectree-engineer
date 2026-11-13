# 03: The faster workflow

**What to build:** `npm audit` runs beside `npm ci`, and the Playwright suite runs on four workers. Both checks of tickets 01 and 02 run as the first step of the job.

**Criteria:** 1 and 2, proved by the two modes of `scripts/workflow-proof.mjs` exiting 0 on the new workflow.

**Blocked by:** 01, 02.

**Reuses:** the script of tickets 01 and 02.

**New:** nothing.

**Status:** ready
