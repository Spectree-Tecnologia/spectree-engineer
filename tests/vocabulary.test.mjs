// The squad names each agent by its role, never by a nickname (the Founder, 2026-11-11: "o dono" ("the owner") told him nothing
// about who was responsible). What the command and the cards say is what the Engineer repeats to the Founder, so the
// nickname is kept out of them here.
//   node --test tests/vocabulary.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
const prompts = ['commands/engineer.md', ...fs.readdirSync(path.join(plugin, 'agents')).map((name) => `agents/${name}`)];

// "dono" ("owner") also means the owner of a resource, a table or a schema.
const ALLOWED = ['dono do recurso', 'não é dono de nada', 'sem o dono;', 'dono do schema'];
const NICKNAMES = /\b(don[oa]s?|revisor(es)?|verificador(es)?|construtor(es)?|quem verifica)\b/gi;

test('the command and the cards name the agent, never a nickname for it', () => {
  for (const rel of prompts) {
    // the rule itself lists the nicknames it forbids
    let text = read(rel).replace(/Nunca um apelido de função \([^)]*\)/, '');
    for (const phrase of ALLOWED) text = text.split(phrase).join('');
    const found = [...text.matchAll(NICKNAMES)].map((match) => `${match[0]} in "${text.slice(Math.max(0, match.index - 40), match.index + 30).replace(/\s+/g, ' ')}"`);
    assert.deepEqual(found, [], `${rel} uses a nickname for an agent`);
  }
});

test('the contract skill names the full-stack-developer, not "the owner"', () => {
  const skill = read('skills/engineering/to-goal/SKILL.md');
  assert.equal(/\bowner\b/i.test(skill), false);
  assert.match(skill, /full-stack-developer/);
});

test('the command tells the Engineer to name each agent by its role', () => {
  const command = read('commands/engineer.md');
  for (const role of ['full-stack-developer', 'quality-engineer', 'security-engineer', 'solutions-architect', 'platform-engineer', 'ui-ux-designer', 'integration-engineer']) {
    assert.match(command, new RegExp(`Nomeie cada agente pelo nome do papel[^\\n]*\`${role}\``));
  }
});
