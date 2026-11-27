// The security-audit validators refuse every input where O_NOFOLLOW does not exist: the plugin ships a Windows entry
// point for each (validate-findings.cjs, and validate-coverage-ledger.cjs since 0.47.0, issue 107).
//   node --test tests/windows-wrappers.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { tmpDir } from './tmp.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrapper = path.join(plugin, 'skills', 'security', 'validate-coverage-ledger.cjs');

test('the coverage ledger is validated on any platform, by exit code', () => {
  const dir = tmpDir('ledger-');
  const check = (text) => {
    const file = path.join(dir, `${Math.random()}.json`);
    fs.writeFileSync(file, text);
    return spawnSync(process.execPath, [wrapper, file], { encoding: 'utf8' });
  };
  const empty = check('[]');
  assert.equal(empty.status, 0, empty.stderr);
  assert.match(empty.stdout, /PASS: 0 coverage units valid/);
  const missing = check('[{"x":1}]');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /missing required field "coverage_id"/);
  assert.equal(check('[').status, 1);
  assert.equal(spawnSync(process.execPath, [wrapper], { encoding: 'utf8' }).status, 2);
  assert.match(fs.readFileSync(path.join(plugin, 'commands', 'engineer.md'), 'utf8'), /`validate-coverage-ledger\.cjs` \(wrappers that work on Windows\)/);
});
