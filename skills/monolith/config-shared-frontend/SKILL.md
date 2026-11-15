---
name: config-shared-frontend
user-invocable: false
description: Sets up the shared structure (shared/) and the Next.js routes (public/private groups) in a target frontend project. Navigation does NOT live in shared/ — the paths are application state and live in the (private) group's layout. Generates a single menu, a landing page, a sample auth screen and an open dashboard (no auth lock). Uses the assets embedded in this skill as the source — no dependency on a specific project at runtime.
tools: Read, Glob, Grep, Bash, Write, Edit
---

# config-shared-frontend

## Official command (deterministic)

Always run from the monorepo root:

```bash
# Autodetects the frontend app when there is only one in apps/
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-shared-frontend/scripts/apply.mjs

# Or pass the name of the target app (frontend, web, or another)
node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-shared-frontend/scripts/apply.mjs <app-name>
```

This script applies the whole skill idempotently (dependencies, `shared/`, routes and formatting).

### Resolving the target app (flexible)

The frontend app does **not** need to be called `frontend` — it can be `web` or any other name
in `apps/`. The script resolves the target like this:

1. **Explicit name** via argument (`apply.mjs web` or `--app=web`) — always takes priority.
2. **Autodetection**: if there is **exactly one** Next.js app in `apps/` (with `next` in
   `package.json` or an `app/` folder), it uses that one.
3. **Ambiguous**: if there are **zero or more than one** candidates, the script fails listing the
   options. In that case, **ask the user** which app to use (via `AskUserQuestion`) and
   re-run passing the name. Supports layouts with or without `src/` (`src/app` or `app`).

Recreates the `shared/` folder and the Next.js route structure in any target frontend project.
Every required file is **embedded** in this skill in `assets/` — the skill is self-sufficient.

## Architecture principles

- **Navigation is application state.** The menu paths/items are defined in
  `app/(private)/layout.tsx`, **not** in `shared/`. To change the menu, edit the layout.
  If a project has another navigation structure, just change `NAVIGATION_SECTIONS`
  (or swap the menu component) in the layout — `shared/` stays intact.
- **Single menu.** There is a single navigation area (no module rail / no double menu).
  Every item lives in the `sections` passed to `SidebarMenu`.
- **Open dashboard.** The `(private)` group uses `AdminShell`, but **without** an
  authentication guard — the private routes are directly accessible.

## Asset location

```
${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-shared-frontend/assets/
  shared/          ← complete, generic shared folder, ready to copy (no navigation)
  public/          ← static assets served from the root (illustrations etc.)
    illustrations/empty-dashboard-dark.svg  (used by empty-dashboard-state)
  app/             ← templates for Next.js route layouts and pages
    globals.template.css                    (dark-only design system — written to app/globals.css)
    page.template.tsx                       (landing page with hero)
    (public)/layout.template.tsx
    (public)/join/page.template.tsx         (sample auth screen, no form)
    (private)/layout.template.tsx           (inline navigation + AdminShell, no guard)
    (private)/dashboard/page.template.tsx   (open dashboard)
```

---

## Phase 1 — Read the target project's context

Before any action, read the target project's context.

```bash
ls {DEST}/src/app/
cat {DEST}/package.json | grep -E '"name"|"next"|"react"'
cat {DEST}/tsconfig.json | grep -A5 '"paths"'
```

Capture:

- Project name (`package.json > name`)
- Next.js version
- Path alias (`@/*` → `./src/*`)
- Whether a `shared/` folder already exists in the target (ask for confirmation before overwriting)
- Whether an `app/(private)/` or `app/(public)/` structure already exists

---

## Phase 2 — Resolve the configuration automatically (no questions)

**Do not ask the user questions.** Resolve everything from the defaults below.

### App name

Extract from the target's `package.json > name`:

- With a namespace (`@acme/frontend`): use the part after `/` in PascalCase → `Frontend`
- Without a namespace (`myapp`): use the name in PascalCase → `Myapp`

### Navigation (single menu, in the layout)

Navigation is defined **inside** `app/(private)/layout.tsx` in `NAVIGATION_SECTIONS`.
Default: one `Navigation` section with a single `Dashboard` item → `/dashboard`.
There is no module menu. For new items, add entries to `NAVIGATION_SECTIONS`.

### Routes

```
/             → app/page.tsx                       (landing page with hero)
/join         → app/(public)/join/page.tsx         (sample auth screen)
/dashboard    → app/(private)/dashboard/page.tsx   (open dashboard)
```

### No authentication guard

The dashboard is **open**. The `(private)` layout does **not** include `RouteGuard`.
The **Sign out** button in the `AdminShell` user menu redirects to the landing page (`/`).

---

## Phase 3 — Install the frontend dependencies

```bash
npm install \
  lucide-react clsx tailwind-merge class-variance-authority radix-ui \
  react-hook-form react-day-picker date-fns recharts sonner \
  @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-label @radix-ui/react-popover @radix-ui/react-radio-group \
  @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-tabs \
  --workspace {FRONTEND_PACKAGE_NAME}
```

Where `{FRONTEND_PACKAGE_NAME}` is the value of `name` in the target's `package.json`.

---

## Phase 4 — Copy the shared/ folder

### 4a. Detect an existing shared

```bash
ls {DEST}/src/shared 2>/dev/null && echo "HAS_SHARED" || echo "NO_SHARED"
```

If `shared/` already exists: **warn and ask for explicit confirmation** before overwriting.

### 4b. Copy every file from assets/shared/

```bash
cp -r {SKILL_DIR}/assets/shared/. {DEST}/src/shared/
```

`shared/` contains only presentation and utilities — **no navigation**.

### 4b-bis. Copy the static assets from assets/public/

```bash
cp -r {SKILL_DIR}/assets/public/. {DEST}/public/
```

Includes `illustrations/empty-dashboard-dark.svg`, referenced by
`shared/components/ui/empty-dashboard-state.tsx`. Without this step the empty
dashboard renders with a broken image.

### 4c. Customize AppLogo with the real name

Edit `{DEST}/src/shared/components/branding/app-logo.component.tsx`:
replace `const APP_NAME = 'App';` with the name resolved in Phase 2.

### 4d. Check the import alias

If `@/*` does not exist in `tsconfig.json`, add `"@/*": ["./src/*"]` to `compilerOptions.paths`.

---

## Phase 5 — Create the Next.js route structure

Copy the templates from `assets/app/` to the target **without modifications**:

| Template                                    | Target                             |
| ------------------------------------------- | ---------------------------------- |
| `app/page.template.tsx`                     | `app/page.tsx`                     |
| `app/(public)/layout.template.tsx`          | `app/(public)/layout.tsx`          |
| `app/(public)/join/page.template.tsx`       | `app/(public)/join/page.tsx`       |
| `app/(private)/layout.template.tsx`         | `app/(private)/layout.tsx`         |
| `app/(private)/dashboard/page.template.tsx` | `app/(private)/dashboard/page.tsx` |
| `app/globals.template.css`                  | `app/globals.css`                  |

Details:

- **Dark-only theme (`globals.css`)** — overwrites the `globals.css` generated by
  `create-next-app` with the full design system in **fixed dark mode**: defines every
  token (`--background`, `--card`, `--primary`, `--muted`, `--border`, `--ring`, …)
  and maps them in `@theme inline` (the shared components use `bg-card`,
  `text-muted-foreground`, `ring-ring`, etc.). Removes the light `:root` and the
  `@media (prefers-color-scheme)`; declares `@custom-variant dark` so that the
  `dark:` variant always resolves to the dark theme. The script also ensures the `dark` class on the
  root layout's `<html>` (`app/layout.tsx`), idempotently.
- **Landing (`/`)** — hero with buttons to `/join` and `/dashboard`.
- **Auth (`/join`)** — skeleton without a form, with the buttons **Back** (`/`) and **Go to the dashboard** (`/dashboard`).
- **Layout (private)** — `ShellProvider` + `AdminShell`. Navigation is inline in
  `NAVIGATION_SECTIONS` and is passed to `SidebarMenu`. `onLogout` does `router.push('/')`.
  There is **no** `RouteGuard`.
- **Dashboard (`/dashboard`)** — open page inside `AdminShell`.

---

## Phase 6 — Final check

```bash
ls {DEST}/src/shared/components/ui/sidebar-menu.component.tsx
ls {DEST}/src/app/page.tsx
ls {DEST}/src/app/(private)/layout.tsx
ls {DEST}/src/app/(private)/dashboard/page.tsx
ls {DEST}/src/app/(public)/layout.tsx
ls {DEST}/src/app/(public)/join/page.tsx

# Navigation must NOT exist in shared/
test ! -d {DEST}/src/shared/navigation && echo "OK: no shared/navigation"
# There must be no wired auth guard
test ! -d {DEST}/src/shared/auth && echo "OK: no shared/auth"

# Dark-only theme applied
grep -q "color-scheme: dark" {DEST}/src/app/globals.css && echo "OK: globals.css dark-only"
grep -q 'className=.*dark' {DEST}/src/app/layout.tsx && echo "OK: <html> with dark class"
# No light mode / theme toggle must remain
! grep -q "prefers-color-scheme" {DEST}/src/app/globals.css && echo "OK: no prefers-color-scheme"
```

---

## Phase 7 — Formatting

```bash
npm run format
```

Run at the monorepo root.

---

## Phase 8 — Final report

```
✅ config-shared-frontend done for {APP_NAME}

📁 shared/ → {DEST}/src/shared/   (presentation + utilities only, no navigation)
   components/branding/app-logo.component.tsx  (name: {APP_NAME})
   components/ui/                              (includes sidebar-menu — single menu)
   context/shell.context.tsx
   hooks/ · i18n/ · lib/ · template/ · util/

🎨 Theme:
   app/globals.css                       → dark-only design system (tokens + @theme inline)
   app/layout.tsx                        → <html className="dark"> (fixed dark mode)

🗺️  Routes created:
   app/page.tsx                          → landing page (hero → /join and /dashboard)
   app/(public)/layout.tsx               → PublicBoxedLayout (auth renders bare)
   app/(public)/join/page.tsx            → sample auth screen (Back / Dashboard)
   app/(private)/layout.tsx              → ShellProvider + AdminShell (inline navigation, no guard)
   app/(private)/dashboard/page.tsx      → open dashboard

⚠️  Next steps:
   1. Edit NAVIGATION_SECTIONS in app/(private)/layout.tsx for the real menus
   2. Implement the real form in app/(public)/join/page.tsx
   3. (Optional) Add an auth guard if the private routes need to be protected
   4. (Optional) Adjust the brand colors in the hsl(...) tokens of app/globals.css
```

---

## Mandatory rules

- **Navigation lives in the layout**, never in `shared/`. Do not recreate `shared/navigation`.
- **Single menu** — do not reintroduce a module rail / double menu in `SidebarMenu`.
- **Open dashboard** — do not add `RouteGuard` to the `(private)` layout by default.
- **Dark-only** — overwrite `app/globals.css` with the dark theme template and keep the
  `dark` class on `<html>`. Do not reintroduce a light `:root` or `prefers-color-scheme`.
- **Always** use the assets embedded in `${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-shared-frontend/assets/` as the source.
- **Confirm** before overwriting existing files in the target.
- **Keep** every `@/shared/...` import intact — do not change the alias system.
- **Never ask** the user for configuration — resolve everything from the Phase 2 defaults.

```

```
