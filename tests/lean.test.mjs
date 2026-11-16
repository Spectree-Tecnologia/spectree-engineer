// Lean code in a goal driven squad (0.22.0, the Founder's "Yes, build it" on 2026-11-11, after reading
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
  assert.match(card, /`Reuses:`[^\n]*`New:`[^\n]*rule 15/);
  assert.match(card, /no criterion exercises comes out before the ticket's commit/);
  assert.match(card, /Lean in the solution, never in the change/);
  assert.match(card, /`shortcut: <the limit>, <when to upgrade>`/);
  assert.match(card, /what you \*\*did not check\*\*/);
});

test('the plan gate refuses what already exists', () => {
  assert.match(read('agents/solutions-architect.md'), /\*\*Reuse\*\*[^\n]*`violates rule 15`/);
});

test('the quality-engineer reads the callers the diff did not touch and reports what no criterion needs', () => {
  const card = read('agents/quality-engineer.md');
  assert.match(card, /\*\*Read beyond the diff\.\*\*[^\n]*look for every caller in the whole project/);
  assert.match(card, /^## Lean$/m);
  assert.match(card, /code that no criterion, limit or rule requires/);
  // lean never costs a round: the risk policy sends a `should` to the hardening goal
  assert.match(card, /One finding per item, `should`/);
  assert.match(card, /What the other numbered rules require is never a finding/);
});

test('a shortcut never covers what the rule forbids cutting', () => {
  assert.match(read('agents/security-engineer.md'), /\*\*Declared shortcut\.\*\*[^\n]*rule 15 forbids that cut, and it is `confirmed`/);
});

test('a finding reaches the Founder numbered and in four parts', () => {
  const command = read('commands/engineer.md');
  assert.match(command, /\*\*what it is\*\*[^\n]*\*\*the problem\*\*[^\n]*\*\*the fix\*\*[^\n]*\*\*if we skip it\*\*/);
  assert.match(command, /Every report ends with what was not checked/);
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
  // 0.34.0 raised both by about 120 words: the two lanes of step 7 (which tickets run together, the second checkout,
  // the merge of a closed ticket and its proof). Measured on the pilot project's ci-time-20: a free ticket sat idle for 40 and for
  // 77 minutes while the one before it was built and verified.
  // 0.35.0 raised the command by 66 words and the two together by 118: the bug's minimal contract (step 8 could not
  // run without one), the verifiers' diff without `.scratch/`, and the rule number beside each item the
  // quality-engineer reads for. The full-stack-developer's card shrank by 34: its rules moved to ARCHITECTURE.md.
  // 0.36.0 raised the command by 389 words and the two together by 500: eight rules that were missing or said two
  // things (who runs a git command, the approval of the design system and the way back to an approved prototype, the
  // count of the audit, the commit of the plan, the test of gate 2, a `should` that pays one round, the ceiling of
  // two full-stack-developers per machine). Each is a sentence where the squad had to guess.
  // 0.37.0 re-based both budgets on the English translation (about 5% longer than the Portuguese, with the language
  // question of section 1 item 8); from here on, new text pays for itself again.
  // 0.39.0 raised the command by 143 words and the two together by 92, after taking some out of step 9's Fable lines: step 7's (e), the checkpoint
  // the Engineer writes into the ticket (`verified`, `open`, `Reproved:`, `Carried:`), the reproval that counts at a
  // checkpoint as in a round, and the security-engineer read from `trust:`. Measured on the pilot project's ts7
  // (issue 89): a criterion reproved three times at checkpoints stayed on Opus.
  // 0.40.0 raised both by 48 words: step 3's "you write the contract, not its proof", which the panel now enforces.
  // Measured on the pilot project on 2026-11-15: the Engineer's own proof script took 64% of a goal's first hour.
  const COMMAND = 8667;
  const SQUAD = 20298;
  assert.ok(words('commands/engineer.md') <= COMMAND, `commands/engineer.md has ${words('commands/engineer.md')} words, over ${COMMAND}`);
  const total = words('commands/engineer.md') + cards.reduce((sum, rel) => sum + words(rel), 0);
  assert.ok(total <= SQUAD, `the command and the cards have ${total} words, over ${SQUAD}`);
});
