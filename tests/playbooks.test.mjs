// 0.32.0: every card and the /engineer command are at most 600 words, and the operating detail moved, verbatim, to
// one playbook per role (skills/squad/<role>-playbook). A card that points at a reference or a skill that does not
// exist sends its agent nowhere, so the pointers are checked here, and so is the claim that nothing was lost: every
// line of the 0.31.0 prompts lives on in a card or in a reference.
//   node --test tests/playbooks.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { plugin, promptFiles, read, roles } from './prompts.mjs';

const skillNames = (() => {
  const names = new Set();
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'SKILL.md') names.add(fs.readFileSync(full, 'utf8').match(/^name:\s*(.+?)\s*$/m)?.[1]);
    }
  })(path.join(plugin, 'skills'));
  return names;
})();

const head = (role) => (role === 'engineer' ? 'commands/engineer.md' : `agents/${role}.md`);
const all = ['engineer', ...roles()];

test('every role that has a playbook loads it, and the playbook is in the manifest', () => {
  const manifest = JSON.parse(read('.claude-plugin/plugin.json')).skills;
  for (const role of all) {
    const dir = `skills/squad/${role}-playbook`;
    if (!fs.existsSync(path.join(plugin, dir))) continue;
    assert.match(read(head(role)), new RegExp(`chame o Skill tool com \`${role}-playbook\``), `${head(role)} does not load its playbook`);
    assert.ok(manifest.includes(`./${dir}`), `${dir} is not in .claude-plugin/plugin.json`);
    const skill = read(`${dir}/SKILL.md`);
    assert.match(skill, new RegExp(`^name: ${role}-playbook$`, 'm'));
    // the index lists every reference, and every reference it lists exists
    const listed = [...skill.matchAll(/\(references\/([a-z-]+\.md)\)/g)].map((m) => m[1]).sort();
    const present = fs.readdirSync(path.join(plugin, dir, 'references')).sort();
    assert.deepEqual(listed, present, `${dir}/SKILL.md does not list exactly its references`);
  }
});

test('every reference and skill a card names exists', () => {
  for (const role of all) {
    const card = read(head(role));
    const refs = path.join(plugin, `skills/squad/${role}-playbook/references`);
    for (const [, name] of card.matchAll(/`([a-z-]+\.md)`/g)) {
      assert.ok(fs.existsSync(path.join(refs, name)), `${head(role)} names \`${name}\`, which its playbook does not have`);
    }
    for (const [, name] of card.matchAll(/`([a-z][a-z0-9-]+)`/g)) {
      const looksLikeSkill = /^(to-|config-|module-|backend-|frontend-)|-playbook$/.test(name) ||
        ['grilling', 'domain-modeling', 'codebase-design', 'tdd', 'diagnosing-bugs', 'code-review', 'pr', 'retro', 'security-audit', 'setup-matt-pocock-skills'].includes(name);
      if (looksLikeSkill) assert.ok(skillNames.has(name), `${head(role)} names the skill \`${name}\`, which does not exist`);
    }
  }
});

test('the tools a card names are the tools its frontmatter gives it', () => {
  const tools = (role) => (read(head(role)).match(/^tools:\s*(.+)$/m)?.[1] ?? '').split(/,\s*/);
  for (const role of roles()) {
    const card = read(head(role));
    const given = tools(role);
    for (const [phrase, tool] of [['Skill tool', 'Skill'], ['Artifact tool', 'Artifact'], ['Playwright MCP', 'mcp__playwright__browser_take_screenshot'], ['Bash', 'Bash']]) {
      if (card.includes(phrase)) assert.ok(given.includes(tool), `${head(role)} names the ${phrase} without ${tool} in its tools`);
    }
  }
});

test('no line of the 0.31.0 prompts was lost: each one is in a card or in a playbook of that role', () => {
  // the frozen copy of 0.31.0 is git history; outside a git checkout this test has nothing to compare with
  const base = spawnSync('git', ['-C', plugin, 'cat-file', '-e', 'v0.31.0'], { encoding: 'utf8' });
  if (base.status !== 0) return;
  for (const role of all) {
    const original = spawnSync('git', ['-C', plugin, 'show', `v0.31.0:${head(role)}`], { encoding: 'utf8' }).stdout;
    const now = promptFiles(role).map(read).join('\n').split('\r\n').join('\n');
    const body = original.split('\r\n').join('\n').replace(/^---\n[\s\S]*?\n---\n/, '');
    for (const line of body.split('\n').map((l) => l.trim()).filter((l) => l.length > 3 && !/^#{1,3} /.test(l) && l !== '```' && l !== '```bash')) {
      assert.ok(now.includes(line), `${head(role)}: a line of 0.31.0 is in neither the card nor the playbook: ${line.slice(0, 120)}`);
    }
  }
});

