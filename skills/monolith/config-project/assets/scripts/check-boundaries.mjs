#!/usr/bin/env node
// Boundaries of the modular monolith, checked by script instead of by review:
//   1. modules/<m>/src imports no framework/infra, no other module, nothing outside itself
//   2. modules/<m>/package.json depends only on the shared package (plus plain libraries)
//   3. no test file inside modules/<m>/src
//   4. a Next route of a module composes nothing: it only imports that module's page
//   5. CQRS: a use case is a command (execute() returns Result<void>); reads are queries, outside use-case/
//   6. every Prisma model has the same spine: uuid id, createdAt, updatedAt; money is Decimal, never Float
// Exit 1 with one `file:line: reason` per violation; `npm test` and CI run it first.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = ['skills.config.json', '.env/skills.config.json'].map((p) => path.join(root, p)).find(fs.existsSync);
if (!configPath) {
  console.error('check-boundaries: skills.config.json not found; run config-project first');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const defaults = config.defaults ?? config;
const scope = defaults.namespace;
const shared = `${scope}/${path.basename(defaults.sharedModulePath ?? 'packages/shared')}`;
const frontend = (defaults.frontendAppPath ?? 'apps/frontend').replace(/\\/g, '/');

const FRAMEWORK = /^(@nestjs\/|next(\/|$)|react(-dom)?(\/|$)|@prisma\/|prisma(\/|$)|express(\/|$)|pg(\/|$))/;
const IMPORT = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

const posix = (p) => p.replace(/\\/g, '/');
const glob = (pattern) => fs.globSync(pattern, { cwd: root }).map(posix).sort();
const imports = (file) =>
  fs
    .readFileSync(path.join(root, file), 'utf8')
    .split('\n')
    .flatMap((text, i) => [...text.matchAll(IMPORT)].map((m) => ({ spec: m[1], line: i + 1 })));
const resolveRelative = (file, spec) => posix(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));

const modules = fs.existsSync(path.join(root, 'modules'))
  ? fs.readdirSync(path.join(root, 'modules'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];
const violations = [];

for (const mod of modules) {
  const src = `modules/${mod}/src`;

  for (const file of glob(`${src}/**/*.ts`)) {
    if (/\.(test|spec)\.ts$/.test(file)) violations.push(`${file}: test file inside ${src}; tests live in modules/${mod}/test`);
    for (const { spec, line } of imports(file)) {
      if (FRAMEWORK.test(spec)) violations.push(`${file}:${line}: "${spec}" — framework/infra import inside the pure core ${src}`);
      else if (spec.startsWith(`${scope}/`) && spec !== shared) violations.push(`${file}:${line}: "${spec}" — a module depends on data, never on another module's code`);
      else if (spec.startsWith('.') && !resolveRelative(file, spec).startsWith(`${src}/`)) violations.push(`${file}:${line}: "${spec}" — relative import leaves ${src}`);
    }
    if (/\/use-case\/[^/]+\.ts$/.test(file) && !file.endsWith('/index.ts')) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      if (/\/(find|list|get|search|count)-[^/]*$/.test(file)) violations.push(`${file}: a read is a query (${src}/<aggregate>/query/), never a use case`);
      const execute = text.match(/execute\s*\([^)]*\)\s*:\s*Promise<\s*Result<\s*([^>]+)>/);
      if (execute && execute[1].trim() !== 'void') violations.push(`${file}: a use case is a command — execute() returns Result<void>, not Result<${execute[1].trim()}>`);
    }
  }

  const pkgPath = `modules/${mod}/package.json`;
  if (fs.existsSync(path.join(root, pkgPath))) {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, pkgPath), 'utf8'));
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) {
      if (FRAMEWORK.test(dep)) violations.push(`${pkgPath}: dependency "${dep}" — framework/infra in a pure module`);
      else if (dep.startsWith(`${scope}/`) && dep !== shared) violations.push(`${pkgPath}: dependency "${dep}" — only ${shared} is allowed`);
    }
  }

  // every page.tsx under a route segment named after the module (route groups like (private) are transparent)
  for (const file of glob(`${frontend}/src/app/**/page.tsx`)) {
    const segments = file.slice(`${frontend}/src/app/`.length).split('/').slice(0, -1);
    if (!segments.includes(mod)) continue;
    const pages = `${frontend}/src/modules/${mod}/`;
    for (const { spec, line } of imports(file)) {
      const ok = spec.startsWith('@/modules/' + mod + '/') || (spec.startsWith('.') && resolveRelative(file, spec).startsWith(pages));
      if (!ok) violations.push(`${file}:${line}: "${spec}" — a route only imports the module's page (${pages}pages/*)`);
    }
  }
}

// rule 6: one spine per table (docs/architecture.md rule 12); the bootstrap placeholder model is exempt
for (const file of glob('apps/*/prisma/models/*.prisma')) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const m of text.matchAll(/^model\s+(\w+)\s*\{([^}]*)\}/gm)) {
    const [, name, body] = m;
    if (name === 'PrismaBootstrap') continue;
    const line = text.slice(0, m.index).split('\n').length;
    if (!/^\s*id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/m.test(body)) violations.push(`${file}:${line}: model ${name} — id must be \`String @id @default(uuid()) @db.Uuid\` (the Id value object accepts UUIDs only)`);
    if (!/^\s*createdAt\s+DateTime\s+@default\(now\(\)\)\s+@db\.Timestamptz/m.test(body)) violations.push(`${file}:${line}: model ${name} — missing \`createdAt DateTime @default(now()) @db.Timestamptz\``);
    if (!/^\s*updatedAt\s+DateTime\s+@updatedAt\s+@db\.Timestamptz/m.test(body)) violations.push(`${file}:${line}: model ${name} — missing \`updatedAt DateTime @updatedAt @db.Timestamptz\``);
    if (/^\s*\w+\s+Float\b/m.test(body)) violations.push(`${file}:${line}: model ${name} — Float is never a column; money is \`Decimal @db.Decimal(19, 4)\``);
  }
}

if (violations.length > 0) {
  console.error(`check-boundaries: ${violations.length} violation(s)`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`check-boundaries: OK (${modules.length} module(s))`);
