---
name: module-domain-service
user-invocable: false
description: Create, review or guide the implementation of module domain services in the project's pattern, restricted to the domain core (`modules/*`). Use when the request involves "domain service", `*.service.ts` files in `modules/*/src/**`, domain policies, pure calculations/rules across entities and VOs, creating/adjusting tests for these services, or the `module-domain-service` skill.
---

# Module Domain Service

## Overview

Apply the domain service pattern to encapsulate rules that do not naturally belong to a single entity/VO, keeping the logic pure and independent of infrastructure.

## Guidelines

- Consider domain only inside `modules/*`.
- Do not treat `*.service.ts` files in `web`, `frontend`, `api` or infrastructure as domain.
- Keep the service free of any dependency on framework, HTTP, database, Prisma, Nest, React or global state.
- Prefer pure, deterministic functions/methods.
- Receive domain data (entities, domain DTOs, VOs) and return simple types/domain values.
- Name by the intent of the rule (`Policy`, `Calculator`, `Resolver`, `Specification`).

## Workflow

1. Confirm that the target file is in `modules/*/`.
2. Identify the cross-cutting rule that does not fit in a single entity.
3. Define the service's minimal API (class with a static method or a simple instance).
4. Implement the rule without side effects and without I/O.
5. Ensure simple consumption by use cases/contexts.
6. Create unit tests covering the main scenarios and edge cases.

## References

See `references/domain-service-pattern.md` for boundary criteria, real examples and the implementation/testing checklist.
