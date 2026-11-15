---
name: config-new-module
user-invocable: false
description: Create a new module deterministically in the Workspace project's pattern, generating the scaffold in `modules/*`, `apps/backend/src/modules/*` and `apps/frontend/src/modules/*`. Use when the request involves creating a full-stack module in the monorepo with a TypeScript package, a NestJS module and an initial dashboard on the web.
---

# Config New Module

## Overview

Standardize the creation of new modules in the monorepo with three synchronized deliverables:

1. a pure domain package in `modules/<module-name>` (TypeScript template with no Nest/Next/React/Prisma dependencies);
2. a backend module in `<backendAppPath>/src/modules/<module-name>` (Nest module + controller + the module's Prisma provider) and an initial Prisma model in `<backendAppPath>/prisma/models/<module-name>.model.prisma`;
3. a frontend module in `<frontendAppPath>/src/modules/<module-name>`, with the folders `components`, `data`, `pages` and the main route in `<frontendAppPath>/src/app/(private)/<module-name>/page.tsx` when the `(private)` group exists. The project uses a **single shell** (`AdminShell`) and a **single navigation menu** declared as `NAVIGATION_SECTIONS` in the `(private)` group's layout — the module's pages inherit that shell, so **no** per-module `layout.tsx` is generated. The module's entry is registered (non-destructively) in `NAVIGATION_SECTIONS`.

Run the skill's Node script to receive the module name and generate the minimal code and test files, without depending on an OS-specific shell.
The namespace and the default directories come from `skills.config.json` at the project root (written by `config-project`).

## Workflow

1. Read the module name requested by the user.
2. Run `node scripts/create-module.mjs <module-name>`.
3. The namespace is resolved by precedence: `--scope` > `PROJECT_NAMESPACE`/`SKILLS_NAMESPACE` > `skills.config.local.json` > `skills.config.json` > automatic fallback.
4. Check the structure created in:
   - `modules/<module-name>`
   - `<backendAppPath>/src/modules/<module-name>`
   - `<backendAppPath>/prisma/models/<module-name>.model.prisma`
   - `<frontendAppPath>/src/modules/<module-name>`
   - `<frontendAppPath>/src/app/(private)/<module-name>` **or** `<frontendAppPath>/src/app/<module-name>` when there is no `(private)` group
5. Confirm the package contains only `src/index.ts` with the `getModuleName` function and the test `test/index.test.ts`.
6. Confirm the backend contains `<module-name>.module.ts`, `<module-name>.controller.ts`, `<module-name>.prisma.ts`, and that the module was registered in `app.module.ts`.
7. Confirm the frontend contains the dashboard template, the main route (`page.tsx`) and that the module was registered in the navigation menu.
   - the route `app/(private)/<module-name>/page.tsx` (or the fallback without `(private)`) must exist and render the module's `DashboardPage`.
   - **no** per-module `layout.tsx` is generated: the pages inherit the single `AdminShell` from the `(private)` group's layout.
   - the `<module-name>-dashboard.component.tsx` component must use `EmptyDashboardState` from `shared/components/ui/empty-dashboard-state.tsx` when that component exists in the project, passing `moduleName` when applicable.
   - the single navigation menu (`NAVIGATION_SECTIONS` in the `(private)` group's layout) must contain the new module: item `{ id, label (English title case of the module slug), href: '/<module-name>', icon, match: 'prefix' }` appended to the end of the first section's `items` array, with the deterministic `lucide-react` icon imported at the top of the file.
   - the menu labels are English by default: the English title case of the module slug (e.g. `payment-methods` → `Payment Methods`).
   - the registration is **idempotent** (does not duplicate) and **non-destructive** (does not reorder or change the existing items).
8. Confirm that `<backendAppPath>/package.json` and `<frontendAppPath>/package.json` have the `<scope>/<module-name>` dependency.
9. If the menu structure (`NAVIGATION_SECTIONS`) is not found, the registration is skipped non-fatally (only logged with `[RISK]`) — the module creation is not aborted.
10. Record the run in `.log/skills.log` with the skill title and a simple list of the relevant commands/actions (no timestamps and no status), ensuring `.log/` is in `.gitignore`.

## Commands

Create a module in the project's default namespace:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-new-module/scripts/create-module.mjs <module-name>
```

> If the repository is in `.claude/skills`, adjust the command path.

Set the namespace via environment variable:

```bash
PROJECT_NAMESPACE=@namespace node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-new-module/scripts/create-module.mjs <module-name>
```

Create a module with an explicit namespace:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-new-module/scripts/create-module.mjs <module-name> --scope @namespace
```

Overwrite an existing directory:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-new-module/scripts/create-module.mjs <module-name> --force
```

Module without a screen (backend only: no frontend module, route, menu entry, sample controller or its e2e):

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-new-module/scripts/create-module.mjs <module-name> --backend-only
```

## Output Contract

The script must generate exactly:

- `modules/<module-name>/package.json`
- `modules/<module-name>/tsconfig.json`
- `modules/<module-name>/vitest.config.ts`
- `modules/<module-name>/src/index.ts` (only the `getModuleName` function)
- `modules/<module-name>/test/index.test.ts`
- `<backendAppPath>/src/modules/<module-name>/<module-name>.controller.ts`
- `<backendAppPath>/src/modules/<module-name>/<module-name>.prisma.ts`
- `<backendAppPath>/src/modules/<module-name>/<module-name>.module.ts`
- `<backendAppPath>/src/modules/<module-name>/index.ts`
- `<backendAppPath>/prisma/models/<module-name>.model.prisma`
- update to `<backendAppPath>/src/app.module.ts` to import and register `<ModuleName>Module`
- `<backendAppPath>/test/<module-name>.e2e-spec.ts`: 401 without a token and `GET /<module-name>` inside `expectQueryBudget(prisma.client, 2, ...)` — when the listing starts reading the database, seed N rows first and keep the budget (rule 11 of `docs/architecture.md`)
- the line `{ "path": "/<module-name>", "auth": true, "p95Ms": 200 }` in `perf.config.json` (when the file exists), measured by `npm run perf`
- `<frontendAppPath>/src/modules/<module-name>/components/<module-name>-dashboard.component.tsx`
- `<frontendAppPath>/src/modules/<module-name>/data/index.ts`
- `<frontendAppPath>/src/modules/<module-name>/pages/dashboard.page.tsx`
- `<frontendAppPath>/src/modules/<module-name>/index.ts`
- `<frontendAppPath>/src/app/(private)/<module-name>/page.tsx` when `(private)` exists, otherwise `<frontendAppPath>/src/app/<module-name>/page.tsx` (only `page.tsx`; no per-module `layout.tsx`)
- update to the `(private)` group's layout (`<frontendAppPath>/src/app/(private)/layout.tsx`, or `<frontendAppPath>/src/app/layout.tsx` in the fallback) adding the module's deterministic entry to `NAVIGATION_SECTIONS` and ensuring the `lucide-react` icon import
- update to `<backendAppPath>/package.json` with the `<scope>/<module-name>` dependency
- update to `<frontendAppPath>/package.json` with the `<scope>/<module-name>` dependency

Module dashboard rule:

- when `shared/components/ui/empty-dashboard-state.tsx` exists, the file `<module-name>-dashboard.component.tsx` must reference `EmptyDashboardState` as the dashboard's main content.
- the `moduleName` prop must be optional on `EmptyDashboardState`; when not provided, keep the default title "Empty Dashboard".

Navigation menu rule (`NAVIGATION_SECTIONS`):

- the project has a **single navigation menu**, declared as `const NAVIGATION_SECTIONS: SidebarMenuSection[] = [...]` in the `(private)` group's layout (`app/(private)/layout.tsx`), which feeds the `SidebarMenu` of the single `AdminShell`.
- the new module must be appended to the end of the **first section's** `items` array, with a navigable item and a `lucide-react` icon chosen by a deterministic mapping based on the module name.
- the chosen icon must be ensured in the `lucide-react` import at the top of the file (without duplicating specifiers and without affecting other imports).
- the labels are the English title case of the module slug (e.g. `auth` → `Auth`, `credit-cards` → `Credit Cards`, `transactions` → `Transactions`).
- the registration is **idempotent** (does not duplicate when the route `/<module-name>` already exists) and **non-destructive**: the items already curated in the menu are not reordered or rewritten — the new item is only appended.
- if `NAVIGATION_SECTIONS` (or the `items` array) is not found, the registration is skipped non-fatally, with a `[RISK]` log.

Shell and layout rule:

- the project uses a **single shell** (`AdminShell` + `ShellProvider`) rendered in the `(private)` group's layout. Each module's pages inherit that shell.
- **no** per-module `layout.tsx` or per-module side menu is created. There is no dependency on `PrivateAppShell`, `moduleItems`, `dashboard/layout.tsx`, `data/*-menu.data.ts` or `*-navigation.component.tsx`.

## Naming Convention

- Folders: always lowercase kebab-case.
- Files: always lowercase kebab-case, with the type suffix in the name (e.g. `branch.controller.ts`, `branch.module.ts`, `branch-dashboard.component.tsx`, `dashboard.page.tsx`).

See `references/module-template.md` for the full contract of the generated files.

## Shared Config

- Versioned file: `skills.config.json` at the project root
- Local override (gitignored): `skills.config.local.json` in the same directory as the main configuration
- Local example: `skills.config.local.example.json` in the same directory as the main configuration
- Local run log: `.log/skills.log` (not versioned; `.log/` is added to `.gitignore` automatically, without extra metadata).

## Risk Logging Guardrails

- Record execution facts in `.log/skills.log` with a marker at the start of the line.
- Minimum expected markers: `[CMD]`, `[FILE_CREATE]`, `[FILE_UPDATE]`, `[FILE_DELETE]`, `[DIR_CREATE]`, `[RISK]`, `[FAIL]`, `[AI]`.
- Always record `[RISK]` when there is an overwrite, deletion, rename/move, or forced fallback on files/folders.
- Every unexpected failure must produce `[FAIL]` with a short factual description of the event.
- Terminal operations and file changes must go through the shared utilities in `../utils` to keep traceability consistent.


