# Repository Pattern

## Paths

- Shared bases:
  - `packages/shared/src/db/crud-repository.ts`
  - `packages/shared/src/db/create-repository.ts`
  - `packages/shared/src/db/find-by-id-repository.ts`
- Domain contracts in `modules/*`:
  - `modules/auth/src/user/provider/user.repository.ts`
  - `modules/product/src/product/provider/product.repository.ts`
  - `modules/branch/src/branch/provider/branch.repository.ts`
- Infrastructure implementations:
  - `apps/backend/src/modules/auth/user.prisma.ts`
  - `apps/backend/src/modules/product/product.prisma.ts`
  - `apps/backend/src/modules/branch/branch.prisma.ts`
- Mocks/in-memory for tests:
  - `modules/<domain>/test/mock/in-memory-<entity>.repository.ts`

## Role of the Repository

- Encapsulate persistence of domain entities.
- Expose aggregate-oriented operations (CRUD + specific methods when needed).
- Contain no use case rule.

## Repository vs Query (CQRS)

- Repository:
  - used in commands/writes.
  - may fetch an entity to preserve invariants before update/delete.
- Query:
  - used for reads/DTO projections.
  - may coexist in the same adapter class, but as a separate contract.

## Expected structure

1. Define the repository interface in the domain.
2. Extend `CrudRepository<T>` when it makes sense.
3. Add domain-specific methods only when needed.
4. Implement the adapter (Prisma/in-memory) returning `Result`.
5. Include mappers:

- `toDomain(payload)` to create the entity.
- `fromDomain(entity)` for persistence.

## Implementation checklist

- [ ] The contract is in the domain and typed as `Promise<Result<...>>`.
- [ ] The implementation does not leak ORM types into the domain.
- [ ] Not found error mapped to a domain error.
- [ ] Composite operations use a transaction when needed.
- [ ] Custom methods have domain-oriented names (`findByEmail`, `updateRoles`, etc.).
- [ ] Test mocks follow the real contract.

## Testing strategy

- Test success/failure of the main methods.
- Test not found.
- Test domain-specific methods.
- In mocks/in-memory, ensure behavior consistent with the contract.

## Common pitfalls

- Returning a DTO from a repository method (breaks the boundary with the query).
- Coupling the use case to the ORM instead of the interface.
- Not normalizing data when mapping the domain.
- Forgetting a transaction in operations that change multiple tables.
