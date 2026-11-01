// One worktree per ticket, ready to build in: own branch, own database, own ports, the frontend
// built against its own backend. Every step runs in order and the first non-zero exit stops it.
//
//   node scripts/worktree.mjs up <ticket-slug> <offset> [--branch <name>] [--from <ref>]
//   node scripts/worktree.mjs down <ticket-slug>
//
// `up` adds ../<repo>-<slug> on <branch> (default feat/<slug>) from <ref> (default the current
// branch), copies the untracked .env files, moves every port by <offset> (frontend and backend,
// FRONTEND_URL and the frontend's API URL with them), points both database URLs at <db>_<slug>,
// creates that database from the owner URL, then installs, generates, migrates, applies the roles,
// seeds and builds. It prints the variables a dev server or Playwright run needs, never a URL
// with a password. `down` drops the database and removes the worktree; the branch stays.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [command, slugArg, offsetArg, ...rest] = process.argv.slice(2);
const usage = () => {
  console.error('usage: node scripts/worktree.mjs up <ticket-slug> <offset> [--branch <name>] [--from <ref>]\n       node scripts/worktree.mjs down <ticket-slug>');
  process.exit(2);
};
if (!['up', 'down'].includes(command) || !slugArg) usage();
// The slug names a branch, a folder and a database: letters, digits and dashes only.
const slug = slugArg.toLowerCase();
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) usage();
const dbSuffix = slug.replace(/-/g, '_');

const root = process.cwd();
const repo = path.basename(root);
const worktree = path.join(path.dirname(root), `${repo}-${slug}`);
const ENV_FILES = ['.env', path.join('apps', 'backend', '.env'), path.join('apps', 'frontend', '.env')];
const backendEnv = path.join('apps', 'backend', '.env');

function sh(cmd, cwd = root, env = {}) {
  console.log(`\n$ ${cmd}   (${path.relative(path.dirname(root), cwd) || '.'})`);
  const res = spawnSync(cmd, { cwd, shell: true, stdio: 'inherit', env: { ...process.env, ...env } });
  if ((res.status ?? 1) !== 0) {
    console.error(`\nworktree ${command}: "${cmd}" exited ${res.status}; stopping here.`);
    process.exit(res.status ?? 1);
  }
}
const out = (cmd, cwd = root) => spawnSync(cmd, { cwd, shell: true, encoding: 'utf8' }).stdout.trim();

function readEnv(file) {
  const entries = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) entries[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return entries;
}

// Rewrites values in place, line by line; nothing of the file is ever printed.
function rewriteEnv(file, fn) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => {
    const m = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/);
    if (!m) return line;
    const next = fn(m[2], m[4]);
    return next === undefined ? line : `${m[1]}${m[2]}${m[3]}${next}`;
  });
  fs.writeFileSync(file, lines.join('\n'));
}

// The owner URL of the main checkout: the database the worktree's one is created beside.
function ownerUrl() {
  const env = readEnv(path.join(root, backendEnv));
  const raw = env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;
  if (!raw) {
    console.error(`worktree: no MIGRATION_DATABASE_URL or DATABASE_URL in ${backendEnv}`);
    process.exit(1);
  }
  return new URL(raw);
}
const dbNameOf = (url) => url.pathname.replace(/^\//, '');
const withDb = (value, name) => {
  const url = new URL(value.replace(/^"(.*)"$/, '$1'));
  url.pathname = `/${name}`;
  return url.toString();
};

// pg is the backend's own dependency (db/roles.mjs uses it); resolved from the main checkout.
async function withOwner(fn) {
  const require = createRequire(path.join(root, 'apps', 'backend', 'package.json'));
  const { Client } = require('pg');
  const client = new Client({ connectionString: ownerUrl().toString() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

const portOf = (env, key, fallback) => Number(env[key] ?? fallback);

async function up() {
  const offset = Number(offsetArg);
  if (!Number.isInteger(offset) || offset <= 0) usage();
  const branch = rest[rest.indexOf('--branch') + 1] && rest.includes('--branch') ? rest[rest.indexOf('--branch') + 1] : `feat/${slug}`;
  const from = rest.includes('--from') ? rest[rest.indexOf('--from') + 1] : out('git branch --show-current');
  if (fs.existsSync(worktree)) {
    console.error(`worktree: ${worktree} already exists; run "down ${slug}" first`);
    process.exit(1);
  }

  const exists = out(`git branch --list "${branch}"`) !== '';
  sh(exists ? `git worktree add "${worktree}" "${branch}"` : `git worktree add "${worktree}" -b "${branch}" "${from}"`);

  // The untracked env files do not travel with the worktree.
  for (const rel of ENV_FILES) {
    const src = path.join(root, rel);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(path.join(worktree, rel)), { recursive: true });
      fs.copyFileSync(src, path.join(worktree, rel));
    }
  }

  const be = readEnv(path.join(root, backendEnv));
  const fe = readEnv(path.join(root, 'apps', 'frontend', '.env'));
  const backendPort = portOf(be, 'PORT', 4000);
  const frontendPort = portOf(fe, 'PORT', 3000);
  const ports = { backend: backendPort + offset, frontend: frontendPort + offset };
  const dbName = `${dbNameOf(ownerUrl())}_${dbSuffix}`;

  rewriteEnv(path.join(worktree, backendEnv), (key, value) => {
    if (key === 'PORT') return String(ports.backend);
    if (value.includes(`localhost:${frontendPort}`)) return value.replace(`localhost:${frontendPort}`, `localhost:${ports.frontend}`);
    if (key === 'MIGRATION_DATABASE_URL' || key === 'DATABASE_URL') return `"${withDb(value, dbName)}"`;
    return undefined;
  });
  // Next bakes its public API URL in at build time and reads PORT only from the process: both are rewritten here,
  // and the build below runs inside the worktree so the frontend talks to its own backend.
  rewriteEnv(path.join(worktree, 'apps', 'frontend', '.env'), (key, value) => {
    if (key === 'PORT') return String(ports.frontend);
    if (value.includes(`localhost:${backendPort}`)) return value.replace(`localhost:${backendPort}`, `localhost:${ports.backend}`);
    return undefined;
  });

  await withOwner(async (client) => {
    const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (found.rowCount === 0) await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`\ndatabase ${dbName}: ${found.rowCount === 0 ? 'created' : 'already there'}`);
  });

  const backendDir = path.join(worktree, 'apps', 'backend');
  sh('npm install --no-audit --no-fund', worktree);
  sh('npx prisma generate', backendDir);
  sh(fs.existsSync(path.join(backendDir, 'prisma', 'migrations')) ? 'npx prisma migrate deploy' : 'npx prisma db push', backendDir);
  sh('npm run db:roles', backendDir);
  if (fs.existsSync(path.join(backendDir, 'prisma', 'seed', 'main.ts'))) sh('npx prisma db seed', backendDir);
  // --force: the turbo cache is shared between worktrees, a green build may be another tree's
  sh('npm run build -- --force', worktree);

  console.log(`
worktree ready: ${worktree}
  branch     ${branch} (from ${from})
  database   ${dbName}
  backend    http://localhost:${ports.backend}
  frontend   http://localhost:${ports.frontend}

Next reads PORT from the process, not from .env: start the dev servers with it set.
  PORT=${ports.frontend} npm run dev              (in ${worktree})
For a Playwright run against this tree:
  PLAYWRIGHT_BASE_URL=http://localhost:${ports.frontend}
Done with it: node scripts/worktree.mjs down ${slug}`);
}

async function down() {
  const dbName = `${dbNameOf(ownerUrl())}_${dbSuffix}`;
  await withOwner(async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    console.log(`database ${dbName}: dropped`);
  });
  if (fs.existsSync(worktree)) {
    sh(`git worktree remove --force "${worktree}"`);
    // On Windows git leaves the empty folder tree of node_modules behind, and exits 0.
    if (fs.existsSync(worktree)) fs.rmSync(worktree, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } else {
    console.log(`worktree ${worktree}: already gone`);
  }
  sh('git worktree prune');
}

(command === 'up' ? up() : down()).catch((error) => {
  console.error(`worktree ${command}: ${error.message}`);
  process.exit(1);
});
