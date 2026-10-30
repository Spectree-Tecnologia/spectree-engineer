---
name: config-shared-backend
description: Reconstrói deterministicamente a camada compartilhada do backend NestJS em `apps/backend/src/shared/` — autenticação JWT (passport) como guard global, rotas públicas por `@Public()`, `@CurrentUser()`, filtro global de exceções, rate limit, helmet, `ValidationPipe` estrita, log JSON (pino) com `requestId`/`userId`, validação do `.env` no boot (zod), `GET /health` e `GET /ready`, graceful shutdown — compatível com `packages/shared`. Também adiciona `AuthenticatedUser` ao pacote compartilhado.
---

# Backend shared layer

## Objetivo

Reconstruir `apps/backend/src/shared/` a partir dos assets desta skill, deixando o backend **fechado por padrão**:

- `JwtGuard` registrado como `APP_GUARD`: toda rota exige Bearer token válido, salvo as marcadas com `@Public()`.
- `ThrottlerGuard` como `APP_GUARD` com limite global (100 req/min por cliente).
- `JWT_SECRET` sem valor padrão (`ConfigService.getOrThrow`): o app não sobe sem ele.
- `ApiExceptionFilter` global: `ValidationError` → status da própria exceção (default 400), `HttpException` → status preservado, resto → 500 genérico para o cliente e causa completa no log.
- `helmet()` e `ValidationPipe({ whitelist, forbidNonWhitelisted })` em `main.ts`; CORS restrito a `FRONTEND_URL` (sem a variável, CORS fechado).
- `@CurrentUser()` / `@CurrentUser('id')` para ler o usuário do token; `userId` nunca vem do body.
- `AuthenticatedUser` (`id`, `name`, `email`, `roles`) em `packages/shared/src/dto/`; `@Roles('admin')` fecha a rota a essas claims por cima do JWT (403 `FORBIDDEN_ROLE`).

E **operável em produção**:

- Log JSON por `nestjs-pino`: uma linha por requisição com `requestId` (header `x-request-id` recebido ou UUID, devolvido no response), `userId` assinado pelo `JwtGuard` quando há token, `authorization`/`cookie` redigidos, `/health` e `/ready` fora do auto-log; nível por `LOG_LEVEL` (default `info`). `Logger` do Nest passa a sair em JSON (`app.useLogger`).
- `.env` inteiro validado no boot por `config/env.schema.ts` (zod) via `ConfigModule.forRoot({ validate })`: `PORT` (número, default da config), `DATABASE_URL` (`postgresql://`), `JWT_SECRET` (32+ caracteres), `FRONTEND_URL` (opcional), `LOG_LEVEL` (enum). Variável faltando ou inválida derruba o app com `Invalid environment:` e a lista de problemas.
- `GET /health` (processo vivo) e `GET /ready` (`SELECT 1` no `PrismaService`; 503 se o banco não responde), ambas `@Public()` e `@SkipThrottle()`.
- `app.enableShutdownHooks()` em `main.ts`: SIGTERM fecha conexões (Prisma `onModuleDestroy`) antes de sair.

Identificadores, arquivos e classes em inglês. Imports relativos com sufixo `.js` (backend é ESM/`nodenext`).

## Uso

Da raiz do monorepo, depois de `config-project` e do `packages/shared` instalado. O backend só compila depois de `config-prisma`: `shared.module.ts` importa `DbModule` e `/ready` usa o `PrismaService` que ela gera.

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-shared-backend/scripts/apply.js
```

`--force` sobrescreve mesmo arquivos sem alteração. O script:

1. Resolve o nome do pacote shared pelo `skills.config.json` (`utils/resolve-skill-config.mjs`).
2. Instala no workspace do backend o que faltar: `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/config`, `@nestjs/throttler`, `passport`, `passport-jwt`, `helmet`, `class-validator`, `class-transformer`, `nestjs-pino`, `pino-http`, `pino`, `zod` (e `@types/passport-jwt` como dev).
3. Remove arquivos legados com nomes em português, se existirem.
4. Copia `packages/shared/src/dto/authenticated-user.dto.ts` e garante os exports em `dto/index.ts` e `src/index.ts`; builda o shared.
5. Copia os 16 arquivos de `apps/backend/src/shared/`, trocando `{{SHARED_PACKAGE}}`, `{{BACKEND_PORT_ENV_VAR}}` e `{{BACKEND_PORT}}` pelos valores do `skills.config.json`.
6. Patcha `app.module.ts` (`SharedModule` em `imports`) e `main.ts` (`bufferLogs`, `app.useLogger(app.get(Logger))`, helmet, `ValidationPipe`, `ApiExceptionFilter`, `enableShutdownHooks`, CORS restrito). Idempotente.

Formatação fica para o `npm run format` da raiz (o `config-shared-frontend` roda no fim do bootstrap).

## Estrutura criada

```text
packages/shared/src/dto/authenticated-user.dto.ts   AuthenticatedUser { id, name, email }

apps/backend/src/shared/
  auth/        jwt.strategy.ts, jwt.guard.ts (respeita @Public), auth-user.mapper.ts
  decorators/  public.decorator.ts (@Public, PUBLIC_ROUTE), current-user.decorator.ts (@CurrentUser)
  errors/      api-exception.filter.ts, api-error-response.type.ts
  types/       jwt-payload.type.ts, authenticated-request.type.ts
  config/      env.schema.ts (zod: envSchema, validateEnv)
  health/      health.controller.ts (GET /health, GET /ready)
  shared.module.ts   @Global: ConfigModule (validate), LoggerModule (pino), DbModule, PassportModule, JwtModule, ThrottlerModule, HealthController, APP_GUARD × 2
```

`ApiErrorResponse.message` é sempre `string[]`, mesmo com um erro só.

## Guardrails

- Nunca importar de `modules/` dentro de `apps/backend/src/shared/`.
- Nunca acrescentar campos de um módulo específico a `AuthenticatedUser`.
- Nunca dar valor padrão a `JWT_SECRET` nem registrar rota aberta sem `@Public()`.
- Variável de ambiente nova entra em `config/env.schema.ts`; `process.env.X` solto fora do schema é um 500 esperando acontecer.
- Nunca logar token, cookie ou body: o `redact` cobre os headers, o resto é disciplina de quem loga.
- Nunca duplicar classes de erro que já existem em `packages/shared`.

## Referências internas

- `assets/` — arquivos canônicos.
- `scripts/apply.js` — aplicação determinística.
- `references/mandatory-readings.md` — o que ler antes de ajustar à mão.
