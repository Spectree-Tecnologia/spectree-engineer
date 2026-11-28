// The context ceiling: no subagent of the squad works with more than this many tokens of context in one mission.
// The Founder's hypothesis (2026-11-27): below it the model reasons at its best, above it the quality drops and
// nobody notices. This file is the one place the number is written. Change it here and nowhere else:
//   - the Engineer panel (hooks/engineer-desk) reads it from the plugin and enforces it while a mission runs;
//   - `goal` (scripts/goal.mjs, which tooling-sync keeps beside this file in a project) estimates each ticket
//     against it before it is dispatched and reports every mission against it afterwards.
// A mission's context is the input of its last model request as the API reported it (uncached, cache-written and
// cache-read tokens together) plus the output of that request, which the next one carries.
export const CONTEXT_CEILING = 400_000;

// The room the panel keeps under the ceiling. At CONTEXT_CEILING - HANDOFF_ROOM it refuses one call with the way
// out (finish if little is left, otherwise close and report `handoff`); at CONTEXT_CEILING - CLOSE_ROOM it runs only
// the calls that close a mission (a commit, a write under .scratch/, stopping a process). The rooms are tokens, not
// shares of the ceiling, because they hold tool results and a report, whose size does not follow the ceiling: one
// Read returns at most about 25k tokens, one shell output about 8k.
export const HANDOFF_ROOM = 60_000;
export const CLOSE_ROOM = 25_000;
