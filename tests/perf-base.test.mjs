// The latency budget asks the base before it blocks: a route over budget twice is measured on the base's code on the
// same machine, and only "slower than the base" fails. Measured on the pilot project on 2026-11-13: 4 of 4 red CI runs on the
// latency step were the runner or the harness, never the pull request's code. Run, not read:
//   node --test tests/perf-base.test.mjs
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const perf = path.join(plugin, 'skills', 'monolith', 'config-project', 'assets', 'scripts', 'perf.mjs');

// a server that answers every route after `delay(url)` ms and remembers who asked
async function server(t, delay) {
  const people = new Set();
  const one = http.createServer((req, res) => {
    people.add(req.headers.authorization ?? '');
    setTimeout(() => res.writeHead(200).end('ok'), delay(req.url));
  });
  await new Promise((resolve) => one.listen(0, '127.0.0.1', resolve));
  t.after(() => one.close());
  return { url: `http://127.0.0.1:${one.address().port}`, people };
}

// a project whose base commit holds `baseRoutes`, with `routes` in the working tree
function project(baseRoutes, routes, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spectree-perf-base-'));
  const git = (...args) => assert.equal(spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).status, 0, `git ${args.join(' ')}`);
  const write = (list) => fs.writeFileSync(path.join(dir, 'perf.config.json'), JSON.stringify({ connections: 4, durationSeconds: 1, ...extra, routes: list }));
  git('init', '-q');
  write(baseRoutes);
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base');
  write(routes);
  return dir;
}

function run(dir, env, args = ['--changed', 'HEAD']) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [perf, ...args], { cwd: dir, env: { ...process.env, PERF_MAX_CPU: '100', GITHUB_ACTIONS: '', ...env } });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));
    child.on('close', (code) => resolve({ code, out }));
  });
}

const slow = () => 120;
const fast = () => 5;
const route = (p95Ms) => [{ path: '/things', p95Ms }];

test('a route over budget twice that the base serves as slowly does not block: it is not this change', async (t) => {
  const head = await server(t, slow);
  const base = await server(t, slow);
  const dir = project(route(1000), route(40));
  const res = await run(dir, { PERF_URL: head.url, PERF_BASE_URL: base.url });
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /\/things \(1st\)[\s\S]*\/things \(2nd\)[\s\S]*\/things \(base\)/, 'both measurements and the base are printed');
  assert.match(res.out, /OVER, AS THE BASE/);
  assert.match(res.out, /perf: \/things p95 [\d.]+ms > 40ms, and the base measures [\d.]+ms on this machine \([\d.]+x\): over budget here and on the base, not this change/);
  assert.doesNotMatch(res.out, /::warning/, 'no annotation outside GitHub Actions');

  const annotated = await run(dir, { PERF_URL: head.url, PERF_BASE_URL: base.url, GITHUB_ACTIONS: 'true' });
  assert.equal(annotated.code, 0, annotated.out);
  assert.match(annotated.out, /::warning title=Latency budget::\/things p95/, 'on a pull request the run is green and says so in a warning');
});

test('a base within budget is not called over budget: this change took the route over, by less than the ratio', async (t) => {
  // 0.47.0 (issue 87): 64 ms on the base, budget 72, 79 here passed with "not this change", which was not true
  // 500 here and 420 on the base (1.19x) around a budget of 465: some 40 ms of margin each way for a loaded machine
  const head = await server(t, () => 500);
  const base = await server(t, () => 420);
  const res = await run(project(route(1000), route(465)), { PERF_URL: head.url, PERF_BASE_URL: base.url });
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /OVER, WITHIN RATIO/);
  assert.match(res.out, /within 1\.25x of the base's [\d.]+ms on this machine \([\d.]+x\), which was within budget: this change took it over/);
  assert.doesNotMatch(res.out, /not this change/);
});

test('a route the change made slower than the base fails, with both numbers', async (t) => {
  const head = await server(t, slow);
  const base = await server(t, fast);
  const dir = project(route(1000), route(40));
  const res = await run(dir, { PERF_URL: head.url, PERF_BASE_URL: base.url });
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /SLOWER THAN BASE/);
  assert.match(res.out, /perf: \/things p95 [\d.]+ms > 40ms, [\d.]+x the base's [\d.]+ms on this machine: this change made it slower/);
});

test('the margin is the project\'s: `regressionRatio` decides how much slower is slower', async (t) => {
  const head = await server(t, slow);
  const base = await server(t, () => 60);
  // 120 ms against 60 ms is 2x: over the default 1.25, under a ratio of 3
  assert.equal((await run(project(route(1000), route(40)), { PERF_URL: head.url, PERF_BASE_URL: base.url })).code, 1);
  const loose = await run(project(route(1000), route(40), { regressionRatio: 3 }), { PERF_URL: head.url, PERF_BASE_URL: base.url });
  assert.equal(loose.code, 0, loose.out);
});

test('the budget alone decides when there is no base to ask', async (t) => {
  const head = await server(t, slow);
  const base = await server(t, slow);
  const both = { PERF_URL: head.url, PERF_BASE_URL: base.url };

  const added = await run(project([{ path: '/old', p95Ms: 1000 }], route(40)), both);
  assert.equal(added.code, 1, 'a new route has no base: it is held to its budget');
  assert.match(added.out, /not compared with the base \(the routes over budget are new in this change\)/);

  const noRef = await run(project(route(1000), route(40)), both, []);
  assert.equal(noRef.code, 1, 'a run without --changed has no base');
  assert.match(noRef.out, /not compared with the base \(no base ref: run with --changed <ref>\)/);

  const off = await run(project(route(1000), route(40)), { ...both, PERF_COMPARE: '0' });
  assert.equal(off.code, 1, 'PERF_COMPARE=0 is the old gate');
  assert.doesNotMatch(off.out, /\(base\)/);

  const foreign = await run(project(route(1000), route(40)), { PERF_URL: head.url });
  assert.equal(foreign.code, 1, 'a server the script did not start is not rebuilt at the base');
  assert.match(foreign.out, /name the base server in PERF_BASE_URL/);

  const broken = http.createServer((req, res) => res.writeHead(500).end());
  await new Promise((resolve) => broken.listen(0, '127.0.0.1', resolve));
  t.after(() => broken.close());
  const dead = await run(project(route(1000), route(40)), { PERF_URL: head.url, PERF_BASE_URL: `http://127.0.0.1:${broken.address().port}` });
  assert.equal(dead.code, 1, 'a base that answers wrong never excuses a route');
  assert.match(dead.out, /could not be measured on the base/);
});

test('a wrong status is never compared: it is a wrong answer, not a slow one', async (t) => {
  const broken = http.createServer((req, res) => setTimeout(() => res.writeHead(500).end(), 120));
  await new Promise((resolve) => broken.listen(0, '127.0.0.1', resolve));
  t.after(() => broken.close());
  const base = await server(t, slow);
  const res = await run(project(route(1000), route(40)), { PERF_URL: `http://127.0.0.1:${broken.address().port}`, PERF_BASE_URL: base.url });
  assert.equal(res.code, 1, res.out);
  assert.doesNotMatch(res.out, /\(base\)/);
});

test('a route within its budget never asks the base', async (t) => {
  const head = await server(t, fast);
  const base = await server(t, fast);
  const res = await run(project(route(1000), route(1000)), { PERF_URL: head.url, PERF_BASE_URL: base.url });
  assert.equal(res.code, 0, res.out);
  assert.equal(base.people.size, 0, 'the base was never called');
});

test('`actors` from the setup gives each connection its own person', async (t) => {
  const head = await server(t, fast);
  const dir = project(route(1000), [{ path: '/things', auth: true, p95Ms: 1000 }], { setup: 'perf.setup.mjs' });
  fs.writeFileSync(path.join(dir, 'perf.setup.mjs'), 'export default async () => ({ actors: [1, 2, 3, 4].map((n) => ({ headers: { authorization: `Bearer person-${n}` } })) });\n');
  const res = await run(dir, { PERF_URL: head.url, JWT_SECRET: 's' }, []);
  assert.equal(res.code, 0, res.out);
  // the empty one is the script's own "is the server up" probe
  assert.deepEqual([...head.people].filter(Boolean).sort(), ['Bearer person-1', 'Bearer person-2', 'Bearer person-3', 'Bearer person-4']);
});
