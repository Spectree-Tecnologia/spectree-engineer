# Goal: transactions

Status: approved by founder on 2026-10-30
Type: feat

## Objective

A user records an income or an expense against one of their accounts and sees, in the list of accounts, what each account holds now.

## Context

### Actors and scenarios

- User: records an income or an expense with an amount, a date and a description against an account of their own; opens the list of accounts to see the current balance of each.

### Decided already

- The current balance is the initial balance plus the account's transactions. Because the initial balance is the amount held when tracking started (GLOSSARY).

### What exists today

- The `accounts` module registers, edits and deactivates accounts. Read first: `modules/accounts/src/account/`.

## Success criteria

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | A user records an income or an expense against an account of their own; the amount is positive, and a transaction against another user's account is refused as not found. | A test at the use case seam, one case per rule. |
| 2 | The list of accounts shows the current balance of each account: initial balance plus incomes minus expenses. | An e2e test at the HTTP seam with two accounts and three transactions, inside the query budget. |
| 3 | A transaction against a deactivated account is refused with `ACCOUNT_INACTIVE`. | The same test file as criterion 1. |

## Limits

- The public props of Account and its error codes do not change.
- Out of scope: categories, editing and deleting transactions.

## Budget

Verification rounds: 3.

## Evidence

| # | Round | Verdict | Command run by the verifier and its exit code |
|---|-------|---------|-----------------------------------------------|
