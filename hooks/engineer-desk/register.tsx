import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow, AgentStatus, AgentSteps, DeskUi, Plan, Resume } from './state'
import { heroMarkup, mascotAvatar, planBarMarkup, planCellColors, spinnerMarkup } from './avatar'
import { formatDuration, formatTokens, modelLabel, plural, stepLabel, tokensOf } from './format'
import { applyToPlan, planFromTool, planProgress } from './plan'
import { clockTime, nextResume, NO_RESUME, resumePrompt } from './resume'
import { artOf, faceOf, labelOf, PALETTE, roleOf } from './roles'
import type { Art } from './roles'

const PLUGIN = 'spectree-engineer'
const PANE = 'engineer-desk'
const TITLE = 'Engineer'
// Steps past the last few show only when a card is expanded.
const STEPS_KEPT = 30
const SHOWN_STEPS = 3
// The pane redraws whole every second: a long session's finished cards are
// shown the last few at a time and kept up to a bound.
const SHOWN_FINISHED = 5
const FINISHED_KEPT = 50
const PLAN_TOOLS = ['TaskCreate', 'TaskUpdate', 'TodoWrite']
// The desktop app has no TodoWrite: the Engineer brings its own plan tool.
const PLAN_TOOL = `mcp__${PLUGIN}__plan`
const PLAN_PROMPT =
  `Your to-do list is the ${PLAN_TOOL} tool; the user watches it as a progress bar in the Engineer panel. ` +
  'For any task that needs 2 or more steps or tool calls, call it first, before other tools, with a short title and every step in order, the first one in_progress. ' +
  'Call it again with the full list each time a step finishes or a new one starts, and mark the last step completed before your final answer. ' +
  'A step that dispatches subagents is one step. Skip it only for a one-line answer with no tool calls.'

// Change a tag when the stored shape changes: an earlier value is then read
// as the initial one instead of breaking the drawing.
const agents = atom({ plugin: 'spectree-engineer', key: 'agents' } as const, {}, { shape: 'agents-1' })
const NO_STEPS: AgentSteps = { count: 0, labels: [] }
const ui = atom(
  { plugin: 'spectree-engineer', key: 'ui' } as const,
  { isRunningCollapsed: false, isFinishedCollapsed: false, isFinishedWhole: false, expanded: [], isAutoOpened: false },
  { shape: 'ui-1' },
)
const plan = atom({ plugin: 'spectree-engineer', key: 'plan' } as const, { tasks: [] }, { shape: 'plan-1' })
const now = atom({ plugin: 'spectree-engineer', key: 'now' } as const, 0)
const resume = atom({ plugin: 'spectree-engineer', key: 'resume' } as const, NO_RESUME, { shape: 'resume-1' })

type Agents = Record<string, AgentRow>

// Set once the plan tool is registered; the prompt names it only then.
let hasPlanTool = false

const isRunning = (row: AgentRow) => row.status === 'running'

// A reload starts the module over; the next event that needs the clock
// starts it again. It ticks once a second for the running cards' durations,
// and only while one runs: each tick redraws the whole pane.
let tick: { cancel: () => void } | null = null

// The last effort recorded per subagent, so a request that repeats it reads nothing.
const efforts = new Map<string, string>()

async function syncClock($: EngineInterface, list: Agents) {
  const at = await $.clock.now()
  await update($, now, () => at)
  const running = Object.values(list).filter(isRunning).length
  if (running > 0 && !tick) tick = $.clock.every(1000, () => void $.clock.now().then(t => update($, now, () => t)))
  if (running === 0 && tick) {
    tick.cancel()
    tick = null
  }
  $.ui.status(running > 0 ? `Engineer orchestrating ${plural(running, 'subagent', 'subagents')}` : undefined)
}

async function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: TITLE })
}

// Opened unasked once a session, and only where a pane is a sidebar: the
// desktop and the editor. After the person hides it, /engineer-desk brings it back.
async function openWhereSidebar($: EngineInterface) {
  if ((await read($, ui)).isAutoOpened) return
  const surfaces = await $.session.surfaces()
  if (!surfaces.some(one => one === 'desktop' || one === 'vscode')) return
  const opened = await openPane($)
  if (opened.isPlaced) await update($, ui, v => ({ ...v, isAutoOpened: true }))
}

// A project the Engineer bootstrapped or is running: its skills config, or a roadmap.
async function isEngineerProject($: EngineInterface, cwd: string) {
  return (await $.fs.exists(`${cwd}/skills.config.json`)) || (await $.fs.exists(`${cwd}/docs/roadmap.md`))
}

async function recordSpawn($: EngineInterface, id: string, description: string, type: string, model: string) {
  const at = await $.clock.now()
  const list = await update($, agents, all => {
    const known = all[id]
    const row: AgentRow = known
      ? { ...known, status: 'running', endedAt: null, model }
      : { id, description: description || labelOf(type), type, model, status: 'running', startedAt: at, endedAt: null, tokens: 0 }
    return { ...all, [id]: row }
  })
  await syncClock($, list)
  if (roleOf(type)) await openWhereSidebar($)
}

// A step writes its own subagent's steps and nothing else, whatever the session has done.
async function recordStep($: EngineInterface, id: string, label: string) {
  const steps = await update($, { plugin: 'spectree-engineer', key: 'steps', id } as const, (steps = NO_STEPS) => ({
    count: steps.count + 1,
    labels: [...steps.labels, label].slice(-STEPS_KEPT),
  }))
  return steps.count
}

async function recordEffort($: EngineInterface, id: string, effort: string) {
  if (efforts.get(id) === effort) return
  const row = (await read($, agents))[id]
  // A step that comes before its spawn is recorded has no row yet: the next one tries again.
  if (!row) return
  if (row.effort !== effort) await update($, agents, all => (all[id] ? { ...all, [id]: { ...all[id], effort } } : all))
  efforts.set(id, effort)
}

async function recordEnd($: EngineInterface, id: string, status: AgentStatus, tokens: number) {
  const at = await $.clock.now()
  let gone: string[] = []
  const list = await update($, agents, all => {
    const row = all[id]
    if (!row) return all
    const next = { ...all, [id]: { ...row, status, endedAt: at, tokens: row.tokens + tokens } }
    // The first to end go first, a card that just ended never.
    const finished = Object.values(next)
      .filter(one => !isRunning(one))
      .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0) || a.startedAt - b.startedAt)
    gone = finished.slice(0, Math.max(0, finished.length - FINISHED_KEPT)).map(one => one.id)
    for (const one of gone) delete next[one]
    return next
  })
  // A card that left takes its steps and its open toggle along.
  for (const one of gone) {
    await update($, { plugin: 'spectree-engineer', key: 'steps', id: one } as const, () => NO_STEPS)
    efforts.delete(one)
  }
  if (gone.length > 0) {
    await update($, ui, v => (v.expanded.every(one => one in list) ? v : { ...v, expanded: v.expanded.filter(one => one in list) }))
  }
  await syncClock($, list)
}

// Neighbouring cells of one colour drawn as one text.
function runs(colors: string[]): [string, number][] {
  const out: [string, number][] = []
  for (const color of colors) {
    const last = out[out.length - 1]
    if (last && last[0] === color) last[1] += 1
    else out.push([color, 1])
  }
  return out
}

// The plan on the terminal, where nothing is drawn as a vector: a row of
// blocks from Depth to Spirit, the task under way shimmering once a second
// while the clock runs, and a light track for the rest.
function planBlocks(Text: any, progress: ReturnType<typeof planProgress>, cells: number, at: number) {
  const filled = progress.total === 0 ? 0 : Math.round((cells * progress.done) / progress.total)
  const live = progress.isLive ? Math.max(0, Math.round((cells * Math.min(progress.total, progress.done + 1)) / progress.total) - filled) : 0
  return (
    <Text>
      {runs(planCellColors(filled)).map(([color, count]) => (
        <Text color={color}>{'█'.repeat(count)}</Text>
      ))}
      {live > 0 && <Text color={Math.floor(at / 1000) % 2 ? PALETTE.spirit : PALETTE.depth}>{'▓'.repeat(live)}</Text>}
      <Text dimColor>{'░'.repeat(Math.max(0, cells - filled - live))}</Text>
    </Text>
  )
}

// A plan shows above the terminal's prompt until it is done and the person has written again.
const isBandPlan = (current: Plan) =>
  current.tasks.length > 0 && !(current.isSettled && current.tasks.every(one => one.status === 'completed'))

// The Founder's floor: no subagent of his runs under Opus (2026-11-11; it was Sonnet from 2026-11-01).
// Every role's card declares Opus, and the Engineer raises a goal to Fable only from its third
// verification round on. A spawn that names Haiku or Sonnet is raised; so is one of a harness agent
// that would pick Haiku on its own, since a hook sees no agent definition, only the call.
// shortcut: the harness agents known to default to Haiku are listed by name; add one when the panel shows Haiku on it.
const HAIKU_BY_DEFAULT = ['web-fetch', 'Explore', 'claude-code-guide', 'statusline-setup']
const FLOOR = 'opus'
const isBelowFloor = (model: string | undefined) => /haiku|sonnet/i.test(model ?? '')

export function modelFloor(subagentType: string, model: string | undefined): string | undefined {
  if (isBelowFloor(model)) return FLOOR
  if (model === undefined && HAIKU_BY_DEFAULT.includes(subagentType)) return FLOOR
  return model
}

// The Founder's second guard (2026-11-05): a heredoc or a pipe into an interpreter's stdin
// (`python - <<EOF`, `node -`) hangs on Windows, where Git Bash resolves `python` to the Store
// stub that waits on stdin for ever, and leaves a process nobody can kill holding a worktree.
// The script goes to a file with the Write tool and runs from there. `node -e "..."`, `python
// file.py` and `python -I file.py` are not stdin and pass, and so does `cat > fix.py <<EOF`: the name
// of a file is not the interpreter (the lookbehind refuses a `.`, `/`, `-` or word character before it).
// At command position only (the start of a line, or after ; & | or an opening parenthesis, with any VAR=value in
// front): `grep "python -" notes.md` and a commit message that says "node - " are text, not a command.
const AT_COMMAND = String.raw`(?:^|[;&|(])[ \t]*(?:[A-Za-z_]\w*=\S*[ \t]+)*`
// `python -`, `python - notes.txt`, `node - <<EOF`, `node <<EOF`: the script comes from stdin.
const STDIN_INTERPRETER = new RegExp(AT_COMMAND + String.raw`(?:python3?|py|node)\b[^\n|;&]*?(?:\s-(?=\s|$|[|;&)<])|\s<<)`, 'm')
// A bare interpreter opens a prompt that waits on stdin (the pilot project, 2026-11-11: five subagents did it). A pipe in front
// of it feeds it, so `echo 1 | node` passes.
const BARE_INTERPRETER = new RegExp(String.raw`(?:^|[;&(]|\|\|)[ \t]*(?:[A-Za-z_]\w*=\S*[ \t]+)*(?:python3?|py|node)[ \t]*(?:$|[;&)])`, 'm')
export const stdinInterpreter = (command: string) => STDIN_INTERPRETER.test(command) || BARE_INTERPRETER.test(command)
const STDIN_DENY =
  'A heredoc or pipe into an interpreter hangs on Windows (the python Store stub waits on stdin) and leaves a process nobody can kill. ' +
  'Write the script to a file with the Write tool and run it from there.'

// The stash list belongs to the repository, not to a worktree: a subagent's `git stash pop` applied another
// branch's stash over four files (the pilot project, 2026-11-11). Reading the list is harmless.
// `stash` as the git subcommand, after any global option (-C <dir>, -c <k=v>, --no-pager): a commit message that says
// stash is not one.
const GIT_STASH = /(?:^|[;&|(])[ \t]*git(?:[ \t]+(?:-[Cc][ \t]+\S+|--?[\w-]+(?:=\S+)?))*[ \t]+stash\b(?![ \t]+(?:list|show)\b)/m
export const sharedStash = (command: string) => GIT_STASH.test(command)
const STASH_DENY =
  'The stash list is shared by every worktree of the repository: a pop here can apply the work of another branch. ' +
  'Commit to your own branch instead (a wip commit you amend later).'

// The fourth guard (2026-11-12): a long mission costs more per call, because every call re-reads the whole context.
// On the pilot project's ci-time goal a full-stack-developer's call cost 98 thousand tokens in missions of up to 60 calls and 162
// thousand in missions past 110, and six long missions were 76% of its tokens. A sentence in the card did not change
// how the agents work, so the panel says it once, at the call where the cost turns: that call is refused, with the
// way out, and passes when repeated.
// 0.52.0 moved the point from 60 to 90. Measured on the pilot project's data-import-2 (2026-11-24): two of three
// tickets were handed off at call 60, one before it had run anything; the missions cut at 60 cost 118 and 123
// thousand tokens a turn, and the two that went on to 89 turns cost 100 and 140. The panel does not see a mission's
// context size while it runs, so the point is still a count of calls.
export const HANDOFF_AT = 90
const HANDOFF_NOTICE =
  `Handoff point: this is tool call ${HANDOFF_AT} of this mission, and every further call re-reads your whole context. ` +
  'If what is left fits in 15 calls, finish it. Otherwise close what is in hand: commit, write `Next needs:` with what is left and what you learned (in your ticket, or in your report when the mission has no ticket), ' +
  'stop what you started, and report `handoff`. Another full-stack-developer continues from there in a fresh context. ' +
  'This call was not run: repeat it if you still need it.'
export const isHandoffPoint = (type: string, count: number) => count === HANDOFF_AT && /(?:^|:)full-stack-developer$/.test(type)

// The Founder's third guard (2026-11-10): the squad is goal driven, and the goal contract belongs to the
// Engineer, the main loop that talks to the Founder. A subagent neither calls the `to-goal` skill nor
// writes under docs/goals/: the full-stack-developer builds from the contract and the verifiers judge against
// it, so neither may move the criteria or fill in the evidence.
const GOAL_SKILL = /(?:^|:)to-goal$/
const GOAL_CONTRACT = /(?:^|[\\/])docs[\\/]goals[\\/][^\\/]+\.md$/
export const goalContractGuard = (tool: string, input: Record<string, unknown>): string | null => {
  if (tool === 'Skill' && GOAL_SKILL.test(String(input.skill ?? ''))) {
    return "The goal contract is the Engineer's: only the main loop calls to-goal. Read docs/goals/<slug>.md and carry on with your mission."
  }
  if ((tool === 'Write' || tool === 'Edit') && GOAL_CONTRACT.test(String(input.file_path ?? ''))) {
    return "The goal contract is the Engineer's: a subagent reads docs/goals/ and never writes it. Put your evidence in your report; the Engineer records the verdicts."
  }
  return null
}

// The mirror of the guard above (0.40.0): the Engineer writes the contract, never code. Measured on the pilot
// project on 2026-11-15: the Engineer took 64% of a goal's first hour of tokens writing a 306-line proof script in
// .scratch/, running it red at the baseline and trying it on an implementation of its own in a throwaway worktree;
// the branch was cut 41 minutes in. A proof that does not exist yet is a ticket of the plan, a full-stack-developer's.
// Only in an Engineer project, and only the main loop: a subagent that builds writes code.
const CODE_FILE = /\.(?:[cm]?[jt]sx?|py|sh|ps1|sql|prisma)$/i
export const ENGINEER_CODE_DENY =
  'The Engineer writes the contract, never code: a proof the contract names that does not exist yet (a test, a script, a checker) is a ticket of the plan, and a fix or a tryout is a full-stack-developer mission. Dispatch it.'
export const engineerCodeGuard = (tool: string, input: Record<string, unknown>): string | null =>
  ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool) && CODE_FILE.test(String(input.file_path ?? input.notebook_path ?? '')) ? ENGINEER_CODE_DENY : null

// The panel only watches, except for the guards above: a failure in its
// bookkeeping is logged and never stops a spawn, a tool call or a turn.
function logFailure($: EngineInterface, error: unknown) {
  $.ui.log(`engineer-desk: ${error instanceof Error ? error.message : String(error)}`)
}

// The stored time is checked every half minute rather than waited for once: a machine that slept wakes
// past it, and a reload keeps the time and loses the timer.
const RESUME_TICK_MS = 30_000
let resumeTick: { cancel: () => void } | null = null
// A resume never follows a main turn that is alive: its own end decides.
let isMainTurnRunning = false

function watchResume($: EngineInterface) {
  if (!resumeTick) resumeTick = $.clock.every(RESUME_TICK_MS, () => void fireResume($).catch(error => logFailure($, error)))
}

function unwatchResume() {
  resumeTick?.cancel()
  resumeTick = null
}

// An answer, an interruption or the Founder's own words: whatever stopped the session is no longer the panel's to mend.
async function clearResume($: EngineInterface) {
  unwatchResume()
  const current = await read($, resume)
  if (current.at !== null || current.attempts > 0) await update($, resume, () => NO_RESUME)
}

// Work under way in an Engineer project: a plan with a step left. Anything else stays stopped.
async function hasWorkUnderWay($: EngineInterface) {
  const current = await read($, plan)
  if (!current.tasks.some(one => one.status !== 'completed')) return false
  return isEngineerProject($, await $.session.cwd())
}

async function scheduleResume($: EngineInterface) {
  if (!(await hasWorkUnderWay($))) return
  const at = await $.clock.now()
  const limits = await $.session.usage().then(
    usage => usage.rateLimits,
    () => [],
  )
  const current = await read($, resume)
  const planned = nextResume(at, current.attempts, limits)
  if (!planned) {
    unwatchResume()
    // The tries stay spent until an answer or the Founder clears them.
    await update($, resume, v => ({ ...v, at: null }))
    $.ui.log(`engineer-desk: the session is still stopped after ${current.attempts} resume attempts; type "continue" to go on`)
    return
  }
  await update($, resume, () => planned)
  watchResume($)
  $.ui.log(`engineer-desk: session stopped by ${planned.why === 'limit' ? 'the usage limit' : 'an API error'}; the panel resumes it at ${clockTime(planned.at as number)}`)
}

async function fireResume($: EngineInterface) {
  const current: Resume = await read($, resume)
  if (current.at === null) return unwatchResume()
  if ((await $.clock.now()) < current.at) return
  unwatchResume()
  await update($, resume, v => ({ ...v, at: null }))
  if (isMainTurnRunning || !(await hasWorkUnderWay($))) return
  const sent = await $.prompt.submit({ text: resumePrompt(current.why) })
  // The engine refuses a prompt while the host's limit stands: that is one more try spent.
  if (sent.drop !== undefined) await scheduleResume($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'engineer-desk',
      description: 'Opens the Engineer panel: the plan under way and the subagents',
    })
    await $.tool.register({
      name: 'plan',
      description:
        'Save the plan for the job in front of you: a short title and the steps in order, each pending, in_progress or completed. ' +
        'It draws the progress bar of the Engineer panel. Send the whole list every time.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A short name for the job, a few words.' },
          steps: {
            type: 'array',
            description: 'Every step, in order.',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'The step in a few plain words.' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
              },
              required: ['text', 'status'],
            },
          },
        },
        required: ['steps'],
      },
      // In the prompt's tool list: a tool behind ToolSearch never gets called.
      isDeferred: false,
    })
      .then(() => {
        hasPlanTool = true
      })
      .catch(error => logFailure($, error))
    // The clock starts here only in an Engineer project; elsewhere the first
    // dispatch starts it, so a session that never orchestrates pays nothing.
    if (await isEngineerProject($, e.cwd)) {
      await syncClock($, await read($, agents))
      await openWhereSidebar($)
    } else {
      const at = await $.clock.now()
      await update($, now, () => at)
    }
    // A reload or a restart keeps a resume that was waiting.
    if ((await read($, resume)).at !== null) watchResume($)

    return next(e)
  })

  on('turn.start', ($, e, next) => {
    if (!e.agentId) isMainTurnRunning = true
    return next(e)
  })

  on('command.run', { command: 'engineer-desk' }, async $ => {
    const opened = await openPane($)
    return { text: opened.isPlaced ? 'Engineer panel opened.' : `Engineer panel could not open: ${opened.reason ?? 'no surface'}` }
  })

  on('agent.spawn', async ($, e, next) => {
    const model = modelFloor(e.subagentType, e.model)
    const started = await next(model === e.model ? e : { ...e, model })
    const id = started.agentId
    if (!id) return started
    // A session that forces one model on every subagent outranks the floor: say so, once per spawn.
    if (isBelowFloor(started.model)) $.ui.log(`engineer-desk: ${e.subagentType} started on ${started.model} despite the Opus floor`)

    await recordSpawn($, id, e.description, e.subagentType, started.model).catch(error => logFailure($, error))

    return started
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    const shell = e.tool === 'Bash' ? String((e as unknown as { command?: unknown }).command ?? '') : ''
    if (shell && stdinInterpreter(shell)) return { deny: STDIN_DENY }
    if (id && shell && sharedStash(shell)) return { deny: STASH_DENY }
    const contractDeny = id ? goalContractGuard(String(e.tool), e as unknown as Record<string, unknown>) : null
    if (contractDeny) return { deny: contractDeny }
    if (!id && engineerCodeGuard(String(e.tool), e as unknown as Record<string, unknown>)) {
      const isProject = await $.session
        .cwd()
        .then(cwd => isEngineerProject($, cwd))
        .catch(error => {
          logFailure($, error)
          return false
        })
      if (isProject) return { deny: ENGINEER_CODE_DENY }
    }
    if (e.tool === PLAN_TOOL) {
      if (id) return { deny: 'Only the main loop keeps a plan. Carry on with your task.' }
      const input = (key: string) => (e as unknown as Record<string, unknown>)[key]
      let said = 'Plan not saved: something went wrong. Carry on.'
      await update($, plan, current => {
        const taken = planFromTool(current, input)
        said = taken.said
        return taken.plan
      }).catch(error => logFailure($, error))
      return { result: said }
    }
    // An observer: whatever happens to the bookkeeping, the call goes on.
    if (id) {
      const count = await recordStep($, id, stepLabel(String(e.tool), e as unknown as Record<string, unknown>)).catch(error => {
        logFailure($, error)
        return 0
      })
      if (count === HANDOFF_AT && isHandoffPoint((await read($, agents))[id]?.type ?? '', count)) return { deny: HANDOFF_NOTICE }
    }

    const answered = await next(e)
    // The plan bar follows the main loop's own task list; a subagent's is its own.
    if (!id && answered.result !== undefined && !answered.isError && PLAN_TOOLS.includes(String(e.tool))) {
      const input = (key: string) => (e as unknown as Record<string, unknown>)[key]
      await update($, plan, current => applyToPlan(current, String(e.tool), input, answered.result)).catch(error => logFailure($, error))
    }
    return answered
  })

  // The plan tool's instruction, for the main loop only.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    // No tool, no instruction: the model would open every task with a call that fails.
    if (!hasPlanTool || e.traits.includes('teammate') || e.traits.includes('bare')) return composed
    return { sections: [...composed.sections, { id: `${PLUGIN}:plan`, text: PLAN_PROMPT, scope: 'session' as const }] }
  })

  // A subagent's effort is known only from its requests: the card shows the last one's.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId && e.effort !== undefined) await recordEffort($, e.agentId, String(e.effort)).catch(error => logFailure($, error))
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    if (id) {
      const status: AgentStatus = e.reason === 'answer' ? 'completed' : e.reason === 'aborted' ? 'killed' : 'failed'
      await recordEnd($, id, status, tokensOf(e.usage)).catch(error => logFailure($, error))
      // A background agent that died while the main loop was idle: its notice may never start a turn.
      if (e.reason === 'error' && !isMainTurnRunning) await scheduleResume($).catch(error => logFailure($, error))
    } else {
      isMainTurnRunning = false
      // Only a turn the API killed is resumed. An answer may be a question to the Founder, and an interruption is his.
      await (e.reason === 'error' ? scheduleResume($) : clearResume($)).catch(error => logFailure($, error))
    }

    return next(e)
  })

  // A plan done stays above the prompt for the turn that finished it, until the person writes again:
  // a notification, a trigger or a dropped prompt leaves it there.
  on('prompt.submit', async ($, e, next) => {
    // The Founder is back, at the prompt or from his phone: the session is his again.
    if ((e.origin.kind === 'composer' || e.origin.kind === 'bridge') && !e.isMeta) await clearResume($).catch(error => logFailure($, error))
    const entered = await next(e)
    if (e.origin.kind !== 'composer' || e.isMeta || entered.drop !== undefined) return entered
    await update($, plan, current =>
      current.tasks.length > 0 && !current.isSettled && current.tasks.every(one => one.status === 'completed')
        ? { ...current, isSettled: true }
        : current,
    ).catch(error => logFailure($, error))
    return entered
  })

  // The terminal has no sidebar: the plan bar sits above the prompt, under any other plugin's band.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey) return next(e)
    const current = await read($, plan)
    if (!isBandPlan(current)) return next(e)
    const drawn = await next(e)
    const rest = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null
    const { Box, Text } = $.ui.resolve(e)
    const progress = planProgress(current)
    // Only a task under way shimmers, so only then does the band follow the clock.
    const at = progress.isLive ? (await read($, now)) || Date.now() : 0
    const label = `Tasks ${progress.done}/${progress.total}`
    const percent = `${progress.percent}%`
    const columns = e.props.bodyColumns > 0 ? Math.floor(e.props.bodyColumns) : 80
    const titleWidth = Math.max(6, Math.min(28, progress.title.length, Math.floor(columns / 3)))
    // Gaps between the five parts, and the dot.
    const cells = Math.max(6, columns - titleWidth - label.length - percent.length - 6)
    return (
      <Box flexDirection="column">
        {rest as never}
        <Box flexDirection="row" gap={1}>
          <Text color={PALETTE.spirit}>●</Text>
          <Box width={titleWidth} flexShrink={0}>
            <Text weight="semibold" wrap="truncate-end">
              {progress.title}
            </Text>
          </Box>
          {planBlocks(Text, progress, cells, at)}
          <Text weight="semibold">{label}</Text>
          <Text dimColor tabular>
            {percent}
          </Text>
        </Box>
        <Text dimColor wrap="truncate-end">
          {progress.now}
        </Text>
      </Box>
    )
  }).catch(($, e, next) => {
    // A band that fails to draw leaves the prompt as it was.
    logFailure($, `band failed (${next.error.kind}${next.error.message ? `: ${next.error.message}` : ''})`)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Svg = 'Svg' in els ? els.Svg : null

    const list = Object.values(await read($, agents)).sort((a, b) => a.startedAt - b.startedAt)
    const view: DeskUi = await read($, ui)
    const progress = planProgress(await read($, plan))
    const at = (await read($, now)) || Date.now()

    const running = list.filter(isRunning)
    // The last to end on top.
    const finished = list.filter(row => !isRunning(row)).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0) || b.startedAt - a.startedAt)
    const isOrchestrating = running.length > 0
    // The specialist last dispatched takes the centre. Alone, the Engineer itself works through a
    // live plan; idle, the mascot smiles over a plan done, looks alert after a failure, else rests.
    const latest = running.reduce<AgentRow | null>((last, row) => (!last || row.startedAt >= last.startedAt ? row : last), null)
    const lastEnded = finished[0]
    const hero: Art = latest
      ? artOf(latest.type)
      : progress.total > 0 && progress.done === progress.total
        ? 'happy'
        : lastEnded && lastEnded.status !== 'completed'
          ? 'alert'
          : progress.isLive
            ? 'engineer'
            : 'mascot'
    const heroAlt = latest
      ? labelOf(latest.type)
      : hero === 'engineer'
        ? 'Engineer working'
        : hero === 'alert'
          ? 'Engineer on alert'
          : 'Engineer at rest'
    const shownFinished = view.isFinishedWhole ? finished.length : SHOWN_FINISHED
    // Only the cards on screen read their steps.
    const shown = [...(view.isRunningCollapsed ? [] : running), ...(view.isFinishedCollapsed ? [] : finished.slice(0, shownFinished))]
    const stepsBy = new Map(
      await Promise.all(shown.map(async row => [row.id, (await read($, { plugin: 'spectree-engineer', key: 'steps', id: row.id } as const)) ?? NO_STEPS] as const)),
    )

    const toggle = (field: 'isRunningCollapsed' | 'isFinishedCollapsed' | 'isFinishedWhole') => () =>
      update($, ui, v => ({ ...v, [field]: !v[field] }))
    const toggleSteps = (id: string) => () =>
      update($, ui, v => ({
        ...v,
        expanded: v.expanded.includes(id) ? v.expanded.filter(one => one !== id) : [...v.expanded, id],
      }))

    // Terminal: no vector drawing, so the mascot is its two eyes, open while a specialist works.
    const glyphMascot = () => <Text color={PALETTE.spirit}>{isOrchestrating ? '◉ ◉' : '● ●'}</Text>

    // The plan in progress, in place of the cost, token and time figures.
    const planBar = () =>
      progress.total === 0 ? (
        <Text dimColor>No plan under way.</Text>
      ) : (
        // Clean: no frame around the plan, the title in the text colour; the bar alone carries the colour.
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1} alignItems="center">
            <Box flexShrink={1} minWidth={0}>
              <Text weight="semibold" wrap="truncate-end">
                {progress.title}
              </Text>
            </Box>
            <Box flexGrow={1} flexShrink={1} minWidth={0}>
              {Svg ? (
                <Svg
                  source={planBarMarkup(progress.done, progress.total, progress.isLive)}
                  alt={`Tasks ${progress.done} of ${progress.total}`}
                  height={14}
                  isInteractive={progress.done < progress.total}
                />
              ) : (
                planBlocks(Text, progress, 12, at)
              )}
            </Box>
            <Box flexShrink={0}>
              <Text dimColor tabular>
                {`Tasks ${progress.done}/${progress.total} · ${progress.percent}%`}
              </Text>
            </Box>
          </Box>
          <Text dimColor wrap="truncate-end">
            {progress.now}
          </Text>
        </Box>
      )

    const card = (row: AgentRow) => {
      const color = PALETTE.spirit
      const isOpen = view.expanded.includes(row.id)
      // A running card heads with the step under way; the list holds the ones before it.
      const { count, labels } = stepsBy.get(row.id) ?? NO_STEPS
      const done = row.status === 'running' ? labels.slice(0, -1) : labels
      const steps = isOpen ? done : done.slice(-SHOWN_STEPS)
      const current = labels[labels.length - 1]
      const elapsed = (row.endedAt ?? at) - row.startedAt
      // A frame per drawing is only for what moves: a finished card's avatar is an image.
      const isMoving = row.status === 'running'
      const headline =
        row.status === 'running'
          ? current
            ? `Step ${count} · ${current}`
            : 'Dispatching…'
          : row.status === 'completed'
            ? `Done · ${plural(count, 'step', 'steps')}`
            : row.status === 'killed'
              ? `Interrupted · ${plural(count, 'step', 'steps')}`
              : `Failed · ${plural(count, 'step', 'steps')}`
      const headColor = row.status === 'completed' ? 'success' : row.status === 'running' ? color : 'error'

      return (
        // Clean: every card is framed in the dim text colour; the mascot's face says how it goes.
        <Box flexDirection="row" borderStyle="round" borderColor="inactive" paddingX={1} gap={1} overflow="hidden">
          <Box flexDirection="column" justifyContent="center" flexShrink={0}>
            {Svg ? (
              <Svg source={mascotAvatar(row.status, faceOf(row.type))} alt={labelOf(row.type)} width={40} height={40} isInteractive={isMoving} />
            ) : (
              <Text color={color}>◉</Text>
            )}
          </Box>
          <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            <Box flexDirection="row" justifyContent="space-between" gap={1}>
              <Box flexShrink={1} minWidth={0}>
                <Text weight="semibold" wrap="truncate-end">
                  {row.description}
                </Text>
              </Box>
              <Box flexShrink={0}>
                <Text color={headColor}>{row.status === 'completed' ? '✓' : row.status === 'running' ? '…' : '✗'}</Text>
              </Box>
            </Box>
            <Box flexDirection="row" justifyContent="space-between" gap={1}>
              <Box flexShrink={1} minWidth={0}>
                <Text dimColor wrap="truncate-end">
                  {[row.type, row.model && modelLabel(row.model), row.effort].filter(Boolean).join(' · ')}
                </Text>
              </Box>
              <Box flexShrink={0}>
                <Text dimColor tabular>
                  {formatTokens(row.tokens)} tokens · {formatDuration(elapsed)}
                </Text>
              </Box>
            </Box>
            {row.status === 'running' ? (
              <Box flexDirection="row" gap={1} alignItems="center">
                <Box flexShrink={0}>
                  {Svg ? <Svg source={spinnerMarkup()} alt="In progress" width={16} height={16} isInteractive /> : <Text color={color}>◐</Text>}
                </Box>
                <Box flexShrink={1} minWidth={0}>
                  <Text color={headColor} weight="semibold" wrap="truncate-end">
                    {headline}
                  </Text>
                </Box>
              </Box>
            ) : (
              <Text color={headColor}>{headline}</Text>
            )}
            {steps.map(step => (
              <Text dimColor wrap="truncate-end">
                {`  ${step}`}
              </Text>
            ))}
            {done.length > SHOWN_STEPS && (
              <Button key={`steps-${row.id}`} plain dimColor onPress={toggleSteps(row.id)}>
                {isOpen ? '▾ Fewer steps' : `▸ ${done.length - SHOWN_STEPS} more steps`}
              </Button>
            )}
          </Box>
        </Box>
      )
    }

    const section = (
      name: string,
      rows: AgentRow[],
      field: 'isRunningCollapsed' | 'isFinishedCollapsed',
      color: string,
      limit = rows.length,
    ) =>
      rows.length > 0 && (
        <Box flexDirection="column" gap={1}>
          <Box backgroundColor={color} paddingX={1}>
            <Button key={field} plain onPress={toggle(field)}>
              <Text color="#ffffff" weight="semibold">
                {view[field] ? '▸' : '▾'} {name} · {rows.length}
              </Text>
            </Button>
          </Box>
          {!view[field] && rows.slice(0, limit).map(card)}
          {!view[field] && rows.length > SHOWN_FINISHED && field === 'isFinishedCollapsed' && (
            <Button key="finished-whole" plain dimColor onPress={toggle('isFinishedWhole')}>
              {view.isFinishedWhole ? `▾ Only the last ${SHOWN_FINISHED}` : `▸ All ${rows.length} finished`}
            </Button>
          )}
        </Box>
      )

    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" justifyContent="flex-end" alignItems="center">
          <Button key="hide" label="Hide" onPress={() => $.ui.close({ id: PANE })} />
        </Box>

        <Box flexDirection="column" alignItems="center">
          {Svg ? <Svg source={heroMarkup(hero)} alt={heroAlt} width={130} height={120} isInteractive /> : glyphMascot()}
          <Text dimColor>{isOrchestrating ? `Dispatching ${running.map(row => labelOf(row.type)).join(', ')}` : heroAlt}</Text>
        </Box>

        {planBar()}

        {list.length === 0 && <Text dimColor>No subagent dispatched yet.</Text>}
        {section('Running', running, 'isRunningCollapsed', PALETTE.depth)}
        {section('Finished', finished, 'isFinishedCollapsed', 'success', shownFinished)}
      </Box>
    )
  }).catch(($, e, next) => {
    // A drawing that failed leaves a pane that says so, never a blank one.
    logFailure($, `drawing failed (${next.error.kind}${next.error.message ? `: ${next.error.message}` : ''})`)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Text weight="semibold">Engineer panel recovering</Text>
        <Text dimColor>The subagents keep running; the panel comes back at the next event.</Text>
      </Box>
    )
  })
}
