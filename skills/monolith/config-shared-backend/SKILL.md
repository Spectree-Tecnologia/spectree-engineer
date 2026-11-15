---
name: config-shared-backend
user-invocable: false
description: Deterministically rebuilds the NestJS backend's shared layer in `apps/backend/src/shared/` — JWT authentication (passport) as a global guard, public routes via `@Public()`, `@CurrentUser()`, a global exception filter, rate limiting, helmet, a strict `ValidationPipe`, JSON logging (pino) with `requestId`/`userId`, `.env` validation at boot (zod), `GET /health` and `GET /ready`, graceful shutdown — compatible with `packages/shared`. Also adds `AuthenticatedUser` to the shared package.
---

# Backend shared layer

## Goal

Rebuild `apps/backend/src/shared/` from this skill's assets, leaving the backend **closed by default**:

- `JwtGuard` registered as `APP_GUARD`: every route requires a valid Bearer token, except those marked with `@Public()`.
- `ThrottlerGuard` as `APP_GUARD` with a global limit (100 req/min per client).
- `JWT_SECRET` with no default value (`ConfigService.getOrThrow`): the app does not start without it.
- Global `ApiExceptionFilter`: `ValidationError` → the exception's own status (default 400), `HttpException` → status preserved, everything else → a generic 500 for the client and the full cause in the log.
- `helmet()` and `ValidationPipe({ whitelist, forbidNonWhitelisted })` in `main.ts`; CORS restricted to `FRONTEND_URL` (without the variable, CORS is closed).
- `@CurrentUser()` / `@CurrentUser('id')` to read the user from the token; `userId` never comes from the body.
- `AuthenticatedUser` (`id`, `name`, `email`, `roles`) in `packages/shared/src/dto/`; `@Roles('admin')` closes the route to those claims on top of the JWT (403 `FORBIDDEN_ROLE`).

And **operable in production**:

- JSON logging via `nestjs-pino`: one line per request with `requestId` (the received `x-request-id` header or a UUID, returned in the response), `userId` set by `JwtGuard` when there is a token, `authorization`/`cookie` redacted, `/health` and `/ready` excluded from auto-logging; level via `LOG_LEVEL` (default `info`). Nest's `Logger` now outputs JSON (`app.useLogger`).
- The whole `.env` validated at boot by `config/env.schema.ts` (zod) via `ConfigModule.forRoot({ validate })`: `PORT` (number, default from the config), `DATABASE_URL` (`postgresql://`), `JWT_SECRET` (32+ characters), `FRONTEND_URL` (optional), `LOG_LEVEL` (enum). A missing or invalid variable brings the app down with `Invalid environment:` and the list of problems.
- `GET /health` (process alive) and `GET /ready` (`SELECT 1` on `PrismaService`; 503 if the database does not respond), both `@Public()` and `@SkipThrottle()`.
- `app.enableShutdownHooks()` in `main.ts`: SIGTERM closes connections (Prisma `onModuleDestroy`) before exiting.

Identifiers, files and classes in English. Relative imports with the `.js` suffix (the backend is ESM/`nodenext`).

## Usage

From the monorepo root, after `config-project` and with `packages/shared` installed. Runs **after** `config-prisma`: `shared.module.ts` imports `DbModule` and `health.controller.ts` imports `PrismaService`, which only exist after it; in the reverse order the step never ends with a green build.

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-shared-backend/scripts/apply.js
```

`--force` overwrites even unchanged files. The script:

1. Resolves the shared package name from `skills.config.json` (`utils/resolve-skill-config.mjs`).
2. Installs in the backend workspace whatever is missing: `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/config`, `@nestjs/throttler`, `passport`, `passport-jwt`, `helmet`, `class-validator`, `class-transformer`, `nestjs-pino`, `pino-http`, `pino`, `zod` (and `@types/passport-jwt` as dev).
3. Removes legacy files with Portuguese names, if they exist.
4. Copies `packages/shared/src/dto/authenticated-user.dto.ts` and ensures the exports in `dto/index.ts` and `src/index.ts`; builds shared.
5. Copies the 16 files of `apps/backend/src/shared/`, replacing `{{SHARED_PACKAGE}}`, `{{BACKEND_PORT_ENV_VAR}}` and `{{BACKEND_PORT}}` with the values from `skills.config.json`.
6. Patches `app.module.ts` (`SharedModule` in `imports`) and `main.ts` (`bufferLogs`, `app.useLogger(app.get(Logger))`, helmet, `ValidationPipe`, `ApiExceptionFilter`, `enableShutdownHooks`, restricted CORS). Idempotent.

Formatting is left to the root `npm run format` (`config-shared-frontend` runs it at the end of the bootstrap).

## Structure created

```text
packages/shared/src/dto/authenticated-user.dto.ts   AuthenticatedUser { id, name, email }

apps/backend/src/shared/
  auth/        jwt.strategy.ts, jwt.guard.ts (respects @Public), auth-user.mapper.ts
  decorators/  public.decorator.ts (@Public, PUBLIC_ROUTE), current-user.decorator.ts (@CurrentUser)
  errors/      api-exception.filter.ts, api-error-response.type.ts
  types/       jwt-payload.type.ts, authenticated-request.type.ts
  config/      env.schema.ts (zod: envSchema, validateEnv)
  health/      health.controller.ts (GET /health, GET /ready)
  shared.module.ts   @Global: ConfigModule (validate), LoggerModule (pino), DbModule, PassportModule, JwtModule, ThrottlerModule, HealthController, APP_GUARD × 2
```

`ApiErrorResponse.message` is always `string[]`, even with a single error.

## Operations CLI

An operator command (tenant onboarding, rename, backfill) does not boot `AppModule` — it would bring guards, listeners and senders that refuse to boot without real credentials — and does not run through `tsx`, which does not emit decorator metadata and breaks Nest's DI. The pattern is `src/cli/run-cli.ts` (`runCli`): a Nest context with only the modules the command uses, `.env` validated by the same `envSchema` but restricted to the keys it reads, exit code 0/1/2. It compiles together with the app and runs from `dist`:

```ts
// apps/backend/src/cli/onboard.ts
import { DbModule } from '../db/db.module.js';
import { PrismaService } from '../db/prisma.service.js';
import { runCli } from './run-cli.js';

await runCli({
  name: 'onboard',
  modules: [DbModule],
  env: ['DATABASE_URL'],
  run: async (context, [name]) => {
    if (!name) throw new Error('usage: onboard <name>');
    await context.get(PrismaService).client.$queryRaw`SELECT 1`;
  },
});
```

```bash
npm run build && node apps/backend/dist/cli/onboard.js <name>
```

The command's e2e does `spawnSync('node', ['dist/cli/onboard.js', ...])` with `NODE_ENV=production` and checks the exit code.

## Guardrails

- Never import from `modules/` inside `apps/backend/src/shared/`.
- Never add a specific module's fields to `AuthenticatedUser`.
- Never give `JWT_SECRET` a default value nor register an open route without `@Public()`.
- A new environment variable goes into `config/env.schema.ts`; a loose `process.env.X` outside the schema is a 500 waiting to happen.
- Never log a token, cookie or body: `redact` covers the headers, the rest is the discipline of whoever logs.
- Never duplicate error classes that already exist in `packages/shared`.

## Internal references

- `assets/` — canonical files.
- `scripts/apply.js` — deterministic application.
- `references/mandatory-readings.md` — what to read before adjusting by hand.
