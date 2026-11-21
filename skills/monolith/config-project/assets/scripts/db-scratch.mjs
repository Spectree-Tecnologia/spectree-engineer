// A throwaway database for one command: created beside the development one, migrated, given the runtime role and
// seeded, handed to the command through the two database URLs, and dropped when the command ends, whatever its exit
// code. One verifier, one latency run or one browser suite per database: two runs on the same rows fail each other.
//
//   npm run db:scratch -- <name> -- <command...>          the exit code is the command's
//   npm run db:scratch -- <name> --keep -- <command...>   leaves the database behind, to look at
//   npm run db:scratch -- <name> --drop                   drops one a kept or killed run left behind
//
// The database is <dev database>_scratch_<name>. Each URL keeps its own user and changes only the database name:
// migrations and the seed run as the owner (MIGRATION_DATABASE_URL), the command's app connects as the runtime role
// (DATABASE_URL). The values come from apps/backend/.env and are set in the environment of the steps and of the
// command, so nothing on disk changes and no URL is ever printed. A database that already exists is never reused:
// the name is yours for the length of one run.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const argv = process.argv.slice(2);
const fail = (message, code = 1) => {
  console.error(`db:scratch: ${message}`);
  process.exit(code);
};
const usage = () => fail('usage: npm run db:scratch -- <name> [--keep] -- <command...>\n       npm run db:scratch -- <name> --drop', 2);

const split = argv.indexOf('--');
const own = split === -1 ? argv : argv.slice(0, split);
const command = split === -1 ? [] : argv.slice(split + 1);
const [nameArg, ...flags] = own;
if (!nameArg || flags.some((flag) => !['--keep', '--drop'].includes(flag))) usage();
const name = nameArg.toLowerCase();
// The name becomes part of a database identifier: letters, digits and dashes only.
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) usage();
const drop = flags.includes('--drop');
const keep = flags.includes('--keep');
if (drop ? command.length > 0 || keep : command.length === 0) usage();

const backendDir = path.join(root, 'apps', 'backend');
function readEnv(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found: run it from the project root, after the bootstrap`);
  const entries = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) entries[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return entries;
}
const env = readEnv(path.join(backendDir, '.env'));
const ownerRaw = env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;
if (!ownerRaw || !env.DATABASE_URL) fail('apps/backend/.env needs MIGRATION_DATABASE_URL (or DATABASE_URL) and DATABASE_URL');
const withDb = (value, database) => {
  const url = new URL(value);
  url.pathname = `/${database}`;
  return url.toString();
};
const baseDb = decodeURIComponent(new URL(ownerRaw).pathname.replace(/^\//, ''));
const dbName = `${baseDb}_scratch_${name.replace(/-/g, '_')}`;
// Postgres truncates identifiers past 63 bytes, so two long names could land on one database.
if (Buffer.byteLength(dbName) > 63) fail(`"${name}" is too long: database "${dbName}" would pass Postgres's 63-byte limit`);

// pg is the backend's own dependency (db/roles.mjs uses it).
async function withOwner(fn) {
  const require = createRequire(path.join(backendDir, 'package.json'));
  const { Client } = require('pg');
  const client = new Client({ connectionString: ownerRaw });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
// The key every db:scratch run takes around db:roles, on the development cluster.
const ROLES_LOCK = 7310115;
const exists = async (client) => (await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])).rowCount > 0;
const dropDatabase = (client) => client.query(`DROP DATABASE ${client.escapeIdentifier(dbName)} WITH (FORCE)`);

// What the steps and the command see: the scratch database under both URLs, nothing else changed.
const scratchEnv = {
  ...process.env,
  MIGRATION_DATABASE_URL: withDb(ownerRaw, dbName),
  DATABASE_URL: withDb(env.DATABASE_URL, dbName),
  DB_SCRATCH: dbName,
};
// One string through the shell: npm and npx are .cmd shims on Windows.
function sh(line, cwd = root) {
  console.log(`\n$ ${line}   (${path.relative(root, cwd) || '.'}, database ${dbName})`);
  return spawnSync(line, { cwd, shell: true, stdio: 'inherit', env: scratchEnv }).status ?? 1;
}
const quote = (arg) => (/[\s"'&|<>^();]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg);

async function main() {
  if (drop) {
    await withOwner(async (client) => {
      if (!(await exists(client))) return console.log(`database ${dbName}: not there`);
      await dropDatabase(client);
      console.log(`database ${dbName}: dropped`);
    });
    return 0;
  }
  await withOwner(async (client) => {
    if (await exists(client)) fail(`database ${dbName} already exists: another run holds that name, or one was killed or kept. Pick another name, or drop it with "npm run db:scratch -- ${name} --drop"`);
    await client.query(`CREATE DATABASE ${client.escapeIdentifier(dbName)}`);
  });
  console.log(`database ${dbName}: created`);
  let status = 1;
  try {
    const steps = [
      [fs.existsSync(path.join(backendDir, 'prisma', 'migrations')) ? 'npx prisma migrate deploy' : 'npx prisma db push', backendDir],
      ['npm -w apps/backend run db:roles', root],
      ...(fs.existsSync(path.join(backendDir, 'prisma', 'seed', 'main.ts')) ? [['npx prisma db seed', backendDir]] : []),
    ];
    for (const [line, cwd] of steps) {
      // the roles are the cluster's, not the database's: two runs that set them up together die on "tuple
      // concurrently updated" (a quality-engineer and a security-engineer verifying one ticket), so one waits
      status = line.includes('db:roles') ? await withOwner(async (client) => {
        await client.query('SELECT pg_advisory_lock($1)', [ROLES_LOCK]);
        try {
          return sh(line, cwd);
        } finally {
          await client.query('SELECT pg_advisory_unlock($1)', [ROLES_LOCK]);
        }
      }) : sh(line, cwd);
      if (status !== 0) {
        console.error(`db:scratch: "${line}" exited ${status}; the command was not run`);
        return status;
      }
    }
    status = sh(command.map(quote).join(' '));
    return status;
  } finally {
    if (keep) {
      console.log(`\ndatabase ${dbName}: kept. Drop it with "npm run db:scratch -- ${name} --drop"`);
    } else {
      await withOwner(dropDatabase).then(
        () => console.log(`\ndatabase ${dbName}: dropped`),
        (error) => console.error(`\ndb:scratch: could not drop ${dbName}: ${error.message}. Drop it with "npm run db:scratch -- ${name} --drop"`),
      );
    }
  }
}

main().then(
  (status) => process.exit(status),
  (error) => fail(error.message),
);
