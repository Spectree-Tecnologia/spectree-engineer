#!/usr/bin/env node
// What a ready pull request runs of the Playwright suite, from its diff: `full`, or the specs it can reach.
// Measured on the pilot project (2026-11-19): every ready pull request of a week ran the whole suite (437-469 tests,
// 8-10 min of a 2-vCPU runner), because any file under e2e/ that was not a spec counted as "the harness", and almost
// every goal edits a state helper that one to eight specs import. Run by ci.yml's scope step and by hand:
//
//   node scripts/e2e-scope.mjs <base-ref>        prints `full` or the specs, relative to apps/frontend, one line
//
// The specs it chooses: the smoke (apps/frontend/e2e/smoke.txt), every spec the diff adds or edits, and every spec
// that reaches a changed e2e module through its imports or names it in a string (a fixture a spec spawns). `full`
// when the change can reach every spec in a way this script does not read: playwright.config.*, a file under e2e/
// that is not a module (an env file, a fixture's data), a deleted or renamed module, a changed module nothing names,
// package-lock.json (the Playwright version and every dependency), or a selection that already covers every spec.
// The application's own code is not followed: a change to it runs the smoke and the specs written for it, as before.
// Exit 1 names a refused spec (a smoke entry that does not exist, a name outside [A-Za-z0-9_.-]); exit 2 when git
// cannot give the diff.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND = 'apps/frontend/';
const E2E = `${FRONTEND}e2e/`;
const SMOKE = `${E2E}smoke.txt`;
const SPEC = /^e2e\/[A-Za-z0-9_.-]+\.spec\.ts$/;
const MODULE = /\.(ts|mts|cts|js|mjs|cjs)$/;

const base = process.argv[2];
if (!base || process.argv.length > 3) {
  console.error('usage: node scripts/e2e-scope.mjs <base-ref>');
  process.exit(2);
}
const git = (args) => {
  const res = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) {
    console.error(`e2e-scope: git ${args.join(' ')} failed: ${res.stderr.trim()}`);
    process.exit(2);
  }
  return res.stdout.split('\0').filter(Boolean);
};
const full = (why) => {
  console.error(`e2e-scope: the whole suite: ${why}`);
  console.log('full');
  process.exit(0);
};

// --name-status -z: "<status>" NUL "<path>" NUL, renames as delete and add
const fields = git(['diff', '--no-renames', '-z', '--name-status', `${base}...HEAD`]);
const changes = [];
for (let i = 0; i < fields.length; i += 2) changes.push({ status: fields[i][0], file: fields[i + 1] });

const smokeSpecs = () => {
  const lines = fs
    .readFileSync(SMOKE, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);
  const wrong = lines.filter((l) => !SPEC.test(l) || !fs.existsSync(`${FRONTEND}${l}`));
  if (lines.length === 0 || wrong.length > 0) {
    console.error(`refused Playwright spec: ${wrong.join(', ') || '(smoke.txt lists none)'} (e2e/<name>.spec.ts, an existing file)`);
    process.exit(1);
  }
  return lines;
};

if (!fs.existsSync(SMOKE)) full(`${SMOKE} does not exist`);
const smoke = smokeSpecs();

if (changes.some((c) => c.file === 'package-lock.json')) full('package-lock.json changed');
const config = changes.find((c) => c.file.startsWith(`${FRONTEND}playwright.config.`));
if (config) full(`${config.file} changed`);

const inE2e = changes.filter((c) => c.file.startsWith(E2E) && c.file !== SMOKE);
const notModule = inE2e.find((c) => !MODULE.test(c.file));
if (notModule) full(`${notModule.file} is not a module`);
const gone = inE2e.find((c) => c.status !== 'A' && c.status !== 'M');
if (gone) full(`${gone.file} was ${c2word(gone.status)}`);

function c2word(status) {
  return { D: 'deleted', T: 'retyped', U: 'unmerged' }[status] ?? `changed (${status})`;
}

// every module under e2e/, as paths relative to apps/frontend
const modules = fs
  .readdirSync(E2E, { recursive: true })
  .map((f) => `e2e/${String(f).split(path.sep).join('/')}`)
  .filter((f) => MODULE.test(f) && fs.statSync(`${FRONTEND}${f}`).isFile());
const specs = modules.filter((f) => f.endsWith('.spec.ts'));
const source = Object.fromEntries(modules.map((f) => [f, fs.readFileSync(`${FRONTEND}${f}`, 'utf8')]));

// a module names another when one of its strings ends in the other's name, with or without the extension:
// `from './login'`, `from './login.ts'`, `import('../e2e/login.js')`, `spawn('node', ['e2e/seed.mjs'])`
const stem = (f) => path.posix.basename(f).replace(MODULE, '');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const names = (from, target) =>
  new RegExp(`['"\`]([^'"\`\\n]*/)?${escape(stem(target))}(\\.(ts|mts|cts|js|mjs|cjs))?['"\`]`).test(source[from]);

const helpers = inE2e.filter((c) => !c.file.endsWith('.spec.ts')).map((c) => c.file.slice(FRONTEND.length));
// the modules that reach a changed helper, to a fixed point
const reached = new Set(helpers);
for (let grew = true; grew; ) {
  grew = false;
  for (const f of modules) {
    if (reached.has(f)) continue;
    if ([...reached].some((t) => names(f, t))) {
      reached.add(f);
      grew = true;
    }
  }
}
const orphan = helpers.find((h) => !modules.some((f) => f !== h && names(f, h)));
if (orphan) full(`e2e module ${orphan} changed and no module names it`);

const written = inE2e.filter((c) => c.file.endsWith('.spec.ts')).map((c) => c.file.slice(FRONTEND.length));
const refused = written.filter((s) => !SPEC.test(s));
if (refused.length > 0) {
  console.error(`refused Playwright spec: ${refused.join(', ')} (e2e/<name>.spec.ts)`);
  process.exit(1);
}
const chosen = [...new Set([...smoke, ...written, ...specs.filter((s) => reached.has(s))])].sort();
if (specs.every((s) => chosen.includes(s))) full('the selection covers every spec');
// a spec in a subfolder: ci.yml passes plain names only, so the whole suite rather than a path it refuses
const nested = chosen.find((s) => !SPEC.test(s));
if (nested) full(`${nested} is outside e2e/<name>.spec.ts`);
console.error(`e2e-scope: ${chosen.length} of ${specs.length} specs`);
console.log(chosen.join(' '));
