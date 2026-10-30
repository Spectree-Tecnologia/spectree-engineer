# Spectree modular monolith

One deployable, many modules, each one a bounded context that could become a service tomorrow without a rewrite. These ten rules are what makes that true. Four of them are enforced by `scripts/check-boundaries.mjs` (runs first in `npm test` and in CI); the rest by the review. A rule you want to break is an ADR, never a comment.

| # | Rule | Why | Enforced by |
|---|---|---|---|
| 1 | **The core is pure.** `modules/<m>/src` imports no framework, no ORM, no HTTP, no other module. Only `@<ns>/shared` and plain libraries. | Business rules outlive frameworks. A module you can test with `node` alone is a module you can move. | script (rule 1, 2) |
| 2 | **Modules depend on data, never on code.** A cross-module reference is an id. Two modules importing each other's business code is a cycle, and a cycle is one module pretending to be two. | The module graph stays acyclic, so any module can be extracted or replaced on its own. | script (rule 1) |
| 3 | **The aggregate is the transaction.** What is inserted, changed and removed together lives in one aggregate under one root, with one repository per root. Child entities have no repository. | Consistency boundaries are explicit; locks and transactions follow the aggregate, not the table. | review |
| 4 | **CQRS: commands and queries are different things.** A command is a use case: `execute()` returns `Result<void>`, side effects only. A query is a direct read (`modules/<m>/src/<aggregate>/query/`), never a use case, never through the domain model. | Reads scale and change at a different rate than writes; a use case that returns data is both and does neither well. | script (rule 5) + review |
| 5 | **Rules live as close to the data as possible.** A rule about one value is in its Value Object; about several attributes of one entity, in the entity (`tryCreate`); across entities none owns, in a domain service. A use case is flow: it calls rules, it never re-implements them. | The invariant is enforced wherever the object is built, not only on the path someone remembered to validate. | review |
| 6 | **Errors are codes in a `Result`, never thrown, never translated.** `Result.fail('ACCOUNT_NAME_TAKEN')`; the frontend owns the message in each language. | The core has no locale, no HTTP status, no stack trace to leak; every caller handles failure the same way. | review |
| 7 | **Identity comes from the token, never from the body.** `userId` is read from the JWT by the controller and passed in; the token itself never enters a module. Every route is closed unless marked `@Public()`. | The module cannot be tricked into acting for someone else, and auth is one guard, not a convention. | `JwtGuard` as `APP_GUARD` + review |
| 8 | **Transactions are explicit.** A use case that touches more than one aggregate runs inside `TransactionManager.runInTransaction`, and repositories accept the `TransactionContext`. | No hidden implicit transactions; a partial write is impossible by construction, not by luck. | type system + review |
| 9 | **A route is thin.** `apps/<frontend>/src/app/**/<m>/page.tsx` imports the module's page component and nothing else; the screen lives in `apps/<frontend>/src/modules/<m>/{components,data,pages}`. | The frontend has the same module boundaries as the backend; moving a module moves its screens. | script (rule 4) |
| 10 | **Tests sit at the seam, outside `src/`.** `modules/<m>/test/<aggregate>/*.test.ts` exercises use cases and queries through `execute()` against an `InMemory<Aggregate>Repository`; the e2e covers the guard and status mapping only. | One seam catches most defects for the least coupling; the suite runs in seconds with no database. | script (rule 3) + review |

## Layout

```
modules/<m>/src/<aggregate>/{dto,model,provider,use-case,query}   pure core
modules/<m>/test/<aggregate>/                                      seam tests + mock/
apps/backend/src/modules/<m>/                                      controller, <m>.prisma.ts, prisma/models/<m>.model.prisma
apps/<frontend>/src/modules/<m>/{components,data,pages}            screens
apps/<frontend>/src/app/(private)/<m>/page.tsx                     thin route
packages/shared                                                    Result, Entity, ValueObject, UseCase, repositories, TransactionManager
```

Support modules (auth, users) come first; the core domain last; breadth before depth.
