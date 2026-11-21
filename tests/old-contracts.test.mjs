// A newer goal.mjs and the contracts an older one accepted (0.47.0, issue 88): on the pilot project two met contracts,
// written before the checker knew their shape, held `goal check` red until a whole ticket reformatted them.
//   node --test tests/old-contracts.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const goal = path.join(plugin, 'skills', 'monolith', 'config-project', 'assets', 'scripts', 'goal.mjs');
const sync = path.join(plugin, 'skills', 'monolith', 'config-project', 'scripts', 'tooling-sync.mjs');

// a contract with a status and nothing a checker accepts
const contract = (status) => `# Goal: x\n\nStatus: ${status}\n\n## Objective\n\nx\n`;

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'old-contracts-'));
  fs.mkdirSync(path.join(dir, 'docs', 'goals'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{ "name": "probe", "private": true, "scripts": {} }\n');
  fs.writeFileSync(path.join(dir, 'docs', 'goals', 'done.md'), contract('met on 2026-10-01'));
  return dir;
}
const run = (dir, script, ...args) => {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};

test('a finished contract is history to `goal check` of every contract, and checked in full when named', () => {
  const dir = project();
  const all = run(dir, goal, 'check');
  assert.equal(all.code, 0, all.out);
  assert.match(all.out, /note: {2}history \(finished, not reformatted\): no success criterion found/);
  assert.equal(run(dir, goal, 'check', 'done').code, 1);
  fs.writeFileSync(path.join(dir, 'docs', 'goals', 'open.md'), contract('approved by the founder on 2026-11-01'));
  assert.equal(run(dir, goal, 'check').code, 1, 'an open contract is never history');
});

test('tooling-sync --check names the contracts the plugin\'s checker refuses, with the error', () => {
  const dir = project();
  fs.writeFileSync(path.join(dir, 'docs', 'goals', 'open.md'), contract('approved by the founder on 2026-11-01'));
  const res = run(dir, sync, '--check');
  assert.match(res.out, /contracts the plugin's goal check refuses[^\n]*\n {4}docs\/goals\/open\.md\n(?: {6}error: [^\n]*\n)*? {6}error: no success criterion found/);
  assert.doesNotMatch(res.out, /docs\/goals\/done\.md\n/);
});
