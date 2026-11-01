// The seven specialists, each with the drawing that takes the mascot's place
// while it works and the mascot's expression on its card while it runs.
export const ROLES = [
  { role: 'solutions-architect', label: 'Solutions Architect', art: 'architect', face: 'focused' },
  { role: 'ui-ux-designer', label: 'UI/UX Designer', art: 'designer', face: 'happy' },
  { role: 'full-stack-developer', label: 'Full Stack Developer', art: 'developer', face: 'focused' },
  { role: 'quality-engineer', label: 'Quality Engineer', art: 'quality', face: 'focused' },
  { role: 'security-engineer', label: 'Security Engineer', art: 'security', face: 'alert' },
  { role: 'platform-engineer', label: 'Platform Engineer', art: 'platform', face: 'focused' },
  { role: 'integration-engineer', label: 'Integration Engineer', art: 'integration', face: 'neutral' },
] as const

export type Role = (typeof ROLES)[number]['role']
// The centre: a specialist's scene, the Engineer itself at work, or the mascot in one of its moods.
export type Art = (typeof ROLES)[number]['art'] | 'engineer' | 'mascot' | 'happy' | 'focused' | 'alert'
export type Face = 'neutral' | 'happy' | 'focused' | 'alert'

// The Founder's art (2026-10-31): matte black bodies lit by a cold blue glow.
export const PALETTE = {
  void: '#07090d',
  surface: '#151a22',
  mist: '#eaf3fb',
  spirit: '#8fc3ff',
  depth: '#2b5b9c',
} as const

// `spectree-engineer:quality-engineer`, `quality-engineer` and a card renamed by the
// harness all end in the role's name.
export function roleOf(agentType: string): Role | null {
  const name = agentType.split(':').pop() ?? ''
  return ROLES.find(one => one.role === name)?.role ?? null
}

export function labelOf(agentType: string): string {
  const role = roleOf(agentType)
  return ROLES.find(one => one.role === role)?.label ?? agentType
}

// A subagent of no squad role works under the mascot itself.
export function artOf(agentType: string): Art {
  const role = roleOf(agentType)
  return ROLES.find(one => one.role === role)?.art ?? 'mascot'
}

// A running subagent of no squad role keeps the mascot's focused look.
export function faceOf(agentType: string): Face {
  const role = roleOf(agentType)
  return ROLES.find(one => one.role === role)?.face ?? 'focused'
}
