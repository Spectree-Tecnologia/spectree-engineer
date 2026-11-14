// The tickets of a goal are a graph, read by a script (the Founder's "engenharia de grafo", approved on 2026-11-13).
// Measured on PILOT the same day: the squad ran almost serially (parallelism 1.14 to 1.33) and the Engineer chose the
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

// Found by the audit of 2026-11-13, after the graph was written: the cards say `Status: done` in plain text, an adopted
// item keeps its tickets from before Goal Driven in the same folder, a goal planned before the graph has no Proof, and
// a criterion moved to a continuation goal could not pass `check --ready`.
test('the graph reads what the squad really writes', () => {
  const plain = (text) => text.replace(/\*\*(Status|Blocked by|Criteria):\*\*/g, '$1:');
  const dir = project({ ...good, '01-create': { ...good['01-create'], status: 'done' } });
  const first = path.join(dir, '.scratch', 'things', 'issues', '01-create.md');
  fs.writeFileSync(first, plain(fs.readFileSync(first, 'utf8')));
  assert.match(run(dir).out, /frontier: 02, 03$/m, 'a plain `Status: done` closes the ticket');

  const mixed = run(project({ ...good, '02-list': { ...good['02-list'], criteria: '2 (e2e), 3 (unit): the list' }, '03-archive': { ...good['03-archive'], blockedBy: '01, 02' } }), '--json');
  assert.deepEqual(JSON.parse(mixed.out).tickets[1].criteria, [2, 3]);
});

test('a ticket from before Goal Driven stays in the folder and out of the graph', () => {
  const dir = project(good);
  fs.writeFileSync(path.join(dir, '.scratch', 'things', 'issues', '01-old-create.md'), '# 01: old\n\n**Blocked by:** None\n\n**Status:** ready-for-agent\n\n- [ ] an acceptance criterion\n');
  const res = run(dir, '--plan');
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /note: {2}\.scratch\/things\/issues\/01-old-create\.md has no "Criteria": a ticket from before Goal Driven, left out of the graph/);
  assert.match(res.out, /3 tickets, 0 done/);
});

test('a ticket planned before the graph has no proof to run, and that is not a failure', () => {
  const res = run(project({ ...good, '02-list': { criteria: '2', blockedBy: '01', proof: null } }), '--prove', '2');
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /ticket 02 has no "Proof" with a run: command \(planned before the graph\): nothing to run/);
});

test('a criterion moved to a continuation goal keeps its row and asks no verdict here', () => {
  const evidence = '| 1 | 1 | met | exit 0 |\n| 2 | 1 | met | exit 0 |\n';
  const check = (text) => {
    const dir = project({}, text);
    const res = spawnSync(process.execPath, [goal, 'check', '--ready', 'things'], { cwd: dir, encoding: 'utf8' });
    return { code: res.status, out: res.stdout + res.stderr };
  };
  const waiting = check(contract(evidence));
  assert.equal(waiting.code, 1);
  assert.match(waiting.out, /not ready: criterion 3 is not verified yet/);
  const moved = check(contract(`${evidence}\n## Amendments\n\n| Date | # | Change | By | Follows |\n|---|---|---|---|---|\n| 2026-11-13 | 3 | moved | Engineer | \`things-2\` |\n`));
  assert.equal(moved.code, 0, moved.out);
  assert.match(read('skills/engineering/to-goal/SKILL.md'), /`moved`[^\n]*the row stays in this contract's criteria table/);
});

test('the ticket fixtures of the evals are in the shape the gate reads', () => {
  const gate = (fixture, slug) => spawnSync(process.execPath, [goal, 'graph', slug, '--plan'], { cwd: path.join(plugin, 'evals', 'fixtures', fixture), encoding: 'utf8' });
  const proof = gate('proof-gate', 'ci-gate');
  assert.equal(proof.status, 0, proof.stdout + proof.stderr);
  // the plan-gate fixture is a wrong plan on purpose: the script names the same hole the solutions-architect must find
  const plan = gate('plan-gate', 'transactions');
  assert.equal(plan.status, 1);
  assert.deepEqual(plan.stdout.match(/error: .+/g), ['error: criterion 3 has no ticket']);
});

test('no skill sends an agent to a user it cannot reach, or to a command the flow forbids', () => {
  assert.match(read('skills/engineering/tdd/SKILL.md'), /In this squad nobody confirms them with the user/);
  assert.doesNotMatch(read('skills/engineering/tdd/SKILL.md'), /confirm them with the user\. No test/);
  for (const skill of ['diagnosing-bugs', 'code-review', 'retro', 'grilling']) assert.match(read(`skills/engineering/${skill}/SKILL.md`), /\*\*In this squad\*\*/, `${skill} does not say how the squad uses it`);
  assert.match(read('skills/engineering/code-review/SKILL.md'), /never open `\.scratch\/`/);
  assert.doesNotMatch(read('skills/monolith/module-aggregate/SKILL.md'), /Do not execute the skill without that answer/);
  assert.doesNotMatch(read('skills/monolith/config-prisma/SKILL.md'), /`npx prisma migrate reset/);
  // a read is a query, in query/, never a use case: the rule, the cards and the skills say the same folder
  assert.match(read('ARCHITECTURE.md'), /`modules\/<m>\/src\/<aggregate>\/query\/`/);
  assert.match(read('agents/full-stack-developer.md'), /`query\/` \(`\*\.query\.ts`\)/);
  assert.match(read('skills/monolith/module-query-cqrs/SKILL.md'), /src\/<feature>\/query\//);
  assert.doesNotMatch(read('skills/monolith/module-query-cqrs/SKILL.md'), /use case de leitura/);
  assert.doesNotMatch(read('skills/monolith/module-use-case/references/use-case-pattern.md'), /class \w+UseCase implements/);
  // check:pr needs the Evidence table filled: it runs before the pull request, not in the deterministic layer
  assert.doesNotMatch(read('commands/engineer.md'), /test:e2e`\); `npm run check:pr`/);
});

// Delivery 2 (0.30.0): a ticket closes whole before the next one starts. Measured on PILOT on 2026-11-13: tickets 02
// and 06 of ci-time took three verification rounds each, every re-verification hunted again and found new things,
// and the quality-engineer verified a checkout the next full-stack-developer was already changing.
test('a ticket closes whole: nobody writes while it is verified, the builder fixes, whoever found re-checks, once', () => {
  const command = read('commands/engineer.md');
  assert.match(command, /\*\*Checkpoint por ticket: o ticket fecha antes de o próximo começar\.\*\*/);
  assert.match(command, /Enquanto eles verificam, ninguém escreve no checkout: o que rodam é o commit do ticket/);
  assert.doesNotMatch(command, /sem esperar por eles/);
  assert.match(command, /quem achou reconfere, pela mesma conversa, com o diff da correção: cada achado `closed` ou `open`/);
  assert.match(command, /Não é caça nova: o objetivo inteiro é da verificação final/);
  assert.match(read('agents/quality-engineer.md'), /\*\*Reconferência\.\*\*[^\n]*`closed` ou `open`[^\n]*Não procure achado novo fora desse diff/);
  assert.match(read('agents/security-engineer.md'), /`closed` ou `open` por achado seu, sem caça nova/);
  assert.match(read('agents/full-stack-developer.md'), /Você pode ser chamado de volta uma vez, pela mesma conversa, com os achados do checkpoint do seu ticket/);
  // the handoff notice no longer assumes a ticket: a fix or a bug mission has none
  assert.match(read('hooks/engineer-desk/register.tsx'), /in your ticket, or in your report when the mission has no ticket/);
});

test('a proof written `in ci:` is run by the pull request\'s run, and by nothing before it', () => {
  const inCi = contract().replace('| 3 | a thing is archived | run: `node -e "process.exit(0)"` |', '| 3 | a thing is archived | in ci: run: `node -e "process.exit(7)"` |');
  const dir = project({}, inCi);
  const prove = (...args) => {
    const res = spawnSync(process.execPath, [goal, 'prove', ...args], { cwd: dir, encoding: 'utf8' });
    return { code: res.status, out: res.stdout + res.stderr };
  };
  const before = prove('things');
  assert.equal(before.code, 0, before.out);
  assert.match(before.out, /waits\s+criterion 3\s+\(in ci: not run now\)/);
  const run = prove('things', '--in-ci');
  assert.equal(run.code, 1, 'the proof is run, and its exit code decides');
  assert.match(run.out, /EXIT 7 {2}criterion 3/);
  assert.doesNotMatch(run.out, /criterion 1/, 'only the proofs written in ci run in that step');
  assert.equal(prove('things', '--in-ci', '--after-merge').code, 2);
  assert.equal(prove('--changed', 'HEAD').code, 2, '--changed is for the deferred proofs of a run');
  const ci = read('skills/monolith/config-project/assets/workflows/ci.yml');
  assert.match(ci, /- name: Goal proofs written in ci\r?\n\s+if: github\.event_name == 'pull_request' && steps\.scope\.outputs\.code == 'true'\r?\n\s+run: node scripts\/goal\.mjs prove --in-ci --changed "origin\/\$BASE_REF"/);
  assert.match(read('skills/engineering/to-goal/SKILL.md'), /An `in ci:` proof is run by the pull request's run \(the CI step `Goal proofs written in ci`/);
});

// 0.33.0, from PILOT's ci-time-20 (2026-11-14): the wording of a by-hand half of a proof held a second `run:`, and the
// pull request's own step would have run it. The quality-engineer found it; the author can see it when it writes.
test('goal check prints every command a contract will run, as the script reads the cell', () => {
  const two = contract().replace('| 3 | a thing is archived | run: `node -e "process.exit(0)"` |', '| 3 | a thing is archived | in ci: run: `node a.mjs` exits 0; by hand, on the runner, the step\'s run: `node b.mjs` shows it |');
  const dir = project({}, two);
  const res = spawnSync(process.execPath, [goal, 'check', 'things'], { cwd: dir, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /runs: {2}criterion 1 {2}node -e "process\.exit\(0\)"/);
  assert.match(res.stdout, /runs: {2}criterion 3 \(in ci\) {2}node a\.mjs/);
  assert.match(res.stdout, /runs: {2}criterion 3 \(in ci\) {2}node b\.mjs/, 'the command the author did not mean to run is on the list');
  assert.match(read('commands/engineer.md'), /as linhas `runs:` são o que cada critério roda/);
});

test('whoever plans does not build: the first ticket is a new full-stack-developer\'s', () => {
  assert.match(read('agents/full-stack-developer.md'), /Plano aprovado, a sua missão acabou\./);
  assert.match(read('agents/full-stack-developer.md'), /^description:[^\n]*O primeiro só planeja o objetivo/m);
  assert.match(read('skills/engineering/to-tickets/SKILL.md'), /never by the one that wrote the plan/);
  assert.doesNotMatch(read('README.md'), /quem planeja constrói o primeiro ticket/);
});

// Delivery 3 (0.34.0): two lanes. Measured on PILOT's ci-time-20 (2026-11-14): ticket 02 sat free for the 40 minutes of
// ticket 01 and ticket 03 for the 77 minutes of ticket 02, with the usage limit never reached in 3.8 hours.
test('the graph says which tickets of the frontier may be built at the same time', () => {
  const dir = project({ ...good, '01-create': { ...good['01-create'], status: 'done' } });
  const res = run(dir);
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /parallel: 02 \+ 03 {2}\(no order between them, no folder in common: each in its own checkout\)/);
  assert.deepEqual(JSON.parse(run(dir, '--json').out).parallel, [2, 3]);
  // one ticket free: nothing to run beside it
  assert.doesNotMatch(run(project(good)).out, /parallel:/);
  // a ticket that does not say what it touches proved nothing: it is built alone
  const silent = project({ ...good, '01-create': { ...good['01-create'], status: 'done' }, '03-archive': { criteria: '3', blockedBy: '01' } });
  assert.doesNotMatch(run(silent).out, /parallel:/);
  assert.deepEqual(JSON.parse(run(silent, '--json').out).parallel, []);
});

test('the Engineer runs two lanes, and a closed ticket is merged with the other lane stopped', () => {
  const command = read('commands/engineer.md');
  assert.match(command, /\*\*Duas pistas, quando o grafo deixa\.\*\*[^\n]*`parallel:`[^\n]*nunca com mais de dois/);
  assert.match(command, /`npm run worktree -- up <slug>-b --branch <tipo>\/<slug>-b`/);
  assert.match(command, /com a pista 1 parada: `git merge --no-ff --no-edit <sha fechado>` e a prova do afetado/);
  assert.match(command, /conflito é `git merge --abort` e missão do platform-engineer/);
  assert.match(command, /O grafo só vê `done` o ticket mergeado/);
  assert.match(command, /Sessão com `worktree` no prompt roda uma pista só/);
  // two verifiers at once never share a scratch database
  assert.match(command, /`npm run db:scratch -- <papel>-t<NN> -- <comando>`/);
  assert.match(read('skills/engineering/to-tickets/SKILL.md'), /also lists `package-lock\.json`/);
  assert.match(read('agents/full-stack-developer.md'), /^description:[^\n]*Um por checkout\./m);
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
