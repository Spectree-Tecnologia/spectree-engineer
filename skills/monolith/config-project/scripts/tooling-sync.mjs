#!/usr/bin/env node
// Brings the squad's scripts in a project up to the plugin's: a project bootstrapped by an older version never got
// the scripts that came later (`goal`, `db:scratch`), and never gets a fix to the ones it has. Run from the project
// root, by the platform-engineer, on the goal's branch before the baseline.
//
//   node <plugin>/skills/monolith/config-project/scripts/tooling-sync.mjs --check          what is behind; exit 1 if anything is
//   node <plugin>/skills/monolith/config-project/scripts/tooling-sync.mjs --apply          copies what is missing or untouched; exit 1 if a file still differs
//   node <plugin>/skills/monolith/config-project/scripts/tooling-sync.mjs --keep <file>    the project's own version of <file> stays, reviewed against this plugin
//
// A script the project changed is never overwritten: it is listed as `differs`, someone reads the two versions,
// brings over what the plugin added, and records the decision with --keep. The record lives in
// scripts/.squad-tooling.json, with the hash each script had when the plugin installed it.
//
// The same run appends to docs/architecture.md the numbered rules the plugin has and the project lacks.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, '..', 'assets', 'scripts');
const plugin = JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
const root = process.cwd();
const stampFile = path.join(root, 'scripts', '.squad-tooling.json');
// The npm script each asset is run by. An entry the project already has is never rewritten.
const NPM_SCRIPTS = {
  perf: 'node scripts/perf.mjs',
  worktree: 'node scripts/worktree.mjs',
  mutation: 'node scripts/mutation.mjs',
  'check:pr': 'node scripts/check-pr.mjs',
  'db:scratch': 'node scripts/db-scratch.mjs',
  goal: 'node scripts/goal.mjs',
};

const fail = (message, code = 2) => {
  console.error(`tooling-sync: ${message}`);
  process.exit(code);
};
const [mode, target, ...rest] = process.argv.slice(2);
if (!['--check', '--apply', '--keep'].includes(mode) || rest.length > 0 || (mode === '--keep') !== Boolean(target)) {
  fail('usage: tooling-sync.mjs --check | --apply | --keep <scripts/file.mjs>');
}
if (!fs.existsSync(path.join(root, 'package.json'))) fail('no package.json here: run it from the project root');

// The same file checked out with CRLF is the same file.
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const stamp = fs.existsSync(stampFile) ? JSON.parse(fs.readFileSync(stampFile, 'utf8')) : {};
stamp.installed ??= {};
stamp.kept ??= {};

const files = fs.readdirSync(assets).filter((name) => name.endsWith('.mjs')).sort().map((name) => {
  const rel = `scripts/${name}`;
  const asset = path.join(assets, name);
  const mine = path.join(root, rel);
  const wanted = hash(asset);
  let state;
  if (!fs.existsSync(mine)) state = 'missing';
  else {
    const current = hash(mine);
    if (current === wanted) state = 'same';
    // untouched since the plugin installed it: safe to replace
    else if (stamp.installed[rel] === current) state = 'outdated';
    // the project's own version, already read against this very asset
    else if (stamp.kept[rel] === wanted) state = 'kept';
    else state = 'differs';
  }
  return { rel, asset, mine, wanted, state };
});

const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.scripts ??= {};
const missingScripts = Object.keys(NPM_SCRIPTS).filter((name) => !(name in pkg.scripts));

// The numbered rules of docs/architecture.md: a rule the plugin gained after the project was bootstrapped is appended
// below the last one. A row the project has is never rewritten, whatever it says.
// shortcut: a project that gave its own rule a number the plugin uses keeps it and never gets the plugin's rule;
// compare the rows by title when a project does that.
// The project's formatter pads the cells (`| 14  |`), so a row is told by its number, whatever the spacing.
const rulesOf = (text) => new Map([...text.matchAll(/^\|\s*(\d+)\s*\|.*$/gm)].map((row) => [Number(row[1]), row[0].trimEnd()]));
const architectureFile = path.join(root, 'docs', 'architecture.md');
const architecture = fs.existsSync(architectureFile) ? fs.readFileSync(architectureFile, 'utf8') : '';
const projectRules = rulesOf(architecture);
const missingRules =
  projectRules.size === 0 ? [] : [...rulesOf(fs.readFileSync(path.join(here, '..', '..', '..', '..', 'ARCHITECTURE.md'), 'utf8'))].filter(([number]) => !projectRules.has(number));

const writeStamp = () => {
  stamp.plugin = plugin;
  fs.mkdirSync(path.dirname(stampFile), { recursive: true });
  fs.writeFileSync(stampFile, `${JSON.stringify({ plugin: stamp.plugin, installed: stamp.installed, kept: stamp.kept }, null, 2)}\n`);
};

if (mode === '--keep') {
  const rel = target.replace(/\\/g, '/');
  const file = files.find((one) => one.rel === rel);
  if (!file) fail(`${rel} is not one of the squad's scripts (${files.map((one) => one.rel).join(', ')})`);
  if (file.state === 'missing') fail(`${rel} does not exist here: --apply copies it`, 1);
  stamp.kept[rel] = file.wanted;
  delete stamp.installed[rel];
  writeStamp();
  console.log(`tooling-sync: ${rel} stays as the project has it, reviewed against plugin ${plugin}`);
  process.exit(0);
}

if (mode === '--apply') {
  for (const file of files) {
    if (file.state === 'missing' || file.state === 'outdated') {
      fs.mkdirSync(path.dirname(file.mine), { recursive: true });
      fs.copyFileSync(file.asset, file.mine);
      file.done = file.state === 'missing' ? 'added' : 'updated';
      file.state = 'same';
    }
    // what the project has is what the plugin installed: from here on a change to it is the project's
    if (file.state === 'same') stamp.installed[file.rel] = file.wanted;
  }
  if (missingScripts.length > 0) {
    for (const name of missingScripts) pkg.scripts[name] = NPM_SCRIPTS[name];
    fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  if (missingRules.length > 0) {
    const eol = architecture.includes('\r\n') ? '\r\n' : '\n';
    const last = [...projectRules.values()].at(-1);
    const at = architecture.indexOf(last) + last.length;
    fs.writeFileSync(architectureFile, architecture.slice(0, at) + missingRules.map(([, row]) => eol + row).join('') + architecture.slice(at));
    // the project formats its markdown: leave the table the way its formatter wants it
    if (pkg.devDependencies?.prettier) spawnSync('npx prettier --write docs/architecture.md', { cwd: root, shell: true, stdio: 'ignore' });
  }
  writeStamp();
}

const behind = files.filter((file) => ['missing', 'outdated', 'differs'].includes(file.state));
const scriptsBehind = mode === '--check' ? [...missingScripts, ...missingRules] : [];
console.log(`tooling-sync ${mode.slice(2)}: plugin ${plugin}, project stamped ${stamp.plugin ?? 'never'}`);
for (const file of files) console.log(`  ${(file.done ?? file.state).padEnd(8)}  ${file.rel}`);
for (const name of missingScripts) console.log(`  ${mode === '--apply' ? 'added   ' : 'missing '}  package.json script "${name}"`);
for (const [number] of missingRules) console.log(`  ${mode === '--apply' ? 'added   ' : 'missing '}  docs/architecture.md rule ${number}`);
const differs = files.filter((file) => file.state === 'differs');
if (differs.length > 0) {
  console.log('\n  differs: the project changed this script, so it was not touched. Read both versions, bring over what the');
  console.log('  plugin added, then record that the project\'s version stays:');
  for (const file of differs) console.log(`    diff ${file.rel} ${path.relative(root, file.asset) || file.asset}\n    node ${path.relative(root, fileURLToPath(import.meta.url))} --keep ${file.rel}`);
}
process.exit(behind.length + scriptsBehind.length === 0 ? 0 : 1);
