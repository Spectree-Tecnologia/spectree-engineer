---
name: config-prisma
description: 'Inicializar e padronizar a infraestrutura do Prisma no backend NestJS do projeto com schema modular por domínio (`apps/backend/prisma/models/*.model.prisma`), entrypoint de seed técnico em `apps/backend/prisma/seed/main.ts` (sem seeds de módulos), configuração de `prisma.config.ts`, Docker Compose do backend compatível com `DATABASE_URL` do `.env`, e criação/ajuste de `DbModule` + `PrismaService` compatível com `TransactionManager`/`runInTransaction`. Usar quando o pedido envolver setup inicial de Prisma, onboarding de módulos com arquivo Prisma próprio ou rebootstrap da infraestrutura de banco no backend.'
---

# Config Prisma

## Overview

Executar setup determinístico da infraestrutura Prisma no `apps/backend`, com seed entrypoint neutro (sem tasks de módulo), módulo de banco no Nest e inicialização do Postgres via Docker Compose alinhada ao `.env`.
O contrato gerado de banco deve ficar compatível com a versão atual do projeto: `PrismaService` implementando `TransactionManager` e expondo `runInTransaction` para casos de uso transacionais (ex.: auth).

## Workflow

1. Confirmar que o workspace contém `apps/backend/package.json`.
2. Executar o script da skill:
   - `node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-prisma/scripts/init-prisma-backend.js --dry-run`
   - `node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-prisma/scripts/init-prisma-backend.js --apply --install`
   - `npm --workspace apps/backend run prisma:generate` (obrigatório antes de qualquer `npm run build`)
3. Incluir arquivos Prisma por módulo (repetível):
   - `node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-prisma/scripts/init-prisma-backend.js --apply --module auth --module product`
4. Subir banco com Docker Compose do backend:
   - `npm --workspace apps/backend run db:start`
5. Validar Prisma:
   - `npm --workspace apps/backend run prisma:generate`
6. Rodar ciclo completo de banco (desenvolvimento local):
   - `npx prisma migrate reset`
   - `npx prisma migrate dev`
   - `npm run db:roles` (cria/atualiza `app_runtime`; repetir depois de toda migration)
   - `npx prisma generate`
   - `npx prisma db seed`

## O que o script garante

- Dependências Prisma no `apps/backend/package.json` (`prisma`, `@prisma/client`, `@prisma/adapter-pg`, `tsx`) com preservação da versão já existente quando o backend já está configurado (sem upgrade forçado por padrão).
- Scripts npm de banco/Prisma (`db:start`, `db:stop`, `db:logs`, `prisma:generate`, `prisma:migrate:*`, `prisma:seed`, `prisma:studio`).
- Script de desenvolvimento na raiz preparado para subir o banco automaticamente antes do Turbo (`npm run dev` -> `db:start` + `turbo run dev`).
- Remoção de script legado `prisma:cid` quando presente.
- Dois papéis de banco: `MIGRATION_DATABASE_URL` (owner: migrate, seed, `db:roles`) e `DATABASE_URL` (`app_runtime`, que não é dono de nada — lê e escreve linhas, nunca `ALTER`/`DROP`/`DISABLE TRIGGER`). `apps/backend/db/roles.sql` (idempotente, escrito uma vez; a lista de tabelas append-only vive nele) + `db/roles.mjs` (`npm run db:roles`, roda como owner com `APP_DB_PASSWORD`). O `PrismaService` recusa subir em produção se o papel conectado for dono de tabela.
- `apps/backend/prisma.config.ts` com `seed: 'npx tsx prisma/seed/main.ts'` e `url` = `MIGRATION_DATABASE_URL` (fallback `DATABASE_URL`).
- `apps/backend/prisma/schema.prisma` com `generator client { provider = "prisma-client-js" }` no padrão atual.
- `apps/backend/prisma/seed/main.ts` inicial (sem implementação de módulos) usando `PrismaClient` de `@prisma/client` com `PrismaPg`.
- Autocorreção apenas para templates legados de seed (`generated/client`, `generated/prisma`, `cid`) sem sobrescrever seeds modernos já estruturados com tasks de módulo.
- Não cria nem altera `prisma/seed/tasks/*` de módulos específicos.
- `apps/backend/prisma/models/bootstrap.model.prisma` temporário apenas quando ainda não existe nenhum `*.model.prisma` de domínio.
- Arquivos de módulos Prisma no padrão `<module-name>.model.prisma`.
- `apps/backend/docker-compose.yml` alinhado ao `DATABASE_URL` carregado de `apps/backend/.env` (fallback para `.env.example`).
- Criação/ajuste de `apps/backend/src/db/db.module.ts` e `apps/backend/src/db/prisma.service.ts`.
- `apps/backend/test/query-budget.ts`: `expectQueryBudget(prisma.client, K, fn)` falha o teste quando o Prisma emite mais de K queries durante `fn` (o `PrismaService` nasce com `log: [{ level: 'query', emit: 'event' }]`). É o orçamento de queries por caso de uso da regra 11 de `docs/architecture.md`; o e2e gerado pelo `config-new-module` já o usa na listagem.
- `PrismaService` com contrato transacional atual:
  - implementa `TransactionManager<PrismaTransactionContext>`
  - expõe `runInTransaction`
  - define `PrismaTransactionContext` com `client: Prisma.TransactionClient`.
- Inclusão de `DbModule` em `apps/backend/src/app.module.ts` quando ausente.

## Notes

- O script é idempotente: pode ser executado várias vezes sem duplicar estrutura.
- O script instala usando o nome real do workspace lido de `apps/backend/package.json` (fallback: `apps/backend`).
- Após criar modelos reais, remover `prisma/models/bootstrap.model.prisma` (se existir) e gerar nova migration.
- Para ambientes locais de desenvolvimento, após ajustes no schema, executar o fluxo completo:
  - `npx prisma migrate reset && npx prisma migrate dev && npx prisma generate && npx prisma db seed`
- Em backends já evoluídos, o script evita regressão de `seed/main.ts` para template neutro quando o arquivo já estiver no padrão moderno com tasks registradas.
- Consultar `references/prisma-init-checklist.md` para checklist operacional.

## Risk Logging Guardrails

- Registrar fatos de execucao em `.log/skills.log` com marcador no inicio da linha.
- Marcadores minimos esperados: `[CMD]`, `[FILE_CREATE]`, `[FILE_UPDATE]`, `[FILE_DELETE]`, `[DIR_CREATE]`, `[RISK]`, `[FAIL]`, `[AI]`.
- Sempre registrar `[RISK]` quando houver sobrescrita, exclusao, rename/move, ou fallback forcado em arquivos/pastas.
- Toda falha inesperada deve gerar `[FAIL]` com descricao factual curta do evento.
- Operacoes de terminal e alteracoes de arquivos devem passar pelos utilitarios compartilhados em `../utils` para manter rastreabilidade consistente.

