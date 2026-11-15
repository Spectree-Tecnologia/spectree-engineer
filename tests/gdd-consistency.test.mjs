// 0.35.0: three places where what Goal Driven Development declared and what the squad practised disagreed, found by
// reading the whole repository on 2026-11-15 (the Founder's "Sim, corrija 1 a 3").
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
  assert.ok(command.includes(`sem \`.scratch/\` (\`${EXCLUDE}\`)`));
  // at a checkpoint the criteria come from the graph, by number, and the ticket stays with whoever built it
  assert.match(command, /com os números dos critérios que o ticket avança \(`npm run goal -- graph <slug> --json`\), nunca o ticket/);
  const card = read('agents/quality-engineer.md');
  assert.match(card, /Dê o veredito dos critérios que a missão numera/);
  assert.doesNotMatch(card, /critérios que o ticket diz avançar/);
  assert.match(card, /É a única missão em que você lê tickets/);
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
  const list = reading.slice(reading.indexOf('Mais o que só a leitura pega'), reading.indexOf('\n## Lean'));
  const items = list.split('\n').filter((line) => line.startsWith('- ') && !/assert enfraquecido/.test(line));
  assert.ok(items.length >= 5);
  for (const item of items) assert.match(item, /\(regra \d+\)/, `no rule number: ${item.slice(0, 60)}`);
  assert.match(reading, /O como só é achado contra regra numerada, GLOSSARY ou ADR/);
  assert.doesNotMatch(reading, /ou desta lista\)/);
  const builder = read('agents/full-stack-developer.md');
  const rules = builder.slice(builder.indexOf('## As regras que a verificação vai cobrar'), builder.indexOf('## Os limites do contrato'));
  for (const n of [16, 17, 18, 19]) assert.match(rules, new RegExp(`regra ${n}\\b`), `the full-stack-developer's card does not cite rule ${n}`);
});

test('a bug has a contract, because the final verification reads one', () => {
  const command = read('commands/engineer.md');
  const bug = command.slice(command.indexOf('### Bug'), command.indexOf('### Auditoria'));
  assert.doesNotMatch(bug, /sem contrato em arquivo/);
  assert.match(bug, /`Type: fix`[^\n]*`Verification rounds: 2`[^\n]*`Status: approved by engineer on <data>`/);
  assert.match(bug, /segue os passos 8 a 11/);
  assert.match(bug, /o bug roda numa sessão de item/);
  assert.match(read('skills/engineering/to-goal/SKILL.md'), /A bug is the exception: its contract has `Type: fix` and one criterion/);
  // the check accepts it: one criterion is a warning, and the status is one the script knows
  const script = read('skills/monolith/config-project/assets/scripts/goal.mjs');
  assert.match(script, /goal\.criteria\.length < 3\) warnings\.push/);
  assert.match(script, /approved by \.\+ on/);
});
