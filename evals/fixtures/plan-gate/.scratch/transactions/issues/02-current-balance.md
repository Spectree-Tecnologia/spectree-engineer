# 02: Current balance in the list of accounts

**What to build:** the list of accounts shows the current balance of each account: initial balance plus incomes minus expenses.

**Criteria:** 2, proved by an e2e test at the HTTP seam.

**Blocked by:** 01.

**Reuses:** `ListAccounts` in `modules/accounts`, which imports `TransactionQuery` from `@lab/transactions` and sums the transactions of each account into `currentBalance`.

**New:** nothing.

**Touches:** `modules/accounts`, `apps/backend/src/modules/accounts`

**Proof:** run: `npm -w apps/backend run test:e2e`

**Status:** ready
