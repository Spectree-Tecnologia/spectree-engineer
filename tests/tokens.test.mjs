// The speed of the squad is bounded by the plan's usage limit, so the number to watch is tokens per goal (0.23.0,
// the Founder's "Yes, build it" on 2026-11-11). Measured on the pilot project: one goal stood 61.6 of its 82.4 hours at the weekly
// limit, and 85% of its tokens were one full-stack-developer re-reading a context that held the whole goal, 259
// thousand tokens a turn. So the full-stack-developer that plans a goal breaks it into tickets (Matt Pocock's
// to-tickets, adapted: the Founder asked for tickets, not "slices", the same day), each ticket is built by a new
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
  assert.match(card, /each mission of yours is \*\*one part of a goal\*\*/);
  assert.match(card, /\*\*One ticket per mission:\*\*/);
  assert.match(card, /`Status: done`, `Done: <sha>` and `Next needs:`/);
  assert.match(card, /with `to-tickets` to break the goal down/);
  // a long mission costs more per call: the card says what to do when the panel says so
  assert.match(card, /\*\*Short mission\.\*\*[^\n]*When the panel refuses a call with the handoff warning[^\n]*report `handoff`/);
  assert.doesNotMatch(card, /come back to you yourself/);
});

test('the command dispatches a new full-stack-developer for each ticket, and a ticket is fixed by the one that built it', () => {
  const command = read('commands/engineer.md');
  assert.match(command, /dispatch a \*\*new\*\* full-stack-developer for the first of the frontier/);
  assert.match(command, /dispatch a new full-stack-developer with the findings, literal/);
  // 0.30.0: three continuations, each of an agent whose context already holds what the message is about. Measured on
  // On the pilot project on 2026-11-13: fixes by a full-stack-developer starting cold were 44% of ci-time's tokens, and a one-line fix
  // cost 3.8M in ts7. The unit is still one ticket per agent: a fix is of the agent's own ticket, never of the goal.
  assert.match(command, /continuation \(SendMessage\) exists in three cases: the plan the gate returned to whoever wrote it, the ticket's fix by whoever built it, and the re-check by whoever found it/);
  // 0.33.0: measured on the pilot project's ci-time-20 (2026-11-14): the planner went on to ticket 01 with 191 thousand tokens of
  // context and its tool-call count already past the handoff point, and handed off after 5 calls
  assert.match(command, /the mission of whoever planned ends there: dispatch a \*\*new\*\* full-stack-developer for the first ticket of the frontier/);
  assert.doesNotMatch(command, /send the same full-stack-developer to build the first ticket/);
  assert.match(command, /to the \*\*same\*\* full-stack-developer that built the ticket, through the same conversation \(SendMessage\)/);
});

test('tickets are the full-stack-developer\'s, never the orchestrator\'s', () => {
  const skill = read('skills/engineering/to-tickets/SKILL.md');
  assert.match(skill, /^user-invocable: false$/m);
  assert.match(skill, /If you are the orchestrator[^\n]*stop: you never write tickets/);
  assert.match(skill, /Each slice is sized to fit in a single fresh context window/);
  assert.match(skill, /`\.scratch\/<slug>\/issues\/<NN>-<name>\.md`/);
  assert.match(read('commands/engineer.md'), /the one who breaks the work into tickets is the full-stack-developer, looking at the code, never you/);
  // the unit of work has one name
  // the unit is a ticket in the command and the cards ("vertical slice" stays a term of the to-tickets skill only)
  for (const rel of ['commands/engineer.md', ...fs.readdirSync(path.join(plugin, 'agents')).map((name) => `agents/${name}`)]) {
    assert.doesNotMatch(read(rel), /fatia/i, `${rel} still says "fatia"`);
    assert.doesNotMatch(read(rel), /\bslices?\b/i, `${rel} says "slice" for a ticket`);
  }
});

test('a mission is short, and a ticket gets one fix and one re-check', () => {
  // measured on the pilot project's ci-time (2026-11-12): 98 thousand tokens a call in missions of up to 60 calls, 162 thousand
  // past 110; the sentence that asked for batched calls changed nothing, so the panel says it
  const panel = read('hooks/engineer-desk/register.tsx');
  assert.match(panel, /export const HANDOFF_AT = 60/);
  assert.match(panel, /count === HANDOFF_AT && \/\(\?:\^\|:\)full-stack-developer\$\//);
  const command = read('commands/engineer.md');
  // 0.25.0 held `should` findings for the final verification because every fix was a cold mission; with the builder's
  // context alive (0.30.0) one message carries them all, and the loop is bounded instead of the list
  assert.match(command, /checkpoint finding \(`blocking`, `should`, `confirmed`\) goes back, in a single literal message/);
  assert.match(command, /\*\*One fix and one re-check per ticket\.\*\*/);
  assert.match(command, /you write literally in `\.scratch\/<slug>\/open\.md`/);
  assert.match(command, /with the findings of `open\.md` in the mission, literal/);
  assert.match(command, /A `handoff` report: a new full-stack-developer continues the same ticket/);
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
  // measured on the pilot project's ci-time (2026-11-13): 12.4 of 29.8 hours were a stopped session nobody restarted, 5.7 h after
  // the 5-hour limit had reset and 6.7 h after one API network error. Neither was a decision of the Founder.
  const panel = read('hooks/engineer-desk/register.tsx');
  assert.match(panel, /e\.reason === 'error' \? scheduleResume\(\$\) : clearResume\(\$\)/);
  assert.match(panel, /if \(isMainTurnRunning \|\| !\(await hasWorkUnderWay\(\$\)\)\) return/);
  assert.match(panel, /\(e\.origin\.kind === 'composer' \|\| e\.origin\.kind === 'bridge'\) && !e\.isMeta\) await clearResume/);
  const resume = read('hooks/engineer-desk/resume.ts');
  assert.match(resume, /export const BACKOFF_MINUTES = \[2, 5, 15, 30, 60, 60, 60, 60, 60\]/);
  assert.match(resume, /one\.percentUsed >= 100 && one\.resetsAt !== undefined/);
  assert.match(resume, /If your last step was a question to the founder, repeat the question and stop/);
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
  assert.match(command, /\*\*The proof is attacked before the code\.\*\*[^\n]*dispatch the \*\*quality-engineer\*\* in proof mode, with the contract and the tickets/);
  assert.match(command, /goes back in the same message as the gate and becomes a `Criteria` line of the ticket/);
  const card = read('agents/quality-engineer.md');
  assert.match(card, /\*\*Proof mode, at the plan gate\.\*\*/);
  assert.match(card, /does it accept by a closed list, or refuse what it remembered to list\?/);
  // the verdict stays independent: the one mission that reads tickets gives none
  assert.match(card, /It is the only mission in which you read tickets, and in it there is no verdict/);
  assert.match(read('agents/full-stack-developer.md'), /what the quality-engineer found in the planned proof becomes a `Criteria` line of the ticket/);
});
