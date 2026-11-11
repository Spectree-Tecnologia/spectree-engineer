// The goal contract (docs/goals/<slug>.md) read by a script instead of by eye: its shape, its proofs and its size.
// Whoever builds, whoever verifies and CI run the same commands, and the exit code decides.
//
//   npm run goal -- check [<slug>]                 the shape of one contract, or of all of them
//   npm run goal -- check --ready <slug>           also: approved, and every criterion's latest verdict is met or waived
//   npm run goal -- check --ready --changed <ref>  the contracts this branch changed since <ref> (what CI and check:pr run)
//   npm run goal -- prove <slug> [--criterion <n>] runs every `run:` proof and prints the exit code of each
//   npm run goal -- size <slug> --base <ref>       the product code changed since <ref> against the contract's size budget
//
// A proof a command decides is written in the Proof cell as run: `<command>`. `prove` runs each from the project
// root, in UTC as CI does, one after the other, and exits 1 if any exits non-zero. A proof with no `run:` is an
// observation someone repeats by hand, listed as manual. Proofs that need a database run under one of their own:
//   npm run db:scratch -- <name> -- npm run goal -- prove <slug>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const goalsDir = path.join(root, 'docs', 'goals');
const [command, ...args] = process.argv.slice(2);
const fail = (message, code = 1) => {
  console.error(`goal: ${message}`);
  process.exit(code);
};
const usage = () =>
  fail(
    'usage: npm run goal -- check [<slug>] [--ready] [--changed <ref>]\n       npm run goal -- prove <slug> [--criterion <n>]\n       npm run goal -- size <slug> --base <ref>',
    2,
  );

// `--name value` pairs and bare flags after the positional arguments; anything else is a mistake, never ignored.
function parseArgs(argv, valued, bare) {
  const out = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (valued.includes(arg)) {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) fail(`${arg} needs a value`, 2);
      out[arg] = value;
    } else if (bare.includes(arg)) out[arg] = true;
    else if (arg.startsWith('--')) fail(`unknown argument "${arg}"`, 2);
    else out.positional.push(arg);
  }
  return out;
}

// execFile, never a shell: the ref is user input. A git failure is one line and exit 1.
function git(argv, failure) {
  try {
    return execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split(/\r?\n/).filter(Boolean);
  } catch (error) {
    const reason = String(error.stderr || error.message).trim().split(/\r?\n/)[0];
    fail(failure ?? `git ${argv.join(' ')} failed${reason ? `: ${reason}` : ''}`);
  }
}
const commitOf = (ref, flag) => git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`], `${flag} ${JSON.stringify(ref)} is not a commit`)[0];

// A table row split on the pipes that are not inside a code span and not escaped.
function cells(line) {
  const out = [];
  let cell = '';
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '`') inCode = !inCode;
    if (ch === '\\' && line[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (ch === '|' && !inCode) {
      out.push(cell.trim());
      cell = '';
    } else cell += ch;
  }
  out.push(cell.trim());
  return out.slice(1, -1);
}
const isRow = (line) => /^\s*\|/.test(line) && !/^\s*\|[\s:|-]+\|\s*$/.test(line);

const VERDICTS = ['met', 'not met', 'weak proof', 'waived'];
const CHANGES = ['narrowed', 'reworded', 'waived', 'added', 'moved'];
const STATUS = /^(proposed|approved by .+ on \d{4}-\d{2}-\d{2}|met on \d{4}-\d{2}-\d{2}|stopped on \d{4}-\d{2}-\d{2}: .+)$/;
const DEFAULT_SIZE = 4000;
// The size budget is about what a reader has to hold to review the change: the product code. Tests, documents and
// working files grow with a goal without making it harder to review (in the goal that set this rule they were 62% of
// 27 thousand lines), and the lockfile is generated. None of them counts, and each is reported.
const NOT_PRODUCT = [
  [/(^|\/)package-lock\.json$/, 'lockfile'],
  [/(^|\/)(test|tests|e2e|__tests__)\//, 'tests'],
  [/\.(test|spec|e2e-spec)\.[cm]?[jt]sx?$/, 'tests'],
  [/^(docs|\.scratch)\//, 'documents'],
  [/\.md$/, 'documents'],
];
const kindOf = (file) => NOT_PRODUCT.find(([pattern]) => pattern.test(file))?.[1] ?? 'product';

function slugFile(slug) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail(`"${slug}" is not a goal slug (letters, digits and dashes)`, 2);
  const file = path.join(goalsDir, `${slug}.md`);
  if (!fs.existsSync(file)) fail(`docs/goals/${slug}.md not found`);
  return file;
}

function parse(file) {
  const slug = path.basename(file, '.md');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const sections = {};
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].toLowerCase();
      sections[current] = [];
    } else if (current) sections[current].push(line);
  }
  const rows = (name) => (sections[name] ?? []).filter(isRow).map(cells).filter((row) => /^\d+$/.test(row[0] ?? '') || /^\d{4}-\d{2}-\d{2}$/.test(row[0] ?? ''));
  const criteria = rows('success criteria').map(([n, text = '', proof = '']) => ({
    n: Number(n),
    text,
    proof,
    commands: [...proof.matchAll(/run:\s*`([^`]+)`/g)].map((m) => m[1].trim()),
  }));
  const evidence = rows('evidence').map(([n, round = '', verdict = '', run = '']) => ({ n: Number(n), round, verdict: verdict.toLowerCase().replace(/[*_`]/g, '').trim(), run }));
  const amendments = rows('amendments').map(([date, n = '', change = '', by = '', follow = '']) => ({ date, n: Number(n), change: change.toLowerCase().split(/[\s:,.]/)[0], by, follow }));
  const sizeLine = (sections.budget ?? []).join('\n').match(/^Size:\s*([\d\s.,]+)\s*changed lines/im);
  return {
    slug,
    file,
    title: lines.find((line) => /^#\s/.test(line)) ?? '',
    status: (lines.find((line) => /^Status:/.test(line)) ?? '').replace(/^Status:\s*/, '').trim(),
    sections,
    criteria,
    evidence,
    amendments,
    sizeBudget: sizeLine ? Number(sizeLine[1].replace(/[\s.,]/g, '')) : DEFAULT_SIZE,
  };
}

// The verdict of the latest round that names the criterion.
function latestVerdict(goal, n) {
  const mine = goal.evidence.filter((row) => row.n === n && /^\d+$/.test(row.round));
  return mine.sort((a, b) => Number(b.round) - Number(a.round))[0]?.verdict;
}

function lint(goal, ready) {
  const errors = [];
  const warnings = [];
  if (goal.title.trim() !== `# Goal: ${goal.slug}`) errors.push(`the first heading is "${goal.title.trim()}", expected "# Goal: ${goal.slug}"`);
  if (!STATUS.test(goal.status)) errors.push(`Status "${goal.status}" is not proposed, approved by <who> on <date>, met on <date> or stopped on <date>: <why>`);
  for (const name of ['objective', 'success criteria', 'limits', 'budget', 'evidence']) {
    if (!(name in goal.sections)) errors.push(`section "## ${name[0].toUpperCase()}${name.slice(1)}" is missing`);
  }
  if (!('context' in goal.sections)) warnings.push('no "## Context": the full-stack-developer gets nothing but the criteria');
  if (goal.criteria.length === 0) errors.push('no success criterion found in the table');
  if (goal.criteria.length > 7) errors.push(`${goal.criteria.length} criteria: more than seven is more than one goal, split it by outcome`);
  if (goal.criteria.length > 0 && goal.criteria.length < 3) warnings.push(`${goal.criteria.length} criteria: a goal usually needs three to seven`);
  goal.criteria.forEach((criterion, index) => {
    if (criterion.n !== index + 1) errors.push(`criterion ${criterion.n} is out of sequence (expected ${index + 1})`);
    if (!criterion.text) errors.push(`criterion ${criterion.n} is empty`);
    if (!criterion.proof) errors.push(`criterion ${criterion.n} has no proof`);
    else if (criterion.commands.length === 0) warnings.push(`criterion ${criterion.n} has no run: proof; it is decided by hand`);
  });
  const numbers = new Set(goal.criteria.map((criterion) => criterion.n));
  for (const row of goal.evidence) {
    if (!numbers.has(row.n)) errors.push(`evidence names criterion ${row.n}, which the contract does not have`);
    if (!/^\d+$/.test(row.round)) errors.push(`evidence of criterion ${row.n}: round "${row.round}" is not a number`);
    if (!VERDICTS.includes(row.verdict)) errors.push(`evidence of criterion ${row.n}: verdict "${row.verdict}" is not one of ${VERDICTS.join(', ')}`);
    if (row.verdict === 'waived' && !goal.amendments.some((a) => a.n === row.n && a.change === 'waived')) {
      errors.push(`criterion ${row.n} is waived with no row in "## Amendments" saying who waived it and where it continues`);
    }
  }
  for (const amendment of goal.amendments) {
    if (!CHANGES.includes(amendment.change)) errors.push(`amendment of ${amendment.date}: change "${amendment.change}" is not one of ${CHANGES.join(', ')}`);
    if (!amendment.by) errors.push(`amendment of ${amendment.date}: nobody is named as having decided it`);
    if (['waived', 'moved', 'narrowed'].includes(amendment.change) && !amendment.follow) errors.push(`amendment of ${amendment.date}: a ${amendment.change} criterion names where the rest continues`);
    if (!['moved', 'added'].includes(amendment.change) && !numbers.has(amendment.n)) errors.push(`amendment of ${amendment.date} names criterion ${amendment.n}, which the contract does not have`);
  }
  if (ready) {
    if (!/^(approved|met)\b/.test(goal.status)) errors.push(`not ready: Status is "${goal.status}"`);
    for (const criterion of goal.criteria) {
      const verdict = latestVerdict(goal, criterion.n);
      if (!['met', 'waived'].includes(verdict)) errors.push(`not ready: criterion ${criterion.n} is ${verdict ?? 'not verified yet'}`);
    }
  }
  return { errors, warnings };
}

function check() {
  const flags = parseArgs(args, ['--changed'], ['--ready']);
  if (flags.positional.length > 1 || (flags.positional.length === 1 && flags['--changed'])) usage();
  let files;
  if (flags['--changed']) {
    const base = commitOf(flags['--changed'], '--changed');
    files = git(['diff', '--name-only', '--diff-filter=d', '--end-of-options', `${base}...HEAD`, '--', 'docs/goals'])
      .filter((file) => /^docs\/goals\/[^/]+\.md$/.test(file))
      .map((file) => path.join(root, file));
    if (files.length === 0) {
      console.log(`goal check: no goal contract changed since ${flags['--changed']}`);
      return 0;
    }
  } else if (flags.positional.length === 1) files = [slugFile(flags.positional[0])];
  else files = fs.existsSync(goalsDir) ? fs.readdirSync(goalsDir).filter((name) => name.endsWith('.md')).map((name) => path.join(goalsDir, name)) : [];
  if (files.length === 0) {
    console.log('goal check: no contract in docs/goals');
    return 0;
  }
  let bad = 0;
  for (const file of files) {
    const goal = parse(file);
    const { errors, warnings } = lint(goal, Boolean(flags['--ready']));
    console.log(`${errors.length === 0 ? 'ok  ' : 'FAIL'}  docs/goals/${goal.slug}.md  (${goal.status || 'no status'}, ${goal.criteria.length} criteria)`);
    for (const error of errors) console.log(`      error: ${error}`);
    for (const warning of warnings) console.log(`      note:  ${warning}`);
    if (errors.length > 0) bad++;
  }
  return bad === 0 ? 0 : 1;
}

function prove() {
  const flags = parseArgs(args, ['--criterion'], []);
  if (flags.positional.length !== 1) usage();
  const goal = parse(slugFile(flags.positional[0]));
  const only = flags['--criterion'] === undefined ? null : Number(flags['--criterion']);
  const criteria = goal.criteria.filter((criterion) => only === null || criterion.n === only);
  if (criteria.length === 0) fail(only === null ? `docs/goals/${goal.slug}.md has no criterion` : `docs/goals/${goal.slug}.md has no criterion ${only}`);
  // CI runs in UTC: a proof that passes only in the local zone is not a proof.
  const env = { ...process.env, TZ: 'UTC' };
  const results = [];
  for (const criterion of criteria) {
    if (criterion.commands.length === 0) results.push({ n: criterion.n, command: '(no run: proof, decided by hand)', status: null });
    for (const line of criterion.commands) {
      console.log(`\n=== criterion ${criterion.n}\n$ ${line}`);
      // One string through the shell, as written in the contract: npm and npx are .cmd shims on Windows.
      const status = spawnSync(line, { cwd: root, shell: true, stdio: 'inherit', env }).status ?? 1;
      results.push({ n: criterion.n, command: line, status });
    }
  }
  console.log(`\ngoal prove: docs/goals/${goal.slug}.md`);
  for (const row of results) console.log(`  ${row.status === null ? 'manual' : row.status === 0 ? 'exit 0' : `EXIT ${row.status}`.padEnd(6)}  criterion ${row.n}  ${row.command}`);
  const failed = results.filter((row) => row.status !== null && row.status !== 0);
  if (results.every((row) => row.status === null)) console.log('  nothing to run: no criterion has a run: proof');
  return failed.length === 0 ? 0 : 1;
}

function size() {
  const flags = parseArgs(args, ['--base'], []);
  if (flags.positional.length !== 1 || !flags['--base']) usage();
  const goal = parse(slugFile(flags.positional[0]));
  const base = commitOf(flags['--base'], '--base');
  const totals = { product: 0, tests: 0, documents: 0, lockfile: 0 };
  let files = 0;
  for (const [added, deleted, file] of git(['diff', '--numstat', '--end-of-options', `${base}...HEAD`]).map((line) => line.split('\t'))) {
    const kind = kindOf(file);
    totals[kind] += (Number(added) || 0) + (Number(deleted) || 0);
    if (kind === 'product') files++;
  }
  const commits = Number(git(['rev-list', '--count', `${base}..HEAD`])[0]);
  const over = totals.product > goal.sizeBudget;
  console.log(`goal size: docs/goals/${goal.slug}.md since ${flags['--base']}`);
  console.log(`  product code   ${totals.product} changed lines in ${files} files  (budget ${goal.sizeBudget})`);
  console.log(`  not counted    tests ${totals.tests}, documents ${totals.documents}, lockfile ${totals.lockfile}`);
  console.log(`  commits        ${commits}`);
  if (over) console.log('  OVER THE SIZE BUDGET: land the criteria that are met, and move the rest to a continuation goal (an amendment of kind "moved").');
  return over ? 1 : 0;
}

if (command === 'check') process.exit(check());
else if (command === 'prove') process.exit(prove());
else if (command === 'size') process.exit(size());
else usage();
