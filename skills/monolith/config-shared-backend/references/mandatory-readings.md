# Leituras obrigatórias

Antes de ajustar à mão qualquer parte da camada compartilhada do backend, leia:

1. `packages/shared/src/base/validation-error.ts` e `packages/shared/src/base/result.ts` — os erros que o filtro traduz.
2. `packages/shared/src/dto/authenticated-user.dto.ts` — o shape de `request.user`.
3. `apps/backend/src/app.module.ts` e `apps/backend/src/main.ts` — o que já está registrado globalmente.
4. `apps/backend/src/shared/shared.module.ts` — guards globais (`APP_GUARD`), JWT, throttler.

Depois, localize o que o projeto já tem sobre autenticação antes de criar qualquer coisa nova:

```bash
rg -n -S "jwt|token|claims|CurrentUser|request.user|req.user|passport|AuthGuard|Bearer|@Public" apps/backend/src modules --glob '!**/node_modules/**'
```

Objetivo: reaproveitar a infraestrutura existente, confirmar os status HTTP que o filtro devolve e garantir que `AuthenticatedUser` (`id`, `name`, `email`, `roles`) cobre o que os controllers precisam. Arquivo obrigatório ausente: pare, encontre o equivalente, registre a suposição no relato.
