#!/usr/bin/env node
// Smoke do bootstrap: roda as skills de monólito a partir do repo do plugin
// (como o plugin instalado faz), num projeto temporário. Sai 1 no primeiro
// passo que falhar, mostrando as últimas 30 linhas da saída.
// SMOKE_KEEP=1 preserva o projeto gerado para inspeção.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = path.join(plugin, 'skills', 'monolith');
const scope = '@smoke';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spectree-smoke-'));
const logFile = path.join(root, 'smoke.log');
const backendDir = path.join(root, 'apps', 'backend');
// portas livres por rodada: o smoke não pode colidir com o Postgres/API de outro projeto nem com outro smoke na máquina
const freePort = () =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
const dbPort = await freePort();
const apiPort = await freePort();
const webPort = await freePort();
// compose project per run: `apps/backend` alone would name the network/volume `backend_*` in every run
const dbCompose = `docker compose -p ${path.basename(root).toLowerCase()}-db`;

// the smoke measures whatever else this machine is doing: the busy-machine refusal of perf is proved on purpose below
process.env.PERF_MAX_CPU = '100';

console.log(`project: ${root}`);

// A step that must fail: exit code not 0 and the output naming why; the smoke goes on.
function refuse(name, command, pattern, { cwd = root } = {}) {
  const t0 = Date.now();
  const res = spawnSync(command, { cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  fs.appendFileSync(logFile, `\n===== [${name}] ${command}\n${out}`);
  const ok = (res.status ?? 0) !== 0 && pattern.test(out);
  console.log(`[STEP] ${name} → ${ok ? 'refused as expected' : `NOT refused (exit ${res.status})`} (${Math.round((Date.now() - t0) / 1000)}s)`);
  if (!ok) {
    console.log(out.trimEnd().split(/\r?\n/).slice(-12).join('\n'));
    console.log(`\nfull log: ${path.join(root, 'smoke.log')}`);
    process.exit(1);
  }
  return out;
}

function run(name, command, { cwd = root } = {}) {
  const t0 = Date.now();
  // one command string + shell: npm/npx are .cmd shims on Windows (and DEP0190 forbids args + shell)
  const res = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
  });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  fs.appendFileSync(logFile, `\n===== [${name}] ${command}\n${out}`);
  const code = res.status ?? 1;
  console.log(`[STEP] ${name} → exit ${code} (${Math.round((Date.now() - t0) / 1000)}s)`);
  if (code !== 0) {
    console.log(out.trimEnd().split(/\r?\n/).slice(-30).join('\n'));
    console.log(`\nfull log: ${path.join(root, 'smoke.log')}`);
    process.exit(1);
  }
  return out;
}

async function step(name, fn) {
  try {
    await fn();
    console.log(`[STEP] ${name} → exit 0`);
  } catch (error) {
    console.log(`[STEP] ${name} → exit 1`);
    console.log(error.stack ?? String(error));
    console.log(`\nfull log: ${path.join(root, 'smoke.log')}`);
    process.exit(1);
  }
}

const node = (rel, args = '') => `node "${path.join(skills, rel)}" ${args}`.trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

run('project-init', node('config-project/scripts/project-init.mjs', `--scope ${scope} --backend-port ${apiPort} --skip-global-nest`));

await step('shared-package', () => {
  const dest = path.join(root, 'packages', 'shared');
  fs.cpSync(path.join(plugin, 'templates', 'shared'), dest, { recursive: true });
  const pkgPath = path.join(dest, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = `${scope}/shared`;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  for (const app of ['apps/backend', 'apps/frontend']) {
    const appPkgPath = path.join(root, app, 'package.json');
    const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
    appPkg.dependencies = { ...appPkg.dependencies, [`${scope}/shared`]: '*' };
    fs.writeFileSync(appPkgPath, `${JSON.stringify(appPkg, null, 2)}\n`);
  }
  for (const env of ['.env', '.env.example']) {
    const envPath = path.join(backendDir, env);
    fs.writeFileSync(envPath, fs.readFileSync(envPath, 'utf8').replace('localhost:5432', `localhost:${dbPort}`));
  }
});
run('npm-install-shared', 'npm install --no-audit --no-fund');

run('config-prisma', node('config-prisma/scripts/init-prisma-backend.js', '--apply --install'));
run('config-shared-backend', node('config-shared-backend/scripts/apply.js'));
run('prisma-generate', 'npm --workspace apps/backend run prisma:generate');
run('config-shared-frontend', node('config-shared-frontend/scripts/apply.mjs'));
run('create-module', node('config-new-module/scripts/create-module.mjs', 'probe'));
run('create-aggregate', node('module-aggregate/scripts/create-aggregate.js', '--module probe --aggregate thing --mode crud'));

await step('check-boundaries-catches-a-leak', () => {
  const leak = path.join(root, 'modules', 'probe', 'src', 'leak.ts');
  fs.writeFileSync(leak, "import { Module } from '@nestjs/common';\nexport const leak = Module;\n");
  const res = spawnSync('node scripts/check-boundaries.mjs', { cwd: root, shell: true, encoding: 'utf8' });
  fs.rmSync(leak);
  fs.appendFileSync(logFile, `\n===== [check-boundaries-catches-a-leak]\n${res.stdout}${res.stderr}`);
  if (res.status === 0 || !res.stderr.includes('@nestjs/common')) {
    throw new Error(`expected exit 1 naming @nestjs/common, got exit ${res.status}\n${res.stdout}${res.stderr}`);
  }
});

// sem migration: o `npm test` do Nest é só unitário (e2e fica em test:e2e, que exige Postgres e não roda aqui)
run('build', 'npm run build');
run('test', 'npm test');
// mutation testing of the probe module: Stryker runs its Vitest suite against each mutant and reports a score
console.log(run('mutation', 'npm run mutation -- probe').trim().split(/\r?\n/).slice(-6).join('\n'));

// prova do schema do .env: um JWT_SECRET curto derruba o processo antes de qualquer conexão, nomeando a variável
await step('backend-refuses-bad-env', () => {
  const res = spawnSync('node dist/main.js', {
    cwd: backendDir,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, JWT_SECRET: 'short' },
  });
  const out = `${res.stdout}${res.stderr}`;
  fs.appendFileSync(logFile, `\n===== [backend-refuses-bad-env]\n${out}`);
  if (res.status === 0 || !out.includes('Invalid environment') || !out.includes('JWT_SECRET')) {
    throw new Error(`expected a non-zero exit naming JWT_SECRET, got exit ${res.status}\n${out}`);
  }
});

async function expectStatus(url, status) {
  const response = await fetch(url);
  if (response.status !== status) throw new Error(`${url}: expected ${status}, got ${response.status} ${await response.text()}`);
  return response;
}

// prova de segurança: sem token, GET / responde 401 pelo guard global, no envelope do ApiExceptionFilter.
// Precisa do Postgres (PrismaService faz SELECT 1 ao subir); sem Docker, o passo é pulado e dito.
if (spawnSync('docker info', { shell: true, stdio: 'ignore' }).status === 0) {
  run('db-up', `${dbCompose} up -d --wait postgres`, { cwd: backendDir });
  // the e2e needs tables: db push creates the bootstrap model without the interactive migrate dev
  run('db-push', 'npx prisma db push', { cwd: backendDir });
  // runtime role: from here the app connects as app_runtime (DATABASE_URL); db push and db execute stay on the owner
  run('db-roles', 'npm --workspace apps/backend run db:roles');
  // generated e2e as is: GET / is 401, GET /probe is 401 without token and within the query budget with one
  run('test-e2e', 'npm --workspace apps/backend run test:e2e');

  // an isolated worktree for a goal's owner from one command: branch, env, ports, own database, install, generate, migrate, roles, build; then gone
  // the smoke's own files stay out of the repo, or every later diff would name them
  fs.appendFileSync(path.join(root, '.gitignore'), ['', 'smoke.log', 'seed-rows.sql', ''].join(String.fromCharCode(10)));
  run('git-init', 'git init -q && git add -A && git -c user.name=smoke -c user.email=smoke@example.com commit -qm "feat: bootstrap"');
  // the scanners the generated ci.yml runs, by the same docker images: a fresh scaffold has no secret in its
  // history (exit 0), and the lockfile scan reads the packages (0 or 1: a known vulnerability in today's latest is not ours)
  // the same pinned image as the generated ci.yml; a scan of 0 commits is the Windows false pass, not a clean repo
  const scanned = run('gitleaks', `docker run --rm -v "${root}:/repo" ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f git --redact --no-banner /repo`);
  await step('gitleaks-scanned-history', () => {
    const commits = Number(scanned.match(/(\d+) commits? scanned/)?.[1] ?? 0);
    if (commits < 1) throw new Error(`gitleaks scanned ${commits} commits: the mount is empty (Windows false pass)`);
  });
  await step('osv-scanner', () => {
    const res = spawnSync(`docker run --rm -v "${root}:/repo" ghcr.io/google/osv-scanner:v2.7.0@sha256:4f3b7e2c64b9d38a5febc5a7e4a3dfef1d1362f726dea7a2ef4762b46469fcd0 --lockfile=/repo/package-lock.json`, { cwd: root, shell: true, encoding: 'utf8' });
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    fs.appendFileSync(logFile, `\n===== [osv-scanner]\n${out}`);
    if (![0, 1].includes(res.status) || !/found \d+ packages/.test(out)) throw new Error(`osv-scanner exit ${res.status}: ${out.trim().split(/\r?\n/).slice(-3).join(' | ')}`);
  });
  // The generated CI: one workflow, one job, never on push; every npm script it names exists; `cp .env.example .env`
  // gives the backend the env it runs with here; and actionlint (with shellcheck) accepts the file.
  await step('ci-workflow-shape', () => {
    const workflows = fs.readdirSync(path.join(root, '.github', 'workflows'));
    if (workflows.join() !== 'ci.yml') throw new Error(`expected ci.yml alone, got ${workflows.join(', ')}`);
    const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    const live = ci.split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join(String.fromCharCode(10));
    const jobs = live.slice(live.indexOf('jobs:')).match(/^  [a-z][\w-]*:$/gm) ?? [];
    if (jobs.length !== 1) throw new Error(`expected one job, got ${jobs.join(' ')}`);
    if (/^\s+push:/m.test(live) || /matrix:/.test(live) || /pull_request_target/.test(live)) throw new Error('ci.yml has a push trigger, a matrix or pull_request_target');
    const timeout = Number(live.match(/timeout-minutes: (\d+)/)?.[1]);
    if (!(timeout > 0 && timeout <= 20)) throw new Error(`timeout-minutes is ${timeout}`);
    const rootScripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
    const backendScripts = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8')).scripts;
    const steps = live.slice(live.indexOf('steps:'));
    // a step's working-directory decides whose scripts `npm run` reads
    for (const block of steps.split(/^      - /m).slice(1)) {
      const inBackend = /working-directory: apps\/backend/.test(block);
      for (const [, workspace, script] of block.matchAll(/npm (-w apps\/backend )?run ([\w:-]+)/g)) {
        const scripts = workspace || inBackend ? backendScripts : rootScripts;
        if (!scripts[script]) throw new Error(`ci.yml runs "${script}", which ${workspace || inBackend ? 'apps/backend' : 'the root'} package.json does not have`);
      }
    }
    const example = fs.readFileSync(path.join(backendDir, '.env.example'), 'utf8').split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => line.split('=')[0]);
    const used = fs.readFileSync(path.join(backendDir, '.env'), 'utf8').split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line)).map((line) => line.split('=')[0]);
    const missing = used.filter((key) => !example.includes(key));
    if (missing.length > 0) throw new Error(`apps/backend/.env.example lacks ${missing.join(', ')}: CI copies it to .env`);
  });
  run('ci-workflow-actionlint', `docker run --rm -v "${root}:/repo" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 -color`);
  // the pull-request-only gates, locally: a clean branch passes; a secret in a commit, a bad title and a base that
  // moved are each refused, by name
  await step('check-pr', () => {
    const base = run('check-pr-base', 'git rev-parse HEAD').trim();
    const commit = 'git -c user.name=smoke -c user.email=smoke@example.com commit -qm';
    run('check-pr-branch', `git checkout -q -b feat/check-pr && ${commit} "feat: nothing" --allow-empty`);
    const clean = run('check-pr-clean', `npm run check:pr -- --base ${base} --title "feat(probe): a thing"`);
    if (!/ok\s+gitleaks/.test(clean) || !/ok\s+squawk/.test(clean) || !/ok\s+title/.test(clean) || !/ok\s+up to date/.test(clean)) throw new Error(`check:pr did not report its checks:${clean.slice(-400)}`);
    refuse('check-pr-bad-title', `npm run check:pr -- --base ${base} --title "added a thing"`, /FAIL\s+title/);
    // a token-shaped value, assembled here so this file never holds one
    fs.writeFileSync(path.join(root, 'leak.txt'), `aws_secret_access_key = ${['wJalrXUtnFEMI', 'K7MDENG', 'bPxRfiCYzEXAMPLEKEY'].join('/')}${String.fromCharCode(10)}github_token = ghp_${'a1B2c3D4e5F6g7H8i9J0'.repeat(2).slice(0, 36)}${String.fromCharCode(10)}`);
    run('check-pr-leak-commit', `git add leak.txt && ${commit} "feat: leak"`);
    refuse('check-pr-secret', `npm run check:pr -- --base ${base}`, /FAIL\s+gitleaks/);
    run('check-pr-drop-branch', 'git checkout -q - && git branch -q -D feat/check-pr');
    // main moved: a branch cut from the previous tip is behind
    run('check-pr-main-moves', `git checkout -q -b feat/behind && git checkout -q - && ${commit} "chore: main moves" --allow-empty`);
    const tip = run('check-pr-tip', 'git rev-parse HEAD').trim();
    run('check-pr-on-behind', 'git checkout -q feat/behind');
    refuse('check-pr-behind', `npm run check:pr -- --base ${tip}`, /FAIL\s+up to date with the base/);
    run('check-pr-restore', 'git checkout -q - && git branch -q -D feat/behind');
  });
  // The goal contract by script: its shape, its proofs (in UTC, as CI), the verdicts a pull request needs, an
  // amendment for a waived criterion, and the size budget. check:pr refuses the branch until the contract is ready.
  await step('goal-contract', () => {
    const NL = String.fromCharCode(10);
    const base = run('goal-base', 'git rev-parse HEAD').trim();
    const commit = 'git add -A && git -c user.name=smoke -c user.email=smoke@example.com commit -qm';
    const contract = path.join(root, 'docs', 'goals', 'probe-thing.md');
    const write = ({ evidence = [], amendments = [], size = 2000 } = {}) => {
      fs.mkdirSync(path.dirname(contract), { recursive: true });
      fs.writeFileSync(contract, [
        '# Goal: probe-thing', '', 'Status: approved by founder on 2026-11-11', 'Type: feat', '',
        '## Objective', '', 'A user sees their things.', '',
        '## Context', '', '### What exists today', '', '- The probe module lists things.', '',
        '## Success criteria', '',
        '| # | Criterion | Proof |', '|---|-----------|-------|',
        '| 1 | The boundaries hold: a module imports `core | shared` and nothing else. | run: `node scripts/check-boundaries.mjs` exits 0. |',
        '| 2 | The proof runs in UTC, as CI does. | run: `node scripts/tz-probe.mjs` exits 0 only in UTC. |',
        '| 3 | The list matches the approved artboard `things/list`. | A screenshot beside the artboard. |', '',
        '## Limits', '', '- Out of scope: editing.', '',
        '## Budget', '', 'Verification rounds: 3.', `Size: ${size} changed lines.`, '',
        '## Evidence', '',
        '| # | Round | Verdict | Command run by the verifier and its exit code |', '|---|-------|---------|-----------------------------------------------|',
        ...evidence, '',
        '## Amendments', '', '| Date | # | Change | Decided by | Follow-up |', '|------|---|--------|------------|-----------|',
        ...amendments, '',
      ].join(NL));
    };
    run('goal-branch', 'git checkout -q -b feat/probe-thing');
    fs.writeFileSync(path.join(root, 'scripts', 'tz-probe.mjs'), `process.exit(process.env.TZ === 'UTC' ? 0 : 1);${NL}`);
    write();
    run('goal-check', 'npm run goal -- check probe-thing');
    const proved = run('goal-prove', 'npm run goal -- prove probe-thing');
    if (!/exit 0\s+criterion 1/.test(proved) || !/exit 0\s+criterion 2/.test(proved) || !/manual\s+criterion 3/.test(proved)) throw new Error(`goal prove did not report each criterion:${proved.slice(-500)}`);
    run('goal-commit', `${commit} "feat(probe): contract"`);
    // no verdict yet: the branch cannot become a pull request
    refuse('goal-not-ready', `npm run check:pr -- --base ${base}`, /FAIL\s+goal contract/);
    write({ evidence: ['| 1 | 1 | met | `npm run goal -- prove probe-thing` exit 0 |', '| 2 | 1 | met | same |', '| 3 | 1 | met, narrowed | founder |'] });
    refuse('goal-verdict-with-a-caveat', 'npm run goal -- check probe-thing', /is not one of met, not met, weak proof, waived/);
    write({ evidence: ['| 1 | 1 | met | `npm run goal -- prove probe-thing` exit 0 |', '| 2 | 1 | met | same |', '| 3 | 1 | waived | founder |'] });
    refuse('goal-waived-without-amendment', 'npm run goal -- check probe-thing', /waived with no row/);
    const amended = { evidence: ['| 1 | 1 | met | `npm run goal -- prove probe-thing` exit 0 |', '| 2 | 1 | not met | exit 1 |', '| 2 | 2 | met | exit 0 |', '| 3 | 2 | waived | founder |'], amendments: ['| 2026-11-11 | 3 | waived: the list ships without the artboard check | founder | `probe-thing-visual` in the roadmap |'] };
    write(amended);
    run('goal-ready', 'npm run goal -- check --ready probe-thing');
    run('goal-commit-ready', `${commit} "docs(probe): evidence"`);
    const ready = run('goal-check-pr-ready', `npm run check:pr -- --base ${base}`);
    if (!/ok\s+goal contract/.test(ready)) throw new Error(`check:pr did not check the goal contract:${ready.slice(-400)}`);
    // the budget counts product code: the branch added one line of it (scripts/tz-probe.mjs) and forty of contract
    write({ ...amended, size: 1 });
    const sized = run('goal-size-counts-product-code', `npm run goal -- size probe-thing --base ${base}`);
    if (!/product code\s+1 changed lines in 1 files/.test(sized) || !/documents [1-9]/.test(sized)) throw new Error(`goal size did not leave the contract out of the count:${sized.slice(-300)}`);
    write({ ...amended, size: 0 });
    refuse('goal-over-size', `npm run goal -- size probe-thing --base ${base}`, /OVER THE SIZE BUDGET/);
    run('goal-restore', 'git checkout -q -- . && git checkout -q - && git branch -q -D feat/probe-thing');
  });
  // A throwaway database for one command: the command sees it under both URLs, as the runtime role; it is dropped
  // whatever the exit code; a name in use is never reused; the backend e2e passes on one.
  await step('db-scratch', () => {
    const NL = String.fromCharCode(10);
    const probe = path.join(root, 'db-probe.mjs');
    fs.writeFileSync(probe, [
      "import { createRequire } from 'node:module';",
      "import path from 'node:path';",
      "const { Client } = createRequire(path.join(process.cwd(), 'apps', 'backend', 'package.json'))('pg');",
      'const client = new Client({ connectionString: process.env.DATABASE_URL });',
      'await client.connect();',
      "const { rows } = await client.query('select current_database() as db, current_user as role');",
      'await client.end();',
      'console.log(`${rows[0].db} ${rows[0].role} ${process.env.DB_SCRATCH}`);',
      "process.exit(process.argv[2] === 'fail' ? 7 : 0);",
      '',
    ].join(NL));
    try {
      const seen = run('db-scratch-probe', 'npm run db:scratch -- probe -- node db-probe.mjs');
      if (!/_scratch_probe app_runtime \S+_scratch_probe/.test(seen)) throw new Error(`the command did not see the scratch database as the runtime role:${seen.slice(-400)}`);
      if (!/not there/.test(run('db-scratch-dropped', 'npm run db:scratch -- probe --drop'))) throw new Error('the scratch database outlived its command');
      refuse('db-scratch-exit-code', 'npm run db:scratch -- fails -- node db-probe.mjs fail', /_scratch_fails: dropped/);
      run('db-scratch-keep', 'npm run db:scratch -- kept --keep -- node db-probe.mjs');
      refuse('db-scratch-name-taken', 'npm run db:scratch -- kept -- node db-probe.mjs', /already exists/);
      run('db-scratch-drop-kept', 'npm run db:scratch -- kept --drop');
      refuse('db-scratch-long-name', `npm run db:scratch -- ${'a'.repeat(70)} -- node db-probe.mjs`, /too long/);
      run('db-scratch-e2e', 'npm run db:scratch -- e2e -- npm --workspace apps/backend run test:e2e');
    } finally {
      fs.rmSync(probe, { force: true });
    }
  });
  // no offset given: the first worktree takes +100 by itself
  run('worktree-up', 'npm run worktree -- up t1');
  await step('worktree-ready', () => {
    const tree = path.join(path.dirname(root), `${path.basename(root)}-t1`);
    const env = (rel) => fs.readFileSync(path.join(tree, rel), 'utf8');
    if (!new RegExp(`^PORT=${apiPort + 100}$`, 'm').test(env('apps/backend/.env'))) throw new Error('backend PORT not moved by the offset');
    if (!env('apps/frontend/.env').includes(`localhost:${apiPort + 100}`)) throw new Error('frontend API URL not pointed at the worktree backend');
    if (!/_t1\?/.test(env('apps/backend/.env'))) throw new Error('database URLs not pointed at <db>_t1');
    if (!fs.existsSync(path.join(tree, 'apps', 'backend', 'dist'))) throw new Error('worktree not built');
  });
  // the offset is reserved, not just read: a second tree cannot be given the same ports while this one lives
  refuse('worktree-up-taken-offset', 'npm run worktree -- up t9 100', /offset 100 is taken/);
  run('worktree-down', 'npm run worktree -- down t1');
  await step('worktree-gone', () => {
    if (fs.existsSync(path.join(path.dirname(root), `${path.basename(root)}-t1`))) throw new Error('worktree folder still there');
    const reservations = path.join(root, '.git', 'spectree-worktree-offsets');
    if (fs.existsSync(reservations) && fs.readdirSync(reservations).length > 0) throw new Error(`offset reservation left behind: ${fs.readdirSync(reservations).join(', ')}`);
  });
  // the refusals: a database nobody's `up` created is never reused nor dropped; a long slug, a bad ref and a bare flag stop before anything
  await step('worktree-refusals', async () => {
    const { Client } = createRequire(path.join(backendDir, 'package.json'))('pg');
    const owner = fs.readFileSync(path.join(backendDir, '.env'), 'utf8').match(/^MIGRATION_DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)[1];
    const dbName = `${new URL(owner).pathname.slice(1)}_t2`;
    const sql = async (text) => { const c = new Client({ connectionString: owner }); await c.connect(); try { await c.query(text); } finally { await c.end(); } };
    await sql(`CREATE DATABASE "${dbName}"`);
    try {
      refuse('worktree-up-existing-db', 'npm run worktree -- up t2', /already exists but .* does not/);
      refuse('worktree-down-unregistered', 'npm run worktree -- down t2', /is not a git worktree; .* kept/);
      const c = new Client({ connectionString: owner }); await c.connect();
      const kept = (await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])).rowCount === 1;
      await c.end();
      if (!kept) throw new Error(`${dbName} was dropped by a down that owned no worktree`);
    } finally {
      await sql(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    }
    refuse('worktree-up-long-slug', `npm run worktree -- up ${'a'.repeat(70)}`, /too long/);
    refuse('worktree-up-bad-from', 'npm run worktree -- up t3 --from nope', /is not a commit/);
    refuse('worktree-up-bare-flag', 'npm run worktree -- up t3 --branch', /needs a value/);
  });

  // capacity is a test (architecture rule 11): plant an N+1 in the example adapter, the budget test must fail naming it
  await step('query-budget-catches-n-plus-1', () => {
    const moduleDir = path.join(backendDir, 'src', 'modules', 'probe');
    const adapter = path.join(moduleDir, 'probe.prisma.ts');
    const controller = path.join(moduleDir, 'probe.controller.ts');
    const originals = [adapter, controller].map((file) => [file, fs.readFileSync(file, 'utf8')]);
    fs.writeFileSync(path.join(root, 'seed-rows.sql'), 'INSERT INTO "PrismaBootstrap" ("id", "updatedAt") SELECT gen_random_uuid(), now() FROM generate_series(1, 5);\n');
    run('seed-rows', 'npx prisma db execute --file ../../seed-rows.sql', { cwd: backendDir });
    fs.writeFileSync(adapter, `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service.js';

@Injectable()
export class ProbePrisma {
  constructor(private readonly prisma: PrismaService) {}

  // planted N+1: one query for the list, then one per row (sequential: Prisma batches concurrent findUnique into one IN)
  async list() {
    const rows = await this.prisma.client.prismaBootstrap.findMany();
    const hydrated = [];
    for (const row of rows) hydrated.push(await this.prisma.client.prismaBootstrap.findUnique({ where: { id: row.id } }));
    return hydrated;
  }
}
`);
    fs.writeFileSync(controller, `import { Controller, Get } from '@nestjs/common';
import { ProbePrisma } from './probe.prisma.js';

@Controller('probe')
export class ProbeController {
  constructor(private readonly probe: ProbePrisma) {}

  @Get()
  list() {
    return this.probe.list();
  }
}
`);
    const res = spawnSync('npm --workspace apps/backend run test:e2e', { cwd: root, shell: true, encoding: 'utf8', env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
    for (const [file, content] of originals) fs.writeFileSync(file, content);
    const out = `${res.stdout}${res.stderr}`;
    fs.appendFileSync(logFile, `\n===== [query-budget-catches-n-plus-1]\n${out}`);
    if (res.status === 0 || !/query budget is 2, got 6/.test(out)) {
      throw new Error(`expected test:e2e to fail with "query budget is 2, got 6", got exit ${res.status}\n${out.trimEnd().split(/\r?\n/).slice(-40).join('\n')}`);
    }
  });

  await step('api-401-without-token', async () => {
    const api = spawn('node', ['dist/main.js'], { cwd: backendDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    api.stdout.on('data', (chunk) => (output += chunk));
    api.stderr.on('data', (chunk) => (output += chunk));
    try {
      const deadline = Date.now() + 60_000;
      let response = null;
      while (!response && Date.now() < deadline) {
        if (api.exitCode !== null) throw new Error(`backend exited with ${api.exitCode}\n${output}`);
        await sleep(500);
        response = await fetch(`http://localhost:${apiPort}/`).catch(() => null);
      }
      if (!response) throw new Error(`backend did not answer on :${apiPort} in 60s\n${output}`);
      const body = await response.json();
      if (response.status !== 401 || body.statusCode !== 401) {
        throw new Error(`expected 401 envelope, got ${response.status} ${JSON.stringify(body)}\n${output}`);
      }
    } finally {
      api.kill();
      fs.appendFileSync(logFile, `\n===== [api-401-without-token]\n${output}`);
    }
  });
  // p95 budget per route (architecture rule 11): perf.mjs boots dist/main.js itself and fails over budget or on any non-2xx
  console.log(run('perf', 'npm run perf').trim().split(/\r?\n/).slice(-12).join('\n'));
  // a busy machine is refused before anything starts: exit 3, nothing measured
  process.env.PERF_MAX_CPU = '-1';
  refuse('perf-busy-machine', 'npm run perf', /Nothing was measured/);
  process.env.PERF_MAX_CPU = '100';
  // perf proportional to the diff: a change inside modules/probe measures /probe alone; no change measures nothing
  await step('perf-changed', () => {
    const none = run('perf-changed-none', 'npm run perf -- --changed HEAD');
    if (!/perf: 0 of \d+ routes selected \(no backend change found\)/.test(none)) throw new Error(`expected no route with a clean tree, got: ${none.trim().split(/\r?\n/).slice(-3).join(' | ')}`);
    // the ref is user input: a shell in it never runs, an option-shaped ref never reaches git
    refuse('perf-changed-injection', 'npm run perf -- --changed "HEAD & echo modules/x/y"', /is not a commit/);
    refuse('perf-changed-option-ref', 'npm run perf -- --changed --output=x', /is not a commit/);
    // a backend file outside any module runs every route; a backend test file alone runs none
    fs.appendFileSync(path.join(backendDir, 'src', 'main.ts'), '\n// perf --changed main\n');
    try {
      const all = run('perf-changed-main', 'npm run perf -- --changed HEAD');
      if (!/perf: (\d+) of \1 routes selected \(apps\/backend\/src\/main\.ts is outside any module: every route\)/.test(all)) throw new Error(`expected every route for main.ts, got: ${all.trim().split(/\r?\n/).slice(-3).join(' | ')}`);
    } finally {
      run('perf-changed-restore-main', 'git checkout -- apps/backend/src/main.ts');
    }
    fs.writeFileSync(path.join(backendDir, 'test', 'perf-probe.txt'), 'only a test file\n');
    try {
      const tests = run('perf-changed-tests', 'npm run perf -- --changed HEAD');
      if (!/perf: 0 of \d+ routes selected \(0 routes: only backend tests changed\)/.test(tests)) throw new Error(`expected no route for a test file, got: ${tests.trim().split(/\r?\n/).slice(-3).join(' | ')}`);
    } finally {
      fs.rmSync(path.join(backendDir, 'test', 'perf-probe.txt'), { force: true });
    }
    const probeFile = fs.readdirSync(path.join(root, 'modules', 'probe', 'src')).map((f) => path.join(root, 'modules', 'probe', 'src', f)).find((f) => f.endsWith('.ts') && fs.statSync(f).isFile());
    fs.appendFileSync(probeFile, '\n// perf --changed probe\n');
    try {
      const some = run('perf-changed-probe', 'npm run perf -- --changed HEAD');
      if (!/perf: 1 of \d+ routes selected \(modules probe\)/.test(some)) throw new Error(`expected /probe alone, got: ${some.trim().split(/\r?\n/).slice(-3).join(' | ')}`);
      if (!/\/probe/.test(some) || !/OK/.test(some)) throw new Error('the /probe route was not measured');
    } finally {
      run('perf-changed-restore', 'git checkout -- modules/probe');
    }
  });
  run('db-down', `${dbCompose} down -v`, { cwd: backendDir });

  // a receita de release como o platform-engineer roda: .env da raiz, `npm run release` (builda as duas imagens,
  // `prisma migrate deploy` no serviço migrate, sobe e espera healthy), depois as sondas que a missão Release exige
  await step('release-env', () => {
    const env = [
      'POSTGRES_PASSWORD=smoke',
      'APP_DB_PASSWORD=smoke-app',
      `JWT_SECRET=${randomBytes(32).toString('hex')}`,
      `BACKEND_PORT=${apiPort}`,
      `FRONTEND_PORT=${webPort}`,
      `FRONTEND_URL=http://localhost:${webPort}`,
      `NEXT_PUBLIC_API_URL=http://localhost:${apiPort}`,
    ];
    fs.writeFileSync(path.join(root, '.env'), `${env.join('\n')}\n`);
  });
  try {
    run('release', 'npm run release');
    await step('release-probes', async () => {
      await expectStatus(`http://localhost:${apiPort}/health`, 200);
      await expectStatus(`http://localhost:${apiPort}/ready`, 200);
      const unauthorized = await expectStatus(`http://localhost:${apiPort}/`, 401);
      if (unauthorized.headers.get('x-request-id') === null) throw new Error('401 response carries no x-request-id');
      await expectStatus(`http://localhost:${webPort}/`, 200);
      // the log is JSON lines and the 401 above left one with its requestId
      const logs = spawnSync('docker compose -f docker-compose.prod.yml logs --no-log-prefix backend', { cwd: root, shell: true, encoding: 'utf8' }).stdout;
      fs.appendFileSync(logFile, `\n===== [release-probes] backend logs\n${logs}`);
      const lines = logs.split(/\r?\n/).filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } });
      if (lines.some((line) => line === null)) throw new Error(`backend wrote a non-JSON log line\n${logs}`);
      if (!lines.some((line) => line.requestId === unauthorized.headers.get('x-request-id') && line.res?.statusCode === 401)) {
        throw new Error(`no JSON log line with the requestId of the 401\n${logs}`);
      }
    });
  } finally {
    // images are named after the temp dir: remove them too, or every run leaves two behind
    spawnSync('docker compose -f docker-compose.prod.yml down -v --rmi all', { cwd: root, shell: true, stdio: 'ignore' });
  }
} else {
  console.log('[STEP] test-e2e, query-budget-catches-n-plus-1, api-401-without-token, perf, release → skipped (docker not available)');
}

if (process.env.SMOKE_KEEP) {
  console.log(`smoke OK (project kept at ${root})`);
} else {
  fs.rmSync(root, { recursive: true, force: true });
  console.log('smoke OK');
}
