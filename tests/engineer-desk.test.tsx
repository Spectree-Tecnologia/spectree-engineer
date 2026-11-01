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
  // Each spawn answers the agent id its tool_use_id names (`tu-<id>`), the first one by default.
  on('agent.spawn', (_: unknown, e: any) => ({ model, agentId: String(e.tool_use_id ?? '').replace(/^tu-/, '') || agentId }))
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
  Array.from({ length: total }, (_, i) => ({ text: `Passo ${i + 1}`, status: i < done ? 'completed' : i === done ? 'in_progress' : 'pending' }))

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
    expect(await ui.find({ type: 'Text', text: /Concluído · 2 passos/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^spectree-engineer:quality-engineer · model$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /6\.2M tokens/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Running: npm test/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Using Read: \/repo\/docs\/specs/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Engineer em repouso/ })).toBeDefined()
    if (surface !== 'terminal') {
      // The card's avatar is the mascot's smiling mood once done, and still: no frame.
      const svgs = (await (ui as any).findAll({ type: 'Svg' })) as any[]
      const avatar = svgs.find(one => one?.props?.alt === 'Quality Engineer')
      const source = String(avatar?.props?.source ?? '')
      expect(source).toContain('viewBox="0 0 48 48"')
      expect(source).toContain(happyFace)
      expect(source).not.toContain('@keyframes')
      expect(avatar?.props?.isInteractive).toBe(false)
      expect(source).not.toContain('<image')
      // Idle with no plan, the centre is the mascot itself, inside its ring.
      const hero = String(svgs.find(one => one?.props?.alt === 'Engineer em repouso')?.props?.source ?? '')
      expect(hero).toContain('viewBox="0 0 227 227"')
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
  expect(await ui.find({ type: 'Text', text: /Despachando Platform Engineer/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Em execução · 1/ })).toBeDefined()
  // One drawing, floating in the glow; a specialist wears no ring; still on reduced motion.
  expect(platform).toContain('@keyframes fl')
  expect(platform).toContain('#8fc3ff')
  expect(platform).not.toContain('<ellipse')
  expect(platform).toContain('.fl,.gl,.rg{animation:none}')
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
  expect(await ui.find({ type: 'Text', text: /Despachando Platform Engineer, Solutions Architect/ })).toBeDefined()
  await ui.unmount()
})

test('alone with a live plan the Engineer itself is at the centre; a failure leaves the mascot alert', async ($, on) => {
  engine(on, 'd1')
  await $.tool.call({ tool: PLAN_TOOL, title: 'Identity', steps: steps(1) } as any)
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Engineer trabalhando$/ })).toBeDefined()
  expect((await svgSource(ui, 'Engineer trabalhando')).length).toBeGreaterThan(10_000)
  await ui.unmount()

  await spawn($, 'd1', 'spectree-engineer:full-stack-developer', 'ticket 01')
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: true, turnId: 't', agentId: 'd1', reason: 'aborted' } as any)
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Engineer em alerta$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Interrompido · 0 passos/ })).toBeDefined()
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
  expect(await ui.find({ type: 'Text', text: /Concluídos · 50/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^early run$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^module 59$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^module 55$/ })).toBeUndefined()
  await ui.press({ key: 'finished-whole' })
  expect(await ui.find({ type: 'Text', text: /^module 11$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^module 10$/ })).toBeUndefined()
  await ui.unmount()
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
  expect(await ui.find({ type: 'Text', text: /Painel do Engineer em recuperação/ })).toBeDefined()
  await ui.unmount()
})

test('the main loop adds no card and its task list fills the plan bar', async ($, on) => {
  engine(on, 'x')
  await $.tool.call({ tool: 'Bash', command: 'ls' } as any)

  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Nenhum subagente/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Nenhum plano em andamento/ })).toBeDefined()
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
    expect(await ui.find({ type: 'Text', text: /^Tarefas 1\/3 · 33%$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Agora: Doing Identity$/ })).toBeDefined()
    await ui.unmount()
  }
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const bar = await svgSource(ui, 'Tarefas 1 de 3')
  expect(bar).toContain('viewBox="0 0 300 14"')
  expect(bar).toContain('class="lv"')
  for (const shade of ['#2b5b9c', '#8fc3ff']) expect(bar).toContain(shade)
  await ui.unmount()

  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'completed' } as any)
  await $.tool.call({ tool: 'TaskUpdate', taskId: '3', status: 'completed' } as any)
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't', agentId: 'd1', reason: 'answer' } as any)
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Plano concluído$/ })).toBeDefined()
  // A plan done with nobody running: the mascot smiles in its ring, and the bar is still.
  expect(await ui.find({ type: 'Text', text: /^Engineer em repouso$/ })).toBeDefined()
  expect(await svgSource(ui, 'Engineer em repouso')).toContain(happyHero)
  expect(await svgSource(ui, 'Tarefas 3 de 3')).not.toContain('@keyframes')
  await ui.unmount()
})

test("the plan tool keeps the main loop's plan, refuses a subagent's, and shows above the terminal prompt", async ($, on) => {
  engine(on, 'd1')
  const saved = await $.tool.call({ tool: PLAN_TOOL, title: 'Módulo identity', steps: steps(2) } as any)
  expect(String((saved as any).result)).toBe('Plan saved: 2 of 4 steps done.')
  await spawn($, 'd1', 'spectree-engineer:full-stack-developer', 'ticket')
  const refused = await $.tool.call({ tool: PLAN_TOOL, steps: steps(0), agentId: 'd1' } as any)
  expect(String((refused as any).deny ?? (refused as any).result ?? '')).toContain('Only the main loop')

  let band = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  expect(await band.find({ type: 'Text', text: /^Módulo identity$/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /^Tarefas 2\/4$/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /^Agora: Passo 3$/ })).toBeDefined()
  await band.unmount()
  // The desktop keeps the plan in the panel.
  band = await $.ui.mount({ ...BAND, surface: 'desktop' } as any)
  expect(await band.find({ type: 'Text', text: /^Tarefas/ })).toBeUndefined()
  await band.unmount()

  // Done, it stays for the turn that finished it and goes once the person writes.
  await $.tool.call({ tool: PLAN_TOOL, steps: steps(4) } as any)
  band = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  expect(await band.find({ type: 'Text', text: /^Tarefas 4\/4$/ })).toBeDefined()
  await band.unmount()
  await $.prompt.submit({ text: 'próximo', origin: { kind: 'composer' } } as any)
  band = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  expect(await band.find({ type: 'Text', text: /^Tarefas/ })).toBeUndefined()
  await band.unmount()
})
