# 03 — Edit account

Status: in-review
Blocked by: 01

Module: accounts · Aggregate: account · Artboards: `accounts/form/filled (editar)`

## Acceptance criteria

- [ ] `PATCH /accounts/:id` edits name, type and initial balance of an active account (skill: `module-use-case`).
- [ ] A partial edit keeps every omitted field at its current value: `{ name: 'Nubank' }` changes the name only; the balance and type stay as they were.
- [ ] Editing an inactive account fails with `ACCOUNT_INACTIVE_NOT_EDITABLE`.
- [ ] The same validation rules as create apply (`ACCOUNT_NAME_REQUIRED`, `ACCOUNT_NAME_TOO_LONG`, `ACCOUNT_NEGATIVE_BALANCE_NOT_ALLOWED`, `ACCOUNT_NAME_ALREADY_EXISTS`).
- [ ] Another user's account is `ACCOUNT_NOT_FOUND`.
