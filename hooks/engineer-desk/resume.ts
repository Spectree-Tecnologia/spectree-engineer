import type { Resume } from './state'

// The fifth mechanism (2026-11-13): a session that stopped is restarted by the panel, not by the Founder.
// On the pilot project's ci-time goal 12.4 of 29.8 hours were a stopped session nobody restarted: 5.7 h after the 5-hour
// limit had already reset, overnight, and 6.7 h after one API network error ended the turn. Neither was a
// decision of his. A turn that ends in an answer is never resumed: the Engineer may have asked a question.

// Minutes to wait before each try when no window says when it reopens: about six hours in all, which
// covers a 5-hour window whose reset the engine did not report.
export const BACKOFF_MINUTES = [2, 5, 15, 30, 60, 60, 60, 60, 60]
// Past the reset, so the first request does not race the window.
const AFTER_RESET_MS = 60_000

export const NO_RESUME: Resume = { at: null, attempts: 0, why: null }

type Limit = { kind: string; percentUsed: number; resetsAt?: string }

// When to try again after a turn died, or null once the tries are spent.
export function nextResume(now: number, attempts: number, limits: readonly Limit[]): Resume | null {
  if (attempts >= BACKOFF_MINUTES.length) return null
  const resets = limits
    .filter(one => one.percentUsed >= 100 && one.resetsAt !== undefined)
    .map(one => Date.parse(one.resetsAt as string))
    .filter(at => Number.isFinite(at) && at > now)
  // Every exhausted window has to reopen: the weekly one outlasts the 5-hour one.
  if (resets.length > 0) return { at: Math.max(...resets) + AFTER_RESET_MS, attempts: attempts + 1, why: 'limit' }
  return { at: now + BACKOFF_MINUTES[attempts] * 60_000, attempts: attempts + 1, why: 'error' }
}

export const resumePrompt = (why: Resume['why']) =>
  `The session stopped because of ${why === 'limit' ? "the plan's usage limit" : 'an API error'} and the panel resumed it by itself, without the founder. ` +
  'Continue where it stopped. Before dispatching, re-read the goal contract and the plan in `.scratch/<slug>/`, and check with `git status` and `git log` what the interrupted agents left. ' +
  'An agent that died in the middle of its mission does not come back: dispatch a new one, which resumes from the ticket. ' +
  'If your last step was a question to the founder, repeat the question and stop.'

export const clockTime = (at: number) => {
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
