// check:pr proves the gitleaks digest pinned in ci.yml whenever Docker answers (0.48.0, issue 99): on the pilot project a
// zeroed digest still said "ok gitleaks", because a local binary of the pinned version was run instead of the image.
//   node --test tests/gitleaks-pin.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { tmpDir } from './tmp.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(plugin, 'skills', 'monolith', 'config-project', 'assets');
const docker = spawnSync('docker', ['version', '--format', '{{.Server.Version}}']).status === 0;

test('a zeroed gitleaks digest fails check:pr when Docker answers', { skip: !docker && 'no Docker here' }, () => {
  const dir = tmpDir('gitleaks-pin-');
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
  const ci = fs.readFileSync(path.join(assets, 'workflows', 'ci.yml'), 'utf8').replace(/(gitleaks:v[\d.]+@sha256:)[0-9a-f]{64}/, `$1${'0'.repeat(64)}`);
  fs.writeFileSync(path.join(dir, '.github', 'workflows', 'ci.yml'), ci);
  fs.writeFileSync(path.join(dir, 'package.json'), '{ "name": "probe", "private": true, "scripts": {} }\n');
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD').stdout.trim();
  git('checkout', '-q', '-b', 'feat/x');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'feat: x');
  const res = spawnSync(process.execPath, [path.join(assets, 'scripts', 'check-pr.mjs'), '--base', base], { cwd: dir, encoding: 'utf8' });
  const out = res.stdout + res.stderr;
  assert.equal(res.status, 1, out);
  assert.match(out, /gitleaks: the pinned image ghcr\.io\/gitleaks\/gitleaks:v[\d.]+@sha256:0{64}/);
  assert.match(out, /FAIL\s+gitleaks/);
});
