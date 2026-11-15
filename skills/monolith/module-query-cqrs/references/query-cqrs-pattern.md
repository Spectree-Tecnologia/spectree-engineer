# Query CQRS Pattern

## When to use a Query (CQRS)

- Reads that return data to the front end/API.
- Projections with pagination, filters, aggregations and joins.
- Consumer-oriented output shape (DTO), without requiring the full entity to be returned.

## When to use a Repository (command)

- Write flows: create/update/delete.
- Reads that preserve invariants before a command (e.g. `findById` returning an entity).
- Write-side domain rules with `Entity`/`tryCreate`/`cloneWith`.

## DTO in a Query: modeling rule

- Do not extend the entity class.
- Valid options:
  - Derive from the entity's `*Props` with adaptation:
    - example: `interface RoleDTO extends Omit<RoleProps, "permissionIds"> { permissions: ... }`
  - Create a fully independent DTO when the projection requires it.
- Choose the option with the least coupling for the case.

## Reference paths

- Query interfaces in the domain:
  - `modules/auth/src/user/query/find-user-by-id.query.ts`
  - `modules/product/src/product/query/find-many-products-with-filters.query.ts`
  - `modules/auth/src/audit/query/find-auth-login-overview.query.ts`
- The query's consumer is the controller, directly (`apps/backend/src/modules/<m>/<m>.controller.ts`): a read never goes through a use case, and `check-boundaries` rejects `use-case/find-*`, `list-*`, `get-*`, `search-*` and `count-*` (rule 4).
- Implementations in the adapter (Prisma):
  - `apps/backend/src/modules/auth/user.prisma.ts`
  - `apps/backend/src/modules/product/product.prisma.ts`
  - `apps/backend/src/modules/auth/audit.prisma.ts`

## Expected contract

```ts
export interface FindXxxQuery {
  execute(input: InputDTO): Promise<Result<OutputDTO>>;
}
```

- `InputDTO` may be a primitive, a filter object or pagination.
- `OutputDTO` may be a single item, a paginated collection, an aggregated panel, etc.

## Implementation checklist

- [ ] The case is a read (not a command).
- [ ] The `*Query` interface is in the domain.
- [ ] `execute` returns `Promise<Result<DTO>>`.
- [ ] The DTO is aligned with the consumer's need.
- [ ] The read use case maps `isFailure` to a domain error when needed.
- [ ] The infrastructure adapter implements the interface without leaking database details.

## Testing strategy

- The query/use case returns the expected data in the happy path.
- Empty/not found scenario.
- Query failure scenario (technical error or nonexistent data).
- Pagination/filter cases.
- If there is additional formatting in the use case (e.g. formatted price), test the final projection.

## Common pitfalls

- Returning an entity in an API-facing query when a DTO was the right contract.
- Putting a write rule in a query.
- Coupling the read DTO to the database structure.
- Mixing responsibilities (a query performing a command).
