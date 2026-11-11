# Goal: edit-account

Status: approved by founder on 2026-11-09
Type: feat

## Objective

A user corrects an account they registered (its name, its type or its initial balance) without typing again what was already right.

## Success criteria

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | A partial edit keeps every omitted field at its current value: sending only a new name changes the name, and the type and the initial balance stay as they were. | `npx vitest run modules/accounts/test/account/update-account.test.ts` exits 0, with a test that edits only the name of a savings account holding a non-zero balance and asserts the stored type and balance. |
| 2 | An inactive account is refused with `ACCOUNT_INACTIVE_NOT_EDITABLE`, and nothing is stored. | The same file: a test asserts the code and that the repository was not written. |

## Limits

- The Account's props and its error codes do not change.
- Out of scope: deactivating and deleting accounts.

## Budget

Verification rounds: 3.

## Evidence

| # | Round | Verdict | Command run by the verifier and its exit code |
|---|-------|---------|-----------------------------------------------|
