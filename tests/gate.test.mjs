// One gate per moment and the walk of a goal, read by a script (0.41.0). Measured on the pilot project: the
// orchestrator typed five to eight commands per checkpoint and per round, its e2e and perf went red beside the
// verifiers' builds and were green alone (issue 89), the raw log it committed as evidence held 42 refresh tokens
// (issue 105), and where a goal stood was inferred from prose after every wake-up. Run, not read:
//   node --test tests/gate.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const goal = path.join(plugin, 'skills', 'monolith', 'config-project', 'assets', 'scripts', 'goal.mjs');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
const exit = (code) => `node -e "process.exit(${code})"`;

const contract = ({ status = 'approved by founder on 2026-11-15', rounds = 3, evidence = '', amendments = '' } = {}) => `# Goal: things

Status: ${status}

## Objective

Things.

## Context

The things module.

## Success criteria

| # | Criterion | Proof |
|---|---|---|
| 1 | a thing is created | run: \`${exit(0)}\` |
| 2 | things are listed | run: \`${exit(0)}\` |
| 3 | a thing is archived | run: \`${exit(0)}\` |

## Limits

None.

## Budget

Verification rounds: ${rounds}

## Evidence

| # | Round | Verdict | Run |
|---|---|---|---|
${evidence}
## Amendments

| Date | # | Change | Decided by | Continues in |
|---|---|---|---|---|
${amendments}`;

const ticket = (criteria, status = 'ready', blockedBy = 'None (can start immediately)') =>
  [`# ticket`, `**Criteria:** ${criteria}`, `**Blocked by:** ${blockedBy}`, '**Touches:** `modules/things`', `**Proof:** run: \`${exit(0)}\``, `**Status:** ${status}`].join('\n\n');

function project({ scripts = {}, goalText = contract(), tickets = null, baseline = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spectree-gate-test-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'probe', private: true, scripts: { build: exit(0), test: exit(0), ...scripts } }, null, 2));
  fs.mkdirSync(path.join(dir, 'docs', 'goals'), { recursive: true });
  if (goalText) fs.writeFileSync(path.join(dir, 'docs', 'goals', 'things.md'), goalText);
  fs.mkdirSync(path.join(dir, '.scratch', 'things'), { recursive: true });
  const git = (...argv) => spawnSync('git', argv, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('-c', 'user.email=probe@example.com', '-c', 'user.name=probe', 'commit', '-q', '--allow-empty', '-m', 'base');
  const sha = git('rev-parse', 'HEAD').stdout.trim();
  if (baseline) fs.writeFileSync(path.join(dir, '.scratch', 'things', 'baseline.md'), `# Baseline: things\n\nBaseline sha: \`${sha}\` (main), recorded by goal-start.\nVerdict: green.\n`);
  if (tickets) {
    fs.mkdirSync(path.join(dir, '.scratch', 'things', 'issues'), { recursive: true });
    for (const [name, text] of Object.entries(tickets)) fs.writeFileSync(path.join(dir, '.scratch', 'things', 'issues', `${name}.md`), text);
  }
  return { dir, sha };
}
const run = (dir, ...args) => {
  const res = spawnSync(process.execPath, [goal, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: res.status, out: res.stdout + res.stderr };
};

test('the final gate runs the deterministic layer one command after the other, with one exit code', () => {
  // the build prints a token, as an e2e request log can: it goes to the log outside the repository, never to the output
  const { dir } = project({ scripts: { build: 'node -e "console.log(\'refresh=SECRET-TOKEN\')"' } });
  const res = run(dir, 'gate', 'things', '--final');
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /R build +exit 0/);
  assert.match(res.out, /R test +exit 0/);
  assert.match(res.out, /R check +exit 0 .* goal check things/);
  assert.match(res.out, /R proofs +exit 0 .* goal prove things/);
  assert.match(res.out, /^goal gate: green$/m);
  assert.doesNotMatch(res.out, /SECRET-TOKEN/);
  const logs = res.out.match(/logs: (.+?) {2}\(/)?.[1];
  assert.ok(logs && !path.resolve(logs).startsWith(path.resolve(dir)), 'the raw logs are outside the repository');
  assert.match(fs.readFileSync(path.join(logs, 'build.log'), 'utf8'), /SECRET-TOKEN/);
  assert.match(res.out, /a raw log can hold secrets and is never committed; the evidence is the R lines/);
});

test('a red step stops the gate: what comes after it is not run', () => {
  const { dir } = project({ scripts: { test: exit(4) } });
  const res = run(dir, 'gate', 'things', '--final');
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /R test +exit 4/);
  assert.match(res.out, /R check +not run/);
  assert.match(res.out, /R proofs +not run/);
  assert.match(res.out, /^goal gate: RED at test$/m);
});

test('a step that hangs is a red at its timeout, never a gate that waits for hours (issue 130)', () => {
  const { dir } = project({ scripts: { test: 'node -e "setInterval(() => {}, 1000)"' } });
  const res = spawnSync(process.execPath, [goal, 'gate', 'things', '--final'], { cwd: dir, encoding: 'utf8', env: { ...process.env, GATE_STEP_MINUTES: '0.03' } });
  const out = res.stdout + res.stderr;
  assert.equal(res.status, 1, out);
  assert.match(out, /R test +exit 1 \(timed out after 0\.03 min: GATE_STEP_MINUTES\)/);
  assert.match(out, /^goal gate: RED at test$/m);
  // the perf child killed by a signal counts as gone: a second stop no longer waits on an exit that already fired
  assert.match(read('skills/monolith/config-project/assets/scripts/perf.mjs'), /child\.exitCode !== null \|\| child\.signalCode !== null\) return resolve\(\)/);
});

test('the p95 reports and never blocks: exit 3 is green with a report to read', () => {
  const { dir } = project({ scripts: { perf: 'node perf.cjs' } });
  fs.writeFileSync(path.join(dir, 'perf.cjs'), 'process.exit(1)\n');
  const res = run(dir, 'gate', 'things', '--final');
  assert.equal(res.code, 3, res.out);
  assert.match(res.out, /R perf +exit 1 .* npm run perf -- --changed [0-9a-f]{40}/);
  assert.match(res.out, /goal gate: green, with a report to read: perf exit 1: the p95 reports; read its lines: a non-2xx blocks/);
});

test("a ticket's gate runs the ticket's checkpoint commands, and asks where the checkpoint starts", () => {
  const { dir, sha } = project({ scripts: { build: exit(2) }, tickets: { '01-create': ticket('1, 2, 3', 'built') } });
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.writeFileSync(path.join(dir, 'scripts', 'check-boundaries.mjs'), 'process.exit(0)\n');
  const res = run(dir, 'gate', 'things', '--ticket', '1', '--since', sha);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /goal gate: things, ticket 01/);
  assert.match(res.out, /R boundaries +exit 0/);
  assert.match(res.out, /R build +exit 2/);
  assert.match(res.out, /R test +not run/);
  assert.match(res.out, /R proof +not run/);
  assert.equal(run(dir, 'gate', 'things', '--ticket', '1').code, 2, 'a checkpoint without --since');
  assert.equal(run(dir, 'gate', 'things', '--ticket', '1', '--final').code, 2, 'one moment at a time');
  assert.equal(run(dir, 'gate', 'things', '--ticket', '7', '--since', sha).code, 1, 'a ticket that does not exist');
});

// 0.52.0: measured on the pilot project's data-import-2 (2026-11-24): the full-stack-developer ran the ticket's gate
// (140 to 181 s) and the Engineer ran the same gate on the same code again (142 to 145 s), for each ticket.
test("a ticket's gate that was green on this code answers from its receipt, and runs again when the code changes", () => {
  const { dir, sha } = project({ tickets: { '01-create': ticket('1, 2, 3', 'built') } });
  const git = (...argv) => spawnSync('git', ['-c', 'user.email=probe@example.com', '-c', 'user.name=probe', ...argv], { cwd: dir, encoding: 'utf8' });
  const gate = (...more) => run(dir, 'gate', 'things', '--ticket', '1', '--since', sha, ...more);
  // the affected tests run through turbo, which the probe project does not install: a local bin that exits 0
  fs.mkdirSync(path.join(dir, 'node_modules', '.bin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules', '.bin', 'turbo'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'node_modules', '.bin', 'turbo.cmd'), '@exit /b 0\r\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\n');
  // a dirty tree is nobody's sha: the gate runs and keeps no receipt
  assert.doesNotMatch(gate().out, /receipt:/);
  assert.doesNotMatch(gate().out, /receipt:/);
  git('add', '-A');
  git('commit', '-q', '-m', 'ticket 01');
  const first = gate();
  assert.equal(first.code, 0, first.out);
  assert.doesNotMatch(first.out, /receipt:/);
  // the ticket's own notes change after the gate, and they are not the code
  fs.appendFileSync(path.join(dir, '.scratch', 'things', 'issues', '01-create.md'), '\n\n**Built:** abc\n');
  git('commit', '-q', '-am', 'docs: ticket 01 built');
  const again = gate();
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /R build +exit 0/);
  assert.match(again.out, /^goal gate: green$/m);
  assert.match(again.out, /receipt: green at [0-9a-f]{8} on \S+, and nothing outside \.scratch\/ changed since: not run again \(--rerun runs it\)/);
  assert.doesNotMatch(gate('--rerun').out, /receipt:/);
  // another starting point, or code that moved, is another gate
  const base = git('rev-parse', 'HEAD~1').stdout.trim();
  assert.doesNotMatch(run(dir, 'gate', 'things', '--ticket', '1', '--since', base).out, /receipt:/);
  fs.writeFileSync(path.join(dir, 'index.js'), '// product code\n');
  assert.doesNotMatch(gate().out, /receipt:/, 'an uncommitted change');
  git('add', '-A');
  git('commit', '-q', '-m', 'feat: more');
  const moved = gate();
  assert.doesNotMatch(moved.out, /receipt:/, 'a new commit of product code');
  // a red gate keeps no receipt: it is run again
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'probe', private: true, scripts: { build: exit(2), test: exit(0) } }, null, 2));
  git('commit', '-q', '-am', 'feat: red');
  assert.equal(gate().code, 1);
  assert.doesNotMatch(gate().out, /receipt:/);
  assert.match(read('commands/engineer.md'), /Green already on this code, by whoever built the ticket, it prints `receipt:` and runs nothing again/);
  assert.match(read('agents/full-stack-developer.md'), /The Engineer's same command reads your gate's receipt and runs nothing again/);
});

test('a round past the budget is not ready without the founder\'s "extended" amendment', () => {
  const evidence = '| 1 | 1 | not met | x |\n| 2 | 1 | met | x |\n| 3 | 1 | met | x |\n| 1 | 2 | not met | x |\n| 1 | 3 | met | x |\n';
  const { dir } = project({ goalText: contract({ rounds: 2, evidence }) });
  const res = run(dir, 'check', '--ready', 'things');
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /not ready: round 3 is past the budget of 2 rounds, and no "extended" amendment gives it/);

  const extended = project({ goalText: contract({ rounds: 2, evidence, amendments: '| 2026-11-15 | budget | extended: one more round | founder | none |\n' }) });
  assert.equal(run(extended.dir, 'check', '--ready', 'things').code, 0);
  const two = project({ goalText: contract({ rounds: 1, evidence, amendments: '| 2026-11-15 | budget | extended: 2 more rounds | founder | none |\n' }) });
  assert.equal(run(two.dir, 'check', '--ready', 'things').code, 0, 'the number in the cell is the rounds it gives');
});

test('goal next walks the goal from the disk, one step at a time', () => {
  const next = (options) => run(project(options).dir, 'next', 'things').out;
  assert.match(next({ goalText: null }), /step 3 +write the contract with to-goal/);
  assert.match(next({ goalText: contract({ status: 'proposed' }) }), /step 4 +the contract waits for the founder: gate 2/);
  assert.match(next({ baseline: false }), /step 5 +cut the branch and start the baseline/);
  assert.match(next({}), /step 6 +dispatch one full-stack-developer for the plan/);

  const building = next({ tickets: { '01-create': ticket('1, 2', 'built'), '02-archive': ticket('3', 'ready', '01') } });
  assert.match(building, /step 7 +checkpoint of ticket 01: npm run goal -- gate things --ticket 1 --since <previous checkpoint sha>, then write its Status: verified$/m);
  const after = next({ tickets: { '01-create': ticket('1, 2', 'verified'), '02-archive': ticket('3', 'ready', '01') } });
  assert.match(after, /step 7 +a new full-stack-developer for ticket 02/);
  const held = next({ tickets: { '01-create': ticket('1, 2', 'open'), '02-archive': ticket('3', 'ready', '01') } });
  assert.match(held, /step 7 +ticket 01 is open: write "Carried:"/);
  const closed = { '01-create': ticket('1, 2', 'verified'), '02-archive': ticket('3', 'verified', '01') };
  assert.match(next({ tickets: closed }), /step 8 +final verification: npm run goal -- gate things --final/);

  const round = (evidence, rounds = 3) => next({ tickets: closed, goalText: contract({ rounds, evidence }) });
  assert.match(round('| 1 | 1 | not met | x |\n| 2 | 1 | met | x |\n| 3 | 1 | met | x |\n'), /step 9 +round 2 for criteria 1: a new full-stack-developer/);
  const second = round('| 1 | 1 | not met | x |\n| 2 | 1 | met | x |\n| 3 | 1 | met | x |\n| 1 | 2 | weak proof | x |\n');
  assert.match(second, /round 3 for criteria 1[^\n]*on their second failure: Class: and Closed by:[^\n]*on fable/);
  assert.match(round('| 1 | 1 | not met | x |\n| 2 | 1 | met | x |\n| 3 | 1 | met | x |\n', 1), /step 9 +the budget is spent \(1 of 1 rounds\) with criteria 1 open: read docs\/risk-policy\.md/);
  assert.match(round('| 1 | 1 | met | x |\n| 2 | 1 | met | x |\n| 3 | 1 | met | x |\n'), /step 10 +pull request/);
});

test('goal next says when the audit of every five roadmap items is due', () => {
  const { dir } = project({});
  const items = (n) => Array.from({ length: n }, (_, i) => `- [x] item-${i} — done`).join('\n');
  fs.writeFileSync(path.join(dir, 'docs', 'roadmap.md'), `# Roadmap\n\n${items(3)}\nAudited on 2026-11-01, through item-2\n${items(4)}\n- [ ] things — next\n`);
  assert.doesNotMatch(run(dir, 'next', 'things').out, /audit is due/);
  fs.writeFileSync(path.join(dir, 'docs', 'roadmap.md'), `# Roadmap\n\n${items(1)}\nAudited on 2026-11-01, through item-0\n${items(5)}\n- [ ] things — next\n`);
  assert.match(run(dir, 'next', 'things').out, /the quick audit is due \(5 items since the last "Audited on" line\)/);
  assert.equal(JSON.parse(run(dir, 'next', 'things', '--json').out).audit, true);
});

test('the command walks by goal next and gates by goal gate, and the quality-engineer does not rerun a green proof', () => {
  const command = read('commands/engineer.md');
  assert.match(command, /`npm run goal -- next <slug>`/);
  assert.match(command, /`npm run goal -- gate <slug> --ticket <NN> --since <previous checkpoint sha>`/);
  assert.match(command, /`npm run goal -- gate <slug> --final`/);
  assert.match(command, /\*\*Deterministic, yours, one command, first and alone:\*\* `npm run goal -- gate <slug> --final`/);
  assert.match(command, /The other two layers start after it, never beside it/);
  assert.match(command, /a raw log is never committed/);
  const qe = read('agents/quality-engineer.md');
  assert.match(qe, /the gate's `R` lines/);
  assert.match(qe, /run again only the proof you judge weak, or the one your refutation needs/);
});
