import { MASCOT_ART } from './mascot-art'
import { PALETTE } from './roles'
import type { AgentStatus } from './state'
import type { Art, Face } from './roles'

// The ring of the Founder's composition, drawn behind the mascot: the full
// ellipse of mascot/main-ring.png in the drawing's own square (centre at
// 50%, 56.6%), the body hiding its middle. Only the mascot's moods wear it.
const RINGED: Art[] = ['mascot', 'happy', 'focused', 'alert']

function ringMarkup(): string {
  return (
    `<g class="rg" style="transform-origin:130px 136px">` +
    `<ellipse cx="130" cy="136" rx="99" ry="33" fill="none" stroke="${PALETTE.spirit}" stroke-width="5" opacity="0.55" filter="url(#glow)"/>` +
    `<ellipse cx="130" cy="136" rx="99" ry="33" fill="none" stroke="${PALETTE.mist}" stroke-width="1.6" opacity="0.9"/>` +
    `</g>`
  )
}

// The panel's centre: the mascot, the Engineer at work, or the specialist
// that took its place, floating over a faint aura as in the Founder's clip:
// a six-second drift up and down, a slight roll of the body and a sway of
// the ring. The traced drawing carries its own highlights, so nothing is
// blurred or glowed over it. Always a frame; the markup depends only on the
// drawing shown, so a redraw for a timer sends the same source and the motion runs on.
export function heroMarkup(art: Art): string {
  const drawing = MASCOT_ART[art].replace('<svg ', '<svg x="20" y="10" width="220" height="220" ')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 240" width="260" height="240">` +
    `<style>.fl{animation:fl 6s ease-in-out infinite;transform-origin:130px 120px}@keyframes fl{0%,100%{transform:translateY(0) rotate(0deg)}25%{transform:translateY(-3px) rotate(-0.7deg)}50%{transform:translateY(0)}75%{transform:translateY(3px) rotate(0.7deg)}}` +
    `.rg{animation:rg 6s ease-in-out infinite}@keyframes rg{0%,100%{transform:rotate(-2.3deg) translateY(1px)}50%{transform:rotate(2.3deg) translateY(-1px)}}` +
    `@media (prefers-reduced-motion: reduce){.fl,.rg{animation:none}}</style>` +
    `<defs><radialGradient id="aura" cx="50%" cy="48%" r="50%"><stop offset="0" stop-color="${PALETTE.spirit}" stop-opacity="0.2"/>` +
    `<stop offset="1" stop-color="${PALETTE.spirit}" stop-opacity="0"/></radialGradient>` +
    `<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter></defs>` +
    `<circle cx="130" cy="120" r="112" fill="url(#aura)"/>` +
    (RINGED.includes(art) ? ringMarkup() : '') +
    `<g class="fl">${drawing}</g>` +
    `</svg>`
  )
}

// A card's avatar: the visor and eyes of one of the mascot's moods, cut in a
// circle with a thin rim. While the subagent runs it wears its role's and the
// rim pulses; once it ends it smiles when done and looks alert when it failed
// or was stopped, still.
export function mascotAvatar(status: AgentStatus, face: Face = 'focused'): string {
  const isRunning = status === 'running'
  const shown: Face = isRunning ? face : status === 'completed' ? 'happy' : 'alert'
  const drawing = MASCOT_ART[`face_${shown}`].replace('<svg ', '<svg x="0" y="0" width="48" height="48" ')
  const rim = isRunning ? PALETTE.spirit : status === 'completed' ? '#7fd39a' : '#e0a06a'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="40" height="40">` +
    (isRunning
      ? `<style>.rim{animation:rim 1.6s ease-in-out infinite}@keyframes rim{0%,100%{opacity:.45}50%{opacity:1}}` +
        `@media (prefers-reduced-motion: reduce){.rim{animation:none}}</style>`
      : '') +
    `<defs><clipPath id="round"><circle cx="24" cy="24" r="22"/></clipPath></defs>` +
    `<circle cx="24" cy="24" r="22" fill="${PALETTE.surface}"/>` +
    `<g clip-path="url(#round)">${drawing}</g>` +
    `<circle class="rim" cx="24" cy="24" r="22.5" fill="none" stroke="${rim}" stroke-width="1.5" opacity="${isRunning ? 1 : 0.7}"/>` +
    `</svg>`
  )
}

// The running step's spinner: three glowing dots turning like a clock hand.
export function spinnerMarkup(): string {
  const dots = [2.6, 2.1, 1.6]
    .map((r, i) => {
      const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2
      const x = Math.round((8 + 5.2 * Math.cos(angle)) * 10) / 10
      const y = Math.round((8 + 5.2 * Math.sin(angle)) * 10) / 10
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${PALETTE.spirit}" opacity="${1 - i * 0.3}"/>`
    })
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">` +
    `<circle cx="8" cy="8" r="5.2" fill="none" stroke="${PALETTE.depth}" stroke-opacity="0.5" stroke-width="1"/>` +
    `<g>${dots}<animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="1.2s" repeatCount="indefinite"/></g>` +
    `</svg>`
  )
}

// Fixed noise, so the sparkles sit still between redraws and only their twinkle moves.
const noise = (x: number, y: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return v - Math.floor(v)
}

// Sparkles over the fill: a dither of tiny squares, sparse where the fill
// starts and dense at its head, each twinkling out of phase with its neighbours.
function sparkles(width: number): string {
  const out: string[] = []
  const cols = Math.floor(width / 3)
  for (let c = 0; c < cols; c++) {
    const density = 0.12 + 0.4 * Math.pow(c / Math.max(1, cols), 1.3)
    for (let r = 0; r < 4; r++) {
      if (noise(c, r) < density) out.push(`<rect class="s${Math.floor(noise(r, c) * 4)}" x="${c * 3 + 0.5}" y="${r * 3 + 1.5}" width="1.6" height="1.6"/>`)
    }
  }
  return out.join('')
}

// The plan's progress: a track cut into one segment per task, filled from
// Depth to Spirit as tasks close and dusted with sparkles. While a
// task remains a light sweeps the fill and the task under way glows; a plan
// done is a still image.
export function planBarMarkup(done: number, total: number, isLive = false): string {
  const width = total === 0 ? 0 : Math.round((done / total) * 300)
  const isMoving = done < total
  const liveWidth = isLive && isMoving ? Math.round((Math.min(total, done + 1) * 300) / total) - width : 0
  // A tick under the fill would cut it: only the segments still to go are marked.
  const ticks = Array.from({ length: Math.max(0, total - 1) }, (_, i) => Math.round(((i + 1) * 300) / total))
    .filter(x => x > width + 3)
    .map(x => `<rect x="${x}" y="3" width="1" height="8" fill="#ffffff" opacity="0.18"/>`)
    .join('')
  const motion = isMoving
    ? `<style>.s0,.s1,.s2,.s3{animation:tw 2.1s ease-in-out infinite}.s1{animation-duration:2.7s;animation-delay:-.7s}` +
      `.s2{animation-duration:1.8s;animation-delay:-1.3s}.s3{animation-duration:3.1s;animation-delay:-.4s}` +
      `@keyframes tw{0%,100%{opacity:.95}50%{opacity:.15}}` +
      `.lv{animation:gl 1.6s ease-in-out infinite}@keyframes gl{0%,100%{opacity:.18}50%{opacity:.5}}` +
      `.sh{animation:sw 2.6s linear infinite}@keyframes sw{from{transform:translateX(-70px)}to{transform:translateX(${width + 70}px)}}` +
      `@media (prefers-reduced-motion: reduce){.s0,.s1,.s2,.s3,.lv,.sh{animation:none}}</style>`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 14" width="300" height="14" preserveAspectRatio="none">` +
    motion +
    `<defs><linearGradient id="plan-fill"><stop offset="0" stop-color="${PALETTE.depth}"/>` +
    `<stop offset="1" stop-color="${PALETTE.spirit}"/></linearGradient>` +
    `<linearGradient id="plan-shine"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="plan-track"><rect x="0" y="0" width="300" height="14" rx="7"/></clipPath>` +
    `<clipPath id="plan-clip"><rect x="0" y="0" width="${width}" height="14"/></clipPath></defs>` +
    `<rect x="0" y="0" width="300" height="14" rx="7" fill="#ffffff" opacity="0.08"/>` +
    `<g clip-path="url(#plan-track)">` +
    (liveWidth > 0 ? `<rect class="lv" x="${width}" y="0" width="${liveWidth}" height="14" fill="${PALETTE.spirit}"/>` : '') +
    (width > 0 ? `<rect x="0" y="0" width="${width}" height="14" fill="url(#plan-fill)"/>` : '') +
    `<g fill="#ffffff">${sparkles(width)}</g>` +
    (width > 0 && isMoving ? `<g clip-path="url(#plan-clip)"><rect class="sh" x="0" y="0" width="70" height="14" fill="url(#plan-shine)"/></g>` : '') +
    ticks +
    `</g></svg>`
  )
}

// A colour between `a` and `b`, both #rrggbb; `t` from 0 to 1.
function mix(a: string, b: string, t: number): string {
  const at = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2].map(i => Math.round(at(a, i) + (at(b, i) - at(a, i)) * t).toString(16).padStart(2, '0')).join('')}`
}

// The terminal's plan bar, a colour per filled cell: the same Depth to Spirit
// gradient as the drawing, spread over however many cells are full, in
// twelve shades so a wide bar is a dozen texts and not one per cell.
export function planCellColors(cells: number): string[] {
  return Array.from({ length: cells }, (_, i) => {
    const t = Math.round((cells > 1 ? i / (cells - 1) : 1) * 11) / 11
    return mix(PALETTE.depth, PALETTE.spirit, t)
  })
}
