# Plan — transactions

## Slices

1. **Record a transaction (tracer bullet).** New module `transactions`, aggregate `transaction`. `RecordTransaction.execute()` imports `Account` and `AccountRepository` from `@lab/accounts` to load the account, checks `account.props.userId === input.userId` and saves the transaction. Proves criterion 1.
2. **Current balance in the list of accounts.** `ListAccounts` in `modules/accounts` imports `TransactionQuery` from `@lab/transactions` and sums the transactions of each account into `currentBalance`. Proves criterion 2.

## Modules and aggregates

- `modules/transactions/src/transaction/{dto,model,provider,use-case}` (new).
- `modules/accounts/src/account/use-case/list-accounts.use-case.ts` (changed).
- `modules/transactions/package.json` depends on `@lab/shared` and `@lab/accounts`; `modules/accounts/package.json` gains `@lab/transactions`.

## Decisions

- Import the account entity instead of copying the ownership check. Because the rule already exists there.
- Compute the balance inside `ListAccounts`. Because it is the use case that already returns the list.
