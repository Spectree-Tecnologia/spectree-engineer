// The generated CI runs by moment (decided by the Founder on 2026-11-13, measured on the pilot project): fast checks on every push
// to a pull request, the merge gate on a ready one, everything every night on main with the latency budget reporting,
// and the latency budget as a gate only in the `pre-release` run. A red p95 never sends a goal back for another round.
// Run, not only read: the scope step and the latency step of the template are executed in bash.
//   node --test tests/ci-moments.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { tmpDir } from './tmp.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8').split('\r\n').join('\n');
const ci = read('skills/monolith/config-project/assets/workflows/ci.yml');
const bash = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' }).stdout?.trim() === 'ok';

// the `run: |` block of a named step, de-indented
function stepRun(name) {
  const lines = ci.split('\n');
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  assert.ok(start >= 0, `step "${name}" exists`);
  const at = lines.findIndex((l, i) => i > start && l.trim() === 'run: |');
  const out = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() === '') break;
    out.push(line.replace(/^ {10}/, ''));
  }
  return out.join('\n');
}
const stepIf = (name) => ci.match(new RegExp(`- name: ${name}\\n\\s+if: (.+)`))?.[1];

test('the template runs by moment and never on push', () => {
  assert.match(ci, /pull_request:\n\s+#[^\n]*\n\s+types:\n\s+- opened\n\s+- synchronize\n\s+- reopened\n\s+- ready_for_review\n/);
  // weekly, not nightly (0.44.0): the nightly run repeated on main what each merged pull request had just run
  assert.match(ci, /- cron: '17 6 \* \* 1'/, 'once a week, on Monday');
  assert.match(ci, /--since='170 hours ago'/, 'the full run only when something merged in the last week');
  assert.match(ci, /workflow_dispatch:\n\s+inputs:\n\s+stage:[\s\S]*?options:\n\s+- weekly\n\s+- pre-release\n\s+default: weekly/);
  assert.doesNotMatch(ci.replace(/#.*$/gm, ''), /^\s+push:/m);
  assert.match(ci, /STAGE: \$\{\{ inputs\.stage \}\}/);
});

test('the runner is a repository variable with the hosted runner as default, never an input', () => {
  assert.match(ci, /^ {4}runs-on: \$\{\{ vars\.CI_RUNNER \|\| 'ubuntu-latest' \}\}$/m);
  assert.doesNotMatch(ci, /runs-on: .*inputs\./);
  // node before the scope step, which runs scripts/e2e-scope.mjs
  assert.ok(ci.indexOf('actions/setup-node') < ci.indexOf('- name: What this run has to prove'));
  assert.equal(ci.match(/actions\/setup-node/g).length, 1);
  // the npm cache on ubuntu-latest only: a self-hosted runner keeps ~/.npm, and restoring it took ~8 min on the
  // pilot's (2026-11-24); package-manager-cache, or setup-node turns the cache on by itself from packageManager
  assert.match(ci, /^ {10}cache: \$\{\{ vars\.CI_RUNNER == '' && 'npm' \|\| '' \}\}$/m);
  assert.match(ci, /^ {10}package-manager-cache: \$\{\{ vars\.CI_RUNNER == '' \}\}$/m);
  assert.doesNotMatch(ci, /^\s+cache: npm$/m);
});

// measured on the pilot's self-hosted runner (2026-11-20): WSL2 distros share one network, so CI asked for the
// developer's 5433; and a self-hosted runner keeps the volume between runs
test('CI Postgres has its own host port and an empty volume, development keeps its port', { skip: !bash && 'no bash' }, () => {
  const prisma = read('skills/monolith/config-prisma/scripts/init-prisma-backend.js');
  assert.match(prisma, /- '\\\$\{POSTGRES_HOST_PORT:-\$\{dbConfig\.port\}\}:5432'/, 'the compose port defaults to the project port');
  const dir = tmpDir('ci-pg-');
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.writeFileSync(path.join(dir, 'bin', 'docker'), '#!/bin/sh\necho "$@" >> "$CALLS"\n', { mode: 0o755 });
  const example = [
    'MIGRATION_DATABASE_URL="postgresql://docker:docker@localhost:5433/docker?schema=public"',
    'DATABASE_URL="postgresql://app_runtime:x@localhost:5433/docker?schema=public"',
    'FRONTEND_URL="http://localhost:3000"',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, '.env.example'), example);
  const r = spawnSync('bash', ['-e', '-c', stepRun('Postgres')], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`, CALLS: path.join(dir, 'calls') },
  });
  assert.equal(r.status, 0, r.stderr);
  const env = fs.readFileSync(path.join(dir, '.env'), 'utf8');
  assert.equal(env.match(/@localhost:55433\//g).length, 2, 'both database URLs moved');
  assert.match(env, /^POSTGRES_HOST_PORT=55433$/m);
  assert.match(env, /localhost:3000/, 'other localhost values are untouched');
  assert.deepEqual(fs.readFileSync(path.join(dir, 'calls'), 'utf8').trim().split('\n'), [
    'compose down -v --remove-orphans',
    'compose up -d --wait postgres',
  ]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the latency budget never runs on a pull request and gates only pre-release', () => {
  assert.equal(stepIf('Latency budget'), "steps.scope.outputs.code == 'true' && github.event_name != 'pull_request'");
  assert.doesNotMatch(stepRun('Latency budget'), /--changed/);
  assert.equal(stepIf('Backend e2e'), "steps.scope.outputs.code == 'true' && github.event.pull_request.draft != true");
});

test('a red latency budget reports, and fails only the pre-release run', { skip: !bash && 'no bash' }, () => {
  const dir = tmpDir('ci-moments-');
  const script = path.join(dir, 'perf-step.sh');
  fs.writeFileSync(script, stepRun('Latency budget'));
  const run = (stage, exit) => {
    const summary = path.join(dir, `summary-${stage}-${exit}.md`);
    const res = spawnSync('bash', ['-eo', 'pipefail', '-c', `npm() { return ${exit}; }; source "${script.replace(/\\/g, '/')}"`], {
      encoding: 'utf8',
      env: { ...process.env, STAGE: stage, GITHUB_STEP_SUMMARY: summary.replace(/\\/g, '/') },
    });
    return { code: res.status, out: `${res.stdout}${res.stderr}`, summary: fs.readFileSync(summary, 'utf8') };
  };
  for (const stage of ['', 'weekly']) {
    assert.equal(run(stage, 0).code, 0);
    for (const exit of [1, 3]) {
      const r = run(stage, exit);
      assert.equal(r.code, 0, `stage "${stage}", perf exit ${exit}: reported, not failed`);
      assert.match(r.out, /::warning title=Latency budget::/);
      assert.match(r.summary, /over budget, reported/);
    }
  }
  assert.equal(run('pre-release', 0).code, 0);
  const gate = run('pre-release', 1);
  assert.equal(gate.code, 1, 'pre-release: the gate fails the run');
  assert.match(gate.out, /::error title=Latency budget::/);
});

test('the scope step chooses the Playwright smoke from the diff', { skip: !bash && 'no bash' }, () => {
  const dir = tmpDir('ci-scope-');
  const script = path.join(dir, 'scope.sh').replace(/\\/g, '/');
  fs.writeFileSync(script, stepRun('What this run has to prove'));
  const repo = path.join(dir, 'repo');
  const e2e = path.join(repo, 'apps', 'frontend', 'e2e');
  fs.mkdirSync(e2e, { recursive: true });
  const sh = (cmd) => {
    const res = spawnSync('bash', ['-c', cmd], { cwd: repo, encoding: 'utf8' });
    assert.equal(res.status, 0, `${cmd}\n${res.stderr}`);
  };
  const commit = (msg) => sh(`git add -A && git -c user.email=t@t -c user.name=t -c core.autocrlf=false commit -qm ${msg}`);
  const scope = () => {
    const res = spawnSync('bash', ['-eo', 'pipefail', script], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, BASE_REF: 'main', GITHUB_OUTPUT: '/dev/null' },
    });
    return { code: res.status, playwright: res.stdout.match(/^playwright=(.*)$/m)?.[1]?.trim(), out: `${res.stdout}${res.stderr}` };
  };
  sh('git init -q -b main');
  fs.mkdirSync(path.join(repo, 'scripts'));
  fs.copyFileSync(path.join(plugin, 'skills/monolith/config-project/assets/scripts/e2e-scope.mjs'), path.join(repo, 'scripts', 'e2e-scope.mjs'));
  fs.writeFileSync(path.join(e2e, 'smoke.txt'), '# the journeys\r\ne2e/a.spec.ts\r\ne2e/b.spec.ts # why\r\n');
  // login.ts reaches every spec; state.ts only c, through its import; deep.ts reaches c through state.ts; seed.mjs
  // only d, which spawns it by path; orphan.ts nothing
  const files = {
    'a.spec.ts': "import { login } from './login';\n",
    'b.spec.ts': "import { login } from './login.ts';\n",
    'c.spec.ts': "import { login } from './login';\nimport { state } from './state';\n",
    'd.spec.ts': "import { login } from './login';\nspawnSync('node', ['e2e/seed.mjs']);\n",
    'e.spec.ts': "import { login } from './login';\n",
    'login.ts': 'export const login = 1;\n',
    'state.ts': "export { deep as state } from './deep';\n",
    'deep.ts': 'export const deep = 1;\n',
    'seed.mjs': '',
    'orphan.ts': '',
    'rows.json': '{}',
  };
  for (const [f, text] of Object.entries(files)) fs.writeFileSync(path.join(e2e, f), text);
  fs.writeFileSync(path.join(repo, 'apps', 'frontend', 'playwright.config.ts'), '');
  fs.writeFileSync(path.join(repo, 'package-lock.json'), '{}');
  commit('base');
  sh('git update-ref refs/remotes/origin/main HEAD && git switch -q -c change');
  const touch = (rel, msg) => {
    sh('git reset -q --hard origin/main');
    fs.appendFileSync(path.join(repo, rel), '\n// x\n');
    commit(msg);
    return scope();
  };

  assert.equal(touch('apps/frontend/e2e/c.spec.ts', 'spec').playwright, 'e2e/a.spec.ts e2e/b.spec.ts e2e/c.spec.ts', 'the smoke and the spec this change wrote');
  assert.equal(touch('apps/frontend/e2e/state.ts', 'state').playwright, 'e2e/a.spec.ts e2e/b.spec.ts e2e/c.spec.ts', 'the spec that imports the helper');
  assert.equal(touch('apps/frontend/e2e/deep.ts', 'deep').playwright, 'e2e/a.spec.ts e2e/b.spec.ts e2e/c.spec.ts', 'and through another helper');
  assert.equal(touch('apps/frontend/e2e/seed.mjs', 'seed').playwright, 'e2e/a.spec.ts e2e/b.spec.ts e2e/d.spec.ts', 'the spec that spawns it by path');
  assert.equal(touch('apps/frontend/e2e/login.ts', 'login').playwright, 'full', 'a helper every spec imports: the whole suite');
  assert.equal(touch('apps/frontend/e2e/orphan.ts', 'orphan').playwright, 'full', 'a module nothing names: the whole suite');
  assert.equal(touch('apps/frontend/e2e/rows.json', 'rows').playwright, 'full', 'a file that is not a module: the whole suite');
  assert.equal(touch('apps/frontend/playwright.config.ts', 'config').playwright, 'full', 'the config: the whole suite');
  assert.equal(touch('package-lock.json', 'lock').playwright, 'full', 'the lockfile: the whole suite');
  sh('git reset -q --hard origin/main && git rm -q apps/frontend/e2e/orphan.ts');
  commit('gone');
  assert.equal(scope().playwright, 'full', 'a deleted module: the whole suite');

  sh('git reset -q --hard origin/main');
  fs.appendFileSync(path.join(e2e, 'smoke.txt'), 'e2e/gone.spec.ts\n');
  commit('typo');
  const typo = scope();
  assert.equal(typo.code, 1, 'a smoke name that does not exist fails the step');
  assert.match(typo.out, /refused Playwright spec: e2e\/gone\.spec\.ts/);
});

test('the squad reads the moments: a red p95 is reported, never a round', () => {
  const command = read('commands/engineer.md');
  assert.match(command, /\*\*The p95 reports, it does not block:\*\* the table goes to the evidence as `reported`/);
  assert.match(command, /become roadmap items, never a round\. What blocks is the `pre-release` run, before the deploy\./);
  assert.match(command, /every deterministic layer exits 0, except the p95\./);
  assert.match(command, /The PR opens ready, never as a draft: the ready-PR run is the merge gate\./);
  assert.doesNotMatch(command, /red perf goes to the full-stack-developer/);
  const platform = read('agents/platform-engineer.md');
  assert.match(platform, /\*\*one workflow, one job, never on push\*\*/);
  assert.match(platform, /gh workflow run ci\.yml --ref main -f stage=pre-release/);
  assert.match(platform, /\*\*without `--` before the names\*\*/);
  assert.match(read('agents/quality-engineer.md'), /A p95 over budget is not a finding: the finding is the route without a number/);
  assert.match(read('ARCHITECTURE.md'), /gates the `pre-release` run before production/);
});
