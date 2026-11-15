# Mandatory readings

Before adjusting by hand any part of the backend's shared layer, read:

1. `packages/shared/src/base/validation-error.ts` and `packages/shared/src/base/result.ts` — the errors the filter translates.
2. `packages/shared/src/dto/authenticated-user.dto.ts` — the shape of `request.user`.
3. `apps/backend/src/app.module.ts` and `apps/backend/src/main.ts` — what is already registered globally.
4. `apps/backend/src/shared/shared.module.ts` — global guards (`APP_GUARD`), JWT, throttler.

Then, find what the project already has on authentication before creating anything new:

```bash
rg -n -S "jwt|token|claims|CurrentUser|request.user|req.user|passport|AuthGuard|Bearer|@Public" apps/backend/src modules --glob '!**/node_modules/**'
```

Goal: reuse the existing infrastructure, confirm the HTTP statuses the filter returns and ensure that `AuthenticatedUser` (`id`, `name`, `email`, `roles`) covers what the controllers need. A mandatory file is missing: stop, find the equivalent, record the assumption in the report.
