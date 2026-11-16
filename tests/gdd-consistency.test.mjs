// 0.35.0: three places where what Goal-Driven Development declared and what the squad practised disagreed, found by
// reading the whole repository on 2026-11-15 (the Founder's "Yes, fix 1 to 3").
//   node --test tests/gdd-consistency.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
const EXCLUDE = "-- . ':(exclude).scratch'";

test('whoever verifies never reads the plan, and the plan is committed: the diff leaves .scratch/ out', () => {
  // .scratch/ is tracked in a generated project (goal.mjs counts it as documents of the diff), so a plain three-dot
  // diff carried plan.md, the tickets and decisions.md to the verifiers that must not see them
  assert.ok(read('agents/quality-engineer.md').includes(`git diff <baseline>...HEAD ${EXCLUDE}`));
  assert.ok(read('agents/security-engineer.md').includes(EXCLUDE));
  assert.ok(read('skills/engineering/code-review/SKILL.md').includes(`git diff <fixed-point>...HEAD ${EXCLUDE}`));
  const command = read('commands/engineer.md');
  assert.ok(command.includes(`without \`.scratch/\` (\`${EXCLUDE}\`)`));
  // at a checkpoint the criteria come from the graph, by number, and the ticket stays with whoever built it
  assert.match(command, /with the numbers of the criteria the ticket advances \(`npm run goal -- graph <slug> --json`\), never the ticket/);
  const card = read('agents/quality-engineer.md');
  assert.match(card, /Give the verdict on the criteria the mission numbers/);
  assert.doesNotMatch(card, /criteria the ticket says it advances/);
  assert.match(card, /It is the only mission in which you read tickets/);
});

test('the modular monolith has one book of rules: what the cards charge has a number in ARCHITECTURE.md', () => {
  const architecture = read('ARCHITECTURE.md');
  const rule = (n) => architecture.match(new RegExp(`^\\|\\s*${n}\\s*\\|.*$`, 'm'))?.[0] ?? '';
  assert.match(rule(16), /`modules\/<m>\/src\/app\/`[^\n]*kebab-case[^\n]*never `UserEntity`/);
  assert.match(rule(17), /`tryCreate`[^\n]*`cloneWith`/);
  assert.match(rule(18), /at most 50 rows/);
  assert.match(rule(19), /\*\*A controller is thin\.\*\*/);
  // the plan gate fails a plan on a numbered rule only, so a rule the verification blocks on must have a number
  const reading = read('agents/quality-engineer.md');
  const list = reading.slice(reading.indexOf('Plus what only reading catches'), reading.indexOf('\n## Lean'));
  const items = list.split('\n').filter((line) => line.startsWith('- ') && !/a weakened assert/.test(line));
  assert.ok(items.length >= 5);
  for (const item of items) assert.match(item, /\(rule \d+\)/, `no rule number: ${item.slice(0, 60)}`);
  assert.match(reading, /The how is only a finding against a numbered rule, the GLOSSARY or an ADR/);
  assert.doesNotMatch(reading, /or (from )?this list\)/);
  const builder = read('agents/full-stack-developer.md');
  const rules = builder.slice(builder.indexOf('## The rules the verification will enforce'), builder.indexOf("## The contract's limits"));
  for (const n of [16, 17, 18, 19]) assert.match(rules, new RegExp(`rule ${n}\\b`), `the full-stack-developer's card does not cite rule ${n}`);
});

test('a bug has a contract, because the final verification reads one', () => {
  const command = read('commands/engineer.md');
  const bug = command.slice(command.indexOf('### Bug'), command.indexOf('### Audit ('));
  assert.doesNotMatch(bug, /without a contract (in|on) (a )?file/);
  assert.match(bug, /`Type: fix`[^\n]*`Verification rounds: 2`[^\n]*`Status: approved by engineer on <date>`/);
  assert.match(bug, /follows steps 8 to 11/);
  assert.match(bug, /the bug runs in an item session/);
  assert.match(read('skills/engineering/to-goal/SKILL.md'), /A bug is the exception: its contract has `Type: fix` and one criterion/);
  // the check accepts it: one criterion is a warning, and the status is one the script knows
  const script = read('skills/monolith/config-project/assets/scripts/goal.mjs');
  assert.match(script, /goal\.criteria\.length < 3\) warnings\.push/);
  assert.match(script, /approved by \.\+ on/);
});

// 0.36.0: the rest of the same reading (the Founder's "Run the round: findings 4 to 8 and the three dualities").
const command = read('commands/engineer.md');
const STATUS = /^(proposed|approved by .+ on \d{4}-\d{2}-\d{2})$/;

test('a deterministic git command is the Engineer\'s and is logged; judgement is the platform-engineer\'s', () => {
  assert.match(command, /\*\*A deterministic git command is yours; what calls for reading and judgement is the platform-engineer's\*\*/);
  assert.match(command, /`\[CMD\] <command> → exit <n>` in `decisions\.md`/);
  // a session opened with `worktree` no longer sends the platform-engineer to run the script the Engineer runs
  assert.doesNotMatch(command, /the platform-engineer's mission is `npm run worktree/);
  const card = read('agents/platform-engineer.md');
  assert.doesNotMatch(card, /Everything that changes the repository outside a goal's code goes through you/);
  assert.doesNotMatch(card, /on the main checkout: no worktree/);
  assert.match(card, /The Engineer creates and removes the worktree, by script/);
  assert.doesNotMatch(read('agents/full-stack-developer.md'), /remove (a |the )?worktree: (it is|that is) the platform-engineer's/);
});

test('the design stage records every approval and has a way back', () => {
  assert.match(command, /you write `Approved by founder on <date>` in `docs\/design\/design-system\.md`/);
  assert.match(command, /`design-system\.md` without that line, in a project with no contract at all, is the design system waiting for the founder/);
  assert.match(command, /screen state missing from the approved prototype is a ui-ux-designer round for that artboard only, with a new founder approval/);
  const card = read('agents/ui-ux-designer.md');
  assert.match(card, /The exception is the round the Engineer opens for a screen state that was missing/);
  assert.match(card, /in a module that does not exist yet, from `decisions\.md` and `GLOSSARY\.md`/);
  assert.doesNotMatch(card, /that asks the solutions-architect/);
});

test('the audit every five items has a count and a line that resets it', () => {
  const audit = command.slice(command.indexOf('### Audit ('), command.indexOf('### Question about an external API'));
  assert.match(audit, /`Audited on <date>, through <slug>`/);
  assert.match(audit, /Five or more: the `quick` audit runs before the item/);
  assert.match(command, /the Audit count, and open the next item/);
  assert.match(command, /do the Audit count and start the next roadmap item/);
});

test('one order of construction: support modules first, the tracer bullet before breadth', () => {
  assert.doesNotMatch(read('ARCHITECTURE.md'), /breadth before depth/);
  assert.match(read('ARCHITECTURE.md'), /inside a goal, the tracer bullet comes before breadth/);
  assert.doesNotMatch(read('agents/solutions-architect.md'), /breadth before depth/);
  assert.match(command, /tracer bullet before breadth/);
});

test('the plan is committed before the first ticket, because lane 2 is born from HEAD', () => {
  assert.match(command, /you commit `docs\/goals\/<slug>\.md` and `\.scratch\/<slug>\/` \(`docs\(<slug>\): plan`/);
});

test('scope: the criteria are the Engineer\'s, and the test of a new business rule is written once', () => {
  assert.match(command, /`Status: approved by engineer under the roadmap approved on <date of the roadmap approval>`/);
  assert.match('approved by engineer under the roadmap approved on 2026-11-15', STATUS);
  const gates = command.slice(command.indexOf('## 6. The four gates'), command.indexOf('## 7.'));
  assert.match(gates, /changes what the end user can do, pay or see and is not in the roadmap, in `GLOSSARY\.md`, in an ADR or in the approved prototype/);
});

test('a should pays for one round, and only a real failure climbs to fable', () => {
  assert.match(command, /\*\*`should` pays one round, not two\.\*\*/);
  assert.match(command, /Failed in the second with a criterion `not met` or `weak proof`, a `blocking`, or a `confirmed` of `medium` and up/);
  assert.match(command, /or from the second final round on/);
  assert.doesNotMatch(read('README.md'), /`should` waits for the final verification/);
});

test('two full-stack-developers per machine, whichever way they are opened', () => {
  assert.match(command, /only if `git worktree list` shows only this checkout \(the ceiling is two full-stack-developers per machine/);
  assert.match(command, /the `Spent:` line of the last closed goal has no hours at the usage limit/);
  assert.match(command, /`git worktree list` shows only the main checkout \(the first is not in two lanes/);
});

// 0.40.0: on the pilot project on 2026-11-15 the Engineer wrote a 306-line proof script itself, ran it red at the
// baseline and tried it on an implementation of its own; it took 64% of the goal's first hour of tokens.
test('the Engineer writes the contract, not its proof: a proof that does not exist yet is a ticket', () => {
  assert.match(command, /\*\*You write the contract, not its proof:\*\* a test, a new script or checker that does not exist yet is a ticket of the plan, never yours to write, run at the baseline or try out, and the panel refuses you a code file\./);
  assert.match(command, /you apply at once when it fits in one line and is not code/);
  assert.match(read('skills/engineering/to-goal/SKILL.md'), /built by the full-stack-developer, as a ticket of the plan, never by the orchestrator/);
  assert.match(read('skills/engineering/to-tickets/SKILL.md'), /gets it in a ticket of its own, before the tickets it decides: nobody else writes it/);
  assert.match(read('hooks/engineer-desk/register.tsx'), /if \(isProject\) return \{ deny: ENGINEER_CODE_DENY \}/);
});
