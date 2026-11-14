// The Founder's model policy (2026-11-11): every role of the squad runs on Opus, and a goal is raised to Fable only
// from its third verification round on, when two rounds on Opus left a criterion open. The cards and the command
// are what decides the model of a dispatch, so the policy is kept in them here.
//   node --test tests/models.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { allPromptFiles, role } from './prompts.mjs';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
const cards = fs.readdirSync(path.join(plugin, 'agents')).map((name) => `agents/${name}`);

test('every card declares Opus', () => {
  assert.equal(cards.length, 7);
  for (const rel of cards) {
    const frontmatter = read(rel).split(/^---\r?$/m)[1];
    assert.match(frontmatter, /^model: opus\r?$/m, `${rel} does not declare model: opus`);
  }
});

test('the command asks for Fable only from the third verification round on', () => {
  const command = role('engineer');
  assert.match(command, /todo papel do squad roda em \*\*Opus\*\*/);
  assert.match(command, /\*\*Piso: `opus`\.\*\*/);
  // each line that names `model: "fable"` is the one about the third round
  const asking = command.split('\n').filter((line) => line.includes('model: "fable"'));
  assert.equal(asking.length, 1);
  assert.match(asking[0], /\*\*A terceira rodada sobe de modelo\.\*\*/);
  assert.doesNotMatch(command, /modelo mais capaz/);
});

test("the panel's floor is Opus", () => {
  const panel = read('hooks/engineer-desk/register.tsx');
  assert.match(panel, /const FLOOR = 'opus'/);
});
