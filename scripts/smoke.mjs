#!/usr/bin/env node
// Smoke do bootstrap: roda as skills de monólito a partir do repo do plugin
// (como o plugin instalado faz), num projeto temporário. Sai 1 no primeiro
// passo que falhar, mostrando as últimas 30 linhas da saída.
// SMOKE_KEEP=1 preserva o projeto gerado para inspeção.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
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
// portas livres por rodada: o smoke não pode colidir com o Postgres/API de outro projeto nem com outro smoke na máquina
const freePort = () =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
const dbPort = await freePort();
const apiPort = await freePort();
const webPort = await freePort();
// compose project per run: `apps/backend` alone would name the network/volume `backend_*` in every run
const dbCompose = `docker compose -p ${path.basename(root).toLowerCase()}-db`;

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

// prova do schema do .env: um JWT_SECRET curto derruba o processo antes de qualquer conexão, nomeando a variável
await step('backend-refuses-bad-env', () => {
  const res = spawnSync('node dist/main.js', {
    cwd: backendDir,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, JWT_SECRET: 'short' },
  });
  const out = `${res.stdout}${res.stderr}`;
  fs.appendFileSync(logFile, `\n===== [backend-refuses-bad-env]\n${out}`);
  if (res.status === 0 || !out.includes('Invalid environment') || !out.includes('JWT_SECRET')) {
    throw new Error(`expected a non-zero exit naming JWT_SECRET, got exit ${res.status}\n${out}`);
  }
});

async function expectStatus(url, status) {
  const response = await fetch(url);
  if (response.status !== status) throw new Error(`${url}: expected ${status}, got ${response.status} ${await response.text()}`);
  return response;
}

// prova de segurança: sem token, GET / responde 401 pelo guard global, no envelope do ApiExceptionFilter.
// Precisa do Postgres (PrismaService faz SELECT 1 ao subir); sem Docker, o passo é pulado e dito.
if (spawnSync('docker info', { shell: true, stdio: 'ignore' }).status === 0) {
  run('db-up', `${dbCompose} up -d --wait postgres`, { cwd: backendDir });
  // the e2e needs tables: db push creates the bootstrap model without the interactive migrate dev
  run('db-push', 'npx prisma db push', { cwd: backendDir });
  // generated e2e as is: GET / is 401, GET /probe is 401 without token and within the query budget with one
  run('test-e2e', 'npm --workspace apps/backend run test:e2e');

  // capacity is a test (architecture rule 11): plant an N+1 in the example adapter, the budget test must fail naming it
  await step('query-budget-catches-n-plus-1', () => {
    const moduleDir = path.join(backendDir, 'src', 'modules', 'probe');
    const adapter = path.join(moduleDir, 'probe.prisma.ts');
    const controller = path.join(moduleDir, 'probe.controller.ts');
    const originals = [adapter, controller].map((file) => [file, fs.readFileSync(file, 'utf8')]);
    fs.writeFileSync(path.join(root, 'seed-rows.sql'), 'INSERT INTO "PrismaBootstrap" ("id", "updatedAt") SELECT gen_random_uuid()::text, now() FROM generate_series(1, 5);\n');
    run('seed-rows', 'npx prisma db execute --file ../../seed-rows.sql', { cwd: backendDir });
    fs.writeFileSync(adapter, `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service.js';

@Injectable()
export class ProbePrisma {
  constructor(private readonly prisma: PrismaService) {}

  // planted N+1: one query for the list, then one per row (sequential: Prisma batches concurrent findUnique into one IN)
  async list() {
    const rows = await this.prisma.client.prismaBootstrap.findMany();
    const hydrated = [];
    for (const row of rows) hydrated.push(await this.prisma.client.prismaBootstrap.findUnique({ where: { id: row.id } }));
    return hydrated;
  }
}
`);
    fs.writeFileSync(controller, `import { Controller, Get } from '@nestjs/common';
import { ProbePrisma } from './probe.prisma.js';

@Controller('probe')
export class ProbeController {
  constructor(private readonly probe: ProbePrisma) {}

  @Get()
  list() {
    return this.probe.list();
  }
}
`);
    const res = spawnSync('npm --workspace apps/backend run test:e2e', { cwd: root, shell: true, encoding: 'utf8', env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
    for (const [file, content] of originals) fs.writeFileSync(file, content);
    const out = `${res.stdout}${res.stderr}`;
    fs.appendFileSync(logFile, `\n===== [query-budget-catches-n-plus-1]\n${out}`);
    if (res.status === 0 || !/query budget is 2, got 6/.test(out)) {
      throw new Error(`expected test:e2e to fail with "query budget is 2, got 6", got exit ${res.status}\n${out.trimEnd().split(/\r?\n/).slice(-40).join('\n')}`);
    }
  });

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
  // p95 budget per route (architecture rule 11): perf.mjs boots dist/main.js itself and fails over budget or on any non-2xx
  console.log(run('perf', 'npm run perf').trim().split(/\r?\n/).slice(-12).join('\n'));
  run('db-down', `${dbCompose} down -v`, { cwd: backendDir });

  // a receita de release como o platform-engineer roda: .env da raiz, `npm run release` (builda as duas imagens,
  // `prisma migrate deploy` no serviço migrate, sobe e espera healthy), depois as sondas que a missão Release exige
  await step('release-env', () => {
    const env = [
      'POSTGRES_PASSWORD=smoke',
      `JWT_SECRET=${randomBytes(32).toString('hex')}`,
      `BACKEND_PORT=${apiPort}`,
      `FRONTEND_PORT=${webPort}`,
      `FRONTEND_URL=http://localhost:${webPort}`,
      `NEXT_PUBLIC_API_URL=http://localhost:${apiPort}`,
    ];
    fs.writeFileSync(path.join(root, '.env'), `${env.join('\n')}\n`);
  });
  try {
    run('release', 'npm run release');
    await step('release-probes', async () => {
      await expectStatus(`http://localhost:${apiPort}/health`, 200);
      await expectStatus(`http://localhost:${apiPort}/ready`, 200);
      const unauthorized = await expectStatus(`http://localhost:${apiPort}/`, 401);
      if (unauthorized.headers.get('x-request-id') === null) throw new Error('401 response carries no x-request-id');
      await expectStatus(`http://localhost:${webPort}/`, 200);
      // the log is JSON lines and the 401 above left one with its requestId
      const logs = spawnSync('docker compose -f docker-compose.prod.yml logs --no-log-prefix backend', { cwd: root, shell: true, encoding: 'utf8' }).stdout;
      fs.appendFileSync(logFile, `\n===== [release-probes] backend logs\n${logs}`);
      const lines = logs.split(/\r?\n/).filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } });
      if (lines.some((line) => line === null)) throw new Error(`backend wrote a non-JSON log line\n${logs}`);
      if (!lines.some((line) => line.requestId === unauthorized.headers.get('x-request-id') && line.res?.statusCode === 401)) {
        throw new Error(`no JSON log line with the requestId of the 401\n${logs}`);
      }
    });
  } finally {
    // images are named after the temp dir: remove them too, or every run leaves two behind
    spawnSync('docker compose -f docker-compose.prod.yml down -v --rmi all', { cwd: root, shell: true, stdio: 'ignore' });
  }
} else {
  console.log('[STEP] test-e2e, query-budget-catches-n-plus-1, api-401-without-token, perf, release → skipped (docker not available)');
}

if (process.env.SMOKE_KEEP) {
  console.log(`smoke OK (project kept at ${root})`);
} else {
  fs.rmSync(root, { recursive: true, force: true });
  console.log('smoke OK');
}
