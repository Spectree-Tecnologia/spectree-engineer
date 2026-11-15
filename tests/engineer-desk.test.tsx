import { expect, mock, test } from 'claude-code/testing'

import { MASCOT_ART } from '../hooks/engineer-desk/mascot-art'

const PANE = {
  plugin: 'spectree-engineer',
  component: 'Pane',
  requestId: 'engineer-desk',
  props: {
    title: 'Engineer',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const BAND = { plugin: 'spectree-engineer', component: 'AbovePrompt', requestId: 'above-prompt', props: { bodyColumns: 80 } } as const

const PLAN_TOOL = 'mcp__spectree-engineer__plan'

// The kit's find ignores `alt`: the Svg is picked out of all of them by its alt.
async function svgSource(ui: any, alt: string): Promise<string> {
  const svgs = (await ui.findAll({ type: 'Svg' })) as any[]
  return String(svgs.find(one => one?.props?.alt === alt)?.props?.source ?? '')
}

// The smiling mood of the mascot, as a card draws it: its first polygon picks it out.
const happyFace = (MASCOT_ART.face_happy.match(/<path [^>]+>/) ?? [''])[0]
const happyHero = (MASCOT_ART.happy.match(/<path [^>]+>/) ?? [''])[0]

const ENGINE = { plugin: 'engine', tier: 'core' } as const

async function spawn($: any, agentId: string, subagentType: string, description: string) {
  return $.agent.spawn({
    tool_use_id: `tu-${agentId}`,
    prompt: 'mission',
    description,
    subagentType,
    provider: ENGINE,
    parentModel: 'model',
    background: false,
    fork: false,
  })
}

function engine(on: any, agentId: string, model = 'model') {
  const clock = mock.clock(on, { now: 1_000_000 })
  // Each spawn answers the agent id its tool_use_id names (`tu-<id>`), the first one by default,
  // on the model the call named, else the engine's: Haiku for the harness's web-fetch, the test's otherwise.
  on('agent.spawn', (_: unknown, e: any) => ({
    model: e.model ?? (e.subagentType === 'web-fetch' ? 'claude-haiku-5-5' : model),
    agentId: String(e.tool_use_id ?? '').replace(/^tu-/, '') || agentId,
  }))
  // A TaskCreate answers the id of the task it made, numbered from 1.
  let created = 0
  on('tool.call', (_: unknown, e: any) => ({ result: e.tool === 'TaskCreate' ? { task: { id: String(++created), subject: e.subject } } : {} }))
  on('turn.complete', (_: unknown, e: any) => ({ text: e.answer }))
  on('prompt.submit', (_: unknown, e: any) => e)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: {} }))
  on('session.surfaces', () => ({ value: ['terminal'] }))
  // What the engine draws above the prompt when no plugin draws there.
  on('ui.render', ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return clock
}

const steps = (done: number, total = 4) =>
  Array.from({ length: total }, (_, i) => ({ text: `Step ${i + 1}`, status: i < done ? 'completed' : i === done ? 'in_progress' : 'pending' }))

test('a finished subagent is a card with its role, steps, tokens and status', async ($, on) => {
  engine(on, 'a1')
  await spawn($, 'a1', 'spectree-engineer:quality-engineer', 'QE review of identity')
  await $.tool.call({ tool: 'Bash', command: 'npm test', agentId: 'a1' } as any)
  await $.tool.call({ tool: 'Read', file_path: '/repo/docs/specs/account/spec.md', agentId: 'a1' } as any)
  await $.turn.complete({
    answer: 'done',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
    agentId: 'a1',
    reason: 'answer',
    usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 6_000_000, cache_creation_input_tokens: 200_000, model: 'm' },
  } as any)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Done · 2 steps/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^spectree-engineer:quality-engineer · model$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /6\.2M tokens/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Running: npm test/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Using Read: \/repo\/docs\/specs/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Engineer at rest/ })).toBeDefined()
    if (surface !== 'terminal') {
      // The card's avatar is the mascot's smiling visor once done, round, and still: no frame.
      const svgs = (await (ui as any).findAll({ type: 'Svg' })) as any[]
      const avatar = svgs.find(one => one?.props?.alt === 'Quality Engineer')
      const source = String(avatar?.props?.source ?? '')
      expect(source).toContain('viewBox="0 0 48 48"')
      expect(source).toContain(happyFace)
      expect(source).toContain('<clipPath id="round">')
      expect(source).not.toContain('@keyframes')
      expect(avatar?.props?.isInteractive).toBe(false)
      expect(source).not.toContain('<image')
      // Idle with no plan, the centre is the mascot itself, inside its ring.
      const hero = String(svgs.find(one => one?.props?.alt === 'Engineer at rest')?.props?.source ?? '')
      expect(hero).toContain('viewBox="0 0 341 341"')
      expect(hero).toContain('<ellipse')
      expect(hero.length).toBeLessThanOrEqual(131072)
    }
    await ui.unmount()
  }
})

test("the specialist at work takes the mascot's place, the last one dispatched in front", async ($, on) => {
  const clock = engine(on, 'p1')
  await spawn($, 'p1', 'spectree-engineer:platform-engineer', 'PE: merge PR 4')

  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const platform = String(((await (ui as any).findAll({ type: 'Svg' })) as any[]).find(one => one?.props?.alt === 'Platform Engineer' && one?.props?.width === 130)?.props?.source ?? '')
  expect(await ui.find({ type: 'Text', text: /Dispatching Platform Engineer/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Running · 1/ })).toBeDefined()
  // One drawing, floating in the glow; a specialist wears no ring; still on reduced motion.
  expect(platform).toContain('@keyframes fl')
  expect(platform).toContain('#8fc3ff')
  expect(platform).not.toContain('<ellipse')
  expect(platform).toContain('.fl,.rg{animation:none}')
  // Nothing blurred or glowed over the drawing: it is shown as traced.
  expect(platform).not.toContain('feGaussianBlur stdDeviation="0')
  expect(platform).not.toContain('<use href="#hero"')
  // The desktop app strips an <image> from an Svg: every picture in it is traced polygons.
  expect(platform).not.toContain('<image')
  expect(platform.length).toBeLessThanOrEqual(131072)
  await ui.unmount()

  await clock.advance(1000)
  await spawn($, 'a1', 'spectree-engineer:solutions-architect', 'Architect: map')
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const hero = ((await (ui as any).findAll({ type: 'Svg' })) as any[]).find(one => one?.props?.width === 130)
  expect(hero?.props?.alt).toBe('Solutions Architect')
  expect(hero?.props?.height).toBe(120)
  expect(String(hero?.props?.source ?? '')).not.toBe(platform)
  expect(await ui.find({ type: 'Text', text: /Dispatching Platform Engineer, Solutions Architect/ })).toBeDefined()
  await ui.unmount()
})

test('alone with a live plan the Engineer itself is at the centre; a failure leaves the mascot alert', async ($, on) => {
  engine(on, 'd1')
  await $.tool.call({ tool: PLAN_TOOL, title: 'Identity', steps: steps(1) } as any)
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Engineer working$/ })).toBeDefined()
  expect((await svgSource(ui, 'Engineer working')).length).toBeGreaterThan(10_000)
  await ui.unmount()

  await spawn($, 'd1', 'spectree-engineer:full-stack-developer', 'ticket 01')
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: true, turnId: 't', agentId: 'd1', reason: 'aborted' } as any)
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Engineer on alert$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Interrupted · 0 steps/ })).toBeDefined()
  await ui.unmount()
})

test('a section collapses and the steps of a card expand', async ($, on) => {
  engine(on, 'd1')
  await spawn($, 'd1', 'spectree-engineer:full-stack-developer', 'account module')
  for (const command of ['a', 'b', 'c', 'd', 'e']) {
    await $.tool.call({ tool: 'Bash', command: `step ${command}`, agentId: 'd1' } as any)
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Running: step a/ })).toBeUndefined()
  await ui.press({ key: 'steps-d1' })
  expect(await ui.find({ type: 'Text', text: /Running: step a/ })).toBeDefined()
  await ui.press({ key: 'isRunningCollapsed' })
  expect(await ui.find({ type: 'Text', text: /Running: step e/ })).toBeUndefined()
  await ui.unmount()
})

test('a long session stays in budget: each step writes its own subagent, the pane draws a bounded tree', { timeoutMs: 60_000 }, async ($, on) => {
  const clock = engine(on, 'f0')
  const written: Record<string, number> = {}
  on('state.set', (_: unknown, e: any, next: any) => {
    written[e.key] = (written[e.key] ?? 0) + JSON.stringify(e.value ?? null).length
    return next(e)
  })
  await spawn($, 'early', 'spectree-engineer:solutions-architect', 'early run')
  for (let i = 0; i < 60; i++) {
    await spawn($, `f${i}`, 'spectree-engineer:full-stack-developer', `module ${i}`)
    for (let s = 0; s < 40; s++) await $.tool.call({ tool: 'Bash', command: `npm test step ${s} ${'x'.repeat(80)}`, agentId: `f${i}` } as any)
    await clock.advance(1000)
    await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: `t${i}`, agentId: `f${i}`, reason: 'answer' } as any)
  }
  await clock.advance(1000)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 'te', agentId: 'early', reason: 'answer' } as any)
  for (let r = 0; r < 8; r++) await spawn($, `r${r}`, 'spectree-engineer:quality-engineer', `QE ${r}`)

  for (const key of Object.keys(written)) delete written[key]
  for (let s = 0; s < 10; s++) await $.tool.call({ tool: 'Bash', command: `late ${s}`, agentId: 'r0' } as any)
  expect(written.agents ?? 0).toBe(0)
  expect(written.steps ?? 0).toBeLessThan(10 * 5_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svgs = (await ui.findAll({ type: 'Svg' })) as any[]
  const sources = svgs.map(one => String(one?.props?.source ?? ''))
  // The engine draws the whole pane at every tick: the large drawing rides on the centre alone.
  expect(sources.filter(source => source.length > 20_000).length).toBe(1)
  expect(sources.reduce((sum, source) => sum + source.length, 0)).toBeLessThan(250_000)
  // A frame only for what moves: the centre and the avatar and spinner of each running card.
  expect(svgs.filter(one => one?.props?.isInteractive).length).toBe(1 + 2 * 8)
  expect(await ui.find({ type: 'Text', text: /Finished · 50/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^early run$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^module 59$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^module 55$/ })).toBeUndefined()
  await ui.press({ key: 'finished-whole' })
  expect(await ui.find({ type: 'Text', text: /^module 11$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^module 10$/ })).toBeUndefined()
  await ui.unmount()
})

test("no subagent runs under Opus: Haiku or Sonnet, named or defaulted, is raised; a role's own model and Fable are left alone", async ($, on) => {
  engine(on, 'w1')
  // The harness's web-fetch picks Haiku on its own; a call may also name a model under the floor.
  await spawn($, 'w1', 'web-fetch', 'Read Asaas visao-geral page')
  await ($ as any).agent.spawn({ tool_use_id: 'tu-h1', prompt: 'x', description: 'named haiku', subagentType: 'general-purpose', provider: ENGINE, parentModel: 'model', model: 'haiku', background: false, fork: false })
  await ($ as any).agent.spawn({ tool_use_id: 'tu-s1', prompt: 'x', description: 'named sonnet', subagentType: 'spectree-engineer:platform-engineer', provider: ENGINE, parentModel: 'model', model: 'sonnet', background: false, fork: false })
  // The third verification round of a goal names Fable: the floor does not touch it.
  await ($ as any).agent.spawn({ tool_use_id: 'tu-f1', prompt: 'x', description: 'round 3', subagentType: 'spectree-engineer:quality-engineer', provider: ENGINE, parentModel: 'model', model: 'fable', background: false, fork: false })
  await spawn($, 'd1', 'spectree-engineer:full-stack-developer', 'ticket')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^web-fetch · opus$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^general-purpose · opus$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^spectree-engineer:platform-engineer · opus$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^spectree-engineer:quality-engineer · fable$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^spectree-engineer:full-stack-developer · model$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Haiku|Sonnet/ })).toBeUndefined()
  await ui.unmount()
})

test('a heredoc or pipe into an interpreter is refused, a script run from a file is not', async ($, on) => {
  engine(on, 'd1')
  const denied = async (command: string) => String(((await $.tool.call({ tool: 'Bash', command } as any)) as any).deny ?? '')
  for (const command of ["python - <<'EOF'\nprint(1)\nEOF", 'python3 -<<EOF\nx\nEOF', 'node - <<EOF\nx\nEOF', 'node <<EOF\nx\nEOF', 'cat patch.py | python -', 'python3 -', 'python - notes.txt', 'node', 'cd apps/backend && python', 'TZ=UTC node -', '(node)']) {
    expect(await denied(command)).toContain('Write tool')
  }
  for (const command of ['python scripts/fix.py', 'python -I scripts/fix.py', 'node scripts/worktree.mjs up t1', 'node -e "console.log(1)"', 'npm run build', 'grep -n "python -" notes.md', "cat > scratch/fix.py <<'EOF'\nprint(1)\nEOF", "cat > scratch/run-node <<'EOF'\nx\nEOF", 'echo 1 | node', 'which node', 'command -v python', 'git commit -m "fix: python - handle the stub"', 'nvm use node']) {
    expect(await denied(command)).toBe('')
  }
})

test("the goal contract is the Engineer's: a subagent neither calls to-goal nor writes docs/goals, the main loop does both", async ($, on) => {
  engine(on, 'd1')
  await spawn($, 'd1', 'spectree-engineer:full-stack-developer', 'goal')
  const denied = async (call: Record<string, unknown>) => String(((await $.tool.call(call as any)) as any).deny ?? '')
  for (const call of [
    { tool: 'Skill', skill: 'spectree-engineer:to-goal', agentId: 'd1' },
    { tool: 'Skill', skill: 'to-goal', agentId: 'd1' },
    { tool: 'Write', file_path: '/repo/docs/goals/second-copy.md', content: 'x', agentId: 'd1' },
    { tool: 'Edit', file_path: 'C:\\repo\\docs\\goals\\second-copy.md', old_string: 'a', new_string: 'b', agentId: 'd1' },
  ]) {
    expect(await denied(call)).toContain("the Engineer's")
  }
  for (const call of [
    { tool: 'Skill', skill: 'spectree-engineer:tdd', agentId: 'd1' },
    { tool: 'Skill', skill: 'spectree-engineer:to-goal-review', agentId: 'd1' },
    { tool: 'Write', file_path: '/repo/.scratch/second-copy/plan.md', content: 'x', agentId: 'd1' },
    { tool: 'Read', file_path: '/repo/docs/goals/second-copy.md', agentId: 'd1' },
    { tool: 'Skill', skill: 'spectree-engineer:to-goal' },
    { tool: 'Write', file_path: '/repo/docs/goals/second-copy.md', content: 'x' },
  ]) {
    expect(await denied(call)).toBe('')
  }
})

test('a subagent never touches the shared stash; the main loop may, and reading the list is free', async ($, on) => {
  engine(on, 'd1')
  await spawn($, 'd1', 'spectree-engineer:full-stack-developer', 'goal')
  const denied = async (command: string, agentId?: string) => String(((await $.tool.call({ tool: 'Bash', command, ...(agentId ? { agentId } : {}) } as any)) as any).deny ?? '')
  for (const command of ['git stash', 'git stash pop', 'git add -A && git stash push -m wip', 'git -C ../repo stash apply']) {
    expect(await denied(command, 'd1')).toContain('shared by every worktree')
  }
  for (const command of ['git stash list', 'git stash show -p', 'git status', 'git commit -m "chore: stash the idea"']) {
    expect(await denied(command, 'd1')).toBe('')
  }
  expect(await denied('git stash')).toBe('')
})

test('a full-stack-developer is told once, at its sixtieth tool call, to hand the ticket off; nobody else is', async ($, on) => {
  engine(on, 'd1')
  await spawn($, 'd1', 'spectree-engineer:full-stack-developer', 'Build ticket 04')
  await spawn($, 'q1', 'spectree-engineer:quality-engineer', 'QE checkpoint ticket 04')
  const denied = async (agentId?: string) => String(((await $.tool.call({ tool: 'Bash', command: 'git status', ...(agentId ? { agentId } : {}) } as any)) as any).deny ?? '')
  for (let call = 1; call < 60; call++) expect(await denied('d1')).toBe('')
  const notice = await denied('d1')
  expect(notice).toContain('Handoff point: this is tool call 60')
  expect(notice).toContain('report `handoff`')
  // the same call passes when repeated, and the notice never comes back
  for (let call = 61; call <= 130; call++) expect(await denied('d1')).toBe('')
  for (let call = 1; call <= 70; call++) expect(await denied('q1')).toBe('')
  for (let call = 1; call <= 70; call++) expect(await denied()).toBe('')
})

test('the clock runs only while a subagent runs', async ($, on) => {
  const clock = engine(on, 'c1')
  let ticks = 0
  on('state.set', (_: unknown, e: any, next: any) => {
    if (e.key === 'now') ticks++
    return next(e)
  })
  await spawn($, 'c1', 'spectree-engineer:platform-engineer', 'PE')
  ticks = 0
  await clock.advance(3000)
  expect(ticks).toBeGreaterThanOrEqual(3)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't', agentId: 'c1', reason: 'answer' } as any)
  ticks = 0
  await clock.advance(5000)
  expect(ticks).toBe(0)
})

test('a drawing that fails leaves a pane that says so', async ($, on) => {
  engine(on, 'x1')
  // A row the drawing cannot read: no type to name its drawing by.
  await spawn($, 'x1', undefined as any, 'PE')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Engineer panel recovering/ })).toBeDefined()
  await ui.unmount()
})

test('the main loop adds no card and its task list fills the plan bar', async ($, on) => {
  engine(on, 'x')
  await $.tool.call({ tool: 'Bash', command: 'ls' } as any)

  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /No subagent/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /No plan under way/ })).toBeDefined()
  await ui.unmount()

  for (const subject of ['Bump plugin', 'Identity', 'Review', 'Close']) {
    await $.tool.call({ tool: 'TaskCreate', subject, description: subject, activeForm: `Doing ${subject}` } as any)
  }
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' } as any)
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'in_progress' } as any)
  await $.tool.call({ tool: 'TaskUpdate', taskId: '4', status: 'deleted' } as any)
  // A subagent's own task list is not the plan.
  await spawn($, 'd1', 'spectree-engineer:full-stack-developer', 'Developer')
  await $.tool.call({ tool: 'TaskCreate', subject: 'inner', description: 'inner', agentId: 'd1' } as any)

  for (const surface of ['terminal', 'desktop'] as const) {
    ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /^Tasks 1\/3 · 33%$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Now: Doing Identity$/ })).toBeDefined()
    await ui.unmount()
  }
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const bar = await svgSource(ui, 'Tasks 1 of 3')
  expect(bar).toContain('viewBox="0 0 300 14"')
  expect(bar).toContain('class="lv"')
  for (const shade of ['#2b5b9c', '#8fc3ff']) expect(bar).toContain(shade)
  await ui.unmount()

  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'completed' } as any)
  await $.tool.call({ tool: 'TaskUpdate', taskId: '3', status: 'completed' } as any)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't', agentId: 'd1', reason: 'answer' } as any)
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Plan done$/ })).toBeDefined()
  // A plan done with nobody running: the mascot smiles in its ring, and the bar is still.
  expect(await ui.find({ type: 'Text', text: /^Engineer at rest$/ })).toBeDefined()
  expect(await svgSource(ui, 'Engineer at rest')).toContain(happyHero)
  expect(await svgSource(ui, 'Tasks 3 of 3')).not.toContain('@keyframes')
  await ui.unmount()
})

test("the plan tool keeps the main loop's plan, refuses a subagent's, and shows above the terminal prompt", async ($, on) => {
  engine(on, 'd1')
  const saved = await $.tool.call({ tool: PLAN_TOOL, title: 'Identity module', steps: steps(2) } as any)
  expect(String((saved as any).result)).toBe('Plan saved: 2 of 4 steps done.')
  await spawn($, 'd1', 'spectree-engineer:full-stack-developer', 'ticket')
  const refused = await $.tool.call({ tool: PLAN_TOOL, steps: steps(0), agentId: 'd1' } as any)
  expect(String((refused as any).deny ?? (refused as any).result ?? '')).toContain('Only the main loop')

  let band = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  expect(await band.find({ type: 'Text', text: /^Identity module$/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /^Tasks 2\/4$/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /^Now: Step 3$/ })).toBeDefined()
  await band.unmount()
  // The desktop keeps the plan in the panel.
  band = await $.ui.mount({ ...BAND, surface: 'desktop' } as any)
  expect(await band.find({ type: 'Text', text: /^Tasks/ })).toBeUndefined()
  await band.unmount()

  // Done, it stays for the turn that finished it and goes once the person writes.
  await $.tool.call({ tool: PLAN_TOOL, steps: steps(4) } as any)
  band = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  expect(await band.find({ type: 'Text', text: /^Tasks 4\/4$/ })).toBeDefined()
  await band.unmount()
  await $.prompt.submit({ text: 'next', origin: { kind: 'composer' } } as any)
  band = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  expect(await band.find({ type: 'Text', text: /^Tasks/ })).toBeUndefined()
  await band.unmount()
})

// A session that stopped: the engine beneath the panel, with the windows the last response reported,
// whether the folder is an Engineer project, and what the panel submitted by itself.
const MINUTE = 60_000
const START = 1_000_000

function stoppedSession(on: any, limits: unknown[] = [], isProject = true) {
  const clock = mock.clock(on, { now: START })
  const sent: string[] = []
  const logged: string[] = []
  const refuse = { left: 0 }
  on('tool.call', () => ({ result: {} }))
  on('turn.start', (_: unknown, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: unknown, e: any) => ({ text: e.answer }))
  on('prompt.submit', (_: unknown, e: any) => {
    if (e.origin?.kind !== 'plugin') return e
    sent.push(e.text)
    if (refuse.left > 0) {
      refuse.left--
      return { drop: 'the limit stands' }
    }
    return e
  })
  on('fs.exists', () => ({ value: isProject }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: limits } }))
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: {} }))
  on('ui.log', (_: unknown, e: any) => {
    logged.push(String(e.text ?? e))
    return { value: {} }
  })
  return { clock, sent, logged, refuse }
}

const turnEnds = ($: any, reason: 'answer' | 'aborted' | 'error', agentId?: string) =>
  $.turn.complete({ answer: '', durationMs: 1, isAborted: reason === 'aborted', turnId: 't1', reason, ...(agentId ? { agentId } : {}) } as any)

const openPlan = ($: any, done = 1) => $.tool.call({ tool: PLAN_TOOL, steps: steps(done) } as any)

test('a session stopped at the usage limit is resumed once, a minute after the window reopens', async ($, on) => {
  const session = stoppedSession(on, [
    { kind: 'five_hour', percentUsed: 100, resetsAt: new Date(START + 120 * MINUTE).toISOString() },
    { kind: 'seven_day', percentUsed: 41, resetsAt: new Date(START + 4000 * MINUTE).toISOString() },
  ])
  await openPlan($)
  await turnEnds($, 'error')
  await session.clock.advance(120 * MINUTE)
  expect(session.sent).toEqual([])
  await session.clock.advance(2 * MINUTE)
  expect(session.sent.length).toBe(1)
  expect(session.sent[0]).toContain("the plan's usage limit")
  expect(session.sent[0]).toContain('repeat the question and stop')
  await session.clock.advance(600 * MINUTE)
  expect(session.sent.length).toBe(1)
})

test('after an API error the panel tries again at growing intervals, and an answer starts the count over', async ($, on) => {
  const session = stoppedSession(on)
  await openPlan($)
  await turnEnds($, 'error')
  await session.clock.advance(1.5 * MINUTE)
  expect(session.sent).toEqual([])
  await session.clock.advance(1 * MINUTE)
  expect(session.sent.length).toBe(1)
  expect(session.sent[0]).toContain('an API error')
  // the resumed turn dies too: the second try waits five minutes
  await turnEnds($, 'error')
  await session.clock.advance(4 * MINUTE)
  expect(session.sent.length).toBe(1)
  await session.clock.advance(1.5 * MINUTE)
  expect(session.sent.length).toBe(2)
  // a prompt the engine refuses is a try spent: the next one waits fifteen minutes, then thirty
  session.refuse.left = 1
  await turnEnds($, 'error')
  await session.clock.advance(15.5 * MINUTE)
  expect(session.sent.length).toBe(3)
  await session.clock.advance(29 * MINUTE)
  expect(session.sent.length).toBe(3)
  await session.clock.advance(1.5 * MINUTE)
  expect(session.sent.length).toBe(4)
  // the turn answers: the next stop starts from two minutes again
  await turnEnds($, 'answer')
  await turnEnds($, 'error')
  await session.clock.advance(2.5 * MINUTE)
  expect(session.sent.length).toBe(5)
})

test('only a turn the API killed, with work under way in an Engineer project, is resumed', async ($, on) => {
  const session = stoppedSession(on)
  const quiet = async () => {
    await session.clock.advance(400 * MINUTE)
    expect(session.sent).toEqual([])
  }
  // no plan: nothing was under way
  await turnEnds($, 'error')
  await quiet()
  await openPlan($)
  // an answer may be a question to the Founder, and an interruption is his
  await turnEnds($, 'answer')
  await quiet()
  await turnEnds($, 'aborted')
  await quiet()
  // the Founder writes before the time comes
  await turnEnds($, 'error')
  await $.prompt.submit({ text: 'deixa comigo', origin: { kind: 'composer' } } as any)
  await quiet()
  // a main turn is alive when the time comes
  await turnEnds($, 'error')
  await $.turn.start({ text: 'continue', turnId: 't2' } as any)
  await quiet()
  await turnEnds($, 'answer')
  // a subagent dies while the main loop works: the main loop hears it
  await $.turn.start({ text: 'segue', turnId: 't3' } as any)
  await turnEnds($, 'error', 'a1')
  await quiet()
  // the plan is done
  await turnEnds($, 'answer')
  await openPlan($, 4)
  await turnEnds($, 'error')
  await quiet()
})

test('a background agent that dies while the main loop is idle wakes the session', async ($, on) => {
  const session = stoppedSession(on)
  await openPlan($)
  await turnEnds($, 'answer')
  await turnEnds($, 'error', 'a1')
  await session.clock.advance(2.5 * MINUTE)
  expect(session.sent.length).toBe(1)
})

test('outside an Engineer project a stopped session stays stopped', async ($, on) => {
  const session = stoppedSession(on, [], false)
  await openPlan($)
  await turnEnds($, 'error')
  await session.clock.advance(400 * MINUTE)
  expect(session.sent).toEqual([])
})

test('the panel gives up after nine tries and says so', async ($, on) => {
  const session = stoppedSession(on)
  await openPlan($)
  const waits = [2, 5, 15, 30, 60, 60, 60, 60, 60]
  for (const [index, minutes] of waits.entries()) {
    await turnEnds($, 'error')
    await session.clock.advance((minutes + 0.5) * MINUTE)
    expect(session.sent.length).toBe(index + 1)
  }
  await turnEnds($, 'error')
  await session.clock.advance(600 * MINUTE)
  expect(session.sent.length).toBe(9)
  expect(session.logged.join('\n')).toContain('still stopped after 9 resume attempts')
})
