# Goal: money-as-string

Status: approved by founder on 2026-11-11
Type: fix

## Objective

A resident sees the amount of a charge exactly as it was issued, to the cent, so that a binary rounding of the number never reaches the screen.

## Context

### Decided already

- Money is a string in the DTO, never a number. Because a float loses cents on the way to the screen (architecture rule 12).

## Success criteria

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | A charge's DTO carries `amount` as a decimal string with four places: a charge of 150 is `"150.0000"`, and one of 0.1 + 0.2 is `"0.3000"`. | run: `npx vitest run modules/billing/test/charge/charge-dto.test.ts` exits 0, with a test asserting both exact strings. |
| 2 | A charge of zero is `"0.0000"`, not an empty string. | The same file: a test asserts the exact string. |

## Limits

- The Charge's props and the stored values do not change.

## Budget

Verification rounds: 3.
Size: 4000 changed lines of product code.

## Evidence

| # | Round | Verdict | Command run by the verifier and its exit code |
|---|-------|---------|-----------------------------------------------|

## Amendments

| Date | # | Change | Decided by | Follow-up |
|------|---|--------|------------|-----------|
