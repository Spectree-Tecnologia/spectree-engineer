// The goal contract (docs/goals/<slug>.md) read by a script instead of by eye: its shape, its proofs and its size.
// Whoever builds, whoever verifies and CI run the same commands, and the exit code decides.
//
//   npm run goal -- check [<slug>]                 the shape of one contract, or of all of them
//   npm run goal -- check --ready <slug>           also: approved, and every criterion's latest verdict is met or waived
//   npm run goal -- check --ready --changed <ref>  the contracts this branch changed since <ref> (what CI and check:pr run)
//   npm run goal -- prove <slug> [--criterion <n>] runs every `run:` proof and prints the exit code of each
//   npm run goal -- prove <slug> --after-merge     runs only the proofs written `after merge:`, on the merged main
//   npm run goal -- prove --in-ci --changed <ref>  runs the proofs written `in ci:` of the contracts this branch changed (a CI step)
//   npm run goal -- size <slug> --base <ref>       the product code changed since <ref> against the contract's size budget
//   npm run goal -- graph <slug>                   the tickets as a graph: no cycle, every criterion has a ticket, the frontier,
//                                                  and which tickets of the frontier may be built at the same time;
//                                                  the tickets waiting for their checkpoint or held by an open one,
//                                                  the ones whose checkpoint has the security-engineer, and every
//                                                  criterion reproved, checkpoints and rounds counted together
//   npm run goal -- graph <slug> --plan            also, before any code: every ticket says what it touches and its proof
//   npm run goal -- graph <slug> --prove <ticket>  runs the ticket's own proof, in UTC, and exits with it
//   npm run goal -- stats                          every contract in one table: rounds, reproofs, user decisions, size, CI, tokens
//   npm run goal -- spent <slug> [--write]         what the goal cost, read from this machine's Claude Code transcripts
//   npm run goal -- spent <slug> --agents          also one line per subagent: its turns, how its context grew, what filled it
//   npm run goal -- map [--check]                  docs/index.md, the product's index generated from the code; --check: is it current
//
// A proof a command decides is written in the Proof cell as run: `<command>`. `prove` runs each from the project
// root, in UTC as CI does, one after the other, and exits 1 if any exits non-zero. A proof with no `run:` is an
// observation someone repeats by hand, listed as manual. Proofs that need a database run under one of their own:
//   npm run db:scratch -- <name> -- npm run goal -- prove <slug>
//
// A proof that only the pull request's run or the merged main can give starts with `in ci:` or `after merge:`.
// It is not run before the pull request (`in ci:` runs in the pull request's run, `after merge:` on the merged
// main); its verdict is `pending` until then, and the contract is `landed`, not
// `met`, while one is pending.
import fs from 'node:fs';
import os from 'node:os';
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
    'usage: npm run goal -- check [<slug>] [--ready] [--changed <ref>]\n       npm run goal -- graph <slug> [--plan] [--json] [--prove <ticket>]\n      npm run goal -- prove <slug> [--criterion <n>] [--after-merge | --in-ci]\n       npm run goal -- prove --in-ci --changed <ref>\n       npm run goal -- size <slug> --base <ref>\n       npm run goal -- stats\n       npm run goal -- spent <slug> [--write] [--agents] [--session <id,id>] [--transcripts <dir>]\n       npm run goal -- map [--check]',
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

const VERDICTS = ['met', 'not met', 'weak proof', 'waived', 'pending'];
// `extended` is the one amendment that is not about a criterion: more verification rounds, decided by the user.
const CHANGES = ['narrowed', 'reworded', 'waived', 'added', 'moved', 'extended'];
const STATUS = /^(proposed|approved by .+ on \d{4}-\d{2}-\d{2}|landed on \d{4}-\d{2}-\d{2}|met on \d{4}-\d{2}-\d{2}|stopped on \d{4}-\d{2}-\d{2}: .+)$/;
const DEFERRED = /^\s*(after merge|in ci):/i;
const DEFAULT_ROUNDS = 3;
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
    // 'after merge' or 'in ci' when the proof cannot run before the pull request, else null
    deferred: proof.match(DEFERRED)?.[1].toLowerCase() ?? null,
    commands: [...proof.matchAll(/run:\s*`([^`]+)`/g)].map((m) => m[1].trim()),
  }));
  const evidence = rows('evidence').map(([n, round = '', verdict = '', run = '']) => ({ n: Number(n), round, verdict: verdict.toLowerCase().replace(/[*_`]/g, '').trim(), run }));
  const amendments = rows('amendments').map(([date, n = '', change = '', by = '', follow = '']) => ({ date, n: Number(n), change: change.toLowerCase().split(/[\s:,.]/)[0], by, follow }));
  const sizeLine = (sections.budget ?? []).join('\n').match(/^Size:\s*([\d\s.,]+)\s*changed lines/im);
  const roundsLine = (sections.budget ?? []).join('\n').match(/^Verification rounds:\s*(\d+)/im);
  // "Landed: PR #23, 1842 product lines, CI 27 min", written by the orchestrator when the pull request merges
  const landed = lines.find((line) => /^Landed:/.test(line)) ?? '';
  // "Spent: 15.2 h wall, 0.0 h at the usage limit, 1.3 h waiting for the founder, 0.0 h stopped by an error, 212.4M tokens in, 0.9M out, 1104 turns",
  // written by `goal spent --write`
  const spentLine = lines.find((line) => /^Spent:/.test(line)) ?? '';
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
    roundsBudget: roundsLine ? Number(roundsLine[1]) : DEFAULT_ROUNDS,
    landed: {
      pr: landed.match(/PR\s*#?(\d+)/i)?.[1] ?? null,
      lines: landed.match(/(\d[\d\s.]*)\s*product lines/i)?.[1].replace(/[\s.]/g, '') ?? null,
      ci: landed.match(/CI\s*(\d+)\s*min/i)?.[1] ?? null,
    },
    spent: {
      wall: spentLine.match(/([\d.]+) h wall/)?.[1] ?? null,
      limit: spentLine.match(/([\d.]+) h at the usage limit/)?.[1] ?? null,
      tokens: spentLine.match(/([\d.]+)M tokens in/)?.[1] ?? null,
    },
  };
}

// The verdict of the latest round that names the criterion; within a round, the row written last.
function latestVerdict(goal, n) {
  const mine = goal.evidence.filter((row) => row.n === n && /^\d+$/.test(row.round));
  const last = Math.max(...mine.map((row) => Number(row.round)));
  return mine.filter((row) => Number(row.round) === last).at(-1)?.verdict;
}

function lint(goal, ready) {
  const errors = [];
  const warnings = [];
  if (goal.title.trim() !== `# Goal: ${goal.slug}`) errors.push(`the first heading is "${goal.title.trim()}", expected "# Goal: ${goal.slug}"`);
  if (!STATUS.test(goal.status)) errors.push(`Status "${goal.status}" is not proposed, approved by <who> on <date>, landed on <date>, met on <date> or stopped on <date>: <why>`);
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
    if (row.verdict === 'pending' && !goal.criteria.find((criterion) => criterion.n === row.n)?.deferred) {
      errors.push(`criterion ${row.n} is pending, and only a proof written "after merge:" or "in ci:" may wait`);
    }
  }
  // A round has one verdict per criterion. A second row that turns the round's "not met" or "weak proof" into "met"
  // is the criterion as narrowed by an amendment, never a verdict changed by argument.
  for (const criterion of goal.criteria) {
    const byRound = new Map();
    for (const row of goal.evidence.filter((one) => one.n === criterion.n)) byRound.set(row.round, [...(byRound.get(row.round) ?? []), row.verdict]);
    for (const [round, verdicts] of byRound) {
      const turned = verdicts.at(-1) === 'met' && verdicts.slice(0, -1).some((verdict) => ['not met', 'weak proof'].includes(verdict));
      if (turned && !goal.amendments.some((a) => a.n === criterion.n && a.change === 'narrowed')) {
        errors.push(`criterion ${criterion.n} goes from reproved to met inside round ${round} with no "narrowed" row in "## Amendments"`);
      }
    }
  }
  if (/^met\b/.test(goal.status) && goal.criteria.some((criterion) => latestVerdict(goal, criterion.n) === 'pending')) {
    errors.push('Status is met while a proof is still pending: it is "landed on <date>" until the proof is run');
  }
  for (const amendment of goal.amendments) {
    if (!CHANGES.includes(amendment.change)) errors.push(`amendment of ${amendment.date}: change "${amendment.change}" is not one of ${CHANGES.join(', ')}`);
    if (!amendment.by) errors.push(`amendment of ${amendment.date}: nobody is named as having decided it`);
    if (['waived', 'moved', 'narrowed'].includes(amendment.change) && !amendment.follow) errors.push(`amendment of ${amendment.date}: a ${amendment.change} criterion names where the rest continues`);
    if (!['moved', 'added', 'extended'].includes(amendment.change) && !numbers.has(amendment.n)) errors.push(`amendment of ${amendment.date} names criterion ${amendment.n}, which the contract does not have`);
  }
  if (ready) {
    if (!/^(approved|landed|met)\b/.test(goal.status)) errors.push(`not ready: Status is "${goal.status}"`);
    for (const criterion of goal.criteria) {
      // moved to a continuation goal: the row stays so the numbers never change, and the verdict is given there
      if (goal.amendments.some((a) => a.n === criterion.n && a.change === 'moved')) continue;
      const verdict = latestVerdict(goal, criterion.n);
      // a proof that only the pull request's run or the merged main can give is ready while it waits
      const accepted = criterion.deferred ? ['met', 'waived', 'pending'] : ['met', 'waived'];
      if (!accepted.includes(verdict)) errors.push(`not ready: criterion ${criterion.n} is ${verdict ?? 'not verified yet'}`);
    }
  }
  return { errors, warnings };
}

// The contracts this branch changed since <ref>: what a pull request delivers.
function changedContracts(ref) {
  const base = commitOf(ref, '--changed');
  return git(['diff', '--name-only', '--diff-filter=d', '--end-of-options', `${base}...HEAD`, '--', 'docs/goals'])
    .filter((file) => /^docs\/goals\/[^/]+\.md$/.test(file))
    .map((file) => path.join(root, file));
}

function check() {
  const flags = parseArgs(args, ['--changed'], ['--ready']);
  if (flags.positional.length > 1 || (flags.positional.length === 1 && flags['--changed'])) usage();
  let files;
  if (flags['--changed']) {
    files = changedContracts(flags['--changed']);
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
    // one contract: every command its proofs will run, as the script reads the cell and not as its author meant it
    if (files.length === 1) {
      for (const criterion of goal.criteria) {
        for (const line of criterion.commands) console.log(`      runs:  criterion ${criterion.n}${criterion.deferred ? ` (${criterion.deferred})` : ''}  ${line}`);
      }
    }
    for (const error of errors) console.log(`      error: ${error}`);
    for (const warning of warnings) console.log(`      note:  ${warning}`);
    if (errors.length > 0) bad++;
  }
  return bad === 0 ? 0 : 1;
}

function prove() {
  const flags = parseArgs(args, ['--criterion', '--changed'], ['--after-merge', '--in-ci']);
  if (flags['--after-merge'] && flags['--in-ci']) usage();
  // the deferred proofs this run is the place for: the merged main, or the pull request's run
  const now = flags['--after-merge'] ? 'after merge' : flags['--in-ci'] ? 'in ci' : null;
  if (flags['--changed']) {
    if (flags.positional.length !== 0 || !now) usage();
    const files = changedContracts(flags['--changed']);
    if (files.length === 0) console.log(`goal prove: no goal contract changed since ${flags['--changed']}`);
    return files.map((file) => proveOne(parse(file), null, now)).some((code) => code !== 0) ? 1 : 0;
  }
  if (flags.positional.length !== 1) usage();
  return proveOne(parse(slugFile(flags.positional[0])), flags['--criterion'] === undefined ? null : Number(flags['--criterion']), now);
}

function proveOne(goal, only, now) {
  const criteria = goal.criteria.filter((criterion) => (only === null || criterion.n === only) && (!now || criterion.deferred === now));
  if (now && criteria.length === 0) {
    console.log(`goal prove: docs/goals/${goal.slug}.md has no proof written "${now}:"`);
    return 0;
  }
  if (criteria.length === 0) fail(only === null ? `docs/goals/${goal.slug}.md has no criterion` : `docs/goals/${goal.slug}.md has no criterion ${only}`);
  // CI runs in UTC: a proof that passes only in the local zone is not a proof.
  const env = { ...process.env, TZ: 'UTC' };
  const results = [];
  for (const criterion of criteria) {
    // what only the pull request's run or the merged main can show does not run here
    if (criterion.deferred && criterion.deferred !== now) {
      results.push({ n: criterion.n, command: `(${criterion.deferred}: not run now)`, status: null, waits: true });
      continue;
    }
    if (criterion.commands.length === 0) results.push({ n: criterion.n, command: '(no run: proof, decided by hand)', status: null });
    for (const line of criterion.commands) {
      console.log(`\n=== criterion ${criterion.n}\n$ ${line}`);
      // One string through the shell, as written in the contract: npm and npx are .cmd shims on Windows.
      const status = spawnSync(line, { cwd: root, shell: true, stdio: 'inherit', env }).status ?? 1;
      results.push({ n: criterion.n, command: line, status });
    }
  }
  console.log(`\ngoal prove: docs/goals/${goal.slug}.md`);
  for (const row of results) console.log(`  ${row.waits ? 'waits ' : row.status === null ? 'manual' : row.status === 0 ? 'exit 0' : `EXIT ${row.status}`.padEnd(6)}  criterion ${row.n}  ${row.command}`);
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

// Every contract in one table, read from the contracts themselves: what the squad's way of working costs and how
// often it needed the user, goal by goal. Lenient where check is strict, so that old contracts still count.
function stats() {
  if (args.length > 0) usage();
  const files = fs.existsSync(goalsDir) ? fs.readdirSync(goalsDir).filter((name) => name.endsWith('.md')).sort() : [];
  if (files.length === 0) {
    console.log('goal stats: no contract in docs/goals');
    return 0;
  }
  const roundOf = (row) => Number(row.round.match(/^\d+/)?.[0] ?? 0);
  const rows = files.map((name) => {
    const goal = parse(path.join(goalsDir, name));
    const decisions = path.join(root, '.scratch', goal.slug, 'decisions.md');
    return {
      slug: goal.slug,
      status: goal.status.split(' ')[0] || '?',
      criteria: goal.criteria.length,
      rounds: Math.max(0, ...goal.evidence.map(roundOf)),
      budget: goal.roundsBudget,
      reproved: new Set(goal.evidence.filter((row) => /^(not met|weak proof)/.test(row.verdict)).map((row) => row.n)).size,
      user: goal.amendments.filter((a) => /founder|fundador|user/i.test(a.by) && !/policy/i.test(a.by)).length,
      policy: goal.amendments.filter((a) => /policy/i.test(a.by)).length,
      fable: fs.existsSync(decisions) && /escalated to fable/i.test(fs.readFileSync(decisions, 'utf8')),
      lines: goal.landed.lines,
      ci: goal.landed.ci,
      ...goal.spent,
    };
  });
  const head = ['goal', 'status', 'criteria', 'rounds', 'reproved', 'user', 'policy', 'fable', 'lines', 'ci min', 'wall h', 'limit h', 'tokens M'];
  const table = rows.map((r) => [r.slug, r.status, String(r.criteria), `${r.rounds}/${r.budget}`, String(r.reproved), String(r.user), String(r.policy), r.fable ? 'yes' : '-', r.lines ?? '-', r.ci ?? '-', r.wall ?? '-', r.limit ?? '-', r.tokens ?? '-']);
  const width = head.map((title, i) => Math.max(title.length, ...table.map((row) => row[i].length)));
  const print = (row) => console.log(`  ${row.map((cell, i) => cell.padEnd(width[i])).join('  ')}`.trimEnd());
  console.log('goal stats: docs/goals');
  print(head);
  table.forEach(print);
  const done = rows.filter((r) => ['met', 'landed'].includes(r.status));
  if (done.length > 0) {
    const mean = (pick) => (done.reduce((sum, r) => sum + pick(r), 0) / done.length).toFixed(1);
    const ci = done.filter((r) => r.ci).reduce((sum, r) => sum + Number(r.ci), 0);
    console.log(`\n  ${done.length} landed or met`);
    console.log(`  rounds per goal          ${mean((r) => r.rounds)}`);
    console.log(`  met in the first round   ${done.filter((r) => r.rounds <= 1 && r.reproved === 0).length} of ${done.length}`);
    console.log(`  spent the whole budget   ${done.filter((r) => r.rounds >= r.budget).length} of ${done.length}`);
    console.log(`  user decisions per goal  ${mean((r) => r.user)}  (amendments the user decided; "policy" counts the ones the risk policy decided)`);
    console.log(`  raised to fable          ${done.filter((r) => r.fable).length} of ${done.length}`);
    if (ci > 0) console.log(`  CI minutes recorded      ${ci}`);
    const measured = done.filter((r) => r.tokens);
    if (measured.length > 0) {
      const sum = (pick) => measured.reduce((total, r) => total + Number(pick(r) ?? 0), 0);
      console.log(`  tokens in per goal       ${(sum((r) => r.tokens) / measured.length).toFixed(1)}M  (${measured.length} measured with "goal spent")`);
      console.log(`  hours at the usage limit ${sum((r) => r.limit).toFixed(1)} of ${sum((r) => r.wall).toFixed(1)} h of wall-clock`);
    }
  }
  return 0;
}

// The product's index, generated from the code. The monolith has one shape, so a script reads what the
// solutions-architect used to rebuild by hand for every request: modules, aggregates, use cases, queries, events,
// routes, tables, screens, and the ADRs and contracts that name each module. The code is the source of truth and the
// index is derived from it, so it cannot drift unnoticed: `--check` exits 1 when docs/index.md is not what the code
// gives. Nothing in it is a rule: a rule is in docs/architecture.md, the GLOSSARY or an ADR.
const INDEX = path.join('docs', 'index.md');
const LAYERS = ['dto', 'model', 'provider', 'query', 'use-case'];

function projectConfig() {
  for (const rel of ['skills.config.json', path.join('.env', 'skills.config.json')]) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      fail(`${rel} is not valid JSON`);
    }
  }
  return {};
}

const posix = (rel) => rel.split(path.sep).join('/');
const entries = (rel) => {
  const dir = path.join(root, rel);
  return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)) : [];
};
const folders = (rel) => entries(rel).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
// Source files under a folder, tests and build output left out.
function sources(rel) {
  const out = [];
  for (const entry of entries(rel)) {
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.next', 'test', '__tests__', 'coverage'].includes(entry.name)) out.push(...sources(child));
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) out.push(child);
  }
  return out;
}
const textOf = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const named = (files, suffix) => files.filter((file) => file.endsWith(suffix)).map((file) => path.basename(file, suffix)).sort();
const spans = (names) => names.map((name) => `\`${name}\``).join(', ');
const literal = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function productIndex() {
  const config = projectConfig();
  const ns = config.namespace ?? null;
  const backend = config.backendAppPath ?? path.join('apps', 'backend');
  const frontend = config.frontendAppPath ?? path.join('apps', 'frontend');
  const coreNames = folders('modules');
  const backendNames = folders(path.join(backend, 'src', 'modules'));
  const frontendNames = folders(path.join(frontend, 'src', 'modules'));
  const names = [...new Set([...coreNames, ...backendNames, ...frontendNames])].sort();
  if (names.length === 0) return null;

  const modules = names.map((name) => {
    const coreRel = path.join('modules', name, 'src');
    const aggregates = folders(coreRel)
      .filter((dir) => folders(path.join(coreRel, dir)).some((layer) => LAYERS.includes(layer)))
      .map((dir) => {
        const files = sources(path.join(coreRel, dir));
        const events = [];
        for (const file of files.filter((one) => one.endsWith('-events.dto.ts') || one.endsWith('.event.ts'))) {
          for (const m of textOf(file).matchAll(/export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*['"`]([^'"`]+)['"`]/g)) events.push({ constant: m[1], name: m[2] });
        }
        return {
          name: dir,
          entities: named(files, '.entity.ts'),
          vos: named(files, '.vo.ts'),
          useCases: named(files, '.use-case.ts'),
          queries: named(files, '.query.ts'),
          repositories: named(files, '.repository.ts'),
          events,
        };
      });
    const backendRel = path.join(backend, 'src', 'modules', name);
    const backendFiles = sources(backendRel);
    // Which other modules' packages a folder imports; `shared` is everyone's and is left out.
    const imports = (files) => {
      if (!ns) return [];
      const found = new Set();
      const re = new RegExp(`from\\s+['"]${literal(ns)}/([a-z0-9-]+)`, 'g');
      for (const file of files) for (const m of textOf(file).matchAll(re)) if (m[1] !== name && m[1] !== 'shared') found.add(m[1]);
      return [...found].sort();
    };
    const routes = new Set();
    for (const file of backendFiles.filter((one) => one.endsWith('.controller.ts'))) {
      const source = textOf(file);
      const prefix = /@Controller\(\s*['"`]([^'"`]*)['"`]/.exec(source)?.[1] ?? '';
      for (const m of source.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?/g)) {
        const route = [prefix, m[2] ?? ''].join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
        routes.add(`${m[1].toUpperCase()} /${route}`);
      }
    }
    const prismaRel = path.join(backend, 'prisma', 'models', `${name}.model.prisma`);
    const tables = fs.existsSync(path.join(root, prismaRel)) ? [...textOf(prismaRel).matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]).sort() : [];
    return {
      name,
      core: coreNames.includes(name) ? posix(coreRel) : null,
      backend: backendNames.includes(name) ? posix(backendRel) : null,
      frontend: frontendNames.includes(name) ? posix(path.join(frontend, 'src', 'modules', name)) : null,
      aggregates,
      coreImports: imports(sources(coreRel)),
      backendImports: imports(backendFiles),
      backendFiles,
      routes: [...routes].sort(),
      tables,
      screens: [],
      reactsTo: [],
      adrs: [],
      goals: [],
    };
  });

  // Rule 13: a module reacts to another's event in its own backend wiring, by the event's constant or its name.
  const published = modules.flatMap((module) => module.aggregates.flatMap((aggregate) => aggregate.events.map((event) => ({ ...event, module: module.name }))));
  for (const module of modules) {
    const wiring = module.backendFiles.map(textOf).join('\n');
    module.reactsTo = published
      .filter((event) => event.module !== module.name)
      .filter((event) => new RegExp(`\\b${event.constant}\\b`).test(wiring) || wiring.includes(`'${event.name}'`) || wiring.includes(`"${event.name}"`))
      .map((event) => `\`${event.name}\` (${event.module})`)
      .sort();
  }

  // A screen is a page.tsx under app/; it belongs to the module whose folder it imports.
  const appRel = path.join(frontend, 'src', 'app');
  const loose = [];
  for (const file of sources(appRel).filter((one) => path.basename(one) === 'page.tsx')) {
    const segments = posix(path.relative(appRel, path.dirname(file))).split('/').filter((segment) => segment && segment !== '.' && !/^\(.*\)$/.test(segment));
    const route = `/${segments.join('/')}`;
    const source = textOf(file);
    const owner = modules.find((module) => new RegExp(`modules/${literal(module.name)}['"/]`).test(source));
    if (owner) owner.screens.push(route);
    else loose.push(route);
  }

  // The documents that name a module: its path, its package, or its name in a code span.
  const markdown = (dir) => entries(dir).filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map((entry) => path.join(dir, entry.name));
  const mentions = (module, body) => [`modules/${module.name}/`, `/modules/${module.name}`, `\`${module.name}\``, ...(ns ? [`${ns}/${module.name}`] : [])].some((needle) => body.includes(needle));
  for (const file of markdown(path.join('docs', 'adr'))) {
    const body = textOf(file);
    for (const module of modules) if (mentions(module, body)) module.adrs.push(path.basename(file, '.md'));
  }
  for (const file of markdown(path.join('docs', 'goals'))) {
    const body = textOf(file);
    const status = /^Status:\s*(proposed|approved|landed|met|stopped)/m.exec(body)?.[1] ?? 'no status';
    for (const module of modules) if (mentions(module, body)) module.goals.push(`\`${path.basename(file, '.md')}\` (${status})`);
  }

  const total = (module, key) => module.aggregates.reduce((sum, aggregate) => sum + aggregate[key].length, 0);
  const cell = (n) => (n === 0 ? '-' : String(n));
  const lines = [
    '# Product index',
    '',
    'Generated from the code by `npm run goal -- map`. Do not edit it by hand: run the command again and commit the result. The code is the source of truth; when this page and the code disagree, the page is stale and `npm run goal -- map --check` exits 1. Nothing here is a rule: the rules are in `docs/architecture.md`, `GLOSSARY.md` and `docs/adr/`.',
    '',
    '| Module | Aggregates | Use cases | Queries | Events | Routes | Tables | Screens | Core imports |',
    '|---|---|---|---|---|---|---|---|---|',
    ...modules.map(
      (m) =>
        `| [${m.name}](#${m.name}) | ${cell(m.aggregates.filter((a) => a.name !== 'app').length)} | ${cell(total(m, 'useCases'))} | ${cell(total(m, 'queries'))} | ${cell(total(m, 'events'))} | ${cell(m.routes.length)} | ${cell(m.tables.length)} | ${cell(m.screens.length)} | ${m.coreImports.length ? spans(m.coreImports) : '-'} |`,
    ),
  ];
  for (const m of modules) {
    lines.push('', `## ${m.name}`, '');
    if (m.core) {
      lines.push(`- **Core** \`${m.core}/\``);
      for (const a of m.aggregates) {
        const parts = [
          ['entities', a.entities],
          ['value objects', a.vos],
          ['use cases', a.useCases],
          ['queries', a.queries],
          ['repositories', a.repositories],
          ['publishes', a.events.map((event) => event.name)],
        ]
          .filter(([, list]) => list.length > 0)
          .map(([label, list]) => `${label} ${spans(list)}`);
        lines.push(`  - \`${a.name}\`${a.name === 'app' ? ' (across aggregates)' : ''}: ${parts.join('; ') || 'no files yet'}`);
      }
      if (m.coreImports.length) lines.push(`  - imports the business code of ${spans(m.coreImports)}`);
    }
    if (m.backend) {
      lines.push(`- **Backend** \`${m.backend}/\``);
      if (m.routes.length) lines.push(`  - routes: ${spans(m.routes)}`);
      if (m.tables.length) lines.push(`  - tables: ${spans(m.tables)}`);
      if (m.reactsTo.length) lines.push(`  - reacts to: ${m.reactsTo.join(', ')}`);
      if (m.backendImports.length) lines.push(`  - imports the packages of ${spans(m.backendImports)}`);
    }
    if (m.frontend || m.screens.length) lines.push(`- **Frontend**${m.frontend ? ` \`${m.frontend}/\`` : ''}${m.screens.length ? `: screens ${spans(m.screens.sort())}` : ''}`);
    if (m.adrs.length) lines.push(`- **ADRs**: ${spans(m.adrs)}`);
    if (m.goals.length) lines.push(`- **Goals**: ${m.goals.join(', ')}`);
  }
  if (loose.length) lines.push('', '## Screens outside a module', '', spans(loose.sort()));
  return { modules: modules.length, body: `${lines.join('\n')}\n` };
}

function map() {
  const flags = parseArgs(args, [], ['--check']);
  if (flags.positional.length > 0) usage();
  const index = productIndex();
  if (!index) fail('no module under modules/ or the backend and frontend modules folders: nothing to index');
  const file = path.join(root, INDEX);
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
  if (flags['--check']) {
    if (current === index.body) {
      console.log(`goal map: ${posix(INDEX)} is current (${index.modules} modules)`);
      return 0;
    }
    console.log(`goal map: ${posix(INDEX)} is ${current === null ? 'missing' : 'stale'}: run \`npm run goal -- map\` and commit it`);
    return 1;
  }
  if (current !== index.body) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, index.body);
  }
  console.log(`goal map: ${posix(INDEX)} ${current === index.body ? 'unchanged' : 'written'} (${index.modules} modules)`);
  return 0;
}

// What a goal cost, read from the Claude Code transcripts of this project on this machine: the sessions opened with
// "/engineer item <slug>", their subagents, and where the wall-clock went. The speed of the squad is bounded by the
// plan's usage limit, so the number to watch is tokens per goal, role by role.
function spent() {
  const flags = parseArgs(args, ['--session', '--transcripts'], ['--write', '--agents']);
  if (flags.positional.length !== 1) usage();
  const goal = parse(slugFile(flags.positional[0]));
  const projects = flags['--transcripts'] ?? path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects');
  // Claude Code names a project's folder after its path, every character that is not a letter or a digit as a dash;
  // a worktree of the project is a folder that starts with the same name.
  const mine = root.replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
  const dirs = fs.existsSync(projects) ? fs.readdirSync(projects).filter((name) => name.toLowerCase() === mine || name.toLowerCase().startsWith(`${mine}-`)) : [];
  const head = (file) => {
    const buffer = Buffer.alloc(400_000);
    const fd = fs.openSync(file, 'r');
    const read = fs.readSync(fd, buffer, 0, buffer.length, 0);
    fs.closeSync(fd);
    return buffer.toString('utf8', 0, read);
  };
  const named = flags['--session']?.split(',').filter(Boolean);
  // an item session opens with the command, and the app titles it with the slug: either one names it
  const opening = new RegExp(`/engineer item ${goal.slug}(?![a-z0-9-])|"customTitle":"${goal.slug}"`);
  const sessions = dirs.flatMap((dir) =>
    fs.readdirSync(path.join(projects, dir)).filter((name) => name.endsWith('.jsonl')).map((name) => path.join(projects, dir, name)).filter((file) => (named ? named.some((id) => path.basename(file).startsWith(id)) : opening.test(head(file)))),
  );
  if (sessions.length === 0) fail(`no session of this project opened with "/engineer item ${goal.slug}" or titled "${goal.slug}" under ${projects}: name it with --session <id>`);

  const rowsOf = (file) =>
    fs.readFileSync(file, 'utf8').split('\n').flatMap((line) => {
      try {
        return line ? [JSON.parse(line)] : [];
      } catch {
        return [];
      }
    });
  const roles = {};
  const missions = [];
  const count = (role, rows, what) => {
    const one = (roles[role] ??= { turns: 0, cached: 0, fresh: 0, out: 0 });
    const seen = new Set();
    // one subagent: its turns, the context of its first and last turn, and the bytes of tool results by tool
    const mine = { role, what, at: rows.find((row) => row.timestamp)?.timestamp ?? '', turns: 0, first: 0, last: 0, tokens: 0, filled: {} };
    const tools = new Map();
    for (const row of rows) {
      const used = row.message?.usage;
      for (const part of Array.isArray(row.message?.content) ? row.message.content : []) {
        if (part.type === 'tool_use') tools.set(part.id, part.name);
        if (part.type === 'tool_result') mine.filled[tools.get(part.tool_use_id) ?? 'other'] = (mine.filled[tools.get(part.tool_use_id) ?? 'other'] ?? 0) + JSON.stringify(part.content ?? '').length;
      }
      // one response is written once per content block: count it once
      if (row.type !== 'assistant' || !used || seen.has(row.message.id ?? row.uuid)) continue;
      seen.add(row.message.id ?? row.uuid);
      one.turns += 1;
      const context = (used.cache_read_input_tokens ?? 0) + (used.input_tokens ?? 0) + (used.cache_creation_input_tokens ?? 0);
      mine.turns += 1;
      mine.first ||= context;
      mine.last = context;
      mine.tokens += context;
      one.cached += used.cache_read_input_tokens ?? 0;
      one.fresh += (used.input_tokens ?? 0) + (used.cache_creation_input_tokens ?? 0);
      one.out += used.output_tokens ?? 0;
    }
    if (what !== undefined && mine.turns > 0) missions.push(mine);
  };
  const total = { wall: 0, limit: 0, waiting: 0, waits: 0, stopped: 0, stops: 0, agents: 0, union: 0, from: Infinity, to: 0 };
  for (const file of sessions) {
    const rows = rowsOf(file);
    count('Engineer', rows.filter((row) => !row.isSidechain));
    const sub = path.join(file.replace(/\.jsonl$/, ''), 'subagents');
    for (const name of fs.existsSync(sub) ? fs.readdirSync(sub).filter((one) => one.endsWith('.jsonl')) : []) {
      const meta = path.join(sub, name.replace(/\.jsonl$/, '.meta.json'));
      const about = fs.existsSync(meta) ? JSON.parse(fs.readFileSync(meta, 'utf8')) : {};
      count(String(about.agentType ?? 'subagent').split(':').pop(), rowsOf(path.join(sub, name)), String(about.description ?? ''));
    }
    // the wall-clock: a background agent runs from its launch, or from a message to it, until the next notice with
    // its id; a wait before a message from outside counts only while nothing runs, as the usage limit when that is
    // what stopped the session, and as a stop when an API error ended the turn: nobody was asked anything
    const calls = new Map();
    const known = new Set();
    const running = new Map();
    const intervals = [];
    let first = null;
    let prev = null;
    let limitedAt = null;
    let erroredAt = null;
    for (const row of rows) {
      if (row.isSidechain || !row.timestamp) continue;
      const ts = Date.parse(row.timestamp);
      if (row.type === 'queue-operation') {
        const id = /<task-id>([^<]+)<\/task-id>/.exec(String(row.content ?? ''))?.[1];
        if (id && running.has(id)) {
          intervals.push([running.get(id), ts]);
          running.delete(id);
        }
        continue;
      }
      if (!row.message) continue;
      first ??= ts;
      const content = Array.isArray(row.message.content) ? row.message.content : [{ type: 'text', text: String(row.message.content ?? '') }];
      if (row.type === 'assistant') {
        if (row.isApiErrorMessage && /hit your .*limit/i.test(JSON.stringify(content))) limitedAt ??= ts;
        // an error the turn got past is followed by another response, and is no stop
        else if (row.isApiErrorMessage) erroredAt ??= ts;
        else erroredAt = null;
        for (const part of content) if (part.type === 'tool_use') calls.set(part.id, { name: part.name, to: part.input?.to, ts });
      }
      if (row.type === 'user') {
        let outside = false;
        for (const part of content) {
          const call = part.type === 'tool_result' ? calls.get(part.tool_use_id) : null;
          if (call && row.toolUseResult?.isAsync && row.toolUseResult.agentId) {
            known.add(row.toolUseResult.agentId);
            running.set(row.toolUseResult.agentId, call.ts);
          } else if (call && call.name === 'SendMessage' && known.has(call.to) && !running.has(call.to)) running.set(call.to, call.ts);
          else if (call && (call.name === 'Agent' || call.name === 'Task')) intervals.push([call.ts, ts]);
          const said = part.type === 'text' ? (part.text ?? '') : '';
          if (said && !row.isMeta && !/^\s*<[a-z-]+>/.test(said) && !/SYSTEM NOTIFICATION|hand-back|Handback/.test(said)) outside = true;
        }
        if (outside && limitedAt !== null) {
          total.limit += ts - limitedAt;
          limitedAt = null;
          erroredAt = null;
        } else if (outside && erroredAt !== null) {
          total.stopped += ts - erroredAt;
          total.stops += 1;
          erroredAt = null;
        } else if (outside && prev !== null && running.size === 0 && ts - prev > 60_000) {
          total.waiting += ts - prev;
          total.waits += 1;
        }
      }
      prev = ts;
    }
    if (first === null) continue;
    total.wall += prev - first;
    total.from = Math.min(total.from, first);
    total.to = Math.max(total.to, prev);
    intervals.sort((a, b) => a[0] - b[0]);
    let end = 0;
    for (const [from, to] of intervals) {
      total.agents += to - from;
      if (to > end) total.union += to - Math.max(from, end);
      end = Math.max(end, to);
    }
  }
  const h = (ms) => (ms / 3_600_000).toFixed(1);
  const M = (n) => `${(n / 1e6).toFixed(1)}M`;
  const all = Object.values(roles).reduce((sum, one) => ({ turns: sum.turns + one.turns, cached: sum.cached + one.cached, fresh: sum.fresh + one.fresh, out: sum.out + one.out }), { turns: 0, cached: 0, fresh: 0, out: 0 });
  const tokensIn = all.cached + all.fresh;
  const day = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  console.log(`goal spent: docs/goals/${goal.slug}.md, ${sessions.length} session${sessions.length === 1 ? '' : 's'} of this project on this machine (${day(total.from)} to ${day(total.to)} UTC)`);
  console.log(`  wall                 ${h(total.wall).padStart(7)} h`);
  console.log(`  at the usage limit   ${h(total.limit).padStart(7)} h`);
  console.log(`  waiting for a reply  ${h(total.waiting).padStart(7)} h   ${total.waits} waits with nothing running`);
  console.log(`  stopped by an error  ${h(total.stopped).padStart(7)} h   ${total.stops} turn${total.stops === 1 ? '' : 's'} an API error ended, until somebody wrote again`);
  console.log(`  working              ${h(total.wall - total.limit - total.waiting - total.stopped).padStart(7)} h   an agent running ${h(total.union)} h, x${(total.agents / Math.max(total.union, 1)).toFixed(2)} in parallel`);
  console.log(`  tokens in            ${M(tokensIn).padStart(8)}    ${M(all.cached)} read from the cache, ${M(all.fresh)} new`);
  console.log(`  tokens out           ${M(all.out).padStart(8)}    in ${all.turns} turns`);
  console.log('  by role                    turns   tokens in   per turn     out');
  for (const [role, one] of Object.entries(roles).sort((a, b) => b[1].cached + b[1].fresh - a[1].cached - a[1].fresh)) {
    const input = one.cached + one.fresh;
    console.log(`    ${role.padEnd(22)} ${String(one.turns).padStart(7)}  ${M(input).padStart(10)}  ${`${Math.round(input / Math.max(one.turns, 1) / 1000)}k`.padStart(9)}  ${M(one.out).padStart(6)}  ${Math.round((100 * input) / Math.max(tokensIn, 1))}%`);
  }
  // a mission past 60 turns re-reads a context that has grown: where the tokens of the builders went
  const LONG = 60;
  const builds = missions.filter((one) => one.role === 'full-stack-developer');
  const long = builds.filter((one) => one.turns > LONG);
  const sum = (list) => list.reduce((all, one) => all + one.tokens, 0);
  if (builds.length > 0) console.log(`  missions over ${LONG} turns  ${long.length} of ${builds.length} full-stack-developer missions, ${Math.round((100 * sum(long)) / Math.max(sum(builds), 1))}% of its tokens`);
  // what a verification sent back: a mission the Engineer named as a fix or a diagnosis
  const REWORK = /\b(?:fix\w*|diagnos\w*|debug\w*|corre[cç]\w*|corrig\w*|conser\w*)/i;
  const rework = builds.filter((one) => REWORK.test(one.what));
  if (builds.length > 0) console.log(`  fixes after a verification  ${rework.length} of ${builds.length} full-stack-developer missions, ${Math.round((100 * sum(rework)) / Math.max(sum(builds), 1))}% of its tokens (by the mission's name)`);
  if (flags['--agents']) {
    const k = (n) => `${Math.round(n / 1000)}k`;
    console.log('  by agent      role                   turns   context         tokens in  what filled it');
    for (const one of missions.sort((a, b) => a.at.localeCompare(b.at))) {
      const top = Object.entries(one.filled).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([tool, bytes]) => `${tool} ${Math.round(bytes / 1000)}kB`).join(', ');
      console.log(`    ${one.at.slice(5, 16).replace('T', ' ')}  ${one.role.padEnd(21)} ${String(one.turns).padStart(5)}   ${`${k(one.first)} -> ${k(one.last)}`.padEnd(14)} ${M(one.tokens).padStart(8)}  ${top}  ${one.what.slice(0, 40)}`);
    }
  }
  const line = `Spent: ${h(total.wall)} h wall, ${h(total.limit)} h at the usage limit, ${h(total.waiting)} h waiting for the founder, ${h(total.stopped)} h stopped by an error, ${M(tokensIn)} tokens in, ${M(all.out)} out, ${all.turns} turns`;
  console.log(`\n${line}`);
  if (flags['--write']) {
    const lines = fs.readFileSync(goal.file, 'utf8').split(/\r?\n/);
    const at = lines.findIndex((one) => /^Spent:/.test(one));
    if (at >= 0) lines[at] = line;
    else lines.splice(Math.max(lines.findIndex((one) => /^Landed:/.test(one)), lines.findIndex((one) => /^Status:/.test(one))) + 1, 0, line);
    fs.writeFileSync(goal.file, lines.join('\n'));
    console.log(`  written to docs/goals/${goal.slug}.md`);
  }
  return 0;
}

// The tickets of a goal are a graph: each ticket is a node, `Blocked by` its edges, `Touches` the paths it writes and
// `Proof` the command that closes it. Read by a script, the graph says what the prose of a plan cannot be trusted to:
// that it has no cycle, that every criterion has a ticket, that two tickets that could run at the same time never
// write the same place, and which tickets are free to start now (the frontier).
const pad = (n) => String(n).padStart(2, '0');
// A ticket's state. Whoever builds it writes `built`; only the Engineer writes `verified` or `open`, after the
// ticket's checkpoint. `done` is what tickets said before 0.39.0, read as `verified`. Anything else is `ready`.
const STATES = ['ready', 'built', 'verified', 'open'];
const stateOf = (status) => {
  const word = (status ?? '').toLowerCase().match(/^[a-z]+/)?.[0] ?? '';
  if (word === 'done') return 'verified';
  return STATES.includes(word) ? word : 'ready';
};
// Paths whose change crosses a trust boundary of the monolith: the backend (routes, guards, persistence,
// migrations, configuration, external clients), the shared package, a dependency, CI, an env file, and any auth,
// middleware, api or upload folder. A ticket that touches one of them has the security-engineer at its checkpoint.
const TRUST = [
  /^apps\/backend(\/|$)/,
  /^packages\/shared(\/|$)/,
  /(^|\/)package(-lock)?\.json$/,
  /^\.github(\/|$)/,
  /(^|\/)\.env/,
  /(^|\/)(auth|middleware|proxy|api|uploads?)(\/|$|\.)/,
];
const cleanPath = (one) => one.replace(/`/g, '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/\*{1,2}$/, '').replace(/\/+$/, '');
const samePlace = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

function readTickets(slug) {
  const dir = path.join(root, '.scratch', slug, 'issues');
  if (!fs.existsSync(dir)) fail(`.scratch/${slug}/issues not found: the goal has no tickets yet`);
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d+-.+\.md$/.test(name))
    .sort()
    .map((name) => {
      const text = fs.readFileSync(path.join(dir, name), 'utf8');
      const field = (label) => text.match(new RegExp(`^(?:\\*\\*)?${label}:(?:\\*\\*)?[ \\t]*(.*)$`, 'im'))?.[1].trim() ?? null;
      const numbers = (value) => [...(value ?? '').matchAll(/\d+/g)].map((m) => Number(m[0]));
      const touches = field('Touches');
      const paths = touches === null ? null : touches.split(',').map(cleanPath).filter(Boolean);
      const state = stateOf(field('Status'));
      const carried = field('Carried');
      return {
        n: Number(name.match(/^\d+/)[0]),
        file: `.scratch/${slug}/issues/${name}`,
        name: name.replace(/^\d+-/, '').replace(/\.md$/, ''),
        // the numbers that open the field: "1 and 3, proved by 2 e2e tests" advances 1 and 3
        legacy: field('Criteria') === null,
        criteria: numbers((field('Criteria') ?? '').match(/^\d+(?:\s*\([^)]*\))?(?:\s*(?:,|;|and|e|&)\s*\d+(?:\s*\([^)]*\))?)*/)?.[0].replace(/\([^)]*\)/g, '')),
        blockedBy: numbers(field('Blocked by')),
        touches: paths,
        proof: [...(field('Proof') ?? '').matchAll(/run:\s*`([^`]+)`/g)].map((m) => m[1].trim()),
        state,
        // an `open` ticket frees the tickets it blocks only with the Engineer's `Carried:` reason
        carried: state === 'open' && Boolean(carried),
        // closed: the tickets it blocks may start
        done: state === 'verified' || (state === 'open' && Boolean(carried)),
        // the criteria the checkpoint found `not met` or `weak proof` before the fix
        reproved: /^(none|-)?$/i.test(field('Reproved') ?? '') ? [] : numbers(field('Reproved')),
        // a ticket that does not say what it touches proved nothing: it has the security-engineer too
        trust: paths === null || paths.length === 0 || paths.some((one) => TRUST.some((pattern) => pattern.test(one))),
      };
    });
}

function graph() {
  const flags = parseArgs(args, ['--prove'], ['--plan', '--json']);
  if (flags.positional.length !== 1) usage();
  const slug = flags.positional[0];
  const goal = parse(slugFile(slug));
  const every = readTickets(slug);
  const tickets = every.filter((ticket) => !ticket.legacy);
  const byNumber = new Map(tickets.map((ticket) => [ticket.n, ticket]));
  const errors = [];
  const notes = every.filter((ticket) => ticket.legacy).map((ticket) => `${ticket.file} has no "Criteria": a ticket from before Goal-Driven, left out of the graph`);
  if (tickets.length === 0) errors.push('no ticket file (<NN>-<name>.md) in the folder');
  if (byNumber.size !== tickets.length) errors.push('two ticket files share a number');

  for (const ticket of tickets) {
    for (const blocker of ticket.blockedBy) {
      if (blocker === ticket.n) errors.push(`ticket ${pad(ticket.n)} is blocked by itself`);
      else if (!byNumber.has(blocker)) errors.push(`ticket ${pad(ticket.n)} is blocked by ${pad(blocker)}, which does not exist`);
    }
    if (ticket.criteria.length === 0) errors.push(`ticket ${pad(ticket.n)} names no criterion in "Criteria"`);
    for (const n of ticket.criteria) if (!goal.criteria.some((criterion) => criterion.n === n)) errors.push(`ticket ${pad(ticket.n)} names criterion ${n}, which the contract does not have`);
    if (ticket.done) continue;
    // what a plan must say before any code; a goal planned before the graph only gets a note
    const missing = [ticket.touches === null || ticket.touches.length === 0 ? '"Touches"' : null, ticket.proof.length === 0 ? '"Proof" with a run: command' : null].filter(Boolean);
    if (missing.length > 0) (flags['--plan'] ? errors : notes).push(`ticket ${pad(ticket.n)} has no ${missing.join(' and no ')}`);
  }
  const gone = new Set(goal.amendments.filter((a) => ['moved', 'waived'].includes(a.change)).map((a) => a.n));
  for (const criterion of goal.criteria) {
    if (!gone.has(criterion.n) && !tickets.some((ticket) => ticket.criteria.includes(criterion.n))) errors.push(`criterion ${criterion.n} has no ticket`);
  }

  // every ticket a ticket waits for, direct or not; a ticket found on its own path is a cycle
  const before = new Map();
  let cycle = null;
  const walk = (ticket, trail) => {
    if (before.has(ticket.n)) return before.get(ticket.n);
    if (trail.includes(ticket.n)) {
      cycle ??= [...trail.slice(trail.indexOf(ticket.n)), ticket.n];
      return new Set();
    }
    const all = new Set();
    for (const blocker of ticket.blockedBy.filter((n) => byNumber.has(n) && n !== ticket.n)) {
      all.add(blocker);
      for (const n of walk(byNumber.get(blocker), [...trail, ticket.n])) all.add(n);
    }
    if (!cycle) before.set(ticket.n, all);
    return all;
  };
  for (const ticket of tickets) walk(ticket, []);
  if (cycle) errors.push(`the tickets form a cycle: ${cycle.map(pad).join(' -> ')}`);

  // two tickets with no order between them may run at the same time: they must not write the same place
  if (!cycle) {
    for (const a of tickets) {
      for (const b of tickets) {
        if (a.n >= b.n || a.done || b.done || !a.touches || !b.touches || before.get(a.n).has(b.n) || before.get(b.n).has(a.n)) continue;
        const shared = a.touches.find((one) => b.touches.some((other) => samePlace(one, other)));
        if (shared) errors.push(`tickets ${pad(a.n)} and ${pad(b.n)} both touch ${shared} and neither waits for the other: add the edge`);
      }
    }
  }

  // the wave of a ticket is the longest chain of tickets it waits for
  const wave = (ticket) => (cycle ? 1 : 1 + Math.max(0, ...ticket.blockedBy.filter((n) => byNumber.has(n)).map((n) => wave(byNumber.get(n)))));
  for (const ticket of tickets) ticket.wave = wave(ticket);
  // The frontier is what the Engineer's checkpoint closed, never what the builder said: a `built` ticket waits for
  // its checkpoint, and an `open` one holds the tickets after it until the Engineer writes why they can start.
  const frontier = cycle ? [] : tickets.filter((ticket) => ticket.state === 'ready' && ticket.blockedBy.every((n) => byNumber.get(n)?.done));
  const built = tickets.filter((ticket) => ticket.state === 'built');
  const held = tickets
    .filter((ticket) => ticket.state === 'open' && !ticket.carried)
    .map((ticket) => ({ n: ticket.n, holds: tickets.filter((other) => other.state === 'ready' && other.blockedBy.includes(ticket.n)).map((other) => other.n) }));
  const trust = tickets.filter((ticket) => !ticket.done && ticket.trust);
  // A reproval counts the same at a ticket's checkpoint and in a final round: twice is the second reproval of step 9
  // (the next fix closes the class), three times raises the next fix to fable.
  const reproved = goal.criteria
    .map((criterion) => {
      const checkpoints = tickets.filter((ticket) => ticket.reproved.includes(criterion.n)).map((ticket) => ticket.n);
      const rounds = [...new Set(goal.evidence.filter((row) => row.n === criterion.n && /^(not met|weak proof)/.test(row.verdict)).map((row) => row.round.match(/^\d+/)?.[0] ?? row.round))];
      return { n: criterion.n, checkpoints, rounds, total: checkpoints.length + rounds.length };
    })
    .filter((one) => one.total > 0);
  // Two tickets of the frontier have no order between them, and the check above proved they write no folder in
  // common: they may be built at the same time, each in its own checkout. A ticket that does not say what it touches
  // proved nothing, so it is built alone.
  const together = frontier.filter((ticket) => ticket.touches && ticket.touches.length > 0);
  const parallel = errors.length === 0 && together.length > 1 ? together : [];

  if (flags['--prove'] !== undefined) {
    const ticket = byNumber.get(Number(flags['--prove']));
    if (!ticket) fail(`.scratch/${slug}/issues has no ticket ${flags['--prove']}`);
    if (ticket.proof.length === 0) {
      console.log(`goal graph: ticket ${pad(ticket.n)} has no "Proof" with a run: command (planned before the graph): nothing to run`);
      return 0;
    }
    let failed = 0;
    for (const line of ticket.proof) {
      console.log(`\n=== ticket ${pad(ticket.n)}\n$ ${line}`);
      const status = spawnSync(line, { cwd: root, shell: true, stdio: 'inherit', env: { ...process.env, TZ: 'UTC' } }).status ?? 1;
      console.log(`  ${status === 0 ? 'exit 0' : `EXIT ${status}`}  ticket ${pad(ticket.n)}  ${line}`);
      if (status !== 0) failed++;
    }
    return failed === 0 ? 0 : 1;
  }

  if (flags['--json']) {
    const out = {
      slug,
      tickets,
      frontier: frontier.map((ticket) => ticket.n),
      parallel: parallel.map((ticket) => ticket.n),
      built: built.map((ticket) => ticket.n),
      held,
      trust: trust.map((ticket) => ticket.n),
      reproved,
      errors,
      notes,
    };
    console.log(JSON.stringify(out, null, 2));
    return errors.length === 0 ? 0 : 1;
  }
  const waves = Math.max(0, ...tickets.map((ticket) => ticket.wave));
  const width = Math.max(0, ...Array.from({ length: waves }, (_, i) => tickets.filter((ticket) => ticket.wave === i + 1).length));
  const closed = tickets.filter((ticket) => ticket.done).length;
  console.log(`goal graph: .scratch/${slug}/issues  (${tickets.length} tickets, ${closed} closed, ${waves} waves, ${width} wide)`);
  for (const ticket of tickets.slice().sort((a, b) => a.wave - b.wave || a.n - b.n)) {
    const after = ticket.blockedBy.length > 0 ? `  after ${ticket.blockedBy.map(pad).join(', ')}` : '';
    const state = ticket.carried ? 'open, carried' : ticket.state;
    console.log(`  wave ${ticket.wave}  ${pad(ticket.n)} ${state}  ${ticket.name}  (criteria ${ticket.criteria.join(', ') || '-'})${after}`);
  }
  for (const error of errors) console.log(`      error: ${error}`);
  for (const note of notes) console.log(`      note:  ${note}`);
  if (errors.length === 0) {
    if (frontier.length > 0) console.log(`  frontier: ${frontier.map((ticket) => pad(ticket.n)).join(', ')}`);
    else if (closed === tickets.length) console.log('  frontier: none, every ticket is closed');
    else console.log('  frontier: none, every ticket left waits for a checkpoint or for a held ticket');
  }
  if (parallel.length > 0) console.log(`  parallel: ${parallel.map((ticket) => pad(ticket.n)).join(' + ')}  (no order between them, no folder in common: each in its own checkout)`);
  for (const ticket of built) console.log(`  built:    ${pad(ticket.n)}  (its checkpoint is not written yet: the tickets after it wait)`);
  for (const one of held) console.log(`  held:     ${pad(one.n)}  open at its checkpoint with no "Carried:" line${one.holds.length > 0 ? `; it holds ${one.holds.map(pad).join(', ')}` : ''}`);
  if (trust.length > 0) console.log(`  trust:    ${trust.map((ticket) => pad(ticket.n)).join(', ')}  (their checkpoint has the security-engineer too)`);
  for (const one of reproved) {
    const where = [one.checkpoints.length > 0 ? `checkpoint ${one.checkpoints.map(pad).join(', ')}` : null, one.rounds.length > 0 ? `round ${one.rounds.join(', ')}` : null].filter(Boolean).join('; ');
    const next = one.total >= 3 ? ': the next fix and its verification run on fable' : one.total === 2 ? ': the next fix closes the class (Class: and Closed by:)' : '';
    console.log(`  reproved: criterion ${one.n}, ${one.total === 1 ? 'once' : one.total === 2 ? 'twice' : `${one.total} times`} (${where})${next}`);
  }
  return errors.length === 0 ? 0 : 1;
}

if (command === 'graph') process.exit(graph());
else if (command === 'check') process.exit(check());
else if (command === 'prove') process.exit(prove());
else if (command === 'size') process.exit(size());
else if (command === 'stats') process.exit(stats());
else if (command === 'spent') process.exit(spent());
else if (command === 'map') process.exit(map());
else usage();
