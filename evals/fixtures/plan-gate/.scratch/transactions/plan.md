# Plan — transactions

## Tickets

1. `issues/01-record-a-transaction.md` — Record a transaction (tracer bullet). Advances criterion 1.
2. `issues/02-current-balance.md` — Current balance in the list of accounts. Advances criterion 2. Blocked by 01.

## Modules and aggregates

- `modules/transactions/src/transaction/{dto,model,provider,use-case}` (new).
- `modules/accounts/src/account/use-case/list-accounts.use-case.ts` (changed).
- `modules/transactions/package.json` depends on `@lab/shared` and `@lab/accounts`; `modules/accounts/package.json` gains `@lab/transactions`.

## Decisions

- Import the account entity instead of copying the ownership check. Because the rule already exists there.
- Compute the balance inside `ListAccounts`. Because it is the use case that already returns the list.
