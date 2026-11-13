// The speed of the squad is bounded by the plan's usage limit, so the number to watch is tokens per goal (0.23.0,
// the Founder's "Sim, construir" on 2026-11-11). Measured on PILOT: one goal stood 61.6 of its 82.4 hours at the weekly
// limit, and 85% of its tokens were one full-stack-developer re-reading a context that held the whole goal, 259
// thousand tokens a turn. So the full-stack-developer that plans a goal breaks it into tickets (Matt Pocock's
// to-tickets, adapted: the Founder asked for tickets, not "fatias", the same day), each ticket is built by a new
// full-stack-developer from the plan, and `goal spent` reads what a goal cost from the transcripts.
//   node --test tests/tokens.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');

test('a full-stack-developer builds one ticket, and leaves the next one what it needs', () => {
  const card = read('agents/full-stack-developer.md');
  assert.match(card, /cada missão sua é \*\*uma parte de um objetivo\*\*/);
  assert.match(card, /\*\*Um ticket por missão:\*\*/);
  assert.match(card, /`Status: done`, `Done: <sha>` e `Next needs:`/);
  assert.match(card, /com `to-tickets` para quebrar o objetivo/);
  // a long mission costs more per call: the card says what to do when the panel says so
  assert.match(card, /\*\*Missão curta\.\*\*[^\n]*Na 60ª o painel recusa a chamada uma vez, como aviso[^\n]*relate `handoff`/);
  assert.doesNotMatch(card, /voltam para você mesmo/);
});

test('the command dispatches a new full-stack-developer for each ticket and each fix', () => {
  const command = read('commands/engineer.md');
  assert.match(command, /despache um full-stack-developer \*\*novo\*\* para o ticket seguinte/);
  assert.match(command, /despache um full-stack-developer novo com os achados, literais/);
  // the one continuation left: the plan was approved and the same agent builds the first slice
  assert.match(command, /a única continuação é a do full-stack-developer que teve o plano aprovado e segue para o primeiro ticket/);
  assert.doesNotMatch(command, /\*\*mesmo\*\* full-stack-developer|\*\*mesmo full-stack-developer\*\*/);
});

test('tickets are the full-stack-developer\'s, never the orchestrator\'s', () => {
  const skill = read('skills/engineering/to-tickets/SKILL.md');
  assert.match(skill, /^user-invocable: false$/m);
  assert.match(skill, /If you are the orchestrator[^\n]*stop: you never write tickets/);
  assert.match(skill, /Each slice is sized to fit in a single fresh context window/);
  assert.match(skill, /`\.scratch\/<slug>\/issues\/<NN>-<name>\.md`/);
  assert.match(read('commands/engineer.md'), /quem quebra o trabalho em tickets é o full-stack-developer, olhando o código, nunca você/);
  // the unit of work has one name
  for (const rel of ['commands/engineer.md', ...fs.readdirSync(path.join(plugin, 'agents')).map((name) => `agents/${name}`)]) assert.doesNotMatch(read(rel), /fatia/i, `${rel} still says "fatia"`);
});

test('a mission is short, and a checkpoint sends back only what blocks', () => {
  // measured on PILOT's ci-time (2026-11-12): 98 thousand tokens a call in missions of up to 60 calls, 162 thousand
  // past 110; the sentence that asked for batched calls changed nothing, so the panel says it
  const panel = read('hooks/engineer-desk/register.tsx');
  assert.match(panel, /export const HANDOFF_AT = 60/);
  assert.match(panel, /count === HANDOFF_AT && \/\(\?:\^\|:\)full-stack-developer\$\//);
  const command = read('commands/engineer.md');
  assert.match(command, /leva os `blocking` e os `confirmed` que já chegaram do checkpoint anterior/);
  assert.match(command, /`should` de checkpoint espera: vai na correção da verificação final/);
  assert.match(command, /um problema por missão/);
  assert.match(command, /Relato `handoff`: um full-stack-developer novo continua o mesmo ticket/);
  assert.match(read('skills/engineering/to-tickets/SKILL.md'), /about 40 tool calls of work/);
  const script = read('skills/monolith/config-project/assets/scripts/goal.mjs');
  // the session is found by the title the app gives it, not only by its opening line
  assert.ok(script.includes('"customTitle":"${goal.slug}"'), 'goal spent does not look for the session by its title');
  assert.match(script, /missions over \$\{LONG\} turns/);
});

test('the retro records what the goal cost', () => {
  assert.match(read('commands/engineer.md'), /`npm run goal -- spent <slug> --write`/);
  const script = read('skills/monolith/config-project/assets/scripts/goal.mjs');
  assert.match(script, /else if \(command === 'spent'\) process\.exit\(spent\(\)\);/);
  // the transcripts are read, never written
  const body = script.slice(script.indexOf('function spent()'), script.indexOf("if (command === 'check')"));
  assert.equal([...body.matchAll(/fs\.writeFileSync\(([^,]+),/g)].map((call) => call[1]).join(), 'goal.file');
});
