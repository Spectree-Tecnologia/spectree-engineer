#!/usr/bin/env node
// The start of a goal without an agent: the branch, the squad's tooling and the green baseline are commands with an
// exit code, and waiting for a command costs no token. Measured on the pilot project: the agent mission that did this took 27
// minutes and 9.3M tokens in one goal and 60 minutes and 9.2M in the next, with the full-stack-developer waiting for
// it; the part this script does took 5 of those 60 minutes. Run from the project root, by the orchestrator.
//
//   node <plugin>/skills/monolith/config-project/scripts/goal-start.mjs <slug> --branch <type>/<slug>
//       cuts the goal's branch (or switches to it), brings the squad's scripts up to the plugin (tooling-sync) and
//       commits that alone. Seconds. Prints the sha every later diff starts from. Exit 4: the project changed a script
//       the plugin also changed, and someone has to read both (the platform-engineer); the branch is cut.
//   node <plugin>/skills/monolith/config-project/scripts/goal-start.mjs <slug> --baseline [--e2e]
//       npm ci when the lockfile is newer than node_modules, then build, test and audit, in UTC as CI; --e2e adds the
//       backend e2e on a database of its own. Minutes: run it in the background. Writes .scratch/<slug>/baseline.md
//       and one log per step beside it. Exit 1: the baseline is red, which is a block and never a starting point.
//       Exit 3: green, and the audit found high or critical.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const fail = (message, code = 2) => {
  console.error(`goal-start: ${message}`);
  process.exit(code);
};
const [slug, mode, ...rest] = process.argv.slice(2);
const usage = 'usage: goal-start.mjs <slug> --branch <type>/<slug> | goal-start.mjs <slug> --baseline [--e2e]';
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug) || !['--branch', '--baseline'].includes(mode)) fail(usage);
if (!fs.existsSync(path.join(root, 'package.json'))) fail('no package.json here: run it from the project root');

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const head = () => git('rev-parse', 'HEAD').stdout.trim();

if (mode === '--branch') {
  const [branch, ...more] = rest;
  if (more.length > 0 || !new RegExp(`^(feat|fix|refactor|perf|chore)/${slug}$`).test(branch ?? '')) fail(`the branch is <type>/${slug}, with type feat, fix, refactor, perf or chore\n${usage}`);
  if (git('branch', '--show-current').stdout.trim() !== branch) {
    const exists = git('rev-parse', '--verify', '--quiet', `refs/heads/${branch}`).status === 0;
    const cut = exists ? git('switch', branch) : git('switch', '-c', branch);
    if (cut.status !== 0) fail(`could not ${exists ? 'switch to' : 'cut'} ${branch}: ${cut.stderr.trim().split(/\r?\n/)[0]}`, 1);
  }
  const sync = (flag) => spawnSync(process.execPath, [path.join(here, 'tooling-sync.mjs'), flag], { cwd: root, encoding: 'utf8' });
  const check = sync('--check');
  if (check.status === 2) fail(`tooling-sync could not run: ${check.stderr.trim()}`, 1);
  if (check.status === 1) {
    const applied = sync('--apply');
    process.stdout.write(applied.stdout);
    // only what the sync wrote is committed: whatever else is changed in the working tree is someone else's
    const touched = ['scripts/.squad-tooling.json', ...[...applied.stdout.matchAll(/^\s+(?:added|updated)\s+(scripts\/\S+\.mjs)$/gm)].map((m) => m[1])];
    if (/package\.json script/.test(applied.stdout)) touched.push('package.json');
    if (/turbo\.json build output/.test(applied.stdout)) touched.push('turbo.json');
    if (/docs\/architecture\.md rule/.test(applied.stdout)) touched.push('docs/architecture.md');
    if (applied.status !== 0) {
      console.error(`goal-start: branch ${branch} is cut, and a script the project changed differs from the plugin's (above). Reading both is a job for the platform-engineer: it finishes the sync and its commit.`);
      process.exit(4);
    }
    const version = JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
    const added = git('add', '--', ...touched);
    const commit = added.status === 0 ? git('commit', '-q', '-m', `chore(tooling): sync the squad's scripts to plugin ${version}`, '--', ...touched) : added;
    if (commit.status !== 0) fail(`the tooling was synced and could not be committed: ${(commit.stderr || commit.stdout).trim().split(/\r?\n/)[0]}`, 1);
    console.log(`goal-start: tooling synced to plugin ${version} in one commit`);
  } else console.log('goal-start: tooling already at the plugin, no commit');
  console.log(`goal-start: branch ${branch} at ${head()} (the baseline sha)`);
  process.exit(0);
}

// --baseline
if (rest.some((flag) => flag !== '--e2e')) fail(usage);
const dir = path.join(root, '.scratch', slug, 'baseline');
fs.mkdirSync(dir, { recursive: true });
const lock = path.join(root, 'package-lock.json');
const installed = path.join(root, 'node_modules', '.package-lock.json');
const stale = fs.existsSync(lock) && (!fs.existsSync(installed) || fs.statSync(installed).mtimeMs < fs.statSync(lock).mtimeMs);
const backend = path.join(root, 'apps', 'backend', 'package.json');
const hasE2e = fs.existsSync(backend) && Boolean(JSON.parse(fs.readFileSync(backend, 'utf8')).scripts?.['test:e2e']);
const steps = [
  stale ? { name: 'install', command: 'npm ci' } : null,
  { name: 'build', command: 'npm run build' },
  { name: 'test', command: 'npm test' },
  fs.existsSync(lock) ? { name: 'audit', command: 'npm audit --audit-level=high', advisory: true } : null,
  rest.includes('--e2e') && hasE2e ? { name: 'e2e', command: 'npm run db:scratch -- baseline -- npm -w apps/backend run test:e2e' } : null,
].filter(Boolean);
const sha = head();
const rows = [];
let red = false;
for (const step of steps) {
  // what comes after a red build or a red test would only repeat the same red
  if (red && !step.advisory) {
    rows.push({ ...step, status: 'not run' });
    continue;
  }
  const log = path.join(dir, `${step.name}.log`);
  const out = fs.openSync(log, 'w');
  const started = Date.now();
  const status = spawnSync(step.command, { cwd: root, shell: true, stdio: ['ignore', out, out], env: { ...process.env, TZ: 'UTC' } }).status ?? 1;
  fs.closeSync(out);
  rows.push({ ...step, status, seconds: Math.round((Date.now() - started) / 1000) });
  if (status !== 0 && !step.advisory) red = true;
  console.log(`goal-start: ${step.name.padEnd(7)} ${status === 0 ? 'exit 0' : `EXIT ${status}`}  ${rows.at(-1).seconds}s  ${step.command}`);
}
const audit = rows.find((row) => row.advisory && row.status !== 0);
const verdict = red ? 'RED: a block, never a starting point' : audit ? 'green; the audit found high or critical: a fix a simple bump gives is a criterion of this goal, a new major is a roadmap item' : 'green';
fs.writeFileSync(
  path.join(root, '.scratch', slug, 'baseline.md'),
  [
    `# Baseline: ${slug}`,
    '',
    `Baseline sha: \`${sha}\` (${git('branch', '--show-current').stdout.trim()}), recorded ${new Date().toISOString().slice(0, 16)}Z by goal-start, in UTC as CI.`,
    `Verdict: ${verdict}.`,
    '',
    '| Step | Command | Exit | Seconds | Log |',
    '|------|---------|------|---------|-----|',
    ...rows.map((row) => `| ${row.name} | \`${row.command}\` | ${row.status} | ${row.seconds ?? '-'} | \`.scratch/${slug}/baseline/${row.name}.log\` |`),
    '',
  ].join('\n'),
);
console.log(`goal-start: baseline of ${sha.slice(0, 8)} is ${verdict}; written to .scratch/${slug}/baseline.md`);
process.exit(red ? 1 : audit ? 3 : 0);
