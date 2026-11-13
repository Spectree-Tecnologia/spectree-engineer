---
name: config-project
user-invocable: false
description: Inicializar ou continuar um projeto no padrão TurboRepo com frontend (Next.js) e backend (NestJS sem git interno), criando/reconciliando a estrutura base via `npx create-turbo@latest` no diretório atual quando necessário e aplicando setup idempotente por `skills.config.json` (com override via CLI). Usar quando o pedido envolver bootstrap de monorepo web+backend, setup inicial Next+Nest, reaplicação segura do setup sem sobrescrever, ou padronização das tasks de `test/build` no Turbo.
---

# Config Project

## Overview

Executar um script determinístico e idempotente para bootstrap web+backend no padrão do monorepo.
O fluxo usa `npx create-turbo@latest` para gerar a base padrão do TurboRepo (incluindo configs compartilhadas e `.gitignore`) e reconcilia apenas o que estiver faltando na pasta atual.
Se `.git` já existir no diretório atual, o scaffold é executado com `--no-git` para evitar recriação de repositório git.
Depois cria frontend/backend apenas quando necessário, aplica namespace do `skills.config.json` nos pacotes e atualiza somente os arquivos pendentes.
As configurações ficam em `skills.config.json` na raiz do projeto: o script o escreve na primeira execução e todas as outras skills o leem de lá.

## Workflow

1. Ler defaults de `namespace`, `frontendAppPath`, `backendAppPath`, `frontendPort`, `backendPort` e env vars no `skills.config.json`.
2. Detectar gaps da estrutura Turbo na pasta atual; quando necessário, executar `npx create-turbo@latest` e reconciliar somente os arquivos/pastas ausentes (`packages/eslint-config`, `packages/typescript-config`, `.gitignore`, `.npmrc`, configs base).
3. Antes de criar apps customizados, remover os projetos padrão do Turbo (`apps/docs`, `apps/frontend` e `packages/ui`) quando detectados como template original.
4. Criar app frontend com `create-next-app --src-dir` somente se `frontendAppPath` ainda não existir como app Next.js, garantindo estrutura `src/` no frontend.
5. Criar app backend com `nest new --skip-git` somente se `backendAppPath` ainda não existir como app NestJS.
6. Garantir namespace em todos os projetos do workspace (`apps/*`, `modules/*` e `packages/*`), incluindo frontend/backend, usando `namespace` do config (ou `--scope`).
7. Instalar apenas dependências faltantes (`turbo` e `prettier` no root, `dotenv` no backend).
8. Atualizar `package.json` root (`test` = `node scripts/check-boundaries.mjs && turbo run test`), copiar `scripts/check-boundaries.mjs` (fronteiras do monólito: core puro, módulo depende só do shared, rota do Next só importa a página do módulo), garantir `.prettierrc` no root e atualizar `turbo.json` de forma incremental.
9. Ajustar `next.config.ts|js|mjs` do frontend para garantir `images.remotePatterns` liberando imagens remotas em `http` e `https` com `hostname: "**"` e `output: 'standalone'` (o que o `Dockerfile` do frontend copia). Idempotente.
10. Atualizar `.env` e `.env.example` de frontend/backend via upsert (sem apagar chaves extras existentes); o backend ganha `FRONTEND_URL` e um `JWT_SECRET` aleatório no `.env` (placeholder no `.env.example`), gerado uma vez e nunca reescrito.
11. Ajustar `main.ts` do backend de forma incremental (`dotenv/config`, CORS restrito a `FRONTEND_URL`, porta via `backendPortEnvVar`).
11a. Criar, se ainda não existirem, os arquivos de release para um host Docker: `apps/backend/Dockerfile` e `apps/frontend/Dockerfile` (multi-stage: `turbo prune --docker`, `npm ci`, build; runtime `node:<.nvmrc>-alpine` com usuário `node`; o do backend com `HEALTHCHECK` em `/health` e `prisma generate` no build), `.dockerignore`, `docker-compose.prod.yml` (Postgres com volume, serviço one-shot `migrate` = `prisma migrate deploy` na mesma imagem do backend, `backend` depois dele, `frontend` depois do backend healthy; imagens `<pasta>-backend` e `<pasta>-frontend`), `.env.example` na raiz com as variáveis do compose (`POSTGRES_*`, `JWT_SECRET`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `BACKEND_PORT`, `FRONTEND_PORT`, `LOG_LEVEL`) e o script `release` no root (`docker compose -f docker-compose.prod.yml up -d --build --wait`). O projeto passa a ser dono desses arquivos: o script não os reescreve.
12. Registrar execução em `.log/skills.log` com título da skill e lista simples dos comandos/ações relevantes (sem timestamps e sem status), garantindo `.log/` no `.gitignore`.
13. Formatar todos os arquivos do projeto com Prettier executando `npm run format` na raiz do monorepo.

## Commands

Fluxo padrão:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs
```

> Se o repositório estiver instalado em `.claude/skills`, ajuste o caminho dos comandos.

Pular instalação global do Nest CLI (forçar `npx`):

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs --skip-global-nest
```

Customizar paths e portas:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs \
  --frontend-path apps/frontend \
  --backend-path apps/api \
  --frontend-port 3000 \
  --backend-port 4000
```

Customizar nomes das env vars de porta/url:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs \
  --frontend-api-env-var NEXT_PUBLIC_API_URL \
  --backend-port-env-var PORT
```

Sobrescrever namespace por CLI:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs --scope @namespace
```

## Resources

- `scripts/project-init.mjs`: script principal de bootstrap.
- `assets/scripts/check-boundaries.mjs`: copiado para `scripts/` do projeto; `npm test` e o CI o rodam antes das suítes.
- `assets/scripts/clean-next.mjs`: copiado para `scripts/`; o `prebuild` da raiz esvazia `apps/*/.next` (menos `.next/cache`) antes do `npm run build`, porque o restore do cache do turbo não apaga nada.
- `references/bootstrap-contract.md`: contrato dos arquivos e alterações que o bootstrap aplica.
- Log local de execução: `.log/skills.log` (não versionado; `.log/` é adicionado ao `.gitignore` automaticamente, sem metadados extras).

## Risk Logging Guardrails

- Registrar fatos de execucao em `.log/skills.log` com marcador no inicio da linha.
- Marcadores minimos esperados: `[CMD]`, `[FILE_CREATE]`, `[FILE_UPDATE]`, `[FILE_DELETE]`, `[DIR_CREATE]`, `[RISK]`, `[FAIL]`, `[AI]`.
- Sempre registrar `[RISK]` quando houver sobrescrita, exclusao, rename/move, ou fallback forcado em arquivos/pastas.
- Toda falha inesperada deve gerar `[FAIL]` com descricao factual curta do evento.
- Operacoes de terminal e alteracoes de arquivos devem passar pelos utilitarios compartilhados em `../utils` para manter rastreabilidade consistente.


