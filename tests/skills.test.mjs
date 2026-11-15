// The skills of this plugin are tools of the squad's agents, not commands of the Founder (2026-11-11: "the skills are
// for the agents' use only, I don't want them showing up in the slash commands"). `user-invocable:
// false` keeps a skill out of the slash menu and leaves it callable by the model, so the only thing the Founder types
// is `/engineer`.
//   node --test tests/skills.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const skills = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'SKILL.md') skills.push(full);
  }
})(path.join(plugin, 'skills'));

const frontmatter = (file) => fs.readFileSync(file, 'utf8').split(/^---\r?$/m)[1] ?? '';
const rel = (file) => path.relative(plugin, file).split(path.sep).join('/');

test('every skill stays out of the slash menu', () => {
  assert.ok(skills.length >= 32, `only ${skills.length} skills found`);
  for (const file of skills) {
    assert.match(frontmatter(file), /^user-invocable: false\r?$/m, `${rel(file)} does not declare user-invocable: false`);
  }
});

test('every skill stays callable by the agents', () => {
  for (const file of skills) {
    const head = frontmatter(file);
    assert.doesNotMatch(head, /^disable-model-invocation:\s*true/m, `${rel(file)} cannot be called by an agent`);
    assert.match(head, /^description:/m, `${rel(file)} has no description for the agents to find it by`);
  }
});

test('the only command the Founder types is /engineer', () => {
  assert.deepEqual(fs.readdirSync(path.join(plugin, 'commands')), ['engineer.md']);
});
