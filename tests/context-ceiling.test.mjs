// The context ceiling (1.3.0, the Founder's request of 2026-11-27): no subagent works past CONTEXT_CEILING tokens
// of context in one mission. The Engineer estimates each ticket against it before dispatching it and splits only
// what the estimate puts past it; the panel hands a mission off at the ceiling itself; `goal spent --write` records
// every mission's largest context in the goal's contract. The number is written in one file.
//   node --test tests/context-ceiling.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { tmpDir } from './tmp.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = path.join(plugin, 'skills', 'monolith', 'config-project', 'assets', 'scripts');
const goal = path.join(scripts, 'goal.mjs');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
const { CONTEXT_CEILING, HANDOFF_ROOM, CLOSE_ROOM } = await import(new URL(`file:///${path.join(scripts, 'context-ceiling.mjs').replace(/\\/g, '/')}`).href);

test('the ceiling is written in one place, and everything else reads it from there', () => {
  assert.equal(CONTEXT_CEILING, 400_000);
  assert.ok(HANDOFF_ROOM > CLOSE_ROOM && CLOSE_ROOM > 0);
  // no other file of the squad writes the number: the panel and the script import it, the prose names the file
  const files = (dir) =>
    fs.readdirSync(path.join(plugin, dir), { withFileTypes: true }).flatMap((one) => (one.isDirectory() ? files(path.join(dir, one.name)) : [path.join(dir, one.name)]));
  const squad = ['agents', 'commands', 'hooks', 'skills', 'docs'].flatMap(files).filter((rel) => /\.(md|mjs|cjs|ts|tsx|json)$/.test(rel));
  // (goal spent reads the first 400 000 bytes of a transcript to find its title: a size of its own, not the ceiling)
  const isCeiling = (line) => /\b400[_ ,.]?000\b|\b400k\b|\b400 thousand\b/i.test(line) && !/Buffer\.alloc\(400_000\)/.test(line);
  const written = squad.filter((rel) => read(rel).split('\n').some(isCeiling)).map((rel) => rel.replace(/\\/g, '/'));
  assert.deepEqual(written, ['skills/monolith/config-project/assets/scripts/context-ceiling.mjs']);
  assert.match(read('hooks/engineer-desk/ceiling.ts'), /from '\.\.\/\.\.\/skills\/monolith\/config-project\/assets\/scripts\/context-ceiling\.mjs'/);
  assert.match(read('skills/monolith/config-project/assets/scripts/goal.mjs'), /from '\.\/context-ceiling\.mjs'/);
  // tooling-sync copies every .mjs of the assets into a project's scripts/, so goal.mjs finds it beside itself there
  assert.match(read('skills/monolith/config-project/scripts/tooling-sync.mjs'), /\/\\\.\(mjs\|d\\\.mts\)\$\//);
  // and the bootstrap, which copies by name, writes it beside goal.mjs in a new project
  assert.match(read('skills/monolith/config-project/scripts/project-init.mjs'), /for \(const name of \['context-ceiling\.mjs', 'context-ceiling\.d\.mts'\]\)/);
});

const contract = (extra = '') => `# Goal: things

Status: approved by founder on 2026-11-27

Landed: PR #9, 120 product lines, CI 9 min

## Objective

Things.

## Success criteria

| # | Criterion | Proof |
|---|---|---|
| 1 | a thing is created | run: \`node -e "process.exit(0)"\` |
| 2 | things are listed | run: \`node -e "process.exit(0)"\` |
| 3 | a thing is archived | run: \`node -e "process.exit(0)"\` |

## Limits

None.

## Budget

Verification rounds: 3

## Evidence

| # | Round | Verdict | Run |
|---|---|---|---|
${extra}`;

const ticket = ({ criteria, blockedBy = 'None (can start immediately)', touches, words = 0 }) =>
  [
    '# ticket',
    `**What to build:** it.${' and more'.repeat(Math.ceil(words / 2))}`,
    `**Criteria:** ${criteria}`,
    `**Blocked by:** ${blockedBy}`,
    `**Touches:** ${touches}`,
    '**Proof:** run: `node -e "process.exit(0)"`',
    '**Status:** ready',
  ].join('\n\n');

function project(tickets, contractText = contract()) {
  const dir = tmpDir('spectree-ceiling-');
  fs.mkdirSync(path.join(dir, 'docs', 'goals'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.scratch', 'things', 'issues'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'goals', 'things.md'), contractText);
  for (const [name, fields] of Object.entries(tickets)) fs.writeFileSync(path.join(dir, '.scratch', 'things', 'issues', `${name}.md`), ticket(fields));
  return dir;
}
const run = (dir, ...args) => {
  const res = spawnSync(process.execPath, [goal, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: res.status, out: res.stdout + res.stderr };
};

test('each ticket is estimated before it is dispatched, and only one estimated past the ceiling is split', () => {
  const dir = project({
    '01-create': { criteria: '1', touches: '`modules/things`', words: 600 },
    '02-list': { criteria: '2', blockedBy: '01', touches: '`apps/frontend/list`', words: 1500 },
    '03-archive': { criteria: '3', blockedBy: '01', touches: '`apps/frontend/archive`', words: 2600 },
  });
  const res = run(dir, 'graph', 'things', '--plan');
  assert.equal(res.code, 1, res.out);
  // the pilot's line (42k + 168 a word) until ten of this project's tickets are measured
  assert.match(res.out, /01 ready {2}create {2}\(criteria 1\) {2}~14\dk$/m);
  assert.match(res.out, /02 ready {2}list {2}\(criteria 2\) {2}after 01 {2}~29\dk$/m);
  assert.match(res.out, /error: ticket 03 is estimated at 4\d\dk of context \(26\d\d words\), over the 400k ceiling: split it by seam/);
  assert.doesNotMatch(res.out, /error: ticket 0[12]/);
  assert.match(res.out, /the pilot project's line until ten of this project's tickets are measured \(42k \+ 168 per word/);
  // the same refusal holds when the Engineer reads the graph to dispatch: a ticket past the ceiling never starts
  assert.equal(run(dir, 'graph', 'things').code, 1);
  assert.match(run(dir, 'graph', 'things').out, /error: ticket 03 is estimated/);
});

test('a criterion cut in two whose halves fit one context together is named at the plan', () => {
  const dir = project({
    '01-create': { criteria: '1', touches: '`modules/things`', words: 500 },
    '02-create-screen': { criteria: '1', blockedBy: '01', touches: '`apps/frontend/create`', words: 500 },
    '03-list': { criteria: '2', blockedBy: '01', touches: '`apps/frontend/list`', words: 500 },
    '04-archive': { criteria: '3', blockedBy: '03', touches: '`apps/frontend/archive`', words: 500 },
  });
  const res = run(dir, 'graph', 'things', '--plan');
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /note: {2}tickets 01 and 02 cut criterion 1 in two and together are estimated at 2\d\dk, under the 400k ceiling: one ticket fits/);
  // two tickets of different criteria are not one
  assert.doesNotMatch(res.out, /tickets 03 and 04/);
});

test('the estimate is refitted on the project\'s own measured tickets once there are ten', () => {
  const rows = Array.from({ length: 10 }, (_, i) => `| Ticket ${String(i + 1).padStart(2, '0')} | ${(i + 1) * 100} words | - | ${100 + (i + 1) * 10}k | 1 |`);
  const history = `${contract()}\n## Spent by mission\n\n| Ticket | Words as planned | Estimate | Context | Missions |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;
  const dir = project({ '01-create': { criteria: '1, 2, 3', touches: '`modules/things`', words: 2000 } });
  fs.writeFileSync(path.join(dir, 'docs', 'goals', 'earlier.md'), history.replace('# Goal: things', '# Goal: earlier'));
  const res = run(dir, 'graph', 'things', '--plan');
  assert.equal(res.code, 0, res.out);
  // 100k + 100 a word, from the ten rows
  assert.match(res.out, /fitted on this project's 10 measured tickets \(100k \+ 100 per word/);
  assert.match(res.out, /01 ready {2}create {2}\(criteria 1, 2, 3\) {2}~30\dk$/m);
});

// A transcript row of one model request, as Claude Code writes it.
const turn = (id, at, context, out = 1_000) =>
  JSON.stringify({ type: 'assistant', timestamp: at, uuid: id, message: { id, role: 'assistant', content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 1_000, cache_creation_input_tokens: 4_000, cache_read_input_tokens: context - 5_000, output_tokens: out } } });

function transcripts(dir, agents) {
  const base = path.join(dir, 'transcripts', 'project');
  fs.mkdirSync(path.join(base, 's1', 'subagents'), { recursive: true });
  fs.writeFileSync(path.join(base, 's1.jsonl'), [JSON.stringify({ type: 'user', timestamp: '2026-11-27T10:00:00Z', message: { role: 'user', content: '/engineer item things' } }), turn('m1', '2026-11-27T10:00:05Z', 30_000)].join('\n'));
  agents.forEach(({ type, description, contexts }, i) => {
    const rows = contexts.map((context, j) => turn(`a${i}-${j}`, `2026-11-27T1${i}:0${j}:00Z`, context));
    fs.writeFileSync(path.join(base, 's1', 'subagents', `agent-a${i}.jsonl`), rows.join('\n'));
    fs.writeFileSync(path.join(base, 's1', 'subagents', `agent-a${i}.meta.json`), JSON.stringify({ agentType: type, description }));
  });
  return path.join(dir, 'transcripts');
}

test('every mission\'s largest context is recorded in the contract and reported against the ceiling', () => {
  const dir = project({ '01-create': { criteria: '1, 2, 3', touches: '`modules/things`', words: 700 } });
  const at = transcripts(dir, [
    { type: 'spectree-engineer:full-stack-developer', description: 'Build ticket 01 things', contexts: [29_000, 180_000, 241_000, 150_000] },
    { type: 'spectree-engineer:full-stack-developer', description: 'Continue ticket 01 things (handoff)', contexts: [30_000, 90_000] },
    { type: 'spectree-engineer:quality-engineer', description: 'Final QE verification things', contexts: [24_000, 412_000] },
  ]);
  const res = run(dir, 'spent', 'things', '--session', 's1', '--transcripts', at, '--write');
  assert.equal(res.code, 0, res.out);
  // the largest context of a mission is its largest request (input and the output it answered), not its last one
  assert.match(res.out, /context ceiling 400k: 3 missions, the largest 413k \(quality-engineer, Final QE verification things\), 1 over the ceiling, 1 handed off/);
  assert.match(res.out, /over the ceiling: 413k {2}quality-engineer {2}Final QE verification things/);
  const written = fs.readFileSync(path.join(dir, 'docs', 'goals', 'things.md'), 'utf8');
  assert.match(written, /^Spent: .*, 413k largest context of 400k, 1 over$/m);
  assert.match(written, /^## Spent by mission$/m);
  assert.match(written, /^\| 2026-11-27 10:00 \| full-stack-developer \| Build ticket 01 things \| 4 \| 242k \| 0\.6M \|$/m);
  assert.match(written, /^\| 2026-11-27 12:00 \| quality-engineer \| Final QE verification things \| 2 \| 413k \*\*over\*\* \| 0\.4M \|$/m);
  // the ticket as one context: the first mission's largest plus the growth of the one that continued it
  assert.match(written, /^\| Ticket 01 \| \d+ words \| \d+k \| 303k \| 2 \|$/m);
  // the contract still reads as a contract, and a second run writes the section again instead of a second one
  assert.equal(run(dir, 'check', 'things').code, 0, run(dir, 'check', 'things').out);
  run(dir, 'spent', 'things', '--session', 's1', '--transcripts', at, '--write');
  assert.equal(fs.readFileSync(path.join(dir, 'docs', 'goals', 'things.md'), 'utf8').match(/^## Spent by mission$/gm).length, 1);
});
