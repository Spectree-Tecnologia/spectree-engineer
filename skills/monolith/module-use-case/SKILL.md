---
name: module-use-case
user-invocable: false
description: Create, review or guide the implementation of module use cases (application services) in the project's pattern. Use when the request involves "use case", `*.use-case.ts` files, orchestration of entities/repositories/queries, application business rules, failure mapping with `Result`, creating/adjusting use case tests, or the `module-use-case` skill.
---

# Module Use Case

## Overview

Apply the project's use case pattern, focused on orchestrating dependencies, flow validations, consistent returns with `Result` and tests that cover success and failure paths.

## Guidelines

- Read `references/use-case-pattern.md` before creating or changing use cases.
- Implement the `UseCase<IN, OUT>` contract with `execute(data: IN): Promise<Result<OUT>>`.
- Keep the use case as an orchestrator: it validates the flow, calls providers/repos/queries and delegates invariants to entities/VOs.
- Inject dependencies through the constructor with provider/repository/query interfaces.
- Handle failures early (`early return`) with `Result.fail(...)` or `result.withFail`.
- Avoid persistence/infra logic inside the use case.
- For state updates, reapply domain validations with `tryCreate` or `cloneWith`.

## Workflow

1. Define `IN/OUT` and the use case contract.
2. Identify the dependencies needed (repo, query, checker, provider).
3. Implement `execute` with precondition validations and immediate failure returns.
4. Orchestrate entity creation/update via `tryCreate`/`cloneWith` when needed.
5. Persist/query data only through provider interfaces.
6. Cover tests with the happy path, input validations and dependency failures.

## References

See `references/use-case-pattern.md` for paths, checklist, examples and frequent pitfalls in the project.
