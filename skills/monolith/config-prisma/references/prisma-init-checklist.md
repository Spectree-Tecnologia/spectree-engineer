# Prisma Init Checklist

## Goal

Standardize the Prisma bootstrap in the NestJS backend with:

- a modular schema in `apps/backend/prisma/models/*.model.prisma`
- a technical seed entrypoint in `apps/backend/prisma/seed/main.ts` (no module seeds)
- a Nest database module in `apps/backend/src/db/*` with a `PrismaService` compatible with `TransactionManager`/`runInTransaction`
- a backend Docker Compose compatible with `DATABASE_URL`

## Prerequisites

- Workspace with `apps/backend/package.json`
- `DATABASE_URL` defined in `apps/backend/.env` (or in `.env.example`)
- Node.js/NPM installed
- Docker/Docker Compose installed

## Step by step

1. Run the simulation.
2. Apply the bootstrap.
3. Install the dependencies.
4. Start Postgres with Docker Compose.
5. Generate the Prisma client.

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-prisma/scripts/init-prisma-backend.js --dry-run
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-prisma/scripts/init-prisma-backend.js --apply --install
npm --workspace apps/backend run db:start
npm --workspace apps/backend run prisma:generate
```

## Scaffolding Prisma modules

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-prisma/scripts/init-prisma-backend.js --apply --module auth --module stock --module billing
```

## Critical files

- `apps/backend/package.json`
- `apps/backend/.env`
- `apps/backend/.env.example`
- `apps/backend/docker-compose.yml`
- `apps/backend/prisma.config.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/seed/main.ts`
- `apps/backend/src/db/db.module.ts`
- `apps/backend/src/db/prisma.service.ts`
- `apps/backend/src/app.module.ts`

## Scope rule of this skill

- Do not include per-module data seeds (`prisma/seed/tasks/*`) at this stage.
- The seed bootstrap must stay neutral until the specific modules are applied.
- `prisma/models/bootstrap.model.prisma` must exist only while there are no domain `*.model.prisma` files yet.
- Do not overwrite a `prisma/seed/main.ts` that is already modern (with `@prisma/client`/`PrismaPg` and module tasks); only fix legacy templates.

## Flags

- `--apply`: applies the changes to disk
- `--dry-run`: simulates the changes
- `--install`: runs `npm install --workspace <workspace-backend>` using the name in `apps/backend/package.json` (fallback `apps/backend`)
- `--start-db`: runs `docker compose up -d postgres` in `apps/backend`
- `--module <name>`: creates a Prisma file per module
- `--prisma-version <semver>`: forces the Prisma version; without this flag, the skill preserves the Prisma version already in the backend (fallback `7.4.2`)

## Post-bootstrap

- Add real models in `prisma/models/*.model.prisma`
- Generate migrations (`prisma migrate dev`)
- Implement per-module seeds and register them in `prisma/seed/main.ts`
- Update the `*.prisma.ts` adapters to map domain/DTO
- Remove `prisma/models/bootstrap.model.prisma` once the real models are in, and generate a replacement migration
- When re-bootstrapping old projects, the script automatically fixes a legacy `prisma/seed/main.ts` when it detects imports of `generated/client`, `generated/prisma` or `cid`.
