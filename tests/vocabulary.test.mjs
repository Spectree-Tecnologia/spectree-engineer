// The squad names each agent by its role, never by a nickname (the Founder, 2026-11-11: "the owner" told him nothing
// about who was responsible). What the command and the cards say is what the Engineer repeats to the Founder, so the
// nickname is kept out of them here. Rewritten for the English prompts in 0.37.0.
//   node --test tests/vocabulary.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
const prompts = ['commands/engineer.md', ...fs.readdirSync(path.join(plugin, 'agents')).map((name) => `agents/${name}`)];

// The same words in a sense that is not an agent: the owner of a resource, a GitHub path, the roles the security-audit
// skill asks the Audit for, and a checker that is a script.
const ALLOWED = ['resource owner', 'resource-owner', 'repos/<owner>/<repo>', 'each hunter, critic and verifier', 'a new script or checker'];
const NICKNAMES = /\b(owners?|builders?|reviewers?|verifiers?|checkers?)\b/gi;

test('the command and the cards name the agent, never a nickname for it', () => {
  for (const rel of prompts) {
    // the rule itself lists the nicknames it forbids
    let text = read(rel).replace(/Never a job nickname \([^)]*\)/, '');
    for (const phrase of ALLOWED) text = text.split(phrase).join('');
    const found = [...text.matchAll(NICKNAMES)].map((match) => `${match[0]} in "${text.slice(Math.max(0, match.index - 40), match.index + 30).replace(/\s+/g, ' ')}"`);
    assert.deepEqual(found, [], `${rel} uses a nickname for an agent`);
  }
});

test('the rule names the nicknames it forbids', () => {
  const rule = read('commands/engineer.md').match(/Never a job nickname \(([^)]*)\)/)?.[1] ?? '';
  for (const nickname of ['the owner', 'the builder', 'the reviewer', 'the verifier']) assert.ok(rule.includes(`"${nickname}"`), `the rule does not list "${nickname}"`);
});

test('the contract skill names the full-stack-developer, not "the owner"', () => {
  const skill = read('skills/engineering/to-goal/SKILL.md');
  assert.equal(/\bowner\b/i.test(skill), false);
  assert.match(skill, /full-stack-developer/);
});

test('the command tells the Engineer to name each agent by its role', () => {
  const command = read('commands/engineer.md');
  for (const role of ['full-stack-developer', 'quality-engineer', 'security-engineer', 'solutions-architect', 'platform-engineer', 'ui-ux-designer', 'integration-engineer']) {
    assert.match(command, new RegExp(`Name each agent by its role's name[^\\n]*\`${role}\``));
  }
});
