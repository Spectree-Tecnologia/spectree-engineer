# TurboRepo Web+Backend Bootstrap Contract

## Goal

Standardize the bootstrap of a TurboRepo monorepo for:

- `<frontendAppPath>` (Next.js)
- `<backendAppPath>` (NestJS without its own git)

With defaults taken from `skills.config.json`:

- `namespace` (default: `@namespace`)
- `frontendAppPath` (default: `apps/frontend`)
- `backendAppPath` (default: `apps/backend`)
- `frontendPort` (default: `3000`)
- `backendPort` (default: `4000`)
- `frontendApiUrlEnvVar` (default: `NEXT_PUBLIC_API_URL`)
- `backendPortEnvVar` (default: `PORT`)

## Steps Applied

1. Detect a missing/incomplete Turbo structure in the current folder and, when needed, run `npx create-turbo@latest` to generate the official template.
2. Reconcile into the current repository only the missing files/folders from the Turbo template (without overwriting files that already exist), including:
   - `.gitignore`
   - `.npmrc`
   - `packages/eslint-config`
   - `packages/typescript-config`
   - any other missing standard structure
   - if `.git` already exists at the root, run the scaffold with `--no-git` to avoid recreating the git repository
3. Before creating the custom apps, remove the default Turbo projects (`apps/docs`, `apps/frontend` and `packages/ui`) when they are detected as the original template.
4. Create `<frontendAppPath>` with `npx create-next-app@latest <frontendName> --yes --use-npm --src-dir` only if the Next.js app does not exist yet.
5. Create `<backendAppPath>` with `nest new <backendName> --skip-git --package-manager npm` (or fallback via `npx @nestjs/cli@latest`) only if the NestJS app does not exist yet.
6. Ensure the `name` of every workspace project (`apps/*` and `modules/*`) carries the namespace:
   - frontend: `<namespace>/<frontendName>`
   - backend: `<namespace>/<backendName>`
7. Install only the missing dependencies:
   - root: `turbo` (dev dependency)
   - root: `prettier` (dev dependency)
   - backend: `dotenv`
8. Update the root `package.json`:
   - `name` filled in (default: `<namespace>/workspace`)
   - `scripts.test = "node scripts/check-boundaries.mjs && turbo run test"` and `scripts/check-boundaries.mjs` copied from the skill's assets
   - `scripts.format = "prettier --write \"**/*.{ts,tsx,md}\""` when missing
   - `private = true`
   - `workspaces` containing `apps/*` and `modules/*`
   - `devDependencies.turbo` present
   - `devDependencies.prettier` present
9. Ensure `.prettierrc` at the root with the workspace's default formatting configuration.
10. Update `turbo.json`:

- `tasks.test.cache = false`
- `tasks.build.outputs` containing `dist/**`
- `tasks.build.outputs` containing `!.next/cache/**` when it contains `.next/**`, and `prebuild: node scripts/clean-next.mjs` in the root `package.json`

11. Update `<frontendAppPath>/next.config.ts|js|mjs` incrementally to ensure:

- `images.remotePatterns` containing rules for `https` and `http` with `hostname: "**"` (allowing remote images).

12. Update the env files via upsert (preserving extra keys):

- `<frontendAppPath>/.env` and `.env.example` with:
  - `<frontendApiUrlEnvVar>=http://localhost:<backendPort>`
  - `PORT=<frontendPort>`
- `<backendAppPath>/.env` and `.env.example` with:
  - `<backendPortEnvVar>=<backendPort>`
  - `FRONTEND_URL=http://localhost:<frontendPort>`
  - `DATABASE_URL`
  - `JWT_SECRET` (placeholder in `.env.example`; random value in `.env`, generated once)

13. Update `<backendAppPath>/src/main.ts` incrementally with:

- `app.enableCors({ origin: FRONTEND_URL })` — without the variable, CORS is closed
- reading `process.env.<backendPortEnvVar>` (default `<backendPort>`)
- `import "dotenv/config"`

14. Create, only when missing, the release files: `<backendAppPath>/Dockerfile`, `<frontendAppPath>/Dockerfile`, `.dockerignore`, `docker-compose.prod.yml` (postgres, migrate, backend, frontend), `.env.example` at the root, and `scripts.release` in the root `package.json`. `next.config` gets `output: 'standalone'`.

## Notes

- The script is idempotent: when run again, it skips the steps already satisfied.
- The script only removes existing directories automatically when it detects they are the original default Turbo projects (`apps/docs`, `apps/frontend` and `packages/ui`).
- If a frontend/backend directory already exists but does not match the expected type (Next/Nest), the process fails to avoid an accidental overwrite.
