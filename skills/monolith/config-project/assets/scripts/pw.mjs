// The Playwright specs of a proof, run alone, as CI runs them: a database of its own (db:scratch), the backend and the
// frontend built and started by this run on the checkout's ports, the specs, and every process this run started
// killed with its children at the end or at the timeout. A screen criterion's `run:` line is this command, so the
// full-stack-developer, the verifiers and `goal prove` run the same thing and nobody keeps a harness in .scratch/.
//
//   npm run pw -- [<spec>...] [--timeout <minutes>]     the exit code is Playwright's; 124 is the timeout (default 20)
//
// The ports are the ones in apps/backend/.env and apps/frontend/.env (PORT), the ones the frontend's public API URL
// was built against; a worktree has its own (npm run worktree -- up). A port that already answers is refused before
// anything starts: a server this run did not start would answer the specs. Logs go to .scratch/pw/<run>/, and the
// specs see them as BACKEND_LOG and FRONTEND_LOG; PLAYWRIGHT_BASE_URL is the frontend, API_URL the backend.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = process.cwd();
const argv = process.argv.slice(2);
const fail = (message, code = 1) => {
  console.error(`pw: ${message}`);
  process.exit(code);
};
const usage = () => fail('usage: npm run pw -- [<spec>...] [--timeout <minutes>]', 2);

const inner = argv[0] === '--inner';
const rest = inner ? argv.slice(1) : argv;
const specs = [];
let minutes = 20;
for (let i = 0; i < rest.length; i += 1) {
  if (rest[i] === '--timeout') {
    minutes = Number(rest[i + 1]);
    if (!(minutes > 0)) usage();
    i += 1;
  } else if (rest[i].startsWith('-')) usage();
  else specs.push(rest[i]);
}

const backendDir = path.join(root, 'apps', 'backend');
const frontendDir = path.join(root, 'apps', 'frontend');
function readEnv(file) {
  if (!fs.existsSync(file)) fail(`${path.relative(root, file)} not found: run it from the project root, after the bootstrap`, 2);
  const entries = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) entries[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return entries;
}
const ports = {
  backend: Number(readEnv(path.join(backendDir, '.env')).PORT ?? 4000),
  frontend: Number(readEnv(path.join(frontendDir, '.env')).PORT ?? 3000),
};
const configDir = [frontendDir, root].find((dir) => ['ts', 'mjs', 'js'].some((ext) => fs.existsSync(path.join(dir, `playwright.config.${ext}`))));
if (!configDir) fail('no playwright.config.{ts,mjs,js} in apps/frontend or at the root', 2);

// Answers on either loopback family: a server on ::1 is as much in the way as one on 127.0.0.1.
const answers = (port, host) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(1000);
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('timeout', () => (socket.destroy(), resolve(false)));
    socket.once('error', () => resolve(false));
  });
const busy = async (port) => (await answers(port, '127.0.0.1')) || (await answers(port, '::1'));

// One string through the shell: npm and npx are .cmd shims on Windows.
const quote = (arg) => (/[\s"'&|<>^();]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg);

async function outer() {
  for (const [role, port] of Object.entries(ports)) {
    if (await busy(port)) fail(`port ${port} (${role}) already answers: another process holds it. Stop the server you started there, or run in a worktree (npm run worktree -- up); never kill a process you did not start`, 2);
  }
  console.log('$ npm run build');
  const built = spawnSync('npm run build', { cwd: root, shell: true, stdio: 'inherit' }).status ?? 1;
  if (built !== 0) fail(`npm run build exited ${built}; no spec was run`, built);
  const self = ['node', 'scripts/pw.mjs', '--inner', ...specs, '--timeout', String(minutes)];
  const line = ['node', 'scripts/db-scratch.mjs', `pw-${process.pid}`, '--', ...self].map(quote).join(' ');
  return spawnSync(line, { cwd: root, shell: true, stdio: 'inherit' }).status ?? 1;
}

const started = [];
function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}
function stopAll() {
  for (const { child } of started) killTree(child);
  if (started.length > 0) console.log(`pw: stopped ${started.map(({ name, child }) => `${name} ${child.pid}`).join(', ')}`);
  started.length = 0;
}

function start(name, command, args, cwd, env, log) {
  const out = fs.openSync(log, 'a');
  // detached on POSIX makes the child a group leader, so the whole tree dies with one signal
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', out, out], detached: process.platform !== 'win32', windowsHide: true });
  started.push({ name, child });
  return child;
}

async function ready(name, child, url, log) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${name} exited ${child.exitCode} before it answered: see ${path.relative(root, log)}`);
    // any HTTP answer is a server up; the ports were free before this run started it, and it is still alive
    if (await fetch(url, { redirect: 'manual' }).then(() => true, () => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${name} did not answer ${url} in 120 s: see ${path.relative(root, log)}`);
}

async function innerRun() {
  const runDir = path.join(root, '.scratch', 'pw', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  fs.mkdirSync(runDir, { recursive: true });
  const logs = { backend: path.join(runDir, 'backend.log'), frontend: path.join(runDir, 'frontend.log') };
  const urls = { backend: `http://localhost:${ports.backend}`, frontend: `http://localhost:${ports.frontend}` };
  const env = { ...process.env, TZ: 'UTC', BACKEND_LOG: logs.backend, FRONTEND_LOG: logs.frontend };

  const timer = setTimeout(() => {
    console.error(`pw: timed out after ${minutes} min; every process this run started is killed`);
    stopAll();
    process.exit(124);
  }, minutes * 60_000);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => (stopAll(), process.exit(130)));

  try {
    // the same raised rate limit as perf: the specs sign in more often than a person would
    const backend = start('backend', process.execPath, ['dist/main.js'], backendDir, { ...env, PORT: String(ports.backend), THROTTLE_LIMIT: '1000000' }, logs.backend);
    const next = createRequire(path.join(frontendDir, 'package.json')).resolve('next/dist/bin/next');
    const frontend = start('frontend', process.execPath, [next, 'start', '-p', String(ports.frontend)], frontendDir, { ...env, PORT: String(ports.frontend) }, logs.frontend);
    await ready('backend', backend, `${urls.backend}/health`, logs.backend);
    await ready('frontend', frontend, urls.frontend, logs.frontend);
    console.log(`pw: backend ${backend.pid} on ${urls.backend}, frontend ${frontend.pid} on ${urls.frontend}, logs in ${path.relative(root, runDir)}`);
    const line = ['npx', 'playwright', 'test', ...specs].map(quote).join(' ');
    console.log(`\n$ ${line}   (${path.relative(root, configDir) || '.'})`);
    const status = await new Promise((resolve) => {
      const child = spawn(line, { cwd: configDir, shell: true, stdio: 'inherit', detached: process.platform !== 'win32', env: { ...env, PLAYWRIGHT_BASE_URL: urls.frontend, API_URL: urls.backend } });
      started.push({ name: 'playwright', child });
      child.once('exit', (code) => resolve(code ?? 1));
    });
    return status;
  } finally {
    clearTimeout(timer);
    stopAll();
  }
}

(inner ? innerRun() : outer()).then(
  (status) => process.exit(status),
  (error) => {
    stopAll();
    fail(error.message);
  },
);
