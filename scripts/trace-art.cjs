// Traces the founder's PNGs (2048 px, alpha) into the flat-colour polygons of
// hooks/engineer-desk/mascot-art.ts: the desktop app strips any <image> from an Svg, so every
// drawing the panel shows is a list of filled paths. Edit the PNGs, then run this; never the .ts.
//
// Usage: node scripts/trace-art.cjs <assets dir> <deps dir> [out]
//   <assets dir>  holds characters/*.png and mascot/*.png as the founder's kit lays them out
//   <deps dir>    any folder where `npm i imagetracerjs@1.2.6` ran (its node_modules is read)
//   out           default hooks/engineer-desk/mascot-art.ts
// Tuning by env: HERO_FACTOR=9 HERO_COLORS=14 HERO_OMIT=6 MASCOT_COLORS=24 ALPHA_FLOOR=128
//   FACE_FACTOR=24 FACE_COLORS=12 FACE_OMIT=2; ONLY=mascot,happy limits the keys traced.
'use strict'
const fs = require('fs')
const path = require('path')

const [assets, deps, out = path.join(__dirname, '..', 'hooks', 'engineer-desk', 'mascot-art.ts')] = process.argv.slice(2)
if (!assets || !deps) {
  console.error('usage: node scripts/trace-art.cjs <assets dir> <deps dir> [out]')
  process.exit(2)
}
const DEPS = path.join(deps, 'node_modules', 'imagetracerjs')
const ImageTracer = require(path.join(DEPS, 'imagetracer_v1.2.6.js'))
const PNGReader = require(path.join(DEPS, 'nodecli', 'PNGReader.js'))

async function readPng(file) {
  const reader = new PNGReader(fs.readFileSync(file))
  const got = await new Promise((resolve, reject) => reader.parse((err, png) => (err ? reject(err) : resolve(png))))
  const width = got.getWidth(), height = got.getHeight()
  const data = new Uint8ClampedArray(width * height * 4)
  const bpp = got.pixels.length / (width * height)
  for (let i = 0; i < width * height; i++) {
    const px = got.getPixel(i % width, Math.floor(i / width))
    data[i * 4] = px[0]; data[i * 4 + 1] = px[1]; data[i * 4 + 2] = px[2]; data[i * 4 + 3] = px.length > 3 ? px[3] : 255
  }
  void bpp
  return { width, height, data }
}

// Area average by an integer factor; colour is alpha-weighted so halos do not darken.
function downsample(img, factor) {
  const w = Math.floor(img.width / factor), h = Math.floor(img.height / factor)
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) {
      const i = ((y * factor + dy) * img.width + (x * factor + dx)) * 4
      const al = img.data[i + 3]
      r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al
    }
    const o = (y * w + x) * 4
    if (a > 0) { data[o] = r / a; data[o + 1] = g / a; data[o + 2] = b / a }
    data[o + 3] = a / (factor * factor)
  }
  return { width: w, height: h, data }
}

// Pixels under the alpha floor become one fixed transparent colour, so the quantizer gives them one palette slot.
function flattenAlpha(img, floor) {
  const data = new Uint8ClampedArray(img.data)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < floor) { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0 }
    else data[i + 3] = 255
  }
  return { width: img.width, height: img.height, data }
}

function hex(n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0') }

function trace(img, { colors, pathomit, ltres = 1 }) {
  const options = {
    ltres, qtres: 0, pathomit, rightangleenhance: false,
    colorsampling: 2, numberofcolors: colors, mincolorratio: 0, colorquantcycles: 3,
    strokewidth: 0, linefilter: true, scale: 1, roundcoords: 0, viewbox: true, desc: false, blurradius: 0, blurdelta: 20,
  }
  const svg = ImageTracer.imagedataToSVG(img, options)
  const paths = []
  for (const m of svg.matchAll(/<path fill="rgb\((\d+),(\d+),(\d+)\)" stroke="rgb\(\d+,\d+,\d+\)" stroke-width="[\d.]+" opacity="([\d.]+)" d="([^"]+)" \/>/g)) {
    const [, r, g, b, opacity, d] = m
    if (Number(opacity) < 0.5) continue
    // Only M, L and Z remain with qtres 0; collapse repeated points and trailing spaces.
    // `M x y L x y ... Z`, holes as further subpaths: compacted to `Mx yLx y...Z`.
    const clean = d.replace(/\s+/g, ' ').trim().replace(/([MLZ]) /g, '$1').replace(/ ([MLZ])/g, '$1')
    if (!/^(M\d+ \d+(L\d+ \d+)*Z)+$/.test(clean)) throw new Error(`unexpected path: ${clean.slice(0, 80)}`)
    paths.push(`<path d="${clean}" fill="#${hex(r)}${hex(g)}${hex(b)}"/>`)
  }
  return `<svg viewBox="0 0 ${img.width} ${img.height}">${paths.join('')}</svg>`
}

// The glow colour: the mean of the bright, opaque pixels of the neutral mascot.
function glowOf(img) {
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < img.data.length; i += 4) {
    const lum = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]
    if (img.data[i + 3] > 200 && lum > 170) { r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++ }
  }
  return n ? `#${hex(r / n)}${hex(g / n)}${hex(b / n)}` : null
}

const HERO = [
  ['engineer', 'characters/engineer.png'],
  ['architect', 'characters/solutions-architect.png'],
  ['designer', 'characters/ui-ux-designer.png'],
  ['developer', 'characters/full-stack-developer.png'],
  ['quality', 'characters/quality-engineer.png'],
  ['security', 'characters/security-engineer.png'],
  ['platform', 'characters/platform-engineer.png'],
  ['integration', 'characters/integration-engineer.png'],
  ['mascot', 'mascot/main-neutral.png'],
  ['happy', 'mascot/main-happy.png'],
  ['focused', 'mascot/main-focused.png'],
  ['alert', 'mascot/main-alert.png'],
]
const FACES = [
  ['face_neutral', 'mascot/main-neutral.png'],
  ['face_happy', 'mascot/main-happy.png'],
  ['face_focused', 'mascot/main-focused.png'],
  ['face_alert', 'mascot/main-alert.png'],
]

const heroFactor = Number(process.env.HERO_FACTOR || 9), heroColors = Number(process.env.HERO_COLORS || 14), heroOmit = Number(process.env.HERO_OMIT || 6)
const faceFactor = Number(process.env.FACE_FACTOR || 24), faceColors = Number(process.env.FACE_COLORS || 12), faceOmit = Number(process.env.FACE_OMIT || 2)
const mascotColors = Number(process.env.MASCOT_COLORS || 24), floor = Number(process.env.ALPHA_FLOOR || 128)
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
async function main() {
const entries = []
let glow = null
for (const [key, file] of HERO) {
  if (only && !only.includes(key)) continue
  const img = await readPng(path.join(assets, file))
  if (key === 'mascot') glow = glowOf(img)
  const small = flattenAlpha(downsample(img, heroFactor), floor)
  const svg = trace(small, { colors: file.startsWith('mascot/') ? mascotColors : heroColors, pathomit: heroOmit })
  entries.push([key, svg])
  console.error(`${key}: ${small.width}px ${svg.length} chars`)
}
for (const [key, file] of FACES) {
  if (only && !only.includes(key)) continue
  const img = await readPng(path.join(assets, file))
  const small = flattenAlpha(downsample(img, faceFactor), floor)
  const svg = trace(small, { colors: faceColors, pathomit: faceOmit })
  entries.push([key, svg])
  console.error(`${key}: ${small.width}px ${svg.length} chars`)
}
console.error(`glow: ${glow}`)

const header =
  "// The Engineer's mascot, its expressions and the seven specialists, from the Founder's own art\n" +
  '// (2026-10-31, 2048px PNGs with alpha), traced into flat-colour polygons: the desktop app strips any\n' +
  '// <image> from an Svg. Generated by the tracing script kept outside the repo; edit the PNGs, not this file.\n' +
  '// The `face_` drawings are the four expressions drawn small, for a card\'s avatar.\n'
const body = entries.map(([k, v]) => `  ${k}:\n    '${v}',`).join('\n')
fs.writeFileSync(out, `${header}export const MASCOT_ART = {\n${body}\n} as const\n`)
console.error(`wrote ${out} (${fs.statSync(out).size} bytes)`)
}
main().catch(err => { console.error(err); process.exit(1) })
