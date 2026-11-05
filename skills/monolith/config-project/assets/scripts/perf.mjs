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
//   --changed <ref>   only the routes of the modules the diff since <ref> touches (committed and working tree);
//                     a change outside a module and outside the frontend (shared, prisma, db, config) runs every route;
//                     a diff with no backend change measures nothing and exits 0. A route belongs to the module of
//                     its first path segment, or to `route.module` when the path says otherwise.
// ponytail: fetch + workers instead of autocannon; good enough for a budget, swap when you need histograms
import { execSync, spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'perf.config.json'), 'utf8'));
const backendDir = path.join(root, config.backendPath ?? 'apps/backend');
const env = { ...parseEnv(path.join(backendDir, '.env')), ...process.env };
const port = env.PORT ?? '4000';
const baseUrl = (process.env.PERF_URL ?? `http://localhost:${port}`).replace(/\/$/, '');
let token = signJwt(env.JWT_SECRET);
let authHeaders = null;

const changedAt = process.argv.indexOf('--changed');
const changedRef = changedAt > -1 ? process.argv[changedAt + 1] : null;
if (changedAt > -1 && !changedRef) {
  console.error('perf: --changed needs a git ref (origin/main, a sha)');
  process.exit(2);
}

// The routes the diff since `ref` can slow down: by module, or all of them.
function routesChangedSince(ref) {
  const git = (args) => execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  const files = new Set([...git(`diff --name-only ${ref}...HEAD`), ...git('diff --name-only HEAD')]);
  const modules = new Set();
  for (const file of files) {
    const module = file.match(/^(?:modules|apps\/backend\/src\/modules)\/([^/]+)\//)?.[1] ?? file.match(/^apps\/backend\/prisma\/models\/([^/]+)\.model\.prisma$/)?.[1];
    if (module) modules.add(module);
    else if (/^(apps\/frontend\/|docs\/|\.github\/|.*\.md$)/.test(file)) continue;
    else return { routes: config.routes, why: `${file} is outside any module: every route` };
  }
  const moduleOf = (route) => route.module ?? route.path.split('/')[1];
  const routes = config.routes.filter((route) => modules.has(moduleOf(route)));
  return { routes, why: modules.size === 0 ? 'no backend change' : `modules ${[...modules].join(', ')}` };
}

const selected = changedRef ? routesChangedSince(changedRef) : { routes: config.routes, why: 'every route' };
console.log(`perf: ${selected.routes.length} of ${config.routes.length} routes (${selected.why})`);
if (selected.routes.length === 0) process.exit(0);

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
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`backend exited with ${child.exitCode}`);
    const res = await fetch(url).catch(() => null);
    if (res) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} did not answer in ${ms / 1000}s`);
}

async function measure(route) {
  const url = `${baseUrl}${route.path}`;
  if (route.auth && !token && !authHeaders) throw new Error(`${route.path} needs a token, but JWT_SECRET is not set`);
  const headers = { ...(route.auth ? (authHeaders ?? { authorization: `Bearer ${token}` }) : {}), ...(route.headers ?? {}) };
  const init = { method: route.method ?? 'GET', headers };
  if (route.body !== undefined) {
    init.body = JSON.stringify(route.body);
    headers['content-type'] ??= 'application/json';
  }
  const latencies = [];
  const statuses = {};
  const stop = Date.now() + (config.durationSeconds ?? 10) * 1000;
  await Promise.all(
    Array.from({ length: config.connections ?? 20 }, async () => {
      while (Date.now() < stop) {
        const t0 = performance.now();
        const res = await fetch(url, init).catch(() => ({ status: 0, arrayBuffer: async () => null }));
        await res.arrayBuffer();
        latencies.push(performance.now() - t0);
        statuses[res.status] = (statuses[res.status] ?? 0) + 1;
      }
    }),
  );
  latencies.sort((a, b) => a - b);
  const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] ?? NaN;
  const non2xx = Object.entries(statuses).filter(([s]) => s < 200 || s >= 300);
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
  };
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
  }
  const rows = [];
  for (const route of selected.routes) rows.push(await measure(route));
  const ms = (n) => `${n.toFixed(1)}ms`;
  console.table(
    rows.map((r) => ({
      route: r.path,
      requests: r.requests,
      'req/s': r.rps,
      p50: ms(r.p50),
      p95: ms(r.p95),
      p99: ms(r.p99),
      max: ms(r.max),
      'p95 budget': `${r.budget}ms`,
      'non-2xx': r.non2xx || '-',
      result: r.ok ? 'OK' : 'OVER BUDGET',
    })),
  );
  for (const r of rows.filter((r) => !r.ok)) {
    failed = true;
    console.error(`perf: ${r.path} p95 ${ms(r.p95)} > ${r.budget}ms${r.non2xx ? ` (${r.non2xx})` : ''}`);
  }
} finally {
  child?.kill();
}
process.exit(failed ? 1 : 0);
