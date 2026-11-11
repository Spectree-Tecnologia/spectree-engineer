// What CI runs only on a pull request, run here before opening one, so a run in Actions is never the first to say it:
// the PR title, the branch holding the tip of its base (nothing runs on push to main: the PR's run is the proof of the
// merged tree, and only for the base it was cut from), gitleaks over the commits this branch adds and squawk over the
// migrations it adds; Prettier too when the project has `format:check`. Each check runs even when an earlier one
// failed; the summary lists every exit code and the script exits 1 if any check failed.
//
//   npm run check:pr                              # against origin/main (never fetched here: `git fetch origin` first)
//   npm run check:pr -- --title "feat(x): ..."    # also the Conventional Commits title the PR will carry
//   npm run check:pr -- --base <ref>
//
// The gitleaks image and the squawk version are read from .github/workflows/ci.yml, so there is one pin. gitleaks runs
// from the local binary when its version is the pinned one, otherwise from the pinned image in Docker.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const args = process.argv.slice(2);
const fail = (message) => {
  console.error(`check:pr: ${message}`);
  process.exit(2);
};

let base = 'origin/main';
let title;
for (let i = 0; i < args.length; i += 2) {
  if (!['--base', '--title'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
    fail('usage: npm run check:pr [-- --base <ref>] [--title "<type>(<scope>): <summary>"]');
  }
  if (args[i] === '--base') base = args[i + 1];
  else title = args[i + 1];
}

const git = (argv) => spawnSync('git', argv, { cwd: root, encoding: 'utf8' });
const gitOut = (argv, what) => {
  const res = git(argv);
  if (res.status !== 0) fail(`${what}: git ${argv.join(' ')} exited ${res.status}\n${res.stderr}`);
  return res.stdout.trim();
};

if (git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${base}^{commit}`]).status !== 0) {
  fail(`--base "${base}" is not a commit (run "git fetch origin" if origin/main is missing)`);
}
const mergeBase = gitOut(['merge-base', base, 'HEAD'], 'merge base');
const head = gitOut(['rev-parse', 'HEAD'], 'HEAD');

// One pin, in the workflow CI runs: read from the command lines themselves, never from a comment.
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const commandLines = workflow
  .split(/\r?\n/)
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');
const gitleaksImage = commandLines.match(/docker run .*?(ghcr\.io\/gitleaks\/gitleaks:v(\d+\.\d+\.\d+)@sha256:[0-9a-f]{64})/);
const squawkPin = commandLines.match(/npx --yes squawk-cli@(\d+\.\d+\.\d+) /);
if (!gitleaksImage || !squawkPin) fail('could not read the gitleaks image or the squawk-cli version from ci.yml');

function run(file, argv, options = {}) {
  console.log(`\n$ ${[file, ...argv].join(' ')}`);
  const res = spawnSync(file, argv, { cwd: root, stdio: 'inherit', ...options });
  if (res.error) console.error(`check:pr: ${res.error.message}`);
  return res.status ?? 1;
}

const commits = Number(gitOut(['rev-list', '--count', `${mergeBase}..HEAD`], 'commit count'));
const baseTip = gitOut(['rev-parse', `${base}^{commit}`], 'base tip');
console.log(
  `check:pr: ${commits} commit(s) on this branch since the merge base ${mergeBase.slice(0, 7)} with ${base} (tip ${baseTip.slice(0, 7)}), HEAD ${head.slice(0, 7)}`,
);
const dirty = gitOut(['status', '--porcelain'], 'status');
if (dirty) {
  console.log(
    'check:pr: the working tree has uncommitted changes. format:check reads them; gitleaks and squawk read only commits.',
  );
}

const results = [];

// 1. The title, by the pattern of the workflow's first step: the squash merge writes it into main's history.
if (title !== undefined) {
  const ok = /^(feat|fix|chore|docs|refactor|test|build|ci|perf|style)(\([a-z0-9-]+\))?!?: .+/.test(title);
  console.log(`\ntitle: ${ok ? 'Conventional Commits' : `"${title}" is not <type>(<scope>): <summary>`}`);
  results.push(['title', ok ? 0 : 1]);
}

// 2. The branch holds the tip of its base. CI proves the merge of the two as they are when it runs, and nothing runs
// after the merge: a base that moved since is a tree nobody tested.
const behind = git(['merge-base', '--is-ancestor', baseTip, 'HEAD']).status !== 0;
if (behind) console.error(`\ncheck:pr: ${base} moved (tip ${baseTip.slice(0, 7)} is not in this branch): merge it in and prove the result again`);
results.push(['up to date with the base', behind ? 1 : 0]);

// 3. Prettier, when the project checks it. A constant string through the shell: npm is a .cmd shim on Windows.
const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts ?? {};
if (scripts['format:check']) results.push(['format:check', run('npm run format:check', [], { shell: true })]);

// 4. gitleaks over the commits this branch adds; main's history is scanned by the weekly run.
// gitleaks exits 0 even when git fails under it ("fatal: not a git repository", "0 commits scanned"), and its own count
// skips merge, empty and delete-only commits, so neither its exit nor its count proves the scan read the branch. The
// proof is git itself, run with the same repository view first (same mounts and GIT_DIR in Docker): it must count the
// branch's commits, and the scan's output must carry no "fatal:" line.
function gitleaks() {
  if (commits === 0) {
    console.log('\ngitleaks: no commits on this branch');
    return 0;
  }
  const range = `${mergeBase}..HEAD`;
  const capture = (file, argv) => {
    console.log(`\n$ ${[file, ...argv].join(' ')}`);
    const res = spawnSync(file, argv, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (res.error) console.error(`check:pr: ${res.error.message}`);
    process.stdout.write(res.stdout ?? '');
    process.stderr.write(res.stderr ?? '');
    return { status: res.status ?? 1, output: `${res.stdout ?? ''}\n${res.stderr ?? ''}` };
  };
  const scan = (preflight, file, argv) => {
    const seen = capture(preflight[0], preflight.slice(1));
    if (seen.status !== 0 || seen.output.trim() !== String(commits)) {
      console.error(`check:pr: git in the scan's view of the repo did not count the branch's ${commits} commit(s)`);
      return 1;
    }
    const res = capture(file, argv);
    if (res.status !== 0) return res.status;
    if (/fatal:/i.test(res.output)) {
      console.error('check:pr: git failed under gitleaks; the scan did not read the branch');
      return 1;
    }
    return 0;
  };
  const local = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  const localVersion = local.status === 0 ? local.stdout.trim().replace(/^v/, '') : undefined;
  // --config: the repo's rules when it has them, never a GITLEAKS_CONFIG from the caller's environment
  const hasConfig = fs.existsSync(path.join(root, '.gitleaks.toml'));
  if (localVersion === gitleaksImage[2]) {
    return scan(
      ['git', '-C', root, 'rev-list', '--count', range],
      'gitleaks',
      ['git', `--log-opts=${range}`, ...(hasConfig ? ['--config', path.join(root, '.gitleaks.toml')] : []), '--redact', '--no-banner', root],
    );
  }
  console.log(
    `\ngitleaks: local binary is ${localVersion ?? 'missing'}, CI pins ${gitleaksImage[2]}; using the pinned image`,
  );
  // A linked worktree's .git is a file pointing into the main checkout: mount the common dir and point GIT_DIR at this
  // tree's own gitdir inside it, so the scan works from a ticket worktree too.
  const commonDir = path.resolve(root, gitOut(['rev-parse', '--git-common-dir'], 'git common dir'));
  const gitDir = gitOut(['rev-parse', '--absolute-git-dir'], 'git dir');
  const inner = path.relative(commonDir, gitDir).split(path.sep).join('/');
  if (inner.startsWith('..') || path.isAbsolute(inner)) {
    console.error(`check:pr: ${gitDir} is not inside ${commonDir}`);
    return 1;
  }
  // read-only mounts and no network: the scan needs neither
  const container = [
    'run',
    '--rm',
    '--network',
    'none',
    '-v',
    `${root}:/repo:ro`,
    '-v',
    `${commonDir}:/common:ro`,
    '-e',
    `GIT_DIR=/common${inner ? `/${inner}` : ''}`,
    '-e',
    'GIT_WORK_TREE=/repo',
    // the mounts are owned by another uid inside the container
    '-e',
    'GIT_CONFIG_COUNT=1',
    '-e',
    'GIT_CONFIG_KEY_0=safe.directory',
    '-e',
    'GIT_CONFIG_VALUE_0=*',
  ];
  return scan(
    ['docker', ...container, '--entrypoint', 'git', gitleaksImage[1], 'rev-list', '--count', range],
    'docker',
    [...container, gitleaksImage[1], 'git', `--log-opts=${range}`, ...(hasConfig ? ['--config', '/repo/.gitleaks.toml'] : []), '--redact', '--no-banner', '/repo'],
  );
}
results.push(['gitleaks', gitleaks()]);

// 5. squawk over the migrations this branch adds or changes: the CI diff. A deleted migration fails here as it fails
// CI (squawk cannot find the file), and is named: an applied migration is never deleted.
function squawk() {
  const deleted = gitOut(
    ['diff', '--name-only', '--diff-filter=D', `${base}...HEAD`, '--', 'apps/backend/prisma/migrations'],
    'deleted migrations',
  )
    .split(/\r?\n/)
    .filter((file) => file.endsWith('.sql'));
  if (deleted.length > 0) {
    console.error(`\ncheck:pr: this branch deletes migration(s), which CI's squawk step fails on:\n  ${deleted.join('\n  ')}`);
    return 1;
  }
  const files = gitOut(
    ['diff', '--name-only', '--diff-filter=d', `${base}...HEAD`, '--', 'apps/backend/prisma/migrations'],
    'migration diff',
  )
    .split(/\r?\n/)
    .filter((file) => file.endsWith('.sql'));
  if (files.length === 0) {
    console.log('\nsquawk: no new migration on this branch');
    return 0;
  }
  // The file names reach a shell (npx is a .cmd shim on Windows): only plain path characters get there.
  const unsafe = files.find((file) => !/^[\w./-]+$/.test(file));
  if (unsafe) {
    console.error(`check:pr: migration path "${unsafe}" has characters outside [A-Za-z0-9_./-]; rename it`);
    return 1;
  }
  return run(`npx --yes squawk-cli@${squawkPin[1]} --assume-in-transaction ${files.join(' ')}`, [], { shell: true });
}
results.push(['squawk', squawk()]);

console.log('\ncheck:pr summary');
for (const [name, status] of results) console.log(`  ${status === 0 ? 'ok  ' : 'FAIL'}  ${name} (exit ${status})`);
process.exit(results.every(([, status]) => status === 0) ? 0 : 1);
