// Lean code in a goal driven squad (0.22.0, the Founder's "Sim, construir" on 2026-11-11, after reading
// DietrichGebert/ponytail): the smallest complete change, where "nobody asked for it" is decided by the contract.
// The rule is written once, as rule 15 of the architecture, and each role has its part of it. The prompts pay for
// what they gain: a rule added to the command or to a card is paid with text that came out.
//   node --test tests/lean.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { allPromptFiles, role } from './prompts.mjs';
import { LIMIT, table } from '../scripts/card-words.mjs';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
const words = (rel) => read(rel).split(/\s+/).filter(Boolean).length;

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
  const card = role('full-stack-developer');
  assert.match(card, /`Reuses:`[^\n]*`New:`[^\n]*regra 15/);
  assert.match(card, /nenhum critério exercita sai antes do commit do ticket/);
  assert.match(card, /Enxuto na solução, nunca na mudança/);
  assert.match(card, /`shortcut: <o limite>, <quando subir>`/);
  assert.match(card, /o que você \*\*não conferiu\*\*/);
});

test('the plan gate refuses what already exists', () => {
  assert.match(role('solutions-architect'), /\*\*Reuse\*\*[^\n]*`violates rule 15`/);
});

test('the quality-engineer reads the callers the diff did not touch and reports what no criterion needs', () => {
  const card = role('quality-engineer');
  assert.match(card, /\*\*Leia além do diff\.\*\*[^\n]*procure cada chamador no projeto inteiro/);
  assert.match(card, /^## Lean$/m);
  assert.match(card, /código que nenhum critério, limite ou regra exige/);
  // lean never costs a round: the risk policy sends a `should` to the hardening goal
  assert.match(card, /Um achado por item, `should`/);
  assert.match(card, /O que as regras 1 a 14 exigem nunca é achado/);
});

test('a shortcut never covers what the rule forbids cutting', () => {
  assert.match(role('security-engineer'), /\*\*Atalho declarado\.\*\*[^\n]*a regra 15 proíbe esse corte, e ele é `confirmed`/);
});

test('a finding reaches the Founder numbered and in four parts', () => {
  const command = role('engineer');
  assert.match(command, /\*\*o que é\*\*[^\n]*\*\*o problema\*\*[^\n]*\*\*a correção\*\*[^\n]*\*\*se pularmos\*\*/);
  assert.match(command, /Todo relato fecha com o que não foi conferido/);
  assert.match(command, /shortcut:/);
});

test('every card and the command stay at most 600 words, without the frontmatter', () => {
  // 0.32.0: a short card keeps the agent on its mission. The card says the mission, the skills and tools and when to
  // use each, the limits and the escalation, and the handoffs; the operating detail moved, verbatim, to the role's
  // playbook (skills/squad/<role>-playbook), read when the mission needs it. `node scripts/card-words.mjs` prints
  // the table.
  for (const row of table()) assert.ok(row.words <= LIMIT, `${row.file} has ${row.words} words in its body, over ${LIMIT}`);
});

test('the prompts stay inside their word budget', () => {
  // 0.22.0 took 416 words out of the command (step 3 repeated the to-goal skill) to pay for the lean rule in the
  // cards. Raising a number here is a decision: say in the pull request what the new text buys. 0.23.0 to 0.30.0
  // lowered it to what they left; 0.31.0 raised it by 141 words for the CI by moment. 0.32.0 moved the operating
  // detail of the command and the cards, verbatim, to the playbooks, and counts what an agent of the squad can be
  // told: the command, the cards and the playbooks. The 18808 words of 0.31.0 became this number; what it grew by is
  // the short cards and the playbook indexes that point at the detail.
  const SQUAD = 24302;
  const total = allPromptFiles().reduce((sum, rel) => sum + words(rel), 0);
  assert.ok(total <= SQUAD, `the command, the cards and the playbooks have ${total} words, over ${SQUAD}`);
});
