---
name: module-repository
user-invocable: false
description: 'Create, review or guide module repository contracts and implementations in the project''s pattern. Use when the request involves `*.repository.ts` files, entity persistence operations (create/update/findById/findAll/delete), adapting infrastructure (e.g. Prisma) to module contracts, error handling with `Result`, `toDomain/fromDomain` mappings, or the `module-repository` skill.'
---

# Module Repository

## Overview

Apply the repository pattern for writing and reading domain entities, with contracts in the domain and a decoupled implementation in infrastructure.

## Guidelines

- Define the contract in `modules/*/src/**/provider/*.repository.ts`.
- Reuse shared bases when applicable (`CrudRepository`, `CreateRepository`, etc.).
- Implement it in an infrastructure adapter (e.g. `apps/backend/src/**/*.prisma.ts`), returning `Result`.
- Map the domain explicitly:
  - `toDomain`: database payload -> entity.
  - `fromDomain`: entity -> persistence payload.
- Handle failures with `Result.fail(...)` and do not leak exceptions in the normal flow.
- Keep the CQRS separation:
  - Repository for commands/writes and entity-oriented reads.
  - Query for reads/DTO projections.

## Workflow

1. Confirm the aggregates/entities covered by the repository.
2. Define/adjust the contract in the domain with the minimal methods needed.
3. Implement the infrastructure adapter respecting the contract.
4. Implement the `toDomain`/`fromDomain` mapping.
5. Ensure transactional consistency for composite operations.
6. Create/adjust in-memory mocks for use case tests.

## References

See `references/repository-pattern.md` for contracts, implementation examples and checklist.
