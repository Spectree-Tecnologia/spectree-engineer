export type AgentStatus = 'running' | 'completed' | 'failed' | 'killed'

export type AgentRow = {
  id: string
  description: string
  type: string
  status: AgentStatus
  startedAt: number
  endedAt: number | null
  tokens: number
  // What the subagent runs on, as the engine resolved it, and its effort, once a request names one.
  model?: string
  effort?: string
}

// A subagent's steps, kept apart from its row so a step writes only its own:
// the last few labels, and how many it has taken.
export type AgentSteps = { count: number; labels: string[] }

// A mission's context, measured on each of its model requests (hooks/engineer-desk/ceiling.ts): the last one and
// the largest, and whether the panel has already given it the handoff notice.
export type AgentContext = { last: number; peak: number; isWarned: boolean }

export type PlanTask = {
  id: string
  subject: string
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed'
}

// The title is what the plan tool names the job; a task tool's list has none.
// A plan done is settled once the person writes again: the band above the
// prompt then lets it go, and the next plan or task brings it back.
export type Plan = { title?: string; tasks: PlanTask[]; isSettled?: boolean }

export type DeskUi = {
  isRunningCollapsed: boolean
  isFinishedCollapsed: boolean
  // Every finished card shown, not only the last few.
  isFinishedWhole: boolean
  expanded: string[]
  isAutoOpened: boolean
}

// A session that stopped on the plan's usage limit or on an API error: when the panel tries again, how many
// tries it has made since the last answer, and what stopped it.
export type Resume = { at: number | null; attempts: number; why: 'limit' | 'error' | null }

declare module 'claude-code' {
  interface PluginState {
    'spectree-engineer': {
      agents: Shaped<Record<string, AgentRow>>
      steps: StateFamily<AgentSteps>
      context: StateFamily<AgentContext>
      ui: Shaped<DeskUi>
      plan: Shaped<Plan>
      now: number
      resume: Shaped<Resume>
    }
  }
}
