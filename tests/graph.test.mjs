// The tickets of a goal are a graph, read by a script (the Founder's "engenharia de grafo", approved on 2026-11-13).
// Measured on SYND the same day: the squad ran almost serially (parallelism 1.14 to 1.33) and the Engineer chose the
// next ticket by reading prose. `goal graph` says by exit code what the plan gate used to read by eye: no cycle, every
// criterion has a ticket, two tickets with no order between them never write the same place; and it names the
// frontier, the tickets free to start. Run, not read:
//   node --test tests/graph.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const goal = path.join(plugin, 'skills', 'monolith', 'config-project', 'assets', 'scripts', 'goal.mjs');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');

const contract = (extra = '') => `# Goal: things

Status: approved by founder on 2026-11-13

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

const ticket = ({ criteria, blockedBy = 'None (can start immediately)', touches, proof = 'run: `node -e "process.exit(0)"`', status = 'ready' }) =>
  [`# ticket`, `**What to build:** it.`, `**Criteria:** ${criteria}`, `**Blocked by:** ${blockedBy}`, touches === undefined ? null : `**Touches:** ${touches}`, proof === null ? null : `**Proof:** ${proof}`, `**Status:** ${status}`]
    .filter(Boolean)
    .join('\n\n');

function project(tickets, contractText = contract()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spectree-graph-'));
  fs.mkdirSync(path.join(dir, 'docs', 'goals'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.scratch', 'things', 'issues'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'goals', 'things.md'), contractText);
  for (const [name, fields] of Object.entries(tickets)) fs.writeFileSync(path.join(dir, '.scratch', 'things', 'issues', `${name}.md`), ticket(fields));
  return dir;
}
const run = (dir, ...args) => {
  const res = spawnSync(process.execPath, [goal, 'graph', 'things', ...args], { cwd: dir, encoding: 'utf8' });
  return { code: res.status, out: res.stdout + res.stderr };
};

const good = {
  '01-create': { criteria: '1, proved by an e2e test', touches: '`modules/things`, `apps/backend/src/modules/things`' },
  '02-list': { criteria: '2', blockedBy: '01.', touches: '`apps/frontend/src/modules/things/list`' },
  '03-archive': { criteria: '3, proved by 2 unit tests', blockedBy: '01', touches: '`apps/frontend/src/modules/things/archive`' },
};

test('a plan that is a graph passes, with its waves and its frontier', () => {
  const res = run(project(good), '--plan');
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /3 tickets, 0 done, 2 waves, 2 wide/);
  assert.match(res.out, /wave 2 {2}02 ready {2}list {2}\(criteria 2\) {2}after 01/);
  assert.match(res.out, /frontier: 01$/m);
});

test('the frontier is every ticket whose blockers are done', () => {
  const dir = project({ ...good, '01-create': { ...good['01-create'], status: 'done' } });
  const res = run(dir);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /frontier: 02, 03$/m);
  const json = JSON.parse(run(dir, '--json').out);
  assert.deepEqual(json.frontier, [2, 3]);
  assert.deepEqual(json.tickets[1].blockedBy, [1]);
  assert.deepEqual(json.tickets[0].touches, ['modules/things', 'apps/backend/src/modules/things']);

  const all = Object.fromEntries(Object.entries(good).map(([name, fields]) => [name, { ...fields, status: 'done' }]));
  assert.match(run(project(all)).out, /frontier: none, every ticket is done/);
});

test('a cycle, a missing blocker and a criterion with no ticket fail', () => {
  const cycle = run(project({ ...good, '01-create': { ...good['01-create'], blockedBy: '03' } }));
  assert.equal(cycle.code, 1, cycle.out);
  assert.match(cycle.out, /the tickets form a cycle: 01 -> 03 -> 01/);
  assert.doesNotMatch(cycle.out, /frontier/);

  const ghost = run(project({ ...good, '02-list': { ...good['02-list'], blockedBy: '07' } }));
  assert.equal(ghost.code, 1);
  assert.match(ghost.out, /ticket 02 is blocked by 07, which does not exist/);

  const { '03-archive': dropped, ...two } = good;
  const uncovered = run(project(two));
  assert.equal(uncovered.code, 1);
  assert.match(uncovered.out, /criterion 3 has no ticket/);
  // a criterion an amendment moved to another goal needs no ticket here
  const moved = contract('\n## Amendments\n\n| Date | # | Change | By | Follows |\n|---|---|---|---|---|\n| 2026-11-13 | 3 | moved | Engineer | `things-2` |\n');
  assert.equal(run(project(two, moved)).code, 0);

  const stranger = run(project({ ...good, '02-list': { ...good['02-list'], criteria: '2 and 9' } }));
  assert.equal(stranger.code, 1);
  assert.match(stranger.out, /ticket 02 names criterion 9, which the contract does not have/);
});

test('two tickets that may run at the same time never write the same place', () => {
  const clash = { ...good, '03-archive': { ...good['03-archive'], touches: 'apps/frontend/src/modules/things/' } };
  const res = run(project(clash));
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /tickets 02 and 03 both touch apps\/frontend\/src\/modules\/things\/list and neither waits for the other: add the edge/);
  // the edge is the fix: with an order between them they never run together
  assert.equal(run(project({ ...clash, '03-archive': { ...clash['03-archive'], blockedBy: '01, 02' } })).code, 0);
  // a path is a path, not a prefix of a name
  assert.equal(run(project({ ...good, '03-archive': { ...good['03-archive'], touches: 'apps/frontend/src/modules/things/list-item' } })).code, 0);
});

test('the plan gate asks every ticket what it touches and what proves it; an older goal only gets a note', () => {
  const old = { ...good, '02-list': { criteria: '2', blockedBy: '01', proof: null } };
  const lenient = run(project(old));
  assert.equal(lenient.code, 0, lenient.out);
  assert.match(lenient.out, /note: {2}ticket 02 has no "Touches" and no "Proof" with a run: command/);
  const gate = run(project(old), '--plan');
  assert.equal(gate.code, 1);
  assert.match(gate.out, /error: ticket 02 has no "Touches"/);
});

test('a ticket closes on its own proof, by exit code', () => {
  const dir = project({ ...good, '02-list': { ...good['02-list'], proof: 'run: `node -e "process.exit(process.env.TZ === \'UTC\' ? 0 : 5)"`' }, '03-archive': { ...good['03-archive'], proof: 'run: `node -e "process.exit(4)"`' } });
  const passed = run(dir, '--prove', '2');
  assert.equal(passed.code, 0, passed.out);
  assert.match(passed.out, /exit 0 {2}ticket 02/);
  const failed = run(dir, '--prove', '03');
  assert.equal(failed.code, 1);
  assert.match(failed.out, /EXIT 4 {2}ticket 03/);
  assert.equal(run(dir, '--prove', '9').code, 1);
});

test('the squad plans, gates and walks by the graph', () => {
  const skill = read('skills/engineering/to-tickets/SKILL.md');
  assert.match(skill, /^\*\*Touches:\*\*/m);
  assert.match(skill, /^\*\*Proof:\*\* run: `<command>`/m);
  assert.match(skill, /npm run goal -- graph <slug> --plan/);
  const command = read('commands/engineer.md');
  assert.match(command, /`npm run goal -- graph <slug> --plan`/);
  assert.match(command, /o primeiro da frontier que `npm run goal -- graph <slug>` imprime/);
  assert.match(command, /`npm run goal -- graph <slug> --prove <NN>`/);
  assert.match(read('agents/full-stack-developer.md'), /npm run goal -- graph <slug> --plan/);
});
