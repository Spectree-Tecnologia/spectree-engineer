// Three numbers a goal is decided on, read the way CI reads them (0.51.0, from tely-workspace's soft-ui-3):
// goal size counted the squad's own synced scripts (issue 132), a developer's local .env turned e2e red that CI ran
// green (issue 133), and a contract split under 0.43 had every criterion skipped by `goal prove` (issue 134).
//   node --test tests/goal-env-size.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const goal = path.join(plugin, 'skills', 'monolith', 'config-project', 'assets', 'scripts', 'goal.mjs');

const contract = (criteria, amendments = '') => `# Goal: things

Status: approved by founder on 2026-11-15

## Objective

Things.

## Context

The things module.

## Success criteria

| # | Criterion | Proof |
|---|---|---|
${criteria}

## Limits

None.

## Budget

Verification rounds: 3
Size: 100 product lines

## Evidence

| # | Round | Verdict | Run |
|---|---|---|---|

## Amendments

| Date | # | Change | Decided by | Continues in |
|---|---|---|---|---|
${amendments}`;

function project(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-env-size-'));
  fs.mkdirSync(path.join(dir, 'docs', 'goals'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'goals', 'things.md'), text);
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  return { dir, git };
}
const run = (dir, ...args) => {
  const res = spawnSync(process.execPath, [goal, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: res.status, out: res.stdout + res.stderr };
};
const lines = (n) => Array.from({ length: n }, (_, i) => `export const x${i} = ${i};`).join('\n');

test('goal size does not count the scripts tooling-sync owns', () => {
  const { dir, git } = project(contract('| 1 | a thing | run: `node -e "0"` |'));
  const base = git('rev-parse', 'HEAD').stdout.trim();
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.writeFileSync(path.join(dir, 'scripts', 'goal.mjs'), lines(500));
  fs.writeFileSync(path.join(dir, 'scripts', '.squad-tooling.json'), JSON.stringify({ plugin: '0.51.0', installed: { 'scripts/goal.mjs': 'x' }, kept: {} }));
  fs.writeFileSync(path.join(dir, 'things.mjs'), lines(40));
  git('add', '.');
  git('commit', '-q', '-m', 'work');
  const res = run(dir, 'size', 'things', '--base', base);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /product code +40 changed lines in 1 files/);
  assert.match(res.out, /squad tooling 50[0-9]/);
});

test('a proof runs with the keys CI gives no value blank, and says which', () => {
  const probe = 'node -e "process.exit(process.env.OIDC_ISSUER === \'\' && process.env.PORT === \'4000\' ? 0 : 9)"';
  const { dir } = project(contract(`| 1 | a thing | run: \`${probe}\` |`));
  fs.mkdirSync(path.join(dir, 'apps', 'backend'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'apps', 'backend', '.env.example'), 'PORT="4000"\nOIDC_ISSUER=\n');
  fs.writeFileSync(path.join(dir, 'apps', 'backend', '.env'), 'PORT="4000"\nOIDC_ISSUER="https://sso.example"\nLOCAL_ONLY=1\n');
  const res = spawnSync(process.execPath, [goal, 'prove', 'things'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PORT: '4000', OIDC_ISSUER: undefined, LOCAL_ONLY: undefined } });
  const out = res.stdout + res.stderr;
  assert.equal(res.status, 0, out);
  assert.match(out, /env: blank as in CI \(local \.env only\): LOCAL_ONLY, OIDC_ISSUER/);
});

test('a moved criterion leaves whole, and a goal with nothing left to prove is red', () => {
  const moved = '| 2026-11-20 | 1 | moved | Engineer | `things-2` |\n';
  const { dir } = project(contract('| 1 | a thing | run: `node -e "0"` |', moved));
  const res = run(dir, 'prove', 'things');
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /every criterion is moved or waived; nothing of this goal is proved here/);

  const split = project(contract('| 1 | a thing | run: `node -e "0"` |\n| 2 | b thing | run: `node -e "0"` |', `${moved}| 2026-11-20 | 1 | reworded | Engineer | |\n`));
  const check = run(split.dir, 'check', 'things');
  assert.equal(check.code, 1, check.out);
  assert.match(check.out, /criterion 1 is moved, and the amendment of 2026-11-20 reworded it here: move the whole row and add the part that stays as a new criterion \(added\)/);
});
