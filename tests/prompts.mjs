// What an agent of the squad is told: its card (or, for the Engineer, the /engineer command) and its playbook, the
// skill `<role>-playbook` under skills/squad/ that holds the operating detail the card points at (0.32.0: a card is
// at most 600 words, and what does not fit moved, verbatim, to the playbook's references). A rule the tests look for
// may live in either, so the tests read both.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');

const files = (dir) =>
  fs.readdirSync(path.join(plugin, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    return entry.isDirectory() ? files(rel) : entry.name.endsWith('.md') ? [rel] : [];
  });

export const roles = () => fs.readdirSync(path.join(plugin, 'agents')).filter((name) => name.endsWith('.md')).map((name) => name.replace(/\.md$/, ''));

// the card (or the command) first, then the playbook's SKILL.md and its references
export const promptFiles = (role) => {
  const head = role === 'engineer' ? 'commands/engineer.md' : `agents/${role}.md`;
  const playbook = `skills/squad/${role}-playbook`;
  return [head, ...(fs.existsSync(path.join(plugin, playbook)) ? files(playbook) : [])];
};

export const role = (name) => promptFiles(name).map(read).join('\n\n');

export const allPromptFiles = () => ['engineer', ...roles()].flatMap(promptFiles);
