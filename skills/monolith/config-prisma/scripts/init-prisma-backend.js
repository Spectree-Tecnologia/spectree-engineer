#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const DEFAULT_PRISMA_VERSION = '7.4.2';
const DEFAULT_TSX_VERSION = '4.21.0';
const BACKEND_WORKSPACE = 'apps/backend';
const DEFAULT_DB = {
  host: 'localhost',
  port: '5432',
  user: 'docker',
  password: 'docker',
  database: 'docker',
  schema: 'public',
  // the app connects as this role; it owns nothing (architecture rule 12). Migrations and seed use the owner.
  appUser: 'app_runtime',
};
let createSkillRunLogger = null;
let createSkillRunOps = null;
let loadSkillConfig = null;
let resolveNamespace = null;

async function loadSkillLoggingUtils() {
  if (createSkillRunLogger && createSkillRunOps) return;

  const [loggerModule, opsModule] = await Promise.all([
    import('../../utils/skill-run-log.mjs'),
    import('../../utils/skill-run-ops.mjs'),
  ]);

  createSkillRunLogger = loggerModule.createSkillRunLogger;
  createSkillRunOps = opsModule.createSkillRunOps;
}

async function loadSkillConfigUtils() {
  if (loadSkillConfig && resolveNamespace) return;

  const configModule = await import('../../utils/resolve-skill-config.mjs');
  loadSkillConfig = configModule.loadSkillConfig;
  resolveNamespace = configModule.resolveNamespace;
}

async function resolveSharedPackageName(rootDir) {
  await loadSkillConfigUtils();
  const config = await loadSkillConfig(rootDir);
  const { scope } = await resolveNamespace({ rootDir });
  const sharedModule = path.basename(config.defaults.sharedModulePath);
  return `${scope}/${sharedModule}`;
}

function printHelp() {
  console.log(`Prisma init

Usage:
  node ${CLAUDE_PLUGIN_ROOT}/skills/monolith/config-prisma/scripts/init-prisma-backend.js [options]

Options:
  --apply                      Apply file changes (default is dry-run)
  --dry-run                    Simulate changes without writing
  --install                    Run npm install for backend workspace after file changes
  --start-db                   Run docker compose up -d postgres in apps/backend
  --module <name>              Create prisma/models/<name>.model.prisma (repeatable)
  --prisma-version <semver>    Prisma version for prisma/@prisma/client/@prisma/adapter-pg (default: detect from package.json, fallback ${DEFAULT_PRISMA_VERSION})
  --help                       Show this help
`);
}

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: false,
    install: false,
    startDb: false,
    modules: [],
    prismaVersion: '',
    customPrismaVersion: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--apply') {
      args.apply = true;
      continue;
    }

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg === '--install') {
      args.install = true;
      continue;
    }

    if (arg === '--start-db') {
      args.startDb = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    if (arg === '--module') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --module');
      }
      args.modules.push(normalizeAndValidateModuleName(value));
      i += 1;
      continue;
    }

    if (arg === '--prisma-version') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --prisma-version');
      }
      args.prismaVersion = value.trim();
      args.customPrismaVersion = true;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.apply) {
    args.dryRun = true;
  }

  return args;
}

function normalizeModuleName(rawName) {
  return rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isValidModuleName(name) {
  return /^[a-z][a-z0-9-]*$/.test(name);
}

function normalizeAndValidateModuleName(rawName) {
  const normalized = normalizeModuleName(rawName);
  if (!isValidModuleName(normalized)) {
    throw new Error(`Invalid module name "${rawName}". Use lowercase letters, numbers and hyphens.`);
  }
  return normalized;
}

async function readBackendPackageJson(backendDir) {
  const backendPackageJsonPath = path.join(backendDir, 'package.json');
  const raw = await fsp.readFile(backendPackageJsonPath, 'utf8');
  return JSON.parse(raw);
}

function detectProjectRoot(startDir) {
  const rootPath = path.parse(startDir).root;
  let currentDir = path.resolve(startDir);

  while (true) {
    const backendPackageJson = path.join(currentDir, 'apps', 'backend', 'package.json');
    if (fs.existsSync(backendPackageJson)) {
      return currentDir;
    }

    if (currentDir === rootPath) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  throw new Error('Could not find project root containing apps/backend/package.json');
}

function upsertValue(target, key, value) {
  if (target[key] === value) {
    return false;
  }

  target[key] = value;
  return true;
}

function toVersionRange(version) {
  const trimmed = String(version || '').trim();
  if (!trimmed) {
    return '';
  }

  if (/^[~^]/.test(trimmed) || /[<>=*]/.test(trimmed)) {
    return trimmed;
  }

  return `^${trimmed}`;
}

function resolvePrismaVersionRange(input) {
  const explicitRange = toVersionRange(input.explicitVersion);
  if (explicitRange) {
    return explicitRange;
  }

  const existingRange =
    input.dependencies['@prisma/client'] ||
    input.dependencies['@prisma/adapter-pg'] ||
    input.devDependencies.prisma ||
    '';

  return toVersionRange(existingRange) || `^${DEFAULT_PRISMA_VERSION}`;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function ensureTrailingLineBreak(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function normalizeEnvValue(rawValue) {
  const value = rawValue.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvContent(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    const value = line.slice(separatorIndex + 1);
    result[key] = normalizeEnvValue(value);
  }

  return result;
}

function serializeEnvContent(values) {
  const preferredOrder = ['DATABASE_URL'];

  const keys = Object.keys(values);
  const remaining = keys.filter((key) => !preferredOrder.includes(key));
  const ordered = [...preferredOrder.filter((key) => key in values), ...remaining];

  const lines = ordered.map((key) => {
    const value = String(values[key]);
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `${key}="${escaped}"`;
  });

  return `${lines.join('\n')}\n`;
}

function parseDatabaseUrl(databaseUrl) {
  try {
    const normalized = databaseUrl.replace(/^postgres:\/\//, 'postgresql://');
    const parsed = new URL(normalized);
    const dbName = parsed.pathname.replace(/^\//, '') || DEFAULT_DB.database;

    return {
      host: parsed.hostname || DEFAULT_DB.host,
      port: parsed.port || DEFAULT_DB.port,
      user: decodeURIComponent(parsed.username || DEFAULT_DB.user),
      password: decodeURIComponent(parsed.password || DEFAULT_DB.password),
      database: decodeURIComponent(dbName),
      schema: parsed.searchParams.get('schema') || DEFAULT_DB.schema,
    };
  } catch {
    return { ...DEFAULT_DB };
  }
}

function buildDatabaseUrl(config) {
  const username = encodeURIComponent(config.user);
  const password = encodeURIComponent(config.password);
  const database = encodeURIComponent(config.database);
  const schema = encodeURIComponent(config.schema);

  return `postgresql://${username}:${password}@${config.host}:${config.port}/${database}?schema=${schema}`;
}

async function readEnvFile(envFilePath) {
  try {
    const raw = await fsp.readFile(envFilePath, 'utf8');
    return parseEnvContent(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function resolveDatabaseConfig(backendDir) {
  const envPath = path.join(backendDir, '.env');
  const envExamplePath = path.join(backendDir, '.env.example');

  const envVars = await readEnvFile(envPath);
  const envExampleVars = await readEnvFile(envExamplePath);
  const source = envVars || envExampleVars || {};

  // MIGRATION_DATABASE_URL is the owner; DATABASE_URL is the runtime role. A project from before the split has only
  // DATABASE_URL, and that one is the owner.
  const ownerUrl = source.MIGRATION_DATABASE_URL || source.DATABASE_URL;
  const resolved = ownerUrl ? parseDatabaseUrl(ownerUrl) : { ...DEFAULT_DB };
  const databaseUrl = ownerUrl || buildDatabaseUrl(resolved);
  const appPassword = source.APP_DB_PASSWORD || resolved.password;
  const appDatabaseUrl = buildDatabaseUrl({ ...resolved, user: DEFAULT_DB.appUser, password: appPassword });

  return {
    ...resolved,
    databaseUrl,
    appDatabaseUrl,
    appPassword,
    envPath,
    envExamplePath,
  };
}

async function writeFileIfChanged(filePath, content, ctx) {
  const normalized = ensureTrailingLineBreak(content);
  const result = await ctx.ops.writeTextFile(filePath, normalized, {
    ensureNewline: false,
    markRiskOnOverwrite: true,
  });
  if (!result.changed) {
    return false;
  }

  ctx.changes.push(`${result.created ? 'create' : 'update'} ${toPosix(path.relative(ctx.rootDir, filePath))}`);

  return true;
}

async function ensureDir(dirPath, ctx) {
  const created = await ctx.ops.ensureDir(dirPath, {
    note: 'preparacao de infraestrutura prisma',
  });
  if (!created) {
    return;
  }

  ctx.changes.push(`mkdir ${toPosix(path.relative(ctx.rootDir, dirPath))}`);
}

async function moveFileIfExists(fromPath, toPath, ctx) {
  if (!fs.existsSync(fromPath) || fs.existsSync(toPath)) {
    return false;
  }

  ctx.changes.push(
    `rename ${toPosix(path.relative(ctx.rootDir, fromPath))} -> ${toPosix(path.relative(ctx.rootDir, toPath))}`,
  );
  await ctx.ops.renamePath(fromPath, toPath, {
    markRisk: true,
    note: 'migracao de nome legado',
  });

  return true;
}

async function hasDomainModelFiles(prismaModelsDir) {
  let entries = [];
  try {
    entries = await fsp.readdir(prismaModelsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }

  return entries.some((entry) => {
    if (!entry.isFile()) return false;
    const fileName = entry.name;
    if (!fileName.endsWith('.model.prisma')) return false;
    return fileName !== 'bootstrap.model.prisma';
  });
}

function renderPrismaConfig() {
  return `// This file was generated by Prisma and assumes you have installed the following:
// npm install --save-dev prisma dotenv
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed/main.ts',
  },
  datasource: {
    // migrate and seed run as the owner; the app (DATABASE_URL) is a role that owns nothing
    url: process.env.MIGRATION_DATABASE_URL ?? env('DATABASE_URL'),
  },
});`;
}

function renderSchemaPrisma() {
  return `// Prisma schema root (modular mode)
// Add per-module models under prisma/models/*.model.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}`;
}

function renderSeedMainTs() {
  return `import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type SeedTask = (prisma: PrismaClient) => Promise<void>;

const seedTasks: SeedTask[] = [];

const adapter = new PrismaPg({
  connectionString: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run prisma/seed/main.ts');
  }

  for (const task of seedTasks) {
    await task(prisma);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });`;
}

function shouldReplaceLegacySeedMain(content) {
  return (
    content.includes("from '../generated/client'") ||
    content.includes('from "../generated/client"') ||
    content.includes("from '../generated/prisma/client'") ||
    content.includes('from "../generated/prisma/client"') ||
    content.includes("from '../../generated/prisma/client'") ||
    content.includes('from "../../generated/prisma/client"') ||
    content.includes('type CidLoader =') ||
    content.includes('const loaders: CidLoader[]')
  );
}

function renderPrismaService(sharedPackageName) {
  return `import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { TransactionContext, TransactionManager } from '${sharedPackageName}';
import { Prisma, PrismaClient } from '@prisma/client';

export interface PrismaTransactionContext extends TransactionContext {
  client: Prisma.TransactionClient;
}

@Injectable()
export class PrismaService
  implements
    OnModuleInit,
    OnModuleDestroy,
    TransactionManager<PrismaTransactionContext>
{
  readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
      }),
      // query events feed test/query-budget.ts (architecture rule 11); without a listener they cost nothing visible
      log: [{ level: 'query', emit: 'event' }],
    });
  }

  async onModuleInit() {
    // $connect is lazy with the pg adapter; a real query fails fast when the database is not there
    await this.client.$queryRaw\`SELECT 1\`;
    // the runtime role owns nothing (architecture rule 12): as the owner, a bug or an injection could ALTER, DROP or
    // DISABLE TRIGGER. Production refuses; development warns, so a fresh checkout still boots before db:roles.
    const [{ owned }] = await this.client.$queryRaw<[{ owned: number }]>\`
      SELECT count(*)::int AS owned FROM pg_tables WHERE schemaname = current_schema() AND tableowner = current_user
    \`;
    if (owned > 0) {
      const message = \`DATABASE_URL connects as the owner of \${owned} table(s); the app must use the runtime role (npm run db:roles, then DATABASE_URL with app_runtime)\`;
      if (process.env.NODE_ENV === 'production') throw new Error(message);
      console.warn(message);
    }
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  async runInTransaction<T>(
    operation: (context: PrismaTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (tx) => {
      return operation({ client: tx });
    });
  }
}`;
}

function renderQueryBudget() {
  return `import type { PrismaClient } from '@prisma/client';
import { expect } from 'vitest';

type QueryEvent = { query: string; params: string; duration: number };
type QueryEmitter = { $on(event: 'query', listener: (event: QueryEvent) => void): void };

// Prisma has $on but no $off: one listener per client, feeding every budget that is open at the time.
const openBudgets = new WeakMap<object, Set<QueryEvent[]>>();

/**
 * Runs \`fn\` and fails the test when the client emitted more than \`max\` queries meanwhile.
 * Needs \`log: [{ level: 'query', emit: 'event' }]\` on the client; PrismaService sets it.
 *
 * A list of N rows must fit the same budget as a list of 1: that is how an N+1 is caught at
 * its origin, in the e2e of the route, instead of in production (architecture rule 11).
 */
export async function expectQueryBudget<T>(
  client: PrismaClient,
  max: number,
  fn: () => Promise<T>,
): Promise<T> {
  let sinks = openBudgets.get(client);
  if (!sinks) {
    sinks = new Set();
    openBudgets.set(client, sinks);
    const subscribers = sinks;
    (client as unknown as QueryEmitter).$on('query', (event) => {
      for (const sink of subscribers) sink.push(event);
    });
  }
  const queries: QueryEvent[] = [];
  sinks.add(queries);
  let result: T;
  try {
    result = await fn();
  } finally {
    // the event of the last query can land one tick after its promise resolves
    await new Promise((resolve) => setImmediate(resolve));
    sinks.delete(queries);
  }
  const emitted = queries.map((q, i) => \`  \${i + 1}. \${q.query}\`).join('\\n');
  expect(queries.length, \`query budget is \${max}, got \${queries.length}:\\n\${emitted}\`).toBeLessThanOrEqual(max);
  return result;
}`;
}

function renderRolesSql() {
  return `-- The app connects as app_runtime, a role that owns nothing: it reads and writes rows, never ALTER, DROP or
-- DISABLE TRIGGER (architecture rule 12). Migrations and seed run as the owner (MIGRATION_DATABASE_URL).
-- Idempotent. Run after every migrate: npm run db:roles (CI and the release do it for you).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN PASSWORD '__APP_DB_PASSWORD__';
  ELSE
    ALTER ROLE app_runtime WITH LOGIN PASSWORD '__APP_DB_PASSWORD__';
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_runtime', current_database());
  -- migration history is the owner's business
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public._prisma_migrations FROM app_runtime';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- Append-only tables: the app inserts and reads; history is never rewritten. One list, kept here, one line each:
-- REVOKE UPDATE, DELETE ON TABLE "AuditEvent" FROM app_runtime;
`;
}

function renderRolesMjs() {
  return `#!/usr/bin/env node
// Applies db/roles.sql as the owner (MIGRATION_DATABASE_URL): creates or updates the runtime role app_runtime with
// APP_DB_PASSWORD and grants it rows, never ownership. Idempotent; run after every migrate (npm run db:roles).
import 'dotenv/config';
import fs from 'node:fs';
import pg from 'pg';

const ownerUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!ownerUrl) {
  console.error('db:roles needs MIGRATION_DATABASE_URL (the owner of the schema)');
  process.exit(2);
}
const password = process.env.APP_DB_PASSWORD ?? decodeURIComponent(new URL(ownerUrl).password);
if (!password) {
  console.error('db:roles needs APP_DB_PASSWORD (the runtime role password)');
  process.exit(2);
}
const sql = fs
  .readFileSync(new URL('./roles.sql', import.meta.url), 'utf8')
  .replaceAll('__APP_DB_PASSWORD__', password.replaceAll("'", "''"));

const client = new pg.Client({ connectionString: ownerUrl });
await client.connect();
try {
  await client.query(sql);
  console.log('db:roles: app_runtime is up to date');
} finally {
  await client.end();
}
`;
}

function renderDbModule() {
  return `import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DbModule {}`;
}

function renderModulePrismaFile(moduleName) {
  return `// Prisma models for module: ${moduleName}
// Keep one file per module in prisma/models, using <module-name>.model.prisma.
// Add concrete models below.
`;
}

function renderBootstrapModelPrismaFile() {
  return `// Temporary bootstrap model to keep initial Prisma setup operational.
// Remove this file once real domain models/migrations are in place.
model PrismaBootstrap {
  id        String   @id @default(uuid()) @db.Uuid
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz
}
`;
}

function renderDockerCompose(dbConfig, rootDir) {
  // one container per project: a generic name collides with the next project on the same machine
  return `services:
  postgres:
    image: postgres:18-alpine
    container_name: ${path.basename(rootDir)}-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${dbConfig.user}
      POSTGRES_PASSWORD: ${dbConfig.password}
      POSTGRES_DB: ${dbConfig.database}
    ports:
      - '${dbConfig.port}:5432'
    volumes:
      - postgres_data:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${dbConfig.user}']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local`;
}

async function ensureBackendPackageJson(backendDir, args, ctx, sharedPackageName) {
  const packageJsonPath = path.join(backendDir, 'package.json');
  const raw = await fsp.readFile(packageJsonPath, 'utf8');
  const parsed = JSON.parse(raw);

  const dependencies = parsed.dependencies || {};
  const devDependencies = parsed.devDependencies || {};
  const scripts = parsed.scripts || {};

  parsed.dependencies = dependencies;
  parsed.devDependencies = devDependencies;
  parsed.scripts = scripts;

  const targetVersion = resolvePrismaVersionRange({
    dependencies,
    devDependencies,
    explicitVersion: args.customPrismaVersion ? args.prismaVersion : '',
  });

  upsertValue(dependencies, '@prisma/client', targetVersion);
  upsertValue(dependencies, '@prisma/adapter-pg', targetVersion);
  upsertValue(dependencies, 'pg', dependencies.pg || '^8.16.3');
  upsertValue(dependencies, 'dotenv', dependencies.dotenv || '^16.0.3');
  upsertValue(dependencies, sharedPackageName, dependencies[sharedPackageName] || '*');

  upsertValue(devDependencies, 'prisma', targetVersion);
  upsertValue(devDependencies, 'tsx', devDependencies.tsx || `^${DEFAULT_TSX_VERSION}`);

  upsertValue(scripts, 'db:start', 'docker compose up -d postgres');
  upsertValue(scripts, 'db:stop', 'docker compose down');
  upsertValue(scripts, 'db:logs', 'docker compose logs -f postgres');
  // a fresh clone or CI runs `npm ci && npm run build`: without the client generated first, nest build fails
  upsertValue(scripts, 'prebuild', 'npx prisma generate');
  upsertValue(scripts, 'prisma:generate', 'npx prisma generate');
  upsertValue(scripts, 'prisma:migrate:dev', 'npx prisma migrate dev');
  upsertValue(scripts, 'prisma:migrate:deploy', 'npx prisma migrate deploy');
  upsertValue(scripts, 'prisma:seed', 'npx prisma db seed');
  upsertValue(scripts, 'db:roles', 'node db/roles.mjs');
  upsertValue(scripts, 'prisma:studio', 'npx prisma studio');
  if ('prisma:cid' in scripts) {
    delete scripts['prisma:cid'];
  }

  const nextRaw = `${JSON.stringify(parsed, null, 2)}\n`;
  if (nextRaw !== raw) {
    await writeFileIfChanged(packageJsonPath, nextRaw, ctx);
  }
}

async function ensureDbModuleImportedInAppModule(backendDir, ctx) {
  const appModulePath = path.join(backendDir, 'src', 'app.module.ts');

  if (!fs.existsSync(appModulePath)) {
    return;
  }

  const content = await fsp.readFile(appModulePath, 'utf8');
  let updated = content;

  const hasDbImport = /from ['"]\.\/db\/db\.module(\.js)?['"]/.test(updated);
  const dbImportLine = "import { DbModule } from './db/db.module.js';";

  if (!hasDbImport) {
    const importBlockMatch = updated.match(/^(import[^\n]*\n)+/m);
    if (importBlockMatch) {
      updated = `${importBlockMatch[0]}${dbImportLine}\n${updated.slice(importBlockMatch[0].length)}`;
    } else {
      updated = `${dbImportLine}\n${updated}`;
    }
  }

  const importsArrayRegex = /imports:\s*\[([\s\S]*?)\],/m;
  const importsArrayMatch = updated.match(importsArrayRegex);

  if (importsArrayMatch && !/\bDbModule\b/.test(importsArrayMatch[1])) {
    const inner = importsArrayMatch[1];
    const replacement = inner.trim().length === 0 ? 'DbModule' : `DbModule, ${inner.trim()}`;
    updated = updated.replace(importsArrayRegex, `imports: [${replacement}],`);
  }

  if (updated !== content) {
    await writeFileIfChanged(appModulePath, updated, ctx);
  }
}

async function ensureEnvFiles(dbConfig, ctx) {
  const envPaths = [dbConfig.envExamplePath, dbConfig.envPath];

  for (const envFilePath of envPaths) {
    const existing = (await readEnvFile(envFilePath)) || {};
    const nextValues = {
      ...existing,
      MIGRATION_DATABASE_URL: dbConfig.databaseUrl,
      DATABASE_URL: dbConfig.appDatabaseUrl,
      APP_DB_PASSWORD: dbConfig.appPassword,
    };
    for (const legacy of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
      delete nextValues[legacy];
    }

    const rendered = serializeEnvContent(nextValues);
    await writeFileIfChanged(envFilePath, rendered, ctx);
  }
}

async function runInstall(rootDir, backendWorkspace, ops) {
  await ops.runCommand('npm', ['install', '--workspace', backendWorkspace], rootDir);
}

async function runStartDb(backendDir, ops) {
  await ops.runCommand('docker', ['compose', 'up', '-d', 'postgres'], backendDir);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  await loadSkillLoggingUtils();

  const rootDir = detectProjectRoot(process.cwd());
  const backendDir = path.join(rootDir, 'apps', 'backend');
  const logger = await createSkillRunLogger({
    rootDir,
    skillName: 'config-prisma',
    commandArgs: process.argv.slice(2),
  });
  const ops = createSkillRunOps({
    rootDir,
    logger,
    dryRun: args.dryRun,
  });

  try {
    const backendPackageJson = await readBackendPackageJson(backendDir);
    const backendWorkspace = backendPackageJson.name || BACKEND_WORKSPACE;
    const sharedPackageName = await resolveSharedPackageName(rootDir);
    const dbConfig = await resolveDatabaseConfig(backendDir);

    const ctx = {
      rootDir,
      dryRun: args.dryRun,
      changes: [],
      ops,
    };

    const prismaDir = path.join(backendDir, 'prisma');
    const prismaModelsDir = path.join(prismaDir, 'models');
    const prismaMigrationsDir = path.join(prismaDir, 'migrations');
    const prismaSeedDir = path.join(prismaDir, 'seed');
    const dbDir = path.join(backendDir, 'src', 'db');

    await ensureDir(prismaDir, ctx);
    await ensureDir(prismaModelsDir, ctx);
    await ensureDir(prismaMigrationsDir, ctx);
    await ensureDir(prismaSeedDir, ctx);
    await ensureDir(dbDir, ctx);
    await ensureBackendPackageJson(backendDir, args, ctx, sharedPackageName);
    await ensureEnvFiles(dbConfig, ctx);

    await writeFileIfChanged(path.join(backendDir, 'prisma.config.ts'), renderPrismaConfig(), ctx);
    await writeFileIfChanged(path.join(prismaDir, 'schema.prisma'), renderSchemaPrisma(), ctx);
    await writeFileIfChanged(path.join(backendDir, 'docker-compose.yml'), renderDockerCompose(dbConfig, rootDir), ctx);
    await writeFileIfChanged(path.join(dbDir, 'prisma.service.ts'), renderPrismaService(sharedPackageName), ctx);
    await writeFileIfChanged(path.join(dbDir, 'db.module.ts'), renderDbModule(), ctx);
    await ensureDir(path.join(backendDir, 'test'), ctx);
    await writeFileIfChanged(path.join(backendDir, 'test', 'query-budget.ts'), renderQueryBudget(), ctx);
    // runtime role: roles.sql is written once (the project keeps its append-only list there); roles.mjs is ours
    const dbScriptsDir = path.join(backendDir, 'db');
    await ensureDir(dbScriptsDir, ctx);
    if (!fs.existsSync(path.join(dbScriptsDir, 'roles.sql'))) {
      await writeFileIfChanged(path.join(dbScriptsDir, 'roles.sql'), renderRolesSql(), ctx);
    }
    await writeFileIfChanged(path.join(dbScriptsDir, 'roles.mjs'), renderRolesMjs(), ctx);

    const seedMainPath = path.join(prismaSeedDir, 'main.ts');
    if (!fs.existsSync(seedMainPath)) {
      await writeFileIfChanged(seedMainPath, renderSeedMainTs(), ctx);
    } else {
      const seedMainContent = await fsp.readFile(seedMainPath, 'utf8');
      if (shouldReplaceLegacySeedMain(seedMainContent)) {
        logger.risk(`seed legado sera sobrescrito: ${toPosix(path.relative(rootDir, seedMainPath))}`);
        await writeFileIfChanged(seedMainPath, renderSeedMainTs(), ctx);
      }
    }

    const moduleSet = new Set(args.modules.filter(Boolean));
    for (const moduleName of moduleSet) {
      const moduleFilePath = path.join(prismaModelsDir, `${moduleName}.model.prisma`);
      const legacyModuleFilePath = path.join(prismaModelsDir, `${moduleName}.prisma`);

      if (await moveFileIfExists(legacyModuleFilePath, moduleFilePath, ctx)) {
        continue;
      }

      if (fs.existsSync(moduleFilePath)) {
        continue;
      }
      await writeFileIfChanged(moduleFilePath, renderModulePrismaFile(moduleName), ctx);
    }

    const bootstrapModelFilePath = path.join(prismaModelsDir, 'bootstrap.model.prisma');
    const legacyBootstrapModelFilePath = path.join(prismaModelsDir, 'bootstrap.prisma');
    const hasDomainModels = await hasDomainModelFiles(prismaModelsDir);
    if (!hasDomainModels) {
      const bootstrapRenamed = await moveFileIfExists(legacyBootstrapModelFilePath, bootstrapModelFilePath, ctx);
      if (!bootstrapRenamed && !fs.existsSync(bootstrapModelFilePath)) {
        await writeFileIfChanged(bootstrapModelFilePath, renderBootstrapModelPrismaFile(), ctx);
      }
    }

    await ensureDbModuleImportedInAppModule(backendDir, ctx);

    if (ctx.changes.length === 0) {
      console.log('No changes required. Prisma init is already up to date.');
      logger.step('Nenhuma alteracao necessaria (estado convergente).');
    } else {
      const modeLabel = args.dryRun ? 'Dry-run changes' : 'Applied changes';
      console.log(`\n${modeLabel}:`);
      logger.step(`${modeLabel}: ${ctx.changes.length} alteracoes.`);
      for (const change of ctx.changes) {
        console.log(`- ${change}`);
        logger.step(change, 'CHANGE');
      }
    }

    if (args.install) {
      if (args.dryRun) {
        console.log('\nDry-run: skipped dependency installation.');
        logger.step('Instalacao ignorada em dry-run.');
      } else {
        console.log('\nInstalling backend dependencies...');
        await runInstall(rootDir, backendWorkspace, ops);
        console.log('Backend dependencies installed successfully.');
      }
    }

    if (args.startDb) {
      if (args.dryRun) {
        console.log('\nDry-run: skipped docker compose up.');
        logger.step('Subida de banco ignorada em dry-run.');
      } else {
        console.log('\nStarting postgres with docker compose...');
        await runStartDb(backendDir, ops);
        console.log('Postgres started successfully.');
      }
    }

    if (args.dryRun) {
      console.log('\nRun again with --apply to persist these changes.');
      logger.step('Dry-run concluido. Execute com --apply para persistir.');
    }

    await logger.success();
  } catch (error) {
    await logger.failure(error);
    throw error;
  }
}

main().catch((error) => {
  console.error(`Bootstrap failed: ${error.message}`);
  process.exit(1);
});
