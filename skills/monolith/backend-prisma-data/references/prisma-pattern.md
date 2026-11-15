# Prisma Pattern

## Main paths

- Schema and models:
  - `apps/backend/prisma/schema.prisma`
  - `apps/backend/prisma/models/*.model.prisma`
- Migrations:
  - `apps/backend/prisma/migrations/*/migration.sql`
- Generated client:
  - `apps/backend/prisma/generated/prisma/*`
- Connection service:
  - `apps/backend/src/db/prisma.service.ts`
- Adapters:
  - `apps/backend/src/**/*.prisma.ts`
- Seeds:
  - `apps/backend/prisma/seed/main.ts`
  - `apps/backend/prisma/seed/*-module.ts`

## Observed conventions

- Modular schema per domain (`auth.model.prisma`, `product.model.prisma`, `stock.model.prisma`, etc.).
- Use of `@map`/`@@map` to reconcile database naming.
- `PrismaClient` with local output in `./generated/prisma`.
- Prisma adapters implement domain contracts (repository/query) and return `Result`.
- Explicit database -> domain/DTO mapping inside the adapter.

## Change checklist

### 1. Modeling

- [ ] Change the model in the correct `models/*.model.prisma` file.
- [ ] Define/adjust relations (`@relation`, `onDelete`) and indexes.
- [ ] Check naming with `@map`/`@@map`.

### 2. Migration and client

- [ ] Generate/apply the SQL migration.
- [ ] Ensure the client is updated after a schema change.
- [ ] Check that the expected delegates exist in the client.

### 3. Prisma adapter

- [ ] Update select/include for the new field/relation.
- [ ] Adjust `toDomain` / `fromDomain`.
- [ ] Adjust the query DTO when the read is projected.
- [ ] Handle failures with `Result.fail`.
- [ ] Use a transaction for multiple changes (`$transaction`).

### 4. Seed

- [ ] Adjust the seed types (`type XxxSeedItem`) when needed.
- [ ] Persist new fields in create/update.
- [ ] Validate data integrity (counts, references, uniqueness).

## CQRS inside Prisma adapters

- These can coexist in the same adapter class:
  - repository methods (entity/command)
  - query properties (`findXxxQuery = { execute: ... }`) for reads/DTO
- Keep clear boundaries in the domain contract.

## Common pitfalls

- Forgetting to update the adapter after changing the schema.
- Returning a DTO from a command repository method.
- Not updating the seed when a required field is added.
- Not regenerating the client after model changes.
- Using raw SQL without proper typing/conversion of numeric types (`bigint`/`string`).

## Global Reference

