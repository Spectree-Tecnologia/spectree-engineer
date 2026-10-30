#!/usr/bin/env node
// Smoke do bootstrap do curso rodando as skills a partir do repo do plugin
// (como o plugin instalado faz), num projeto temporário. Sai 1 no primeiro
// passo que falhar, mostrando as últimas 30 linhas da saída.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = path.join(plugin, 'skills', 'monolith');
const scope = '@smoke';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spectree-smoke-'));
const logFile = path.join(root, 'smoke.log');

console.log(`project: ${root}`);

function run(name, command, { cwd = root } = {}) {
  const t0 = Date.now();
  // one command string + shell: npm/npx are .cmd shims on Windows (and DEP0190 forbids args + shell)
  const res = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
  });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  fs.appendFileSync(logFile, `\n===== [${name}] ${command}\n${out}`);
  const code = res.status ?? 1;
  console.log(`[STEP] ${name} → exit ${code} (${Math.round((Date.now() - t0) / 1000)}s)`);
  if (code !== 0) {
    console.log(out.trimEnd().split(/\r?\n/).slice(-30).join('\n'));
    console.log(`\nfull log: ${path.join(root, 'smoke.log')}`);
    process.exit(1);
  }
  return out;
}

function step(name, fn) {
  try {
    fn();
    console.log(`[STEP] ${name} → exit 0`);
  } catch (error) {
    console.log(`[STEP] ${name} → exit 1`);
    console.log(error.stack ?? String(error));
    process.exit(1);
  }
}

const node = (rel, args = '') => `node "${path.join(skills, rel)}" ${args}`.trim();

run('project-init', node('config-project/scripts/project-init.mjs', `--scope ${scope} --skip-global-nest`));

step('shared-package', () => {
  const dest = path.join(root, 'packages', 'shared');
  fs.cpSync(path.join(plugin, 'templates', 'shared'), dest, { recursive: true });
  const pkgPath = path.join(dest, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = `${scope}/shared`;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  for (const app of ['apps/backend', 'apps/frontend']) {
    const appPkgPath = path.join(root, app, 'package.json');
    const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
    appPkg.dependencies = { ...appPkg.dependencies, [`${scope}/shared`]: '*' };
    fs.writeFileSync(appPkgPath, `${JSON.stringify(appPkg, null, 2)}\n`);
  }
});
run('npm-install-shared', 'npm install --no-audit --no-fund');

run('config-shared-backend', node('config-shared-backend/scripts/apply.js'));
run('config-prisma', node('config-prisma/scripts/init-prisma-backend.js', '--apply --install'));
run('prisma-generate', 'npm --workspace apps/backend run prisma:generate');
run('config-shared-frontend', node('config-shared-frontend/scripts/apply.mjs'));
run('create-module', node('config-new-module/scripts/create-module.mjs', 'probe'));
run('create-aggregate', node('module-aggregate/scripts/create-aggregate.js', '--module probe --aggregate thing --mode crud'));

// sem banco: nenhuma migration; o `npm test` do Nest é só unitário (e2e fica em test:e2e, que exige Postgres e não roda aqui)
run('build', 'npm run build');
run('test', 'npm test');

fs.rmSync(root, { recursive: true, force: true });
console.log('smoke OK');
