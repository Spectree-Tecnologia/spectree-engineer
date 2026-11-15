---
name: backend-prisma-data
user-invocable: false
description: 'Create, review or guide the backend''s Prisma layer in the project''s pattern. Use when the request involves the Prisma schema (`schema.prisma`, `models/*.model.prisma`), SQL migrations, client generation, seeds (`prisma/seed/*`) and `*.prisma.ts` adapters that map the database to domain/DTO.'
---

# Backend Prisma Data

## Overview

Apply the project's Prisma pattern covering modeling, migration, seed and the implementation of the persistence/read adapters with consistent mapping to the domain.

## Guidelines

- Respect the schema's modular organization in `apps/backend/prisma/models/*.model.prisma`.
- For a new Prisma module, use a `<module-name>.model.prisma` file.
- Keep name mapping with `@map`/`@@map` when needed.
- Update the generated client after schema/migration changes.
- In `*.prisma.ts` adapters, separate the `toDomain`/`fromDomain` mapping and the query DTO.
- Handle errors with `Result.fail(...)` in the adapter.
- Use a transaction for composite operations.
- In the seed, keep the JSON file's types and the Prisma payload consistent.

## Workflow

1. Identify the change: schema, migration, seed or adapter.
2. Adjust the Prisma models and/or the SQL migration.
3. Update the affected `*.prisma.ts` implementation (repository/query).
4. Review the mappings to entity/DTO and the domain contracts.
5. Validate the seed and the delegates used (`assertDelegate` when applicable).
6. Run the Prisma validations (generate/migrate/seed) as the task requires.

## References

See `references/prisma-pattern.md` for the project's paths, checklist and pitfalls.

