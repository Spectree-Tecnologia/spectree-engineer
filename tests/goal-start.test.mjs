// The start of a goal is a script, not an agent mission (0.32.0, the Founder's "Yes, build it" on 2026-11-14).
// Measured on the pilot project: the platform-engineer mission that cut the branch and recorded the baseline took 27 minutes and
// 9.3M tokens in ts7 and 60 minutes and 9.2M in ci-time-20, with the full-stack-developer waiting for it; branch,
// tooling, install, build, test and audit were 5 of those 60 minutes, and about 25 of its 93 turns only polled a log.
// Run, not read:
//   node --test tests/goal-start.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(plugin, 'skills', 'monolith', 'config-project', 'scripts', 'goal-start.mjs');
const sync = path.join(plugin, 'skills', 'monolith', 'config-project', 'scripts', 'tooling-sync.mjs');
const version = JSON.parse(fs.readFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), 'utf8')).version;
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');

function project(scripts = { build: 'node -e "process.exit(0)"', test: 'node -e "process.exit(0)"' }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spectree-goal-start-'));
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify({ name: 'probe', private: true, scripts }, null, 2)}\n`);
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 't');
  git('config', 'user.email', 't@t');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  return { dir, git };
}
const run = (dir, ...args) => {
  const res = spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: res.status, out: res.stdout + res.stderr };
};

test('--branch cuts the branch, syncs the tooling in one commit of its own, and names the baseline sha', () => {
  const { dir, git } = project();
  fs.writeFileSync(path.join(dir, 'notes.md'), 'the founder is typing here\n');
  const res = run(dir, 'things', '--branch', 'feat/things');
  assert.equal(res.code, 0, res.out);
  assert.equal(git('branch', '--show-current').stdout.trim(), 'feat/things');
  assert.equal(git('log', '-1', '--format=%s').stdout.trim(), `chore(tooling): sync the squad's scripts to plugin ${version}`);
  const sha = git('rev-parse', 'HEAD').stdout.trim();
  assert.match(res.out, new RegExp(`goal-start: branch feat/things at ${sha} \\(the baseline sha\\)`));
  assert.equal(spawnSync(process.execPath, [sync, '--check'], { cwd: dir }).status, 0, 'the tooling is at the plugin');
  // what the sync did not write is not in its commit
  assert.match(git('status', '--short').stdout, /^\?\? notes\.md$/m);
  assert.doesNotMatch(git('show', '--stat', '--format=', 'HEAD').stdout, /notes\.md/);

  // run again: nothing to cut, nothing to commit, the same sha
  const again = run(dir, 'things', '--branch', 'feat/things');
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /tooling already at the plugin, no commit/);
  assert.equal(git('rev-parse', 'HEAD').stdout.trim(), sha);
});

test('--branch stops at a script the project changed: reading both versions is not a script\'s job', () => {
  const { dir, git } = project();
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.writeFileSync(path.join(dir, 'scripts', 'goal.mjs'), '// the project\'s own goal script\n');
  git('add', '.');
  git('commit', '-q', '-m', 'own script');
  const res = run(dir, 'things', '--branch', 'chore/things');
  assert.equal(res.code, 4, res.out);
  assert.match(res.out, /differs\s+scripts\/goal\.mjs/);
  assert.match(res.out, /a job for the platform-engineer/);
  assert.equal(git('branch', '--show-current').stdout.trim(), 'chore/things', 'the branch is cut all the same');
  assert.equal(git('log', '-1', '--format=%s').stdout.trim(), 'own script', 'and nothing was committed');
});

test('--branch refuses a branch that is not <type>/<slug>', () => {
  const { dir, git } = project();
  for (const branch of ['things', 'feature/things', 'feat/other', undefined]) {
    assert.equal(run(dir, 'things', '--branch', ...(branch ? [branch] : [])).code, 2, String(branch));
  }
  assert.equal(git('branch', '--show-current').stdout.trim(), 'main');
});

test('--baseline runs build and test by exit code, writes the record, and a red one is a block', () => {
  const green = project();
  const ok = run(green.dir, 'things', '--baseline');
  assert.equal(ok.code, 0, ok.out);
  const record = fs.readFileSync(path.join(green.dir, '.scratch', 'things', 'baseline.md'), 'utf8');
  assert.match(record, new RegExp(`Baseline sha: \`${green.git('rev-parse', 'HEAD').stdout.trim()}\``));
  assert.match(record, /Verdict: green\./);
  assert.match(record, /\| build \| `npm run build` \| 0 \|/);
  assert.match(record, /\| test \| `npm test` \| 0 \|/);
  assert.doesNotMatch(record, /\| (install|audit|e2e) \|/, 'no lockfile: nothing to install or audit; no backend: no e2e');
  assert.ok(fs.existsSync(path.join(green.dir, '.scratch', 'things', 'baseline', 'test.log')));

  // the tests see UTC, as on the runner
  const utc = project({ build: 'node -e "process.exit(0)"', test: 'node -e "process.exit(process.env.TZ === \'UTC\' ? 0 : 9)"' });
  assert.equal(run(utc.dir, 'things', '--baseline').code, 0);

  const broken = project({ build: 'node -e "process.exit(5)"', test: 'node -e "process.exit(0)"' });
  const red = run(broken.dir, 'things', '--baseline');
  assert.equal(red.code, 1, red.out);
  const redRecord = fs.readFileSync(path.join(broken.dir, '.scratch', 'things', 'baseline.md'), 'utf8');
  assert.match(redRecord, /Verdict: RED: a block, never a starting point\./);
  assert.match(redRecord, /\| test \| `npm test` \| not run \|/, 'a test run on a red build would only repeat the red');
});

test('the Engineer starts a goal by the script, and the plan does not wait for the baseline', () => {
  const command = read('commands/engineer.md');
  assert.match(command, /goal-start\.mjs <slug> --branch <tipo>\/<slug>/);
  assert.match(command, /goal-start\.mjs <slug> --baseline/);
  assert.match(command, /em segundo plano/);
  assert.match(command, /O plano não espera a baseline/);
  assert.match(command, /Exit 4[^\n]*platform-engineer/);
  // the mission that used to do it is now only the hand merge of a script the project changed, and the worktree
  const card = read('agents/platform-engineer.md');
  assert.match(card, /\*\*Tooling que difere\.\*\*/);
  assert.doesNotMatch(card, /Depois rode `npm run build`, `npm test` e `npm audit --audit-level=high`, e grave a saída/);
});
