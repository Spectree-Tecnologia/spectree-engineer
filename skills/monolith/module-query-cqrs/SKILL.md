---
name: module-query-cqrs
user-invocable: false
description: Create, review or guide module queries in the project's CQRS read pattern. Use when the request involves `*Query` interfaces, `*.query.ts` files, projections/DTOs for API/front-end consumption, pagination/filters/aggregations, separation between read (query) and write (repository/command), or the `module-query-cqrs` skill.
---

# Module Query CQRS

## Overview

Apply the pattern of read queries decoupled from commands, returning DTOs/projections suited to API consumption without exposing entities when not needed.

## Guidelines

- Use a Query for reads/projections; use a Repository/entity for command flows (create/update/delete and write invariants).
- Define query interfaces in `modules/<domain>/src/<feature>/query/` (`*.query.ts`, `execute(...) => Promise<Result<DTO>>`).
- Implement the query in the infrastructure adapter (e.g. Prisma), returning a DTO.
- A read never goes through a use case (rule 4 of `docs/architecture.md`, enforced by `check-boundaries`): the controller calls the query directly.
- Do not couple a query to write-side domain rules.
- Query DTO:
  - may derive from `*Props` (e.g. `UserProps`, `RoleProps`) with `Omit`/additional fields;
  - or be a fully independent DTO, as the projection requires.
  - must not extend the entity class.

## Workflow

1. Identify whether the case is a read (query) or a command (repository).
2. Define the query contract (`FindXxxQuery`) and the output DTO.
3. Implement the query in the adapter (Prisma/in-memory), including filters/pagination when applicable.
4. Call the query directly from the controller and map the failures to HTTP.
5. Validate the final DTO shape for the consumer (API/front end).
6. Create tests covering success, empty/not found and failures.

## References

See `references/query-cqrs-pattern.md` for real examples, checklist and DTO modeling criteria.
