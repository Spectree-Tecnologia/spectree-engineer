#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = process.cwd()
const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appsDir = path.join(root, 'apps')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function copyDirContent(source, target) {
  ensureDir(target)
  const entries = fs.readdirSync(source, { withFileTypes: true })
  for (const entry of entries) {
    const from = path.join(source, entry.name)
    const to = path.join(target, entry.name)
    if (entry.isDirectory()) copyDirContent(from, to)
    else fs.copyFileSync(from, to)
  }
}

function copyTemplate(from, to) {
  ensureDir(path.dirname(to))
  fs.copyFileSync(from, to)
}

// ── Flexible resolution of the target app ────────────────────────────────────
// The frontend app may be called `frontend`, `web` or anything else. Strategy:
//   1. explicit name as an argument: `apply.mjs <name>` or `--app=<name>`
//   2. autodetection: the only Next.js app in apps/ → use it
//   3. ambiguous (0 or >1) → error asking for the name (the AI should ask the user)

function parseAppArg() {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--app' || a === '--target') return args[i + 1]
    if (a.startsWith('--app=')) return a.slice('--app='.length)
    if (a.startsWith('--target=')) return a.slice('--target='.length)
    if (!a.startsWith('-')) return a
  }
  return null
}

function isNextApp(dir) {
  const pkgPath = path.join(dir, 'package.json')
  const hasNextDep = fs.existsSync(pkgPath) && /"next"\s*:/.test(fs.readFileSync(pkgPath, 'utf8'))
  const hasAppDir = fs.existsSync(path.join(dir, 'src', 'app')) || fs.existsSync(path.join(dir, 'app'))
  return hasNextDep || hasAppDir
}

function listNextApps() {
  if (!fs.existsSync(appsDir)) return []
  return fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => isNextApp(path.join(appsDir, name)))
}

function resolveFrontendDir() {
  const requested = parseAppArg()

  if (requested) {
    const dir = path.join(appsDir, requested)
    if (!fs.existsSync(dir)) {
      throw new Error(`App "${requested}" not found in apps/. Available apps: ${listNextApps().join(', ') || '(none)'}`)
    }
    return dir
  }

  const candidates = listNextApps()
  if (candidates.length === 0) {
    throw new Error(
      'No frontend (Next.js) app found in apps/. Run config-project first, or give the name: node apply.mjs <app-name>',
    )
  }
  if (candidates.length > 1) {
    throw new Error(
      `Several frontend apps found in apps/: ${candidates.join(', ')}. Say which one to use: node apply.mjs <app-name>`,
    )
  }
  return path.join(appsDir, candidates[0])
}

// srcRoot supports a layout with or without `src/`.
function resolveSrcRoot(frontendDir) {
  return fs.existsSync(path.join(frontendDir, 'src')) ? path.join(frontendDir, 'src') : frontendDir
}

function getPkgName(frontendDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(frontendDir, 'package.json'), 'utf8'))
  return pkg.name
}

function toAppName(packageName) {
  const raw = packageName.includes('/') ? packageName.split('/').pop() : packageName
  return raw
    .split(/[-_]/g)
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join('')
}

function patchAppLogo(sharedDir, appName) {
  const logoPath = path.join(sharedDir, 'components', 'branding', 'app-logo.component.tsx')
  let content = fs.readFileSync(logoPath, 'utf8')
  content = content.replace(/const APP_NAME = '.*?';/, `const APP_NAME = '${appName}';`)
  fs.writeFileSync(logoPath, content, 'utf8')
}

// The app is dark-only: the root layout needs the `dark` class on <html> so the
// dark theme and the `dark:` variant are always on. Idempotent.
function patchRootLayoutDark(appDir) {
  const layoutPath = path.join(appDir, 'layout.tsx')
  if (!fs.existsSync(layoutPath)) return false

  const content = fs.readFileSync(layoutPath, 'utf8')

  // Finds the opening <html ...> tag.
  const htmlMatch = content.match(/<html\b[^>]*>/)
  if (!htmlMatch) return false

  const htmlTag = htmlMatch[0]
  // Already dark? Leave it.
  if (/\bdark\b/.test(htmlTag)) return false

  let patchedTag
  if (/className=\{`/.test(htmlTag)) {
    // className={`...`}  → insert `dark ` right after the opening backtick
    patchedTag = htmlTag.replace(/className=\{`/, 'className={`dark ')
  } else if (/className=("|')/.test(htmlTag)) {
    // className="..." | '...'  → insert `dark ` right after the opening quote
    patchedTag = htmlTag.replace(/className=("|')/, 'className=$1dark ')
  } else {
    // no className  → add className="dark"
    patchedTag = htmlTag.replace(/<html\b/, '<html className="dark"')
  }

  fs.writeFileSync(layoutPath, content.replace(htmlTag, patchedTag), 'utf8')
  return true
}

function run(command) {
  execSync(command, { stdio: 'inherit', cwd: root })
}

function main() {
  const frontendDir = resolveFrontendDir()
  const srcDir = resolveSrcRoot(frontendDir)
  const appDir = path.join(srcDir, 'app')
  const sharedDir = path.join(srcDir, 'shared')
  const publicDir = path.join(frontendDir, 'public')

  const frontendPkg = getPkgName(frontendDir)
  const appName = toAppName(frontendPkg)
  const assets = path.join(skillDir, 'assets')

  console.log(`→ Applying config-shared-frontend to ${path.relative(root, frontendDir)} (package: ${frontendPkg})`)

  run(
    `npm install lucide-react clsx tailwind-merge class-variance-authority radix-ui react-hook-form react-day-picker date-fns recharts sonner @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-popover @radix-ui/react-radio-group @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-tabs --workspace ${frontendPkg}`,
  )

  // shared/: presentation and utilities only. Navigation does NOT live here:
  // the paths are part of the application's state and live in the (private) layout.
  copyDirContent(path.join(assets, 'shared'), sharedDir)
  patchAppLogo(sharedDir, appName)

  // public/: static assets served from the root (e.g. illustrations used by
  // shared components such as empty-dashboard-state). Copies the whole tree.
  const publicAssets = path.join(assets, 'public')
  if (fs.existsSync(publicAssets)) copyDirContent(publicAssets, publicDir)

  // Dark-only design system: writes globals.css with every dark theme token
  // (the shared components use bg-card, text-muted-foreground, etc.) and makes
  // sure the root layout's <html> has the `dark` class.
  copyTemplate(path.join(assets, 'app', 'globals.template.css'), path.join(appDir, 'globals.css'))
  patchRootLayoutDark(appDir)

  // Next.js routes: landing (root), join (public) and the open dashboard (private).
  copyTemplate(path.join(assets, 'app', 'page.template.tsx'), path.join(appDir, 'page.tsx'))
  copyTemplate(
    path.join(assets, 'app', '(private)', 'layout.template.tsx'),
    path.join(appDir, '(private)', 'layout.tsx'),
  )
  copyTemplate(
    path.join(assets, 'app', '(public)', 'layout.template.tsx'),
    path.join(appDir, '(public)', 'layout.tsx'),
  )
  copyTemplate(
    path.join(assets, 'app', '(private)', 'dashboard', 'page.template.tsx'),
    path.join(appDir, '(private)', 'dashboard', 'page.tsx'),
  )
  copyTemplate(
    path.join(assets, 'app', '(public)', 'join', 'page.template.tsx'),
    path.join(appDir, '(public)', 'join', 'page.tsx'),
  )

  run('npm run format')
}

main()
