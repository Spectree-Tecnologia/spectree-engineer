# Goal: accounts

Status: met on 2026-10-30
Type: feat

## Objective

A user registers, edits and deactivates their accounts (checking, savings, wallet) with an initial balance.

## Success criteria

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | A user creates, edits and deactivates an account of their own; an inactive account is not editable. | e2e test at the HTTP seam, one case per action. |
| 2 | A negative initial balance is accepted only for a checking account; a duplicate name for the same user is refused. | Tests at the use case seam, one case per rule. |

## Limits

- Out of scope: categories and transactions.

## Budget

Verification rounds: 3.

## Evidence

| # | Round | Verdict | Command run by the verifier and its exit code |
|---|-------|---------|-----------------------------------------------|
| 1 | 1 | met | `npm -w apps/backend run test:e2e` → exit 0 |
| 2 | 1 | met | `npx turbo run test --filter=@lab/accounts` → exit 0 |
