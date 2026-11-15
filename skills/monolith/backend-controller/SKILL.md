---
name: backend-controller
user-invocable: false
description: 'Create, review or guide the NestJS backend''s HTTP controllers in the project''s pattern. Use when the request involves `*.controller.ts` files, defining routes and HTTP verbs, applying guards/permissions, binding `@Body/@Param/@Query`, orchestrating use cases and mapping failures to HTTP exceptions (`BadRequestException`, `NotFoundException`, etc.).'
---

# Backend Controller

## Overview

Apply the controller pattern as the HTTP entry layer: receive the request, validate basic parameters, call the use case and translate the `Result` into an HTTP response/exception.

## Guidelines

- The controller does not implement domain rules; it delegates to the use case/query/repository according to the existing flow.
- Define the route and verb with decorators (`@Get`, `@Post`, `@Patch`, `@Delete`).
- Every route is born protected by the global `JwtGuard` (the `SharedModule`'s `APP_GUARD`); opening a route is `@Public()`, and the user comes from `@CurrentUser()` / `@CurrentUser('id')` — never from the body.
- Extract input with `@Body`, `@Param`, `@Query`; normalize types when needed (e.g. `Number(...)`, boolean from string).
- Map `Result` failures to the appropriate HTTP exception.
- Return the payload expected by the contract; for operations without a body, return `void` with `@HttpCode(204|201)` when applicable.
- Follow the global naming: `*.controller.ts` files, kebab-case folders and lowercase names.

## Workflow

1. Define the base route (`@Controller('...')`); mark with `@Public()` only what is really open.
2. Create one method per endpoint with HTTP decorators.
3. Instantiate/call the use case with the dependencies injected into the controller.
4. Handle `result.isFailure` and throw a consistent HTTP exception.
5. Return `result.instance` or `void` according to the contract.
6. Review the consistency of status codes and error format.

## References

See `references/controller-pattern.md` for real examples, a checklist and pitfalls.


