import type { ModelUsage } from 'claude-code'

import { CLOSE_ROOM, CONTEXT_CEILING, HANDOFF_ROOM } from '../../skills/monolith/config-project/assets/scripts/context-ceiling.mjs'
import { formatTokens } from './format'
import type { AgentContext } from './state'

export { CLOSE_ROOM, CONTEXT_CEILING, HANDOFF_ROOM }

export const NO_CONTEXT: AgentContext = { last: 0, peak: 0, isWarned: false }

// What the next request of a loop will carry at least: the input of the last one as the API reported it (uncached,
// cache-written and cache-read together) and the output it answered, which goes back in.
export function contextOf(usage: ModelUsage | null | undefined): number {
  if (!usage) return 0
  return usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens + usage.output_tokens
}

export function measured(current: AgentContext, tokens: number): AgentContext {
  return tokens > 0 ? { ...current, last: tokens, peak: Math.max(current.peak, tokens) } : current
}

// The calls that close a mission and add little to its context: staging and committing, a write under `.scratch/`
// (the ticket's `Next needs:`, a note), stopping a process the mission started. A chain runs only when every part
// of it is one of these.
const CLOSING_PART = /^\s*(?:git(?:\s+-C\s+\S+)?\s+(?:add|commit|status|rev-parse)\b|taskkill\b|kill\b|cd\s)/
const SCRATCH = /(?:^|[\\/])\.scratch[\\/]/
export function isClosingCall(tool: string, input: Record<string, unknown>): boolean {
  if (tool === 'Bash') {
    const command = String(input.command ?? '')
    return command.trim() !== '' && command.split(/&&|;|\n/).every(part => part.trim() === '' || CLOSING_PART.test(part))
  }
  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') return SCRATCH.test(String(input.file_path ?? ''))
  return false
}

const k = formatTokens

export const handoffNotice = (context: number) =>
  `Context ceiling: your context is ${k(context)} tokens and the squad's ceiling is ${k(CONTEXT_CEILING)}; past it a mission is not trusted to reason well. ` +
  `If what is left is a few short calls (well under ${k(HANDOFF_ROOM - CLOSE_ROOM)} tokens of reading and output), finish it. ` +
  'Otherwise close now: commit `wip`, write in `Next needs:` what is left and every fact you learned that the code does not say (in your ticket, or in your report when the mission has no ticket), ' +
  'stop what you started, and report `handoff`. A new agent continues from there in a fresh context, without exploring again. ' +
  'This call was not run: repeat it if you still need it.'

export const closeNotice = (context: number) =>
  `Context ceiling reached: ${k(context)} of ${k(CONTEXT_CEILING)} tokens. Only the calls that close a mission run now: ` +
  '`git add` and `git commit`, a write under `.scratch/`, stopping a process you started. ' +
  'Commit `wip`, write `Next needs:` and answer with your report, `handoff` and what is left.'

// The decision for a subagent's tool call: the close notice for every call that does not close the mission once
// the context is within CLOSE_ROOM of the ceiling, the handoff notice once at HANDOFF_ROOM, nothing below.
export function ceilingVerdict(current: AgentContext, tool: string, input: Record<string, unknown>): { deny?: string; isWarning?: boolean } {
  if (current.peak >= CONTEXT_CEILING - CLOSE_ROOM) return isClosingCall(tool, input) ? {} : { deny: closeNotice(current.peak) }
  if (current.peak >= CONTEXT_CEILING - HANDOFF_ROOM && !current.isWarned) return { deny: handoffNotice(current.peak), isWarning: true }
  return {}
}
