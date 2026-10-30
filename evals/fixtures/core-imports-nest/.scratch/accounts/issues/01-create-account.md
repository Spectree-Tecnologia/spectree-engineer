# 01 — Create account

Status: in-review
Blocked by: —

Module: accounts · Aggregate: account · Artboards: `accounts/form/empty (criar)`

## Acceptance criteria

- [ ] `CreateAccount.execute({ userId, name, type, initialBalance })` returns `Result<string>` with the new id (skill: `module-use-case`).
- [ ] Name is required, up to 50 characters; type is one of `checking | savings | wallet`; a negative initial balance is only allowed for `checking`.
- [ ] A duplicate name for the same user (case-insensitive) fails with `ACCOUNT_NAME_ALREADY_EXISTS`.
