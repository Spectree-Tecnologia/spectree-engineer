# 02: The specs check

**What to build:** `scripts/workflow-proof.mjs specs <baseline sha>` lists the title of every `test(` call in `apps/frontend/e2e/*.spec.ts` at the baseline and on the branch, and exits 1 when a title of the baseline is missing on the branch.

**Criteria:** 2, proved by one case in `scripts/workflow-proof.test.mjs`: a spec file with one `test(` deleted exits 1, and the untouched specs exit 0.

**Blocked by:** 01.

**Reuses:** the baseline reader of ticket 01.

**New:** the `specs` mode.

**Touches:** `scripts/workflow-proof.mjs`, `scripts/workflow-proof.test.mjs`

**Proof:** run: `node --test scripts/workflow-proof.test.mjs`

**Status:** ready
