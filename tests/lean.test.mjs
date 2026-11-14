// Lean code in a goal driven squad (0.22.0, the Founder's "Sim, construir" on 2026-11-11, after reading
// DietrichGebert/ponytail): the smallest complete change, where "nobody asked for it" is decided by the contract.
// The rule is written once, as rule 15 of the architecture, and each role has its part of it. The prompts pay for
// what they gain: a rule added to the command or to a card is paid with text that came out.
//   node --test tests/lean.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
const words = (rel) => read(rel).split(/\s+/).filter(Boolean).length;
const cards = fs.readdirSync(path.join(plugin, 'agents')).map((name) => `agents/${name}`);

test('the rule is written once, as rule 15 of the architecture', () => {
  const rule = read('ARCHITECTURE.md').split('\n').find((line) => line.startsWith('| 15 |'));
  assert.ok(rule, 'ARCHITECTURE.md has no rule 15');
  assert.match(rule, /Nothing exists that the goal does not need/);
  assert.match(rule, /this codebase, `@<ns>\/shared`, the platform and the standard library, an installed dependency/);
  assert.match(rule, /`shortcut: <the limit>, <when to upgrade>`/);
  // lazy about the solution, never about what protects the user
  assert.match(rule, /Never cut: validation at a trust boundary, error handling that prevents data loss, security, accessibility/);
});

test('the full-stack-developer plans what it reuses and reports what it did not check', () => {
  const card = read('agents/full-stack-developer.md');
  assert.match(card, /`Reuses:`[^\n]*`New:`[^\n]*regra 15/);
  assert.match(card, /nenhum critério exercita sai antes do commit do ticket/);
  assert.match(card, /Enxuto na solução, nunca na mudança/);
  assert.match(card, /`shortcut: <o limite>, <quando subir>`/);
  assert.match(card, /o que você \*\*não conferiu\*\*/);
});

test('the plan gate refuses what already exists', () => {
  assert.match(read('agents/solutions-architect.md'), /\*\*Reuse\*\*[^\n]*`violates rule 15`/);
});

test('the quality-engineer reads the callers the diff did not touch and reports what no criterion needs', () => {
  const card = read('agents/quality-engineer.md');
  assert.match(card, /\*\*Leia além do diff\.\*\*[^\n]*procure cada chamador no projeto inteiro/);
  assert.match(card, /^## Lean$/m);
  assert.match(card, /código que nenhum critério, limite ou regra exige/);
  // lean never costs a round: the risk policy sends a `should` to the hardening goal
  assert.match(card, /Um achado por item, `should`/);
  assert.match(card, /O que as regras 1 a 14 exigem nunca é achado/);
});

test('a shortcut never covers what the rule forbids cutting', () => {
  assert.match(read('agents/security-engineer.md'), /\*\*Atalho declarado\.\*\*[^\n]*a regra 15 proíbe esse corte, e ele é `confirmed`/);
});

test('a finding reaches the Founder numbered and in four parts', () => {
  const command = read('commands/engineer.md');
  assert.match(command, /\*\*o que é\*\*[^\n]*\*\*o problema\*\*[^\n]*\*\*a correção\*\*[^\n]*\*\*se pularmos\*\*/);
  assert.match(command, /Todo relato fecha com o que não foi conferido/);
  assert.match(command, /shortcut:/);
});

test('the prompts stay inside their word budget', () => {
  // 0.22.0 took 416 words out of the command (step 3 repeated the to-goal skill) to pay for the lean rule in the
  // cards, and left the command and the cards together no larger than 0.21.1 had them. Raising a number here is a
  // decision: say in the pull request what the new text buys. 0.23.0 and 0.25.0 each lowered both numbers to what
  // they left, and so did 0.26.0, 0.27.0, 0.28.0, 0.29.0 and 0.30.0. 0.31.0 lowered the command to 7511 and raised
  // the squad by 141 words: the platform-engineer's CI by moment (the smoke list, the draft gate, the pre-release run
  // before a release), which replaced the weekly run and the p95 on every pull request.
  // 0.32.0 moved the start of a goal from the platform-engineer's card to the command, as two commands the Engineer
  // runs: the command grew and the two together shrank.
  const COMMAND = 7578;
  const SQUAD = 18781;
  assert.ok(words('commands/engineer.md') <= COMMAND, `commands/engineer.md has ${words('commands/engineer.md')} words, over ${COMMAND}`);
  const total = words('commands/engineer.md') + cards.reduce((sum, rel) => sum + words(rel), 0);
  assert.ok(total <= SQUAD, `the command and the cards have ${total} words, over ${SQUAD}`);
});
