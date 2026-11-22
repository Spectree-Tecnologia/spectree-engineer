// The three dev-tooling issues the pilot project's retros opened on 2026-11-12, each one run instead of read:
//   #76 worktree.mjs handed a worktree port 6000, which Chromium refuses (ERR_UNSAFE_PORT)
//   #77 perf.mjs measured a create route on its duplicate-key 409 path
//   #78 a turbo cache restore left a stale apps/frontend/.next next to the restored build
//   node --test tests/dev-tooling.test.mjs
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(plugin, 'skills', 'monolith', 'config-project', 'assets', 'scripts');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'spectree-tooling-'));

test('#76 the worktree offset skips every port browsers refuse, and a forced one is refused', () => {
  const source = fs.readFileSync(path.join(assets, 'worktree.mjs'), 'utf8');
  const list = source.match(/const BROWSER_BLOCKED_PORTS = new Set\(\[([\s\S]*?)\]\)/)?.[1];
  assert.ok(list, 'worktree.mjs declares the blocked list');
  const blocked = new Set(list.split(',').map((one) => Number(one.trim())).filter(Boolean));
  for (const port of [6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080]) assert.ok(blocked.has(port), `${port} is blocked`);
  // frontend 3000 + offset 3000 is the pilot project's case; both servers are checked
  assert.match(source, /reserveOffset\(\[backendPort, frontendPort\], forcedOffset\)/);
  assert.match(source, /offset \$\{offset\} skipped, port/);
  assert.match(source, /which browsers refuse \(ERR_UNSAFE_PORT\)/);
});

test('#77 a create route is measured with a unique body per request, and `accept` lists the statuses it may answer', async (t) => {
  const seen = new Set();
  let duplicates = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (req.url === '/health') return res.writeHead(200).end();
      const { name } = JSON.parse(body || '{}');
      if (seen.has(name)) {
        duplicates += 1;
        return res.writeHead(409).end();
      }
      seen.add(name);
      res.writeHead(req.url === '/gone' ? 410 : 201).end();
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const dir = tmp();
  const run = (routes) => {
    fs.writeFileSync(path.join(dir, 'perf.config.json'), JSON.stringify({ connections: 4, durationSeconds: 1, routes }));
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(assets, 'perf.mjs')], {
        cwd: dir,
        env: { ...process.env, PERF_URL: `http://127.0.0.1:${server.address().port}`, PERF_MAX_CPU: '100' },
      });
      let out = '';
      child.stdout.on('data', (chunk) => (out += chunk));
      child.stderr.on('data', (chunk) => (out += chunk));
      child.on('close', (code) => resolve({ code, out }));
    });
  };

  const fixed = await run([{ path: '/things', method: 'POST', body: { name: 'perf-{{uuid}}-{{n}}' }, p95Ms: 5000 }]);
  assert.equal(fixed.code, 0, fixed.out);
  assert.equal(duplicates, 0, 'every request created a new thing');
  assert.ok(seen.size > 1);

  const same = await run([{ path: '/things', method: 'POST', body: { name: 'always-the-same' }, p95Ms: 5000 }]);
  assert.equal(same.code, 1, 'the same body twice is the 409 path, and it still fails');
  assert.match(same.out, /409/);

  const accepted = await run([{ path: '/things', method: 'POST', body: { name: 'again' }, accept: [409], p95Ms: 5000 }]);
  assert.equal(accepted.code, 0, accepted.out);
  const gone = await run([{ path: '/gone', method: 'POST', body: { name: 'x-{{uuid}}' }, accept: [409], p95Ms: 5000 }]);
  assert.equal(gone.code, 1, 'a status outside `accept` still fails');
});

test('#78 clean-next empties every apps/*/.next and keeps Next\'s own cache', () => {
  const dir = tmp();
  const next = path.join(dir, 'apps', 'frontend', '.next');
  fs.mkdirSync(path.join(next, 'cache', 'webpack'), { recursive: true });
  fs.mkdirSync(path.join(next, 'server', 'app'), { recursive: true });
  fs.writeFileSync(path.join(next, 'server', 'app', 'stale.html'), 'old');
  fs.writeFileSync(path.join(next, 'BUILD_ID'), 'old');
  fs.mkdirSync(path.join(dir, 'apps', 'backend', 'dist'), { recursive: true });
  const res = spawnSync(process.execPath, [path.join(assets, 'clean-next.mjs')], { cwd: dir, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(fs.readdirSync(next), ['cache']);
  assert.ok(fs.existsSync(path.join(next, 'cache', 'webpack')));
  assert.ok(fs.existsSync(path.join(dir, 'apps', 'backend', 'dist')));
});

test('#78 a new project caches .next without its cache, and tooling-sync brings an old one there', () => {
  const init = fs.readFileSync(path.join(plugin, 'skills', 'monolith', 'config-project', 'scripts', 'project-init.mjs'), 'utf8');
  assert.match(init, /outputs: \['\.next\/\*\*', '!\.next\/cache\/\*\*', 'dist\/\*\*'\]/);
  assert.match(init, /pkg\.scripts\.prebuild = pkg\.scripts\.prebuild \?\? 'node scripts\/clean-next\.mjs'/);

  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'old', scripts: { build: 'turbo run build' } }));
  fs.writeFileSync(path.join(dir, 'turbo.json'), JSON.stringify({ tasks: { build: { outputs: ['.next/**', 'dist/**'] } } }));
  const sync = (mode) => spawnSync(process.execPath, [path.join(plugin, 'skills', 'monolith', 'config-project', 'scripts', 'tooling-sync.mjs'), mode], { cwd: dir, encoding: 'utf8' });
  const check = sync('--check');
  assert.equal(check.status, 1);
  assert.match(check.stdout, /missing   turbo\.json build output "!\.next\/cache\/\*\*"/);
  assert.match(check.stdout, /package\.json script "prebuild"/);
  sync('--apply');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'turbo.json'), 'utf8')).tasks.build.outputs, ['.next/**', '!.next/cache/**', 'dist/**']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts.prebuild, 'node scripts/clean-next.mjs');
  assert.ok(fs.existsSync(path.join(dir, 'scripts', 'clean-next.mjs')));
  assert.equal(sync('--check').status, 0);
});

// The pilot project's feat/data-import-3 showed +61k lines: ~900 raw logs the verifiers left in .scratch/<slug>/<role>/,
// which is committed, because the mission's guard-rail sent them there (and a log can hold tokens, issue 105).
test('raw agent logs stay outside git: the mission sends them to the temp dir, and .gitignore drops any left in .scratch/', () => {
  const command = fs.readFileSync(path.join(plugin, 'commands', 'engineer.md'), 'utf8');
  assert.match(command, /"raw logs and throwaway scripts go in `<os tmpdir>\/spectree-gate\/<project>\/<slug>\/<role>\/`, never in the repository"/);
  assert.doesNotMatch(command, /your scripts and logs go in `\.scratch/);
  const template = fs.readFileSync(path.join(plugin, 'skills', 'monolith', 'config-project', '.gitignore'), 'utf8');
  assert.ok(template.split(/\r?\n/).includes('.scratch/**/*.log'));
  assert.match(fs.readFileSync(path.join(plugin, 'skills', 'monolith', 'config-project', 'scripts', 'project-init.mjs'), 'utf8'), /const missing = \[[^\]]*'\.scratch\/\*\*\/\*\.log'[^\]]*\]/);

  // an old project gets the line from tooling-sync, keeps its own lines, and git then ignores a nested log, not the plan
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'old', scripts: {} }));
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\n');
  const sync = (mode) => spawnSync(process.execPath, [path.join(plugin, 'skills', 'monolith', 'config-project', 'scripts', 'tooling-sync.mjs'), mode], { cwd: dir, encoding: 'utf8' });
  assert.match(sync('--check').stdout, /missing   \.gitignore "\.scratch\/\*\*\/\*\.log"/);
  sync('--apply');
  sync('--apply');
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'node_modules\n.scratch/**/*.log\n');
  spawnSync('git', ['init', '-q'], { cwd: dir });
  const ignored = (file) => spawnSync('git', ['check-ignore', '-q', file], { cwd: dir }).status === 0;
  assert.ok(ignored('.scratch/data-import-3/quality-engineer/t04/mutation.log'));
  assert.ok(!ignored('.scratch/data-import-3/plan.md'));
});
