// One isolated worktree, ready to build in: own branch, own database, own ports, the frontend
// built against its own backend. Every step runs in order and the first non-zero exit stops it.
//
//   node scripts/worktree.mjs up <ticket-slug> [offset] [--branch <name>] [--from <ref>]
//   node scripts/worktree.mjs down <ticket-slug>
//
// `up` adds ../<repo>-<slug> on <branch> (default feat/<slug>) from <ref> (default the current
// branch), copies the untracked .env files, moves every port by the offset (given, or the first
// free hundred among the repo's worktrees, read from their backend .env; frontend and backend,
// FRONTEND_URL and the frontend's API URL with them), points both database URLs at <db>_<slug>,
// creates that database from the owner URL, then installs, generates, migrates, applies the roles,
// seeds and builds. It prints the variables a dev server or Playwright run needs, never a URL
// with a password. `down` drops the database and removes the worktree; the branch stays.
//
// The database is only ever one `up` created: `up` refuses a <db>_<slug> that already exists, and
// `down` drops it only while ../<repo>-<slug> is a registered git worktree. A database without its
// worktree is reported and kept; dropping it is a decision for whoever knows where it came from.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [command, slugArg, ...args] = process.argv.slice(2);
const usage = () => {
  console.error('usage: node scripts/worktree.mjs up <ticket-slug> [offset] [--branch <name>] [--from <ref>]\n       node scripts/worktree.mjs down <ticket-slug>');
  process.exit(2);
};
const fail = (message) => {
  console.error(`worktree ${command}: ${message}`);
  process.exit(1);
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

// Children never inherit a database URL from the caller's shell: each tree reads its own .env.
const childEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !['DATABASE_URL', 'MIGRATION_DATABASE_URL'].includes(key.toUpperCase())),
);

// A string runs through the shell (npm and npx are .cmd shims on Windows) and is always a constant
// of this file; anything carrying user input (git) is an argument array, with no shell in between.
function sh(cmd, cwd = root) {
  const [file, argv, shell] = Array.isArray(cmd) ? [cmd[0], cmd.slice(1), false] : [cmd, [], true];
  const shown = Array.isArray(cmd) ? cmd.join(' ') : cmd;
  console.log(`\n$ ${shown}   (${path.relative(path.dirname(root), cwd) || '.'})`);
  const res = spawnSync(file, argv, { cwd, shell, stdio: 'inherit', env: childEnv });
  if ((res.status ?? 1) !== 0) fail(`"${shown}" exited ${res.status}; stopping here.`);
}
const git = (argv, cwd = root) => spawnSync('git', argv, { cwd, encoding: 'utf8', env: childEnv });

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
  if (!raw) fail(`no MIGRATION_DATABASE_URL or DATABASE_URL in ${backendEnv}`);
  return new URL(raw);
}
const withDb = (value, name) => {
  const url = new URL(value.replace(/^"(.*)"$/, '$1'));
  url.pathname = `/${name}`;
  return url.toString();
};

// Postgres truncates identifiers past 63 bytes, so two long slugs could land on one database.
const PG_MAX_IDENTIFIER = 63;
const baseDb = decodeURIComponent(ownerUrl().pathname.replace(/^\//, ''));
const dbName = `${baseDb}_${dbSuffix}`;
if (Buffer.byteLength(dbName) > PG_MAX_IDENTIFIER) {
  fail(`slug "${slug}" is too long: database "${dbName}" would pass Postgres's ${PG_MAX_IDENTIFIER}-byte limit; use at most ${PG_MAX_IDENTIFIER - Buffer.byteLength(baseDb) - 1} characters`);
}

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
const databaseExists = async (client) => (await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])).rowCount > 0;

const samePath = (a, b) => {
  const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};
function registeredWorktrees() {
  const res = git(['worktree', 'list', '--porcelain']);
  if (res.status !== 0) fail(`git worktree list exited ${res.status}`);
  return res.stdout.split(/\r?\n/).filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
}
const isRegisteredWorktree = () => registeredWorktrees().some((dir) => samePath(dir, worktree));

// The hundreds other worktrees of this repo already took, by the PORT in their backend .env.
function nextOffset(basePort) {
  const used = new Set();
  for (const dir of registeredWorktrees()) {
    if (samePath(dir, root)) continue;
    const envFile = path.join(dir, backendEnv);
    if (!fs.existsSync(envFile)) continue;
    const port = Number(readEnv(envFile).PORT);
    if (port > basePort) used.add(Math.round((port - basePort) / 100) * 100);
  }
  return used;
}

// Two `up` at the same moment would both read the same free hundred, and the two trees would fight for one port.
// The offset is reserved by a folder in the git common dir (mkdir is atomic), named after the offset and holding
// the slug. `down` frees it; a reservation whose worktree never appeared is reclaimed after half an hour.
function reservationsDir() {
  const common = git(['rev-parse', '--git-common-dir']);
  if (common.status !== 0) fail(`git rev-parse --git-common-dir exited ${common.status}`);
  return path.join(path.resolve(root, common.stdout.trim()), 'spectree-worktree-offsets');
}
function reserveOffset(basePort, forced) {
  const dir = reservationsDir();
  fs.mkdirSync(dir, { recursive: true });
  const registered = registeredWorktrees();
  for (const name of fs.readdirSync(dir)) {
    const slugFile = path.join(dir, name, 'slug');
    const owner = fs.existsSync(slugFile) ? fs.readFileSync(slugFile, 'utf8').trim() : '';
    const alive = owner && registered.some((tree) => samePath(tree, path.join(path.dirname(root), `${repo}-${owner}`)));
    const stale = Date.now() - fs.statSync(path.join(dir, name)).mtimeMs > 30 * 60 * 1000;
    if (!alive && stale) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
  const used = nextOffset(basePort);
  const take = (offset) => {
    if (used.has(offset)) return false;
    try {
      fs.mkdirSync(path.join(dir, String(offset)));
    } catch (error) {
      if (error.code === 'EEXIST') return false;
      throw error;
    }
    fs.writeFileSync(path.join(dir, String(offset), 'slug'), slug);
    return true;
  };
  if (forced !== undefined) {
    if (!take(forced)) fail(`offset ${forced} is taken by another worktree of this repository; leave it out and the first free one is picked`);
    return forced;
  }
  let offset = 100;
  while (!take(offset)) offset += 100;
  return offset;
}
function releaseOffset() {
  const dir = reservationsDir();
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const slugFile = path.join(dir, name, 'slug');
    if (fs.existsSync(slugFile) && fs.readFileSync(slugFile, 'utf8').trim() === slug) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

// `--name value`, where the value is required; any other argument is a mistake, never ignored.
function parseFlags(argv, names) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    const [name, value] = [argv[i], argv[i + 1]];
    if (!names.includes(name)) fail(`unknown argument "${name}"`);
    if (value === undefined || value === '' || value.startsWith('--')) fail(`${name} needs a value`);
    flags[name] = value;
  }
  return flags;
}
function assertBranchName(flag, value) {
  if (git(['check-ref-format', '--branch', value]).status !== 0) fail(`${flag} "${value}" is not a valid branch or ref name`);
}

const portOf = (env, key, fallback) => Number(env[key] ?? fallback);

async function up() {
  // The offset is optional: given, it is forced; absent, the first free hundred among this repo's worktrees.
  const offsetArg = args[0] !== undefined && !args[0].startsWith('--') ? args[0] : undefined;
  const rest = offsetArg === undefined ? args : args.slice(1);
  const be = readEnv(path.join(root, backendEnv));
  const fe = readEnv(path.join(root, 'apps', 'frontend', '.env'));
  const backendPort = portOf(be, 'PORT', 4000);
  const frontendPort = portOf(fe, 'PORT', 3000);
  const forcedOffset = offsetArg === undefined ? undefined : Number(offsetArg);
  if (forcedOffset !== undefined && (!Number.isInteger(forcedOffset) || forcedOffset <= 0)) usage();
  const flags = parseFlags(rest, ['--branch', '--from']);
  const branch = flags['--branch'] ?? `feat/${slug}`;
  assertBranchName('--branch', branch);
  let from = flags['--from'];
  if (from === undefined) {
    from = git(['branch', '--show-current']).stdout.trim();
    if (!from) fail('HEAD is detached: pass --from <ref> to say where the branch starts');
  }
  // --from is any commit (a branch, a tag, a sha); only the new branch's name must pass check-ref-format
  if (git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${from}^{commit}`]).status !== 0) fail(`--from "${from}" is not a commit`);
  if (fs.existsSync(worktree)) fail(`${worktree} already exists; run "down ${slug}" first`);
  if (await withOwner(databaseExists)) {
    fail(`database ${dbName} already exists but ${worktree} does not; it was not created by "up ${slug}" here, so it is not reused. Drop it by hand if it is a leftover, or pick another slug`);
  }

  // reserved only now, with every refusal behind: a failed `up` leaves no offset taken
  const offset = reserveOffset(backendPort, forcedOffset);
  const exists = git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0;
  sh(exists ? ['git', 'worktree', 'add', worktree, branch] : ['git', 'worktree', 'add', worktree, '-b', branch, from]);

  // The untracked env files do not travel with the worktree.
  for (const rel of ENV_FILES) {
    const src = path.join(root, rel);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(path.join(worktree, rel)), { recursive: true });
      fs.copyFileSync(src, path.join(worktree, rel));
    }
  }

  const ports = { backend: backendPort + offset, frontend: frontendPort + offset };
  console.log(`ports: offset ${offset}${offsetArg === undefined ? ' (first free hundred among the worktrees, reserved)' : ''}`);

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
    await client.query(`CREATE DATABASE ${client.escapeIdentifier(dbName)}`);
    console.log(`\ndatabase ${dbName}: created`);
  });

  const backendDir = path.join(worktree, 'apps', 'backend');
  sh('npm install --no-audit --no-fund', worktree);
  sh('npx prisma generate', backendDir);
  sh(fs.existsSync(path.join(backendDir, 'prisma', 'migrations')) ? 'npx prisma migrate deploy' : 'npx prisma db push', backendDir);
  sh('npm -w apps/backend run db:roles', worktree);
  if (fs.existsSync(path.join(backendDir, 'prisma', 'seed', 'main.ts'))) sh('npx prisma db seed', backendDir);
  // The turbo cache is keyed by content and declared env, and each worktree has its own: never --force.
  sh('npm run build', worktree);

  console.log(`
worktree ready: ${worktree}
  branch     ${branch} (from ${from})
  database   ${dbName}
  backend    http://localhost:${ports.backend}
  frontend   http://localhost:${ports.frontend}

Start the dev servers from ${worktree}, one terminal each (same in bash and PowerShell; turbo's strict env
would drop a PORT set in front of \`npm run dev\`):
  npm -w apps/backend run start:dev                  (port ${ports.backend}, read from apps/backend/.env)
  npm -w apps/frontend run dev -- -p ${ports.frontend}        (Next reads its port from the process, not .env)
For a Playwright run against this tree:
  PLAYWRIGHT_BASE_URL=http://localhost:${ports.frontend}
Done with it: npm run worktree -- down ${slug}`);
}

async function down() {
  if (args.length > 0) usage();
  const registered = isRegisteredWorktree();
  await withOwner(async (client) => {
    if (!(await databaseExists(client))) {
      console.log(`database ${dbName}: not there`);
      return;
    }
    if (!registered) {
      fail(`database ${dbName} exists but ${worktree} is not a git worktree; nothing proves "up ${slug}" created it, so it is kept. Drop it by hand if it is yours`);
    }
    await client.query(`DROP DATABASE ${client.escapeIdentifier(dbName)} WITH (FORCE)`);
    console.log(`database ${dbName}: dropped`);
  });
  if (fs.existsSync(worktree)) {
    sh(['git', 'worktree', 'remove', '--force', worktree]);
    // On Windows git leaves the empty folder tree of node_modules behind, and exits 0.
    if (fs.existsSync(worktree)) fs.rmSync(worktree, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } else {
    console.log(`worktree ${worktree}: already gone`);
  }
  sh(['git', 'worktree', 'prune']);
  releaseOffset();
}

(command === 'up' ? up() : down()).catch((error) => fail(error.message));
