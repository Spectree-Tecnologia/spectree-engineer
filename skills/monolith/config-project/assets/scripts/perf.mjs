#!/usr/bin/env node
// Latency budget, checked by script instead of by adjective: each route in perf.config.json gets
// `connections` concurrent clients for `durationSeconds`; its p95 must stay under `p95Ms` and
// every response must be 2xx. Exit 1 with one line per route over budget. CI runs it after `npm test`.
//   PERF_URL=http://host:port  measure a server that is already up; otherwise the script starts
//   apps/backend/dist/main.js (needs `npm run build`, a reachable DATABASE_URL and apps/backend/.env).
// Routes are `{ path, method?, body?, headers?, auth?, p95Ms }`. Authenticated happy paths need real claims:
// `"setup": "scripts/perf.setup.mjs"` names a module whose default export runs once the server is up —
// `async ({ env, baseUrl, signJwt }) => ({ claims?: { sub, sid, ... }, headers?: { ... } })` — seeding what it
// needs and returning the claims the token must carry (or complete headers). A 404/401 under perf is never a budget.
// `actors: [{ claims } | { headers }, ...]` gives each connection its own person (connection i is actor i mod n):
// twenty connections as one person measure that person's lock, twenty people measure the route.
// A create route sends the same body twice and gets the duplicate-key 409 from the second request on: in `path` and
// `body`, `{{uuid}}` is a new UUID per request (the same one everywhere in that request) and `{{n}}` a per-route
// counter, so `{ "name": "perf-{{uuid}}" }` measures the real create. `accept: [409]` lists the statuses besides 2xx
// that the route may answer under load without failing; use it only when the status is the expected answer.
//   PERF_MAX_CPU=<percent>     the machine load above which nothing is measured (default 50; 100 measures anyway),
//                              sampled before the run and again, with the server stopped, before a red: exit 3
// A route over budget whose responses were all fine is measured once more, after the others, and the second
// measurement decides: one spike on a shared machine is not a regression. A wrong status is never re-measured.
// A route over budget twice that the base already had is then measured on the BASE's code, on this machine, now:
// the budget says "too slow here", only the base says "this change made it slower". The base is the --changed ref.
// The script checks it out in a git worktree, runs `npm ci` and `baseBuild` (default `npm run build`) there, and
// measures the same routes twice on a database of their own (scripts/db-scratch.mjs, when the project has it).
//   slower than the base by more than `regressionRatio` (default 1.25, best p95 of each side)   exit 1
//   not slower                                         exit 0, one line per route (a warning on the pull request):
//                                                      the route has no slack on this machine, and this diff is not why
//   a new route, no --changed ref, or a base that cannot be built or measured: the budget alone decides, as before
//   PERF_BASE_URL=http://host:port  a base server that is already up, measured instead of building one
//   PERF_COMPARE=0                  never compare
//   --changed <ref>   only the routes the diff since <ref> can slow down (committed, working tree and untracked files).
//                     A file under modules/<m>/ or apps/backend/src/modules/<m>/ selects the routes that list <m>. Any
//                     other file of apps/backend runs every route (main.ts, db/, shared/, prisma/, nest-cli.json,
//                     tsconfig*, package.json...), except apps/backend/test/ and apps/backend/src/cli/, which no route
//                     runs. packages/shared, perf.config.json, scripts/perf.mjs, the root package files and turbo.json
//                     also run every route. A file a route uploads (route.multipart.file) selects that route before the
//                     test/ rule. A diff that selects nothing starts no server and exits 0, saying why. A route lists the
//                     modules whose code its request runs in `route.modules` (or one in `route.module`); without either,
//                     the module is its first path segment. The ref is user input: git runs without a shell, the ref is
//                     verified as a commit first, and a bad one is one line and exit 1.
// ponytail: fetch + workers instead of autocannon; good enough for a budget, swap when you need histograms
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'perf.config.json'), 'utf8'));
const backendDir = path.join(root, config.backendPath ?? 'apps/backend');
const env = { ...parseEnv(path.join(backendDir, '.env')), ...process.env };
const port = env.PORT ?? '4000';
const baseUrl = (process.env.PERF_URL ?? `http://localhost:${port}`).replace(/\/$/, '');
let token = signJwt(env.JWT_SECRET);
let authHeaders = null;
let actorHeaders = null; // one per person, when the setup names them

const changedAt = process.argv.indexOf('--changed');
const changedRef = changedAt > -1 ? process.argv[changedAt + 1] : null;
if (changedAt > -1 && !changedRef) {
  console.error('perf: --changed needs a git ref (origin/main, a sha)');
  process.exit(2);
}

// execFile, never a shell: the ref is user input. A git failure is one line and exit 1.
function git(args, failure) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split(/\r?\n/).filter(Boolean);
  } catch (error) {
    const reason = String(error.stderr || error.message).trim().split(/\r?\n/)[0];
    console.error(`perf: ${failure ?? `git ${args.join(' ')} failed${reason ? `: ${reason}` : ''}`}`);
    process.exit(1);
  }
}

const modulesOf = (route) => route.modules ?? (route.module ? [route.module] : [route.path.split('/')[1]]);

// What a route asks, without its budget: the same key in the base's config is the same route. Rows that ask the
// same thing twice are told apart by their order.
function keysOf(routes) {
  const seen = new Map();
  return routes.map((route) => {
    const what = JSON.stringify([route.method ?? 'GET', route.path, route.body ?? null, Boolean(route.auth), route.headers ?? null, route.multipart ?? null, route.accept ?? null]);
    const nth = seen.get(what) ?? 0;
    seen.set(what, nth + 1);
    return `${what}#${nth}`;
  });
}

// The base's run of this same script: only the routes the parent names, each measured twice, the result in a file.
const flag = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const matchFile = flag('--match');
const jsonFile = flag('--json');

let baseSha = null;
function routesChangedSince(ref) {
  const [sha] = git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`], `--changed ${JSON.stringify(ref)} is not a commit`);
  baseSha = sha;
  const files = new Set([
    ...git(['diff', '--name-only', '--end-of-options', `${sha}...HEAD`]),
    ...git(['diff', '--name-only', '--end-of-options', 'HEAD']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ]);
  const runsAll = /^(packages\/shared\/|apps\/backend\/|perf\.config\.json$|scripts\/perf\.mjs$|package\.json$|package-lock\.json$|turbo\.json$)/;
  const modules = new Set();
  const noRoute = new Set();
  const byFixture = new Map(); // a file a route uploads selects that route, even under apps/backend/test/
  for (const file of files) {
    const uploaders = config.routes.filter((r) => r.multipart?.file === file);
    if (uploaders.length > 0) {
      for (const r of uploaders) byFixture.set(r, `fixture ${file}`);
      continue;
    }
    const module = file.match(/^(?:modules|apps\/backend\/src\/modules)\/([^/]+)\//)?.[1];
    if (module) modules.add(module);
    else if (file.startsWith('apps/backend/src/cli/')) noRoute.add('CLI');
    else if (file.startsWith('apps/backend/test/')) noRoute.add('backend tests');
    else if (runsAll.test(file)) return { routes: config.routes, why: `${file} is outside any module: every route` };
  }
  const routes = config.routes.filter((route) => byFixture.has(route) || modulesOf(route).some((m) => modules.has(m)));
  const fixtures = [...new Set(byFixture.values())];
  if (modules.size > 0 || fixtures.length > 0) {
    const parts = [...(modules.size > 0 ? [`modules ${[...modules].join(', ')}`] : []), ...fixtures];
    return { routes, why: `${parts.join('; ')}${routes.length === 0 ? ': no route lists them' : ''}` };
  }
  if (noRoute.size > 0) return { routes, why: `0 routes: only ${[...noRoute].join(' and ')} changed` };
  return { routes, why: 'no backend change found' };
}

const configKeys = keysOf(config.routes);
const keyOf = (route) => configKeys[config.routes.indexOf(route)];
function routesNamedIn(file) {
  const wanted = new Set(JSON.parse(fs.readFileSync(file, 'utf8')));
  return { routes: config.routes.filter((route) => wanted.has(keyOf(route))), why: 'the routes the comparison asked for' };
}
const selected = matchFile ? routesNamedIn(matchFile) : changedRef ? routesChangedSince(changedRef) : { routes: config.routes, why: 'every route' };
console.log(`perf: ${selected.routes.length} of ${config.routes.length} routes selected (${selected.why})`);
if (changedRef) for (const r of selected.routes) console.log(`  ${r.method ?? 'GET'} ${r.path}`);
if (selected.routes.length === 0) process.exit(0);

// A latency taken while something else holds the CPU is not a number (a game, a sync client, another agent's build
// moved one route from 581 ms to 3140 ms between two runs). Sampled before the server starts; exit 3 says "not measured".
async function cpuBusy(ms = 1500) {
  const snapshot = () => os.cpus().reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    return { idle: acc.idle + cpu.times.idle, total: acc.total + total };
  }, { idle: 0, total: 0 });
  const before = snapshot();
  await new Promise((resolve) => setTimeout(resolve, ms));
  const after = snapshot();
  const total = after.total - before.total;
  return total <= 0 ? 0 : Math.round((1 - (after.idle - before.idle) / total) * 100);
}
const maxCpu = Number(process.env.PERF_MAX_CPU ?? 50);
if (Number.isFinite(maxCpu) && maxCpu < 100) {
  const busy = await cpuBusy();
  if (busy > maxCpu) {
    console.error(`perf: the machine is at ${busy}% CPU before anything started (limit ${maxCpu}%). Nothing was measured: a number taken now would not be a number. Stop what is running and try again, or let the pull request's CI run decide.`);
    process.exit(3);
  }
}

function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')];
      }),
  );
}

// HS256 by hand: the same token passport-jwt verifies, without importing the backend from a root script
function signJwt(secret, claims = {}) {
  if (!secret) return null;
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: '00000000-0000-4000-8000-000000000000',
    name: 'perf',
    email: 'perf@localhost',
    ...claims,
    iat: now,
    exp: now + 3600,
  })}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

async function waitFor(url, ms = 60_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) throw new Error(`backend exited with ${child.exitCode ?? child.signalCode}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null);
    if (res) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not answer in ${ms / 1000}s`);
}

async function measure(route) {
  const url = `${baseUrl}${route.path}`;
  if (route.auth && !token && !authHeaders) throw new Error(`${route.path} needs a token, but JWT_SECRET is not set`);
  const headers = { ...(route.auth ? (authHeaders ?? { authorization: `Bearer ${token}` }) : {}), ...(route.headers ?? {}) };
  if (route.body !== undefined) headers['content-type'] ??= 'application/json';
  const bodyTemplate = route.body === undefined ? undefined : JSON.stringify(route.body);
  const placeholder = /\{\{(uuid|n)\}\}/g;
  let n = 0;
  // one request's url and init: placeholders filled per request, the rest shared
  const request = (connection) => {
    const values = { uuid: randomUUID(), n: String(++n) };
    const fill = (text) => text.replace(placeholder, (_, key) => values[key]);
    const own = route.auth && actorHeaders ? { ...headers, ...actorHeaders[connection % actorHeaders.length], ...(route.headers ?? {}) } : headers;
    const init = { method: route.method ?? 'GET', headers: own };
    if (bodyTemplate !== undefined) init.body = fill(bodyTemplate);
    return [fill(url), init];
  };
  const accepted = new Set((route.accept ?? []).map(Number));
  const latencies = [];
  const statuses = {};
  const stop = Date.now() + (config.durationSeconds ?? 10) * 1000;
  await Promise.all(
    Array.from({ length: config.connections ?? 20 }, async (_, connection) => {
      while (Date.now() < stop) {
        const [target, init] = request(connection);
        const t0 = performance.now();
        // a stalled server is a status 0 after 30 s, never a measurement that waits forever
        const res = await fetch(target, { ...init, signal: AbortSignal.timeout(30_000) }).catch(() => ({ status: 0, arrayBuffer: async () => null }));
        await res.arrayBuffer().catch(() => null);
        latencies.push(performance.now() - t0);
        statuses[res.status] = (statuses[res.status] ?? 0) + 1;
      }
    }),
  );
  latencies.sort((a, b) => a - b);
  const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] ?? NaN;
  const non2xx = Object.entries(statuses).filter(([s]) => (s < 200 || s >= 300) && !accepted.has(Number(s)));
  return {
    path: route.path,
    requests: latencies.length,
    rps: Math.round(latencies.length / (config.durationSeconds ?? 10)),
    p50: pct(50),
    p95: pct(95),
    p99: pct(99),
    max: latencies.at(-1) ?? NaN,
    budget: route.p95Ms,
    non2xx: non2xx.map(([s, n]) => `${n}x ${s}`).join(' '),
    ok: pct(95) <= route.p95Ms && non2xx.length === 0 && latencies.length > 0,
    route,
  };
}

const regressionRatio = Number(config.regressionRatio ?? 1.25);
const stopChild = () =>
  new Promise((resolve) => {
    // a child killed by a signal keeps exitCode null: signalCode says it is gone too (issue 130: a second call waited forever)
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  });

// The same routes on the base's code, on this machine: `{ results: Map(key -> measurement) }`, or `{ why }` when
// there is nothing to compare with. Never throws: a base that cannot be measured leaves the budget to decide.
async function measureBase(routes) {
  if (!baseSha) return { why: 'no base ref: run with --changed <ref>' };
  let baseRoutes;
  try {
    baseRoutes = JSON.parse(execFileSync('git', ['show', `${baseSha}:perf.config.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).routes;
  } catch {
    return { why: 'the base has no perf.config.json' };
  }
  const inBase = new Set(keysOf(baseRoutes ?? []));
  const wanted = routes.map(keyOf).filter((key) => inBase.has(key));
  if (wanted.length === 0) return { why: 'the routes over budget are new in this change' };
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-base-'));
  const out = path.join(work, 'base.json');
  fs.writeFileSync(path.join(work, 'match.json'), JSON.stringify(wanted));
  const self = [fileURLToPath(import.meta.url), '--match', path.join(work, 'match.json'), '--json', out];
  const quiet = { PERF_MAX_CPU: '100', PERF_COMPARE: '0' };
  // the reason a run died: its first error line, else its last line that is not Node's crash banner ("Node.js v26.1.0")
  const lastLine = (r) => {
    const lines = String(r.stderr || r.stdout || r.error?.message || '').trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines.find((line) => /^(?:Uncaught )?[A-Z]?\w*Error\b(?: \[[A-Z_]+\])?:/.test(line)) ?? lines.filter((line) => !/^Node\.js v\d/.test(line)).at(-1) ?? `exit ${r.status}`;
  };
  const capture = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 };
  let checkout = null;
  try {
    if (process.env.PERF_BASE_URL) {
      const r = spawnSync(process.execPath, self, { ...capture, cwd: root, env: { ...process.env, ...quiet, PERF_URL: process.env.PERF_BASE_URL } });
      if (r.status !== 0) return { why: `the base at PERF_BASE_URL was not measured: ${lastLine(r)}` };
    } else {
      if (process.env.PERF_URL) return { why: 'PERF_URL names a server this script did not start: name the base server in PERF_BASE_URL' };
      console.log(`perf: ${wanted.length} of ${routes.length} route(s) over budget twice existed on the base: building ${baseSha.slice(0, 8)} to measure them on this machine`);
      await stopChild(); // the two servers want the same port
      checkout = path.join(work, 'base');
      const added = spawnSync('git', ['worktree', 'add', '--detach', checkout, baseSha], { ...capture, cwd: root });
      if (added.status !== 0) {
        checkout = null;
        return { why: `git worktree add failed: ${lastLine(added)}` };
      }
      const envFile = path.join(backendDir, '.env');
      if (fs.existsSync(envFile)) fs.copyFileSync(envFile, path.join(checkout, path.relative(root, backendDir), '.env'));
      for (const line of ['npm ci --no-audit --no-fund', config.baseBuild ?? 'npm run build']) {
        const r = spawnSync(line, { ...capture, cwd: checkout, shell: true });
        if (r.status !== 0) return { why: `"${line}" failed on the base: ${lastLine(r)}` };
      }
      // a database of the base's own: its migrations, its seed, nothing this change's run wrote
      const scratch = path.join(root, 'scripts', 'db-scratch.mjs');
      const args = fs.existsSync(scratch) ? [scratch, `perf-base-${process.pid}`, '--', process.execPath, ...self] : self;
      const r = spawnSync(process.execPath, args, { ...capture, cwd: checkout, env: { ...process.env, ...quiet } });
      if (r.status !== 0 || !fs.existsSync(out)) return { why: `the base was not measured: ${lastLine(r)}` };
    }
    return { results: new Map(JSON.parse(fs.readFileSync(out, 'utf8')).map((one) => [one.key, one])) };
  } finally {
    if (checkout) spawnSync('git', ['worktree', 'remove', '--force', checkout], { cwd: root, stdio: 'ignore' });
    fs.rmSync(work, { recursive: true, force: true });
    if (checkout) spawnSync('git', ['worktree', 'prune'], { cwd: root, stdio: 'ignore' });
  }
}

let child = null;
if (!process.env.PERF_URL) {
  // THROTTLE_LIMIT lifts the global rate limit (100/min) for the run; the budget is about the handler, not the throttler
  child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backendDir,
    env: { ...env, THROTTLE_LIMIT: '1000000', NODE_ENV: env.NODE_ENV ?? 'production' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

let failed = false;
try {
  await waitFor(`${baseUrl}${selected.routes[0]?.path ?? '/'}`);
  if (config.setup) {
    const { default: setup } = await import(new URL(config.setup, `file://${root}/`).href);
    const result = (await setup({ env, baseUrl, signJwt: (claims) => signJwt(env.JWT_SECRET, claims) })) ?? {};
    if (result.claims) token = signJwt(env.JWT_SECRET, result.claims);
    if (result.headers) authHeaders = result.headers;
    if (Array.isArray(result.actors) && result.actors.length > 0) {
      actorHeaders = result.actors.map((actor) => actor.headers ?? { authorization: `Bearer ${signJwt(env.JWT_SECRET, actor.claims)}` });
    }
  }
  const measured = [];
  for (const route of selected.routes) measured.push(await measure(route));
  const ms = (n) => `${n.toFixed(1)}ms`;
  if (matchFile) {
    // the base's side of a comparison: the better of two measurements per route, and no verdict of its own
    const out = [];
    for (const first of measured) {
      const second = await measure(first.route);
      const best = second.p95 < first.p95 ? second : first;
      out.push({ key: keyOf(first.route), path: best.path, requests: best.requests, rps: best.rps, p50: best.p50, p95: best.p95, p99: best.p99, max: best.max, non2xx: first.non2xx || second.non2xx });
    }
    fs.writeFileSync(jsonFile, JSON.stringify(out));
    child?.kill();
    process.exit(0);
  }
  // the second look at a route over budget with clean statuses, after every other route had its turn
  const rows = [];
  const twice = [];
  for (const first of measured) {
    if (first.ok || first.non2xx || first.requests === 0) {
      rows.push(first);
      continue;
    }
    rows.push({ ...first, label: `${first.path} (1st)`, verdict: 'RE-MEASURED', ok: true });
    const second = { ...(await measure(first.route)), label: `${first.path} (2nd)` };
    rows.push(second);
    if (!second.ok && !second.non2xx && second.requests > 0) twice.push({ row: second, best: Math.min(first.p95, second.p95) });
  }
  // over budget twice: was it this change? Only the base, on this machine, can say.
  const notes = [];
  if (twice.length > 0 && process.env.PERF_COMPARE !== '0') {
    const base = await measureBase(twice.map((one) => one.row.route));
    if (base.why) console.error(`perf: not compared with the base (${base.why}): the budget decides`);
    for (const { row, best } of twice) {
      const was = base.results?.get(keyOf(row.route));
      if (!was) continue;
      rows.splice(rows.indexOf(row) + 1, 0, { ...was, path: row.path, label: `${row.path} (base)`, budget: row.budget, verdict: 'BASE', ok: true });
      if (was.non2xx || was.requests === 0 || !Number.isFinite(was.p95)) {
        console.error(`perf: ${row.path} could not be measured on the base (${was.non2xx || 'no response'}): the budget decides`);
        continue;
      }
      const ratio = best / was.p95;
      if (ratio > regressionRatio) {
        row.verdict = 'SLOWER THAN BASE';
        row.why = `${ratio.toFixed(2)}x the base's ${ms(was.p95)} on this machine: this change made it slower`;
      } else {
        row.ok = true;
        if (was.p95 > row.budget) {
          row.verdict = 'OVER, AS THE BASE';
          notes.push(`${row.path} p95 ${ms(best)} > ${row.budget}ms, and the base measures ${ms(was.p95)} on this machine (${ratio.toFixed(2)}x): over budget here and on the base, not this change. The route has no slack here: a line for the roadmap, not a round.`);
        } else {
          // the base was within budget: this change took the route over it, by less than the regression ratio
          row.verdict = 'OVER, WITHIN RATIO';
          notes.push(`${row.path} p95 ${ms(best)} > ${row.budget}ms, within ${regressionRatio}x of the base's ${ms(was.p95)} on this machine (${ratio.toFixed(2)}x), which was within budget: this change took it over by less than the ratio. A line for the roadmap, not a round.`);
        }
      }
    }
  }
  console.table(
    rows.map((r) => ({
      route: r.label ?? r.path,
      requests: r.requests,
      'req/s': r.rps,
      p50: ms(r.p50),
      p95: ms(r.p95),
      p99: ms(r.p99),
      max: ms(r.max),
      'p95 budget': `${r.budget}ms`,
      'non-2xx': r.non2xx || '-',
      result: r.verdict ?? (r.ok ? 'OK' : 'OVER BUDGET'),
    })),
  );
  // the machine was quiet when the run started; another agent's build may have begun since. A red taken while it was
  // busy is "not measured", like a busy start (issue 87: twice exit 1 under two verifiers' builds, 32 of 32 OK quiet)
  if (rows.some((r) => !r.ok) && Number.isFinite(maxCpu) && maxCpu < 100) {
    child?.kill();
    const busy = await cpuBusy();
    if (busy > maxCpu) {
      console.error(`perf: a route is over budget, and the machine is at ${busy}% CPU with the server stopped (limit ${maxCpu}%): not measured. Stop what is running and try again, or let the pull request's CI run decide.`);
      process.exit(3);
    }
  }
  for (const r of rows.filter((r) => !r.ok)) {
    failed = true;
    console.error(`perf: ${r.path} p95 ${ms(r.p95)} > ${r.budget}ms${r.non2xx ? ` (${r.non2xx})` : ''}${r.why ? `, ${r.why}` : ''}`);
  }
  for (const note of notes) {
    console.error(`perf: ${note}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Latency budget::${note}`);
  }
} finally {
  child?.kill();
}
process.exit(failed ? 1 : 0);
