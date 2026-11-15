// 0.37.0: the plugin's prompts are English, and the Engineer talks with each person in the language that person chose
// once, recorded per person in `.engineer.local.json` and never committed. Everything else the squad writes is
// English, so no Portuguese is left in what the agents read.
//   node --test tests/language.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8').split('\r\n').join('\n');
const command = read('commands/engineer.md');

test('the first contact asks the language, in English, and only the main session asks', () => {
  assert.match(command, /You talk with the founder in their language \(section 1, item 8\)\. Everything else is \*\*English\*\*: contracts, docs, code, comments, tests, commits, PR titles and bodies, issues opened on the plugin, missions to subagents, `decisions\.md`\./);
  const item = command.split('\n').find((line) => line.startsWith('8. `.engineer.local.json`'));
  assert.ok(item, 'section 1 has no item 8 about .engineer.local.json');
  assert.ok(item.includes('`{"conversationLanguage": "<language>"}`'));
  assert.match(item, /File or key missing in the main session \(not `\/engineer item …`\): your first message is only this question, in English, with no state table nor interview/);
  assert.match(item, /A request in `\$ARGUMENTS` is kept and handled right after the answer\./);
  assert.match(item, /make sure the project's `\.gitignore` has the line `\.engineer\.local\.json`/);
  // under .claude/ every write asks for permission, so the first-contact write would stall an unattended session
  assert.match(item, /not under `\.claude\/`, where every write asks for permission/);
  assert.match(item, /An item session never asks: it reports in the recorded language, or in English if none is recorded\./);
});

test('the generated project never commits the language file', () => {
  const gitignore = read('skills/monolith/config-project/.gitignore').split('\n').map((line) => line.trim());
  assert.ok(gitignore.includes('.engineer.local.json'), 'the generated .gitignore does not ignore .engineer.local.json');
  // a project bootstrapped before keeps it out too: project-init adds the line to an existing .gitignore
  assert.match(read('skills/monolith/config-project/scripts/project-init.mjs'), /const missing = \[[^\]]*'\.engineer\.local\.json'[^\]]*\]/);
});

// Common Portuguese words, matched as whole words (JavaScript's \b does not see accented letters as letters).
const PORTUGUESE = /(?<!\p{L})(não|você|vocês|objetivo|critério|critérios|fundador|missão|rodada|projeto|andamento|também|então|está|são|quando|pelo|pela|uma|isso|esse|essa)(?!\p{L})/giu;
const ACCENTED = /\p{L}*[ãõçâêôáéíóú]\p{L}*/giu;
// the language question gives examples in their own language
const EXAMPLES = ['Português (Brasil)', 'Español'];

function prompts() {
  const out = ['commands/engineer.md', ...fs.readdirSync(path.join(plugin, 'agents')).map((name) => `agents/${name}`)];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(plugin, rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'assets' || entry.name === 'scripts') continue;
        walk(child);
      } else if (entry.name === 'SKILL.md' || (/\/references\//.test(child) && /\.(md|ts|tsx|js|mjs|json|ya?ml|prisma)$/.test(entry.name))) {
        out.push(child);
      }
    }
  };
  walk('skills');
  return out;
}

test('a skill that sends to a section of the command names it as the command now spells it', () => {
  for (const rel of ['skills/engineering/implement/SKILL.md', 'skills/engineering/to-spec/SKILL.md', 'skills/engineering/to-tickets/SKILL.md']) {
    const name = read(rel).match(/section 3, "([^"]+)"/)?.[1];
    assert.ok(name, `${rel} does not name the adoption section`);
    assert.ok(command.includes(`### ${name}`), `${rel} sends to "${name}", which is not a section of commands/engineer.md`);
  }
});

test('no Portuguese is left in the command, the cards or the skills', () => {
  const files = prompts();
  assert.ok(files.length > 40, `only ${files.length} prompt files found`);
  const found = [];
  for (const rel of files) {
    let text = read(rel);
    for (const example of EXAMPLES) text = text.split(example).join('');
    for (const match of [...text.matchAll(PORTUGUESE), ...text.matchAll(ACCENTED)]) {
      const line = text.slice(0, match.index).split('\n').length;
      found.push(`${rel}:${line} "${match[0]}"`);
    }
  }
  assert.deepEqual(found, [], 'Portuguese in a prompt');
});
