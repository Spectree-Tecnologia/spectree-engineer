// Counts the words of the body of each agent card and of the /engineer command, without the YAML frontmatter.
// The limit is 600 words a body (0.32.0): a short card keeps the agent on its mission, and the operating detail
// lives in its playbook skill, read only when the mission needs it.
//   node scripts/card-words.mjs            prints the table, exit 1 when a body is over the limit
//   node scripts/card-words.mjs --json     the same as JSON
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMIT = 600;
const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function body(text) {
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return match ? text.slice(match[0].length) : text;
}

export const countWords = (text) => body(text).split(/\s+/).filter(Boolean).length;

export function prompts() {
  const cards = fs.readdirSync(path.join(plugin, 'agents')).filter((f) => f.endsWith('.md')).sort().map((f) => `agents/${f}`);
  return ['commands/engineer.md', ...cards];
}

export function table() {
  return prompts().map((rel) => ({ file: rel, words: countWords(fs.readFileSync(path.join(plugin, rel), 'utf8')) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = table();
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    console.log(`| File | Body words | Limit ${LIMIT} |`);
    console.log('|---|---:|---|');
    for (const row of rows) console.log(`| ${row.file} | ${row.words} | ${row.words <= LIMIT ? 'ok' : 'OVER'} |`);
  }
  process.exit(rows.every((row) => row.words <= LIMIT) ? 0 : 1);
}
