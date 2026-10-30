---
name: config-shared-backend
description: Reconstrói deterministicamente a camada compartilhada do backend NestJS em `apps/backend/src/shared/` — autenticação JWT (passport) como guard global, rotas públicas por `@Public()`, `@CurrentUser()`, filtro global de exceções, rate limit, helmet e `ValidationPipe` estrita — compatível com `packages/shared`. Também adiciona `AuthenticatedUser` ao pacote compartilhado.
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
- `AuthenticatedUser` (`id`, `name`, `email`) em `packages/shared/src/dto/`.

Identificadores, arquivos e classes em inglês. Imports relativos com sufixo `.js` (backend é ESM/`nodenext`).

## Uso

Da raiz do monorepo, depois de `config-project` e do `packages/shared` instalado:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-shared-backend/scripts/apply.js
```

`--force` sobrescreve mesmo arquivos sem alteração. O script:

1. Resolve o nome do pacote shared pelo `skills.config.json` (`utils/resolve-skill-config.mjs`).
2. Instala no workspace do backend o que faltar: `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/config`, `@nestjs/throttler`, `passport`, `passport-jwt`, `helmet`, `class-validator`, `class-transformer` (e `@types/passport-jwt` como dev).
3. Remove arquivos legados com nomes em português, se existirem.
4. Copia `packages/shared/src/dto/authenticated-user.dto.ts` e garante os exports em `dto/index.ts` e `src/index.ts`; builda o shared.
5. Copia os 14 arquivos de `apps/backend/src/shared/`.
6. Patcha `app.module.ts` (`SharedModule` em `imports`) e `main.ts` (helmet, `ValidationPipe`, `ApiExceptionFilter`, CORS restrito). Idempotente.

Formatação fica para o `npm run format` da raiz (o `config-shared-frontend` roda no fim do bootstrap).

## Estrutura criada

```text
packages/shared/src/dto/authenticated-user.dto.ts   AuthenticatedUser { id, name, email }

apps/backend/src/shared/
  auth/        jwt.strategy.ts, jwt.guard.ts (respeita @Public), auth-user.mapper.ts
  decorators/  public.decorator.ts (@Public, PUBLIC_ROUTE), current-user.decorator.ts (@CurrentUser)
  errors/      api-exception.filter.ts, api-error-response.type.ts
  types/       jwt-payload.type.ts, authenticated-request.type.ts
  shared.module.ts   @Global: ConfigModule, PassportModule, JwtModule, ThrottlerModule, APP_GUARD × 2
```

`ApiErrorResponse.message` é sempre `string[]`, mesmo com um erro só.

## Guardrails

- Nunca importar de `modules/` dentro de `apps/backend/src/shared/`.
- Nunca acrescentar campos de um módulo específico a `AuthenticatedUser`.
- Nunca dar valor padrão a `JWT_SECRET` nem registrar rota aberta sem `@Public()`.
- Nunca duplicar classes de erro que já existem em `packages/shared`.

## Referências internas

- `assets/` — arquivos canônicos.
- `scripts/apply.js` — aplicação determinística.
- `references/mandatory-readings.md` — o que ler antes de ajustar à mão.
