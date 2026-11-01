// Traces the founder's PNGs (2048 px, alpha) into the flat-colour polygons of
// hooks/engineer-desk/mascot-art.ts: the desktop app strips any <image> from an Svg, so every
// drawing the panel shows is a list of filled paths. Edit the PNGs, then run this; never the .ts.
//
// Usage: node scripts/trace-art.cjs <assets dir> <deps dir> [out]
//   <assets dir>  holds characters/*.png and mascot/*.png as the founder's kit lays them out
//   <deps dir>    any folder where `npm i imagetracerjs@1.2.6` ran (its node_modules is read)
//   out           default hooks/engineer-desk/mascot-art.ts
// Tuning by env (defaults are what shipped): HERO_FACTOR=6 HERO_COLORS=20 HERO_OMIT=8
//   MASCOT_COLORS=24 ALPHA_FLOOR=200 (a pixel under it is transparent: the soft halo never
//   becomes a polygon); faces are the visor window FACE_X=464 FACE_Y=300 FACE_SIZE=1120 of the
//   mascot (FACE_CROP=0 takes the whole body), FACE_FACTOR=12 FACE_COLORS=10 FACE_OMIT=6;
//   ONLY=mascot,happy limits the keys traced.
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
  for (let i = 0; i < width * height; i++) {
    const px = got.getPixel(i % width, Math.floor(i / width))
    data[i * 4] = px[0]; data[i * 4 + 1] = px[1]; data[i * 4 + 2] = px[2]; data[i * 4 + 3] = px.length > 3 ? px[3] : 255
  }
  return { width, height, data }
}

// A square window of the source: x, y, size in source pixels.
function crop(img, x0, y0, size) {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) data.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + size) * 4), y * size * 4)
  return { width: size, height: size, data }
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
    // Only M, L and Z remain with qtres 0. `M x y L x y ... Z`, holes as further subpaths: compacted to `Mx yLx y...Z`.
    const clean = d.replace(/\s+/g, ' ').trim().replace(/([MLZ]) /g, '$1').replace(/ ([MLZ])/g, '$1')
    if (!/^(M\d+ \d+(L\d+ \d+)*Z)+$/.test(clean)) throw new Error(`unexpected path: ${clean.slice(0, 80)}`)
    paths.push(`<path d="${clean}" fill="#${hex(r)}${hex(g)}${hex(b)}"/>`)
  }
  return `<svg viewBox="0 0 ${img.width} ${img.height}">${paths.join('')}</svg>`
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

const env = (name, fallback) => Number(process.env[name] || fallback)
const heroFactor = env('HERO_FACTOR', 6), heroColors = env('HERO_COLORS', 20), heroOmit = env('HERO_OMIT', 8)
const faceFactor = env('FACE_FACTOR', 12), faceColors = env('FACE_COLORS', 10), faceOmit = env('FACE_OMIT', 6)
const mascotColors = env('MASCOT_COLORS', 24), floor = env('ALPHA_FLOOR', 200)
const only = process.env.ONLY ? process.env.ONLY.split(',') : null

async function main() {
  const entries = []
  for (const [key, file] of HERO) {
    if (only && !only.includes(key)) continue
    const img = await readPng(path.join(assets, file))
    const small = flattenAlpha(downsample(img, heroFactor), floor)
    const svg = trace(small, { colors: file.startsWith('mascot/') ? mascotColors : heroColors, pathomit: heroOmit })
    entries.push([key, svg])
    console.error(`${key}: ${small.width}px ${svg.length} chars`)
  }
  for (const [key, file] of FACES) {
    if (only && !only.includes(key)) continue
    const img = await readPng(path.join(assets, file))
    // The visor and the eyes, not the whole body: at 40px that is the expression.
    const windowed = process.env.FACE_CROP === '0' ? img : crop(img, env('FACE_X', 464), env('FACE_Y', 300), env('FACE_SIZE', 1120))
    const small = flattenAlpha(downsample(windowed, faceFactor), floor)
    const svg = trace(small, { colors: faceColors, pathomit: faceOmit })
    entries.push([key, svg])
    console.error(`${key}: ${small.width}px ${svg.length} chars`)
  }

  const header =
    "// The Engineer's mascot, its moods and the seven specialists, from the Founder's own art\n" +
    '// (2026-10-31, 2048px PNGs with alpha), traced into flat-colour polygons: the desktop app strips any\n' +
    '// <image> from an Svg. Generated by scripts/trace-art.cjs; edit the PNGs and rerun it, never this file.\n' +
    "// The `face_` drawings are the visor and eyes of the four moods, for a card's round avatar.\n"
  const body = entries.map(([k, v]) => `  ${k}:\n    '${v}',`).join('\n')
  fs.writeFileSync(out, `${header}export const MASCOT_ART = {\n${body}\n} as const\n`)
  console.error(`wrote ${out} (${fs.statSync(out).size} bytes)`)
}
main().catch(err => { console.error(err); process.exit(1) })
