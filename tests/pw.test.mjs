// scripts/pw.mjs (0.45.0, issues 117 and 120): a Playwright proof runs alone, and refuses before it starts anything
// when a server it did not start would answer the specs.
//   node --test tests/pw.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(plugin, 'skills', 'monolith', 'config-project', 'assets', 'scripts', 'pw.mjs');

function project({ backendPort, frontendPort, config = true }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-'));
  fs.mkdirSync(path.join(dir, 'apps', 'backend'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'apps', 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'apps', 'backend', '.env'), `PORT=${backendPort}\n`);
  fs.writeFileSync(path.join(dir, 'apps', 'frontend', '.env'), `PORT=${frontendPort}\n`);
  if (config) fs.writeFileSync(path.join(dir, 'apps', 'frontend', 'playwright.config.ts'), 'export default {};\n');
  return dir;
}
const run = (cwd, ...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
const listen = () =>
  new Promise((resolve) => {
    const server = net.createServer((socket) => socket.destroy()).listen(0, '127.0.0.1', () => resolve(server));
  });

test('a port that already answers is refused before the build, the database or a server', async () => {
  const server = await listen();
  const { port } = server.address();
  // the kernel completes the handshake from the backlog while spawnSync blocks this loop
  const r = run(project({ backendPort: 1, frontendPort: port }), 'ledger');
  server.close();
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, new RegExp(`port ${port} \\(frontend\\) already answers`));
  assert.doesNotMatch(r.stdout, /npm run build/);
});

test('a Playwright proof is the same line in the contract, the ticket and the card, and a project gets the script', () => {
  const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
  assert.match(read('skills/engineering/to-goal/SKILL.md'), /A proof by Playwright specs is ``run: `npm run pw -- <spec\.\.\.>` ``/);
  assert.match(read('skills/engineering/to-tickets/SKILL.md'), /A Playwright proof is `npm run pw -- <spec\.\.\.>`[^\n]*never a harness under `\.scratch\/`/);
  assert.match(read('agents/full-stack-developer.md'), /A Playwright spec runs through `npm run pw -- <spec\.\.\.>`/);
  assert.match(read('skills/monolith/config-project/scripts/tooling-sync.mjs'), /pw: 'node scripts\/pw\.mjs'/);
  assert.match(read('skills/monolith/config-project/scripts/project-init.mjs'), /pkg\.scripts\.pw = pkg\.scripts\.pw \?\? 'node scripts\/pw\.mjs'/);
});

test('no Playwright config, or a timeout that is not a number of minutes, is a usage error', () => {
  assert.equal(run(project({ backendPort: 1, frontendPort: 2, config: false })).status, 2);
  const dir = project({ backendPort: 1, frontendPort: 2 });
  for (const bad of [['--timeout', '0'], ['--timeout'], ['--headed']]) assert.equal(run(dir, ...bad).status, 2, bad.join(' '));
});
