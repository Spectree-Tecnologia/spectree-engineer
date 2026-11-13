# 01: Record a transaction (tracer bullet)

**What to build:** a user records an income or an expense against an account of their own, and a transaction against another user's account is refused as not found.

**Criteria:** 1, proved by a test at the use case seam.

**Blocked by:** None (can start immediately).

**Reuses:** `Account` and `AccountRepository` from `@lab/accounts`: `RecordTransaction.execute()` imports them to load the account and checks `account.props.userId === input.userId` before saving the transaction.

**New:** the module `transactions` with the aggregate `transaction`, because no module records money moving in or out of an account.

**Touches:** `modules/transactions`, `apps/backend/src/modules/transactions`

**Proof:** run: `npx vitest run modules/transactions`

**Status:** ready
