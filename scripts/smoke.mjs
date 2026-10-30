#!/usr/bin/env node
// Smoke do bootstrap: roda as skills de monólito a partir do repo do plugin
// (como o plugin instalado faz), num projeto temporário. Sai 1 no primeiro
// passo que falhar, mostrando as últimas 30 linhas da saída.
// SMOKE_KEEP=1 preserva o projeto gerado para inspeção.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = path.join(plugin, 'skills', 'monolith');
const scope = '@smoke';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spectree-smoke-'));
const logFile = path.join(root, 'smoke.log');
const backendDir = path.join(root, 'apps', 'backend');
// portas fora do padrão: o smoke não pode colidir com o Postgres/API de outro projeto na máquina
const dbPort = 54329;
const apiPort = 4321;

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

async function step(name, fn) {
  try {
    await fn();
    console.log(`[STEP] ${name} → exit 0`);
  } catch (error) {
    console.log(`[STEP] ${name} → exit 1`);
    console.log(error.stack ?? String(error));
    console.log(`\nfull log: ${path.join(root, 'smoke.log')}`);
    process.exit(1);
  }
}

const node = (rel, args = '') => `node "${path.join(skills, rel)}" ${args}`.trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

run('project-init', node('config-project/scripts/project-init.mjs', `--scope ${scope} --backend-port ${apiPort} --skip-global-nest`));

await step('shared-package', () => {
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
  for (const env of ['.env', '.env.example']) {
    const envPath = path.join(backendDir, env);
    fs.writeFileSync(envPath, fs.readFileSync(envPath, 'utf8').replace('localhost:5432', `localhost:${dbPort}`));
  }
});
run('npm-install-shared', 'npm install --no-audit --no-fund');

run('config-shared-backend', node('config-shared-backend/scripts/apply.js'));
run('config-prisma', node('config-prisma/scripts/init-prisma-backend.js', '--apply --install'));
run('prisma-generate', 'npm --workspace apps/backend run prisma:generate');
run('config-shared-frontend', node('config-shared-frontend/scripts/apply.mjs'));
run('create-module', node('config-new-module/scripts/create-module.mjs', 'probe'));
run('create-aggregate', node('module-aggregate/scripts/create-aggregate.js', '--module probe --aggregate thing --mode crud'));

await step('check-boundaries-catches-a-leak', () => {
  const leak = path.join(root, 'modules', 'probe', 'src', 'leak.ts');
  fs.writeFileSync(leak, "import { Module } from '@nestjs/common';\nexport const leak = Module;\n");
  const res = spawnSync('node scripts/check-boundaries.mjs', { cwd: root, shell: true, encoding: 'utf8' });
  fs.rmSync(leak);
  fs.appendFileSync(logFile, `\n===== [check-boundaries-catches-a-leak]\n${res.stdout}${res.stderr}`);
  if (res.status === 0 || !res.stderr.includes('@nestjs/common')) {
    throw new Error(`expected exit 1 naming @nestjs/common, got exit ${res.status}\n${res.stdout}${res.stderr}`);
  }
});

// sem migration: o `npm test` do Nest é só unitário (e2e fica em test:e2e, que exige Postgres e não roda aqui)
run('build', 'npm run build');
run('test', 'npm test');

// prova de segurança: sem token, GET / responde 401 pelo guard global, no envelope do ApiExceptionFilter.
// Precisa do Postgres (PrismaService faz SELECT 1 ao subir); sem Docker, o passo é pulado e dito.
if (spawnSync('docker info', { shell: true, stdio: 'ignore' }).status === 0) {
  run('db-up', 'docker compose up -d --wait postgres', { cwd: backendDir });
  await step('api-401-without-token', async () => {
    const api = spawn('node', ['dist/main.js'], { cwd: backendDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    api.stdout.on('data', (chunk) => (output += chunk));
    api.stderr.on('data', (chunk) => (output += chunk));
    try {
      const deadline = Date.now() + 60_000;
      let response = null;
      while (!response && Date.now() < deadline) {
        if (api.exitCode !== null) throw new Error(`backend exited with ${api.exitCode}\n${output}`);
        await sleep(500);
        response = await fetch(`http://localhost:${apiPort}/`).catch(() => null);
      }
      if (!response) throw new Error(`backend did not answer on :${apiPort} in 60s\n${output}`);
      const body = await response.json();
      if (response.status !== 401 || body.statusCode !== 401) {
        throw new Error(`expected 401 envelope, got ${response.status} ${JSON.stringify(body)}\n${output}`);
      }
    } finally {
      api.kill();
      fs.appendFileSync(logFile, `\n===== [api-401-without-token]\n${output}`);
    }
  });
  run('db-down', 'docker compose down -v', { cwd: backendDir });
} else {
  console.log('[STEP] api-401-without-token → skipped (docker not available)');
}

if (process.env.SMOKE_KEEP) {
  console.log(`smoke OK (project kept at ${root})`);
} else {
  fs.rmSync(root, { recursive: true, force: true });
  console.log('smoke OK');
}
