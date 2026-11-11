# Goal: second-copy

Status: proposed
Type: feat

## Objective

A resident who lost a bill gets a second copy of it by e-mail without calling the manager, so that the manager stops answering that request by hand every month.

## Context

### Actors and scenarios

- Resident: asks for the second copy of one of the charges of their own unit and receives it by e-mail.
- Resident of another condominium: knows or guesses the id of a charge and asks for it. Must be refused and must learn nothing.

### Decided already

- A charge belongs to one unit of one condominium, and only residents of that unit see it. Because the product is multi-tenant. (GLOSSARY: Charge, Unit)
- E-mail goes out through the notifications module, which records every message in an outbox before sending. Because other modules reach it by domain event (architecture rule 13).

### What exists today

- Billing issues charges and stores the PDF of each one. A charge has a status: `open`, `overdue`, `paid`, `cancelled`, and billing may add statuses.
- The charges list route already refuses another condominium's resident with 404.

### Unknowns

- How many charges the largest condominium has.

### Priorities

- Never leaking a charge to another condominium wins over convenience.

## Success criteria

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | A resident with an open charge receives the second copy by e-mail within one request; a resident of another condominium asking for the same charge gets 404 and no e-mail is sent. | run: `npm -w apps/backend run test:e2e -- second-copy` exits 0, with a test at the HTTP seam that asserts 200 for the resident of the unit and 404 for the resident of the other condominium. |
| 2 | The second copy is refused, with `CHARGE_NOT_PAYABLE`, for a charge that is `paid` or `cancelled`. | The same file: a test asserts 409 and the code for a paid charge. |
| 3 | The second copy answers quickly even for a condominium with many charges. | run: `npm test` exits 0. |
| 4 | A signed-in resident asking for a charge id that no charge has gets 404, and no e-mail is sent. | The same file: a test asks, as a signed-in resident, for an id that no charge has, and asserts 404 and that the outbox is empty after the request. |

## Limits

- The charge's props, its statuses and the PDF already stored do not change.
- Out of scope: sending the second copy by WhatsApp.

## Budget

Verification rounds: 3.
Size: 4000 changed lines of product code.

## Evidence

Filled by the orchestrator from what the verifiers ran, never by the full-stack-developer. One row per criterion per round.

| # | Round | Verdict | Command run by the verifier and its exit code |
|---|-------|---------|-----------------------------------------------|

## Amendments

A criterion changes only here, never by editing the table above in silence.

| Date | # | Change | Decided by | Follow-up |
|------|---|--------|------------|-----------|
