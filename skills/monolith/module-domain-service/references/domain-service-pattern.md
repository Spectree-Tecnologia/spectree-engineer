# Domain Service Pattern

## Scope (boundary)

- Consider a **domain service** only in `modules/*/src/**` paths.
- Valid example:
  - `modules/auth/src/permission/model/permission-policy.service.ts`
  - `modules/stock/src/service/stock-calculator.service.ts`
- Invalid example for this skill:
  - any UI/browser folder inside a domain package
  - `apps/frontend/**`
  - `apps/backend/**` (infra/controllers/HTTP providers)

## When to create a Domain Service

- The business rule does not clearly belong to a single entity.
- The rule combines multiple domain objects and needs to be reusable.
- The rule must be pure and predictable, with no I/O dependency.

## Expected structure

1. Name oriented to the rule (`*Policy`, `*Calculator`, etc.).
2. Lean API:

- class with a simple instance method (e.g. `PermissionPolicy.check`)
- or a static method for calculation (e.g. `StockCalculator.execute`)

3. Explicit, typed inputs.
4. Objective output (boolean, number, or domain type).
5. No access to database, network, filesystem, env, framework.

## Project examples

### PermissionPolicy

- File: `modules/auth/src/permission/model/permission-policy.service.ts`
- Role:
  - receive the user's permissions
  - validate whether the required set is contained in the user's set
- Characteristics:
  - no side effect
  - simple boolean operation

### StockCalculator

- File: `modules/stock/src/service/stock-calculator.service.ts`
- Role:
  - calculate the current balance based on `snapshot` + list of `movements`
- Characteristics:
  - no side effect
  - deterministic calculation
  - easy to mock in a use case test

## Implementation checklist

- [ ] File in `modules/<domain>/src/**`.
- [ ] No framework dependency (Nest/React/etc.).
- [ ] No I/O (db/http/fs).
- [ ] Clear, cohesive signature.
- [ ] Domain rule isolated and reusable.
- [ ] Test coverage with normal and edge cases.

## Testing strategy

- Test the minimal input.
- Test variations of business scenarios.
- Test limit and empty cases.
- Ensure determinism (same input, same output).

## Common pitfalls

- Putting application logic in the domain service.
- Coupling the domain service to a repository or external provider.
- Duplicating a rule that already exists in an entity/VO.
- Creating a service when an entity method would solve it better.
