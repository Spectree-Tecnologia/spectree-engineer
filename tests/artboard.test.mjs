// 0.46.0 (issues 121, 106, 90, 96, 98, 97): a screen criterion is proved against its artboard by computed style, and the
// contract says what a gate decides for every input, which commits a deferred proof may name, and how a run's verdict
// is read. scripts/artboard.mjs is checked against a real artboard in a Playwright run, not here: the plugin has no browser.
//   node --test tests/artboard.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
const assets = 'skills/monolith/config-project/assets/scripts';

test('a screen criterion is proved by compareArtboard, and a project gets the script and its types', async () => {
  const goal = read('skills/engineering/to-goal/SKILL.md');
  assert.match(goal, /Its proof is a spec that calls `compareArtboard` \(`scripts\/artboard\.mjs`\) for each artboard and state of the list/);
  assert.match(goal, /a screenshot is evidence for the founder, never the proof/);
  const script = read(`${assets}/artboard.mjs`);
  // every exclusion says why, and what the artboard draws outside every probe is returned by its name
  assert.match(script, /needs its why/);
  assert.match(script, /return \{ differences, uncovered: design\.uncovered \}/);
  for (const { why } of (await import(`../${assets}/artboard.mjs`)).NOT_STYLE) assert.ok(why.length > 10);
  assert.match(read(`${assets}/artboard.d.mts`), /export function compareArtboard/);
  assert.match(read('skills/monolith/config-project/scripts/project-init.mjs'), /for \(const name of \['artboard\.mjs', 'artboard\.d\.mts'\]\)/);
  assert.match(read('skills/monolith/config-project/scripts/tooling-sync.mjs'), /\/\\\.\(mjs\|d\\\.mts\)\$\/\.test\(name\)/);
});

test('a gate decides the refusal for every input, its message for a closed list', () => {
  assert.match(read('skills/engineering/to-goal/SKILL.md'), /The refusal itself \(the exit code\) is decided for every input; what the refusal's message names is demanded only for a closed list of cases/);
});

test('a proof reads another tool\'s input with that tool\'s parser', () => {
  assert.match(read('agents/full-stack-developer.md'), /judges another tool's input[^.]*read it with that tool's own parser and fail on any form you cannot judge/);
});

test('a deferred proof names commits on main, a by-hand one waits for the PR\'s run, and a run is judged by its jobs', () => {
  const goal = read('skills/engineering/to-goal/SKILL.md');
  assert.match(goal, /A criterion decided by hand from the pull request's own run is written `in ci:` too, with no `run:`/);
  assert.match(goal, /A deferred proof names only commits that are on main \(`git merge-base --is-ancestor <sha> origin\/main`\)/);
  assert.match(goal, /`gh run view <id> --attempt 1 --json jobs`\), never `gh run watch`'s exit code/);
  const card = read('agents/platform-engineer.md');
  assert.match(card, /A push to an open PR cancels its run in progress/);
  assert.match(card, /never `gh run watch`'s exit code, 0 on a cancelled run/);
});
