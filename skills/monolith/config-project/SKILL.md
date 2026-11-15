---
name: config-project
user-invocable: false
description: Initialize or continue a project in the TurboRepo pattern with a frontend (Next.js) and a backend (NestJS without its own git), creating/reconciling the base structure via `npx create-turbo@latest` in the current directory when needed and applying an idempotent setup driven by `skills.config.json` (with CLI override). Use when the request involves bootstrapping a web+backend monorepo, the initial Next+Nest setup, safely reapplying the setup without overwriting, or standardizing the `test/build` tasks in Turbo.
---

# Config Project

## Overview

Run a deterministic, idempotent script to bootstrap web+backend in the monorepo pattern.
The flow uses `npx create-turbo@latest` to generate the standard TurboRepo base (including shared configs and `.gitignore`) and reconciles only what is missing in the current folder.
If `.git` already exists in the current directory, the scaffold runs with `--no-git` to avoid recreating the git repository.
It then creates the frontend/backend only when needed, applies the namespace from `skills.config.json` to the packages and updates only the pending files.
The settings live in `skills.config.json` at the project root: the script writes it on the first run and every other skill reads it from there.

## Workflow

1. Read the defaults for `namespace`, `frontendAppPath`, `backendAppPath`, `frontendPort`, `backendPort` and the env vars from `skills.config.json`.
2. Detect gaps in the Turbo structure in the current folder; when needed, run `npx create-turbo@latest` and reconcile only the missing files/folders (`packages/eslint-config`, `packages/typescript-config`, `.gitignore`, `.npmrc`, base configs).
3. Before creating the custom apps, remove the default Turbo projects (`apps/docs`, `apps/frontend` and `packages/ui`) when they are detected as the original template.
4. Create the frontend app with `create-next-app --src-dir` only if `frontendAppPath` does not yet exist as a Next.js app, ensuring the `src/` structure in the frontend.
5. Create the backend app with `nest new --skip-git` only if `backendAppPath` does not yet exist as a NestJS app.
6. Ensure the namespace on every workspace project (`apps/*`, `modules/*` and `packages/*`), including frontend/backend, using `namespace` from the config (or `--scope`).
7. Install only the missing dependencies (`turbo` and `prettier` at the root, `dotenv` in the backend).
8. Update the root `package.json` (`test` = `node scripts/check-boundaries.mjs && turbo run test`), copy `scripts/check-boundaries.mjs` (the monolith's boundaries: pure core, a module depends only on shared, a Next route only imports the module's page), ensure `.prettierrc` at the root and update `turbo.json` incrementally.
9. Adjust the frontend's `next.config.ts|js|mjs` to ensure `images.remotePatterns` allowing remote images over `http` and `https` with `hostname: "**"` and `output: 'standalone'` (what the frontend `Dockerfile` copies). Idempotent.
10. Update the frontend/backend `.env` and `.env.example` via upsert (without deleting existing extra keys); the backend gets `FRONTEND_URL` and a random `JWT_SECRET` in `.env` (placeholder in `.env.example`), generated once and never rewritten.
11. Adjust the backend's `main.ts` incrementally (`dotenv/config`, CORS restricted to `FRONTEND_URL`, port via `backendPortEnvVar`).
11a. Create, if they do not exist yet, the release files for a Docker host: `apps/backend/Dockerfile` and `apps/frontend/Dockerfile` (multi-stage: `turbo prune --docker`, `npm ci`, build; runtime `node:<.nvmrc>-alpine` with the `node` user; the backend one with `HEALTHCHECK` on `/health` and `prisma generate` in the build), `.dockerignore`, `docker-compose.prod.yml` (Postgres with a volume, one-shot `migrate` service = `prisma migrate deploy` on the same image as the backend, `backend` after it, `frontend` after the backend is healthy; images `<folder>-backend` and `<folder>-frontend`), `.env.example` at the root with the compose variables (`POSTGRES_*`, `JWT_SECRET`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `BACKEND_PORT`, `FRONTEND_PORT`, `LOG_LEVEL`) and the `release` script at the root (`docker compose -f docker-compose.prod.yml up -d --build --wait`). The project becomes the owner of these files: the script does not rewrite them.
12. Record the run in `.log/skills.log` with the skill title and a simple list of the relevant commands/actions (no timestamps and no status), ensuring `.log/` is in `.gitignore`.
13. Format every project file with Prettier by running `npm run format` at the monorepo root.

## Commands

Default flow:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs
```

> If the repository is installed in `.claude/skills`, adjust the command paths.

Skip the global Nest CLI install (force `npx`):

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs --skip-global-nest
```

Customize paths and ports:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs \
  --frontend-path apps/frontend \
  --backend-path apps/api \
  --frontend-port 3000 \
  --backend-port 4000
```

Customize the names of the port/url env vars:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs \
  --frontend-api-env-var NEXT_PUBLIC_API_URL \
  --backend-port-env-var PORT
```

Override the namespace via CLI:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-project/scripts/project-init.mjs --scope @namespace
```

## Resources

- `scripts/project-init.mjs`: main bootstrap script.
- `assets/scripts/check-boundaries.mjs`: copied to the project's `scripts/`; `npm test` and CI run it before the suites.
- `assets/scripts/clean-next.mjs`: copied to `scripts/`; the root `prebuild` empties `apps/*/.next` (except `.next/cache`) before `npm run build`, because restoring the turbo cache does not delete anything.
- `references/bootstrap-contract.md`: contract of the files and changes the bootstrap applies.
- Local run log: `.log/skills.log` (not versioned; `.log/` is added to `.gitignore` automatically, without extra metadata).

## Risk Logging Guardrails

- Record execution facts in `.log/skills.log` with a marker at the start of the line.
- Minimum expected markers: `[CMD]`, `[FILE_CREATE]`, `[FILE_UPDATE]`, `[FILE_DELETE]`, `[DIR_CREATE]`, `[RISK]`, `[FAIL]`, `[AI]`.
- Always record `[RISK]` when there is an overwrite, deletion, rename/move, or forced fallback on files/folders.
- Every unexpected failure must produce `[FAIL]` with a short factual description of the event.
- Terminal operations and file changes must go through the shared utilities in `../utils` to keep traceability consistent.

