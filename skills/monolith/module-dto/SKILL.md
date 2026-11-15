---
name: module-dto
user-invocable: false
description: 'Create, review or guide module Data Transfer Objects in the project''s pattern. Use when the request involves `dto/*.ts` files, input (`InDTO`) and output (`OutDTO`) contracts, CQRS query DTOs for reads, pagination/filters/metadata, adapting types for API/front-end consumption without leaking entity/ORM details, or the `module-dto` skill.'
---

# Module DTO

## Overview

Apply the DTO pattern to application/read boundaries, clearly separating input, output and query projections according to the consumer and the use case.

## Guidelines

- Distinguish DTOs by purpose:
  - Input DTO (`InDTO`): input of a use case/command/filter.
  - Output DTO (`OutDTO`): response of a use case/controller.
  - Query DTO (CQRS): read projection for the API/front end.
- A query DTO must not extend an entity class.
- A DTO may:
  - derive from `*Props` (e.g. `UserProps`, `RoleProps`) with `Omit`/`Pick`;
  - or be fully independent when the projection requires it.
- Keep the DTO free of domain rules and of coupling to the ORM.
- Prefer explicit names (`FindAllUsersOutDTO`, `ProductFiltersDTO`, `RoleDTO`).

## Workflow

1. Identify the DTO type (input, output or query).
2. Define the minimal contract the consumer needs.
3. Choose the typing base:

- `*Props` + adaptation (`Omit`/`Pick`) when it makes sense;
- a dedicated type when the projection differs from the domain.

4. Standardize pagination/filters/metadata when applicable.
5. Review usage in the use case/query/repository to keep the boundaries correct.

## References

See `references/dto-pattern.md` for real project examples, conventions and checklist.
