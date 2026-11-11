# Goal: create-account

Status: approved by founder on 2026-10-30
Type: feat

## Objective

A user registers an account (checking, savings or wallet) with the balance it holds today, so their money has a place in the product.

## Success criteria

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | A signed-in user creates an account with a name, a type and an initial balance, and gets its id back. | A test at the use case seam creates an account and asserts the returned id and the stored props. |
| 2 | The name is required and has up to 50 characters; the type is one of `checking`, `savings`, `wallet`; a negative initial balance is accepted only for `checking`. Each refusal carries its error code. | The same test file: one case per rule, asserting the code. |
| 3 | A second account with the same name for the same user, in any letter case, is refused with `ACCOUNT_NAME_ALREADY_EXISTS`. | The same test file. |

## Limits

- Other modules and the shared package are not changed.
- Out of scope: editing and deactivating accounts.

## Budget

Verification rounds: 3.

## Evidence

| # | Round | Verdict | Command run by the verifier and its exit code |
|---|-------|---------|-----------------------------------------------|
