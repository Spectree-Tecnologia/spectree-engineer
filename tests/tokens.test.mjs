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
  assert.match(card, /\*\*Missão curta\.\*\*[^\n]*Quando o painel recusar uma chamada com o aviso de handoff[^\n]*relate `handoff`/);
  assert.doesNotMatch(card, /voltam para você mesmo/);
});

test('the command dispatches a new full-stack-developer for each ticket, and a ticket is fixed by the one that built it', () => {
  const command = read('commands/engineer.md');
  assert.match(command, /despache um full-stack-developer \*\*novo\*\* para o primeiro da frontier/);
  assert.match(command, /despache um full-stack-developer novo com os achados, literais/);
  // 0.30.0: three continuations, each of an agent whose context already holds what the message is about. Measured on
  // PILOT on 2026-11-13: fixes by a full-stack-developer starting cold were 44% of ci-time's tokens, and a one-line fix
  // cost 3.8M in ts7. The unit is still one ticket per agent: a fix is of the agent's own ticket, never of the goal.
  assert.match(command, /a continuação \(SendMessage\) existe em três casos: o full-stack-developer que teve o plano aprovado e segue para o primeiro ticket, a correção do ticket por quem o construiu, e a reconferência por quem achou/);
  assert.match(command, /ao \*\*mesmo\*\* full-stack-developer que construiu o ticket, pela mesma conversa \(SendMessage\)/);
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

test('a mission is short, and a ticket gets one fix and one re-check', () => {
  // measured on PILOT's ci-time (2026-11-12): 98 thousand tokens a call in missions of up to 60 calls, 162 thousand
  // past 110; the sentence that asked for batched calls changed nothing, so the panel says it
  const panel = read('hooks/engineer-desk/register.tsx');
  assert.match(panel, /export const HANDOFF_AT = 60/);
  assert.match(panel, /count === HANDOFF_AT && \/\(\?:\^\|:\)full-stack-developer\$\//);
  const command = read('commands/engineer.md');
  // 0.25.0 held `should` findings for the final verification because every fix was a cold mission; with the builder's
  // context alive (0.30.0) one message carries them all, and the loop is bounded instead of the list
  assert.match(command, /achado de checkpoint \(`blocking`, `should`, `confirmed`\) volta, numa mensagem só e literal/);
  assert.match(command, /\*\*Uma correção e uma reconferência por ticket\.\*\*/);
  assert.match(command, /você grava literal em `\.scratch\/<slug>\/open\.md`/);
  assert.match(command, /com os achados de `open\.md` na missão, literais/);
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

test('a stopped session is resumed by the panel, never one that ended in an answer', () => {
  // measured on PILOT's ci-time (2026-11-13): 12.4 of 29.8 hours were a stopped session nobody restarted, 5.7 h after
  // the 5-hour limit had reset and 6.7 h after one API network error. Neither was a decision of the Founder.
  const panel = read('hooks/engineer-desk/register.tsx');
  assert.match(panel, /e\.reason === 'error' \? scheduleResume\(\$\) : clearResume\(\$\)/);
  assert.match(panel, /if \(isMainTurnRunning \|\| !\(await hasWorkUnderWay\(\$\)\)\) return/);
  assert.match(panel, /\(e\.origin\.kind === 'composer' \|\| e\.origin\.kind === 'bridge'\) && !e\.isMeta\) await clearResume/);
  const resume = read('hooks/engineer-desk/resume.ts');
  assert.match(resume, /export const BACKOFF_MINUTES = \[2, 5, 15, 30, 60, 60, 60, 60, 60\]/);
  assert.match(resume, /one\.percentUsed >= 100 && one\.resetsAt !== undefined/);
  assert.match(resume, /Se o seu último passo foi uma pergunta ao fundador, repita a pergunta e pare/);
  // the stop is told apart from a wait for the Founder, and the fixes from the builds
  const script = read('skills/monolith/config-project/assets/scripts/goal.mjs');
  assert.match(script, /else if \(row\.isApiErrorMessage\) erroredAt \?\?= ts;/);
  assert.match(script, /h stopped by an error, \$\{M\(tokensIn\)\} tokens in/);
  assert.match(script, /fixes after a verification/);
});

test('the planned proof is attacked at the plan gate, before the code', () => {
  // ci-time: the ticket that built the proof script cost 1.0M tokens to build and 25.6M in three checkpoint rounds,
  // and the attack on the contract, before the plan said how the proof would be built, had cost 0.2M
  const command = read('commands/engineer.md');
  assert.match(command, /\*\*A prova é atacada antes do código\.\*\*[^\n]*despache o \*\*quality-engineer\*\* em modo prova, com o contrato e os tickets/);
  assert.match(command, /volta na mesma mensagem do gate e vira linha de `Criteria` do ticket/);
  const card = read('agents/quality-engineer.md');
  assert.match(card, /\*\*Modo prova, no gate do plano\.\*\*/);
  assert.match(card, /ele aceita por lista fechada, ou recusa o que lembrou de listar\?/);
  // the verdict stays independent: the one mission that reads tickets gives none
  assert.match(card, /É a única missão em que você lê tickets, e nela não há veredito/);
  assert.match(read('agents/full-stack-developer.md'), /o que o quality-engineer achou na prova planejada vira linha de `Criteria` do ticket/);
});
