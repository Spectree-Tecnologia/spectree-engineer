---
name: module-entity
user-invocable: false
description: Create, review or guide the implementation of entities. Use when the request involves "entity", "module-entity", `*.entity.ts` files, modeling business rules with `Entity`, validation with `Result`, composition with Value Objects/nested entities, or creating/adjusting entity tests.
---

# Module Entity

## Overview

Apply the project's entity pattern, focused on identity (`id`), invariants, practical immutability (no setters), validation in `tryCreate` and safe operations with `cloneWith`.

## Guidelines

- Read `references/entity-pattern.md` before creating/changing entities.
- Extend `Entity<Type, Props>` from `@namespace/shared` and keep the constructor `private` or `protected`.
- Expose a consistent API: `create` (throws) and `tryCreate` (`Result`).
- Validate invariants with VOs (`Id`, `Name`, `Text`, `Number`, `Sku`, etc.) and `Result.combine`.
- Store in `props` only normalized values (`instance.value`, `instance.props` when applicable).
- Implement getters for domain properties; avoid direct external access to `props` outside the entity.
- Prefer explicit domain methods (e.g. `deactivate`, `createMovementIn`) for relevant behavior.

## Workflow

1. Identify the entity's invariants and identity type (`Id.tryCreate`/`Id.required`).
2. Map the VO and nested entity dependencies for validation.
3. Implement `Props`, the class, getters and `create/tryCreate` in the project's pattern.
4. Add domain methods when there is a state transition/behavior.
5. Create or update tests in `modules/*/test/**` covering valid creation, invalid creation, `cloneWith` and equality by `id`.
6. Review mapping consistency with repositories/DTOs for new fields.

## References

See `references/entity-pattern.md` for paths, checklist, examples and common pitfalls observed in the current code.
