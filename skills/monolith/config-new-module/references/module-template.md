# Module Template Contract

## Goal

Generate a new module deterministically in three areas of the monorepo:

- domain package: `modules/<module-name>`
- backend: `<backendAppPath>/src/modules/<module-name>` + `<backendAppPath>/prisma/models/<module-name>.model.prisma`
- frontend: `<frontendAppPath>/src/modules/<module-name>` + route in `<frontendAppPath>/src/app/(private)/<module-name>` when `(private)` exists

## Required Files

### Package

- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/index.ts`
- `test/index.test.ts`

### Backend

- `<module-name>.controller.ts`
- `<module-name>.prisma.ts`
- `<module-name>.module.ts`
- `index.ts` (re-export of the module)
- Registration of `<ModuleName>Module` in `<backendAppPath>/src/app.module.ts`
- `<backendAppPath>/prisma/models/<module-name>.model.prisma`
- Dependency `<scope>/<module-name>` in `<backendAppPath>/package.json`

### Frontend

- `<frontendAppPath>/src/modules/<module-name>/components/<module-name>-dashboard.component.tsx`
- `<frontendAppPath>/src/modules/<module-name>/data/index.ts`
- `<frontendAppPath>/src/modules/<module-name>/pages/dashboard.page.tsx`
- `<frontendAppPath>/src/modules/<module-name>/index.ts`
- `<frontendAppPath>/src/app/(private)/<module-name>/page.tsx` when `(private)` exists (only `page.tsx`; no per-module `layout.tsx`)
- update to the `(private)` group's layout (`<frontendAppPath>/src/app/(private)/layout.tsx`) adding the new module's item to `NAVIGATION_SECTIONS` (label/href/icon/match) and ensuring the `lucide-react` icon import
- Dependency `<scope>/<module-name>` in `<frontendAppPath>/package.json`

> The expected architecture uses `src/modules` and `src/app` inside `apps/frontend`.

## Package Rules

- Package name: `<scope>/<module-name>`.
- Mandatory dependency on `<scope>/<basename(sharedModulePath)>`.
- The new module's dependency must also be added to the backend and frontend:
  - `<backendAppPath>/package.json` -> `<scope>/<module-name>: "*"`
  - `<frontendAppPath>/package.json` -> `<scope>/<module-name>: "*"`
- The actual name of the shared module is derived from `basename(sharedModulePath)`.
- Namespace by precedence:
  - `--scope`
  - `PROJECT_NAMESPACE` or `SKILLS_NAMESPACE`
  - `skills.config.local.json` (project root, gitignored)
  - `skills.config.json` (project root)
  - fallback from `packages/shared/package.json`
- Default scripts:
  - `dev: tsc --watch`
  - `build: tsc`
  - `test: vitest run`
  - `test:watch: vitest`
  - `test:cov: vitest run --coverage`

## Source Rules

- ESM package (`"type": "module"`, `nodenext`): relative imports with the `.js` suffix.
- `src/index.ts` must export a minimal module API (`getModuleName`).
- `test/index.test.ts` must validate that minimal API.

## Backend Rules

- The `controller` must expose a sample `GET /<module-name>` endpoint.
- `<module-name>.prisma.ts` must encapsulate access to `PrismaService`.
- The `module` must declare the controller in the `@Module` decorator.
- The `module` must import `DbModule` and register/export the module's Prisma provider.
- `<module-name>.model.prisma` must exist as a placeholder for the module's models.
- The new module must be imported and added to the `imports` array of `AppModule`.

## Frontend Rules

- The project uses a **single shell** (`AdminShell` + `ShellProvider`) and a **single navigation menu** (`NAVIGATION_SECTIONS`) declared in the `(private)` group's layout. Each module's pages inherit that shell.
- **No** per-module `layout.tsx` or per-module side menu is created. There is no `PrivateAppShell`, `moduleItems`, `dashboard/layout.tsx`, `data/*-menu.data.ts` or `*-navigation.component.tsx`.
- The dashboard must use `EmptyDashboardState` from `shared/components/ui/empty-dashboard-state.tsx` when the component exists in the project.
- `EmptyDashboardState` must accept `moduleName?: string`; for module dashboards, pass `moduleName`, and without that prop keep "Empty Dashboard".
- If the base empty-dashboard component does not exist, generate a simple local fallback to avoid a compilation error.
- The dashboard page must render the dashboard component.
- The module's main route (`page.tsx`) must render the dashboard page inside `<frontendAppPath>/src/app/(private)` when that group exists.
- The menu registration must append (non-destructively) an item to the end of the `items` array of the first section of `NAVIGATION_SECTIONS`: `{ id, label (English title case of the module slug), href: '/<module-name>', icon, match: 'prefix' }`, with the `lucide-react` icon defined by deterministic rules and imported at the top of the file.
- The registration is idempotent (does not duplicate `/<module-name>`) and does not reorder/rewrite the existing items. Failing to find `NAVIGATION_SECTIONS` is non-fatal (`[RISK]` log).
- The menu labels are English by default: the English title case of the module slug.
- Frontend folders and files must follow lowercase kebab-case.
- The component file must use the `.component.tsx` suffix.
- The internal page file must use the `.page.tsx` suffix.

## Notes

- `--scope` lets you force an explicit namespace (e.g. `@namespace`, `@acme`).
- Without `--scope`, use the skill's global configuration precedence.
- `--force` lets you overwrite the module's package/backend/frontend directories.
- Recommended command (cross-platform): `node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-new-module/scripts/create-module.mjs <module-name>` (or adjust to `.claude/skills` when applicable).
