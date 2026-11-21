// The built screen against its approved artboard, by computed style (0.46.0, issue 121). A screen criterion proved by
// numbers a spec copied from the artboard is reproved once per property nobody copied: on the pilot project's
// statement-of-accounts-2 five checkpoints in a row found one more (a sticky header painted over a row, a square plate
// where the artboard is rounded, a button's opacity, border and font). Here the list is the artboard itself: every
// element that draws something inside a probe is compared, with every computed property, minus the exclusions named
// below with their reason; and whatever the artboard draws that no probe covers fails by its name.
//
// From a Playwright spec, run by `npm run pw -- <spec>`:
//
//   import { compareArtboard } from '../../../scripts/artboard.mjs';
//   const { differences, uncovered } = await compareArtboard(page, {
//     artboard: '../../docs/design/<slug>/project/<artboard>.dc.html', // from the spec's working directory
//     designRoot: '.side.t-light .stage',                               // the artboard's frame of the screen
//     appRoot: page.locator('[data-panel]'),                            // the same frame, built
//     probes: [{ name: 'row', design: '.lg', app: '[data-row]', without: ['text'] }],
//     exclude: [{ properties: ['font-family'], why: 'the kit owns the base font, proved by its own spec' }],
//   });
//   expect(uncovered).toEqual([]);
//   expect(differences).toEqual([]);
//
// A probe pairs the design's n-th match with the screen's n-th, and inside each the elements that draw (a text, a
// painted box, an icon or image, a ::before or ::after), in document order; a wrapper that draws nothing is not
// compared, because where it puts things is in the geometry of what it holds. Geometry is the box relative to the root,
// and the box of an element's own text. `without` on a probe and `exclude` take property names and the keys `text`,
// `left`, `top`, `width`, `height`, `textLeft`, `textTop`, `textWidth`, `textHeight`, `count`; an `exclude` with `probe`
// applies to that probe only, and every exclusion says why.

// Not compared anywhere, each for its reason. A project adds its own with `exclude`, never by editing this list.
export const NOT_STYLE = [
  { why: 'motion: a static artboard draws no transition or animation', match: /^(transition|animation)(-|$)/ },
  { why: 'rendering hints, nothing is drawn by them', match: /^(will-change|contain|content-visibility|contain-intrinsic-.*|view-transition-.*|anchor-.*|position-anchor|position-try.*|interpolate-size)$/ },
  { why: 'interaction, not drawing', match: /^(cursor|pointer-events|user-select|touch-action|caret-color|resize|scroll-.*|overscroll-.*|interactivity)$/ },
  { why: 'a vendor-prefixed property repeats a standard one', match: /^-/ },
  {
    why: 'how a box is placed is the screen\'s own markup; where it lands is compared as geometry',
    match: /^(display|position|float|clear|order|z-index|box-sizing|inset.*|top|right|bottom|left|margin.*|padding.*|width|height|inline-size|block-size|(min|max)-(width|height|inline-size|block-size)|flex.*|grid.*|gap|row-gap|column-gap|align-.*|justify-.*|place-.*|vertical-align|transform-origin|perspective-origin|aspect-ratio|columns|column-.*|table-layout|counter-.*|direction|unicode-bidi|writing-mode|text-orientation|isolation|field-sizing|zoom)$/,
  },
  { why: 'text is wrapped by its box: where it wraps is compared as the text\'s geometry', match: /^(white-space.*|text-wrap.*|word-break|overflow-wrap|hyphens|line-break|text-overflow|text-indent|tab-size)$/ },
  { why: 'an SVG\'s own coordinates: its drawn box is compared as geometry', match: /^(x|y|r|rx|ry|cx|cy|d)$/ },
];

const GEOMETRY = ['left', 'top', 'width', 'height', 'textLeft', 'textTop', 'textWidth', 'textHeight'];

// Runs in the page: what each probe's elements draw, relative to the root.
function measureIn(root, { probes, inProbes }) {
  const rootBox = root.getBoundingClientRect();
  const px = (n) => Math.round(n * 2) / 2;
  const transparent = (c) => !c || c === 'transparent' || /^rgba\(.*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);
  const directText = (el) =>
    [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');
  const paints = (style) =>
    !transparent(style.backgroundColor) ||
    style.backgroundImage !== 'none' ||
    style.boxShadow !== 'none' ||
    (style.backdropFilter && style.backdropFilter !== 'none') ||
    ['Top', 'Right', 'Bottom', 'Left'].some((side) => parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none' && !transparent(style[`border${side}Color`])) ||
    (parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== 'none' && !transparent(style.outlineColor));
  // drawn at all: rendered, and neither it nor an ancestor hidden or fully transparent
  const shown = (el) => el.getClientRects().length > 0 && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const styleOf = (style) => {
    const out = {};
    for (let i = 0; i < style.length; i++) out[style[i]] = style.getPropertyValue(style[i]);
    return out;
  };
  const describe = (el) => {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    return `${el.tagName.toLowerCase()}${el.classList.length ? `.${[...el.classList].join('.')}` : ''}${text ? ` "${text.slice(0, 40)}"` : ''}`;
  };
  const inks = (el) => {
    const style = getComputedStyle(el);
    return directText(el).length > 0 || paints(style) || el instanceof SVGSVGElement || el instanceof HTMLImageElement || el instanceof HTMLCanvasElement || el instanceof HTMLInputElement;
  };
  const itemOf = (node) => {
    const box = node.getBoundingClientRect();
    const item = {
      at: describe(node),
      style: styleOf(getComputedStyle(node)),
      left: px(box.left - rootBox.left),
      top: px(box.top - rootBox.top),
      width: px(box.width),
      height: px(box.height),
    };
    const texts = directText(node);
    if (texts.length) {
      const range = document.createRange();
      const rects = texts.flatMap((one) => {
        range.selectNodeContents(one);
        return [...range.getClientRects()];
      });
      const l = Math.min(...rects.map((r) => r.left));
      const t = Math.min(...rects.map((r) => r.top));
      item.text = texts.map((one) => one.textContent).join('').trim().replace(/\s+/g, ' ');
      item.textLeft = px(l - rootBox.left);
      item.textTop = px(t - rootBox.top);
      item.textWidth = px(Math.max(...rects.map((r) => r.right)) - l);
      item.textHeight = px(Math.max(...rects.map((r) => r.bottom)) - t);
    }
    return item;
  };
  const drawn = (el) => {
    const items = [];
    const visit = (node) => {
      if (!shown(node)) return;
      if (inks(node)) items.push(itemOf(node));
      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(node, pseudo);
        if (style.content === 'none' || style.content === 'normal' || style.display === 'none') continue;
        if (style.content === '""' && !paints(style)) continue;
        items.push({ at: `${describe(node)}${pseudo}`, style: styleOf(style), text: style.content });
      }
      // an icon is one drawing: its box and its colours, not its paths
      if (!(node instanceof SVGSVGElement)) for (const child of node.children) visit(child);
    };
    visit(el);
    return items;
  };
  const result = { root: inks(root) ? [itemOf(root)] : [] };
  const covered = new Set();
  for (const probe of probes) {
    const matches = [...root.querySelectorAll(probe.selector)].filter(shown);
    result[probe.name] = matches.map((m) => drawn(m));
    for (const m of matches) {
      covered.add(m);
      for (const d of m.querySelectorAll('*')) covered.add(d);
    }
  }
  if (inProbes) {
    // what the artboard draws inside the root and no probe compares
    result.uncovered = [];
    for (const el of root.querySelectorAll('*')) {
      if (covered.has(el) || el.ownerSVGElement) continue;
      if (shown(el) && inks(el)) result.uncovered.push(describe(el));
    }
  }
  return result;
}

const settle = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => {})));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

// A number in a value is the same when it is within half a pixel; everything else is compared as written.
const NUMBER = /-?\d*\.?\d+(?:e-?\d+)?/gi;
function sameValue(a, b) {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  if (a.replace(NUMBER, '#') !== b.replace(NUMBER, '#')) return false;
  const x = a.match(NUMBER) ?? [];
  const y = b.match(NUMBER) ?? [];
  return x.length === y.length && x.every((n, i) => Math.abs(Number(n) - Number(y[i])) <= 0.5);
}

// Next's font loader names a family `__Inter_3a7f2c`: it is Inter, and only the first family of the stack is drawn
// when it loads.
const firstFamily = (value) => (value ?? '').split(',')[0].trim().replace(/^["']|["']$/g, '').replace(/^__(.+?)_[0-9a-f]{5,}$/i, '$1').replace(/_Fallback$/i, '').toLowerCase();

/**
 * @param {import('@playwright/test').Page} page the page showing the built screen
 * @param {{
 *   artboard: string, designRoot: string, appRoot: import('@playwright/test').Locator | string,
 *   probes?: { name: string, design: string, app: string, without?: string[] }[],
 *   exclude?: { properties: string[], why: string, probe?: string }[],
 *   colorScheme?: 'light' | 'dark', viewport?: { width: number, height: number },
 * }} options
 * @returns {Promise<{ differences: string[], uncovered: string[] }>}
 */
export async function compareArtboard(page, { artboard, designRoot, appRoot, probes = [], exclude = [], colorScheme, viewport }) {
  for (const one of exclude) if (!one.why) throw new Error(`compareArtboard: excluding ${one.properties.join(', ')} needs its why`);
  for (const one of exclude) if (one.probe && one.probe !== 'root' && !probes.some((p) => p.name === one.probe)) throw new Error(`compareArtboard: no probe "${one.probe}" to exclude from`);
  const path = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const fs = await import('node:fs');
  const file = path.resolve(artboard);
  if (!fs.existsSync(file)) throw new Error(`compareArtboard: ${file} not found`);

  const board = await page.context().newPage();
  let design;
  try {
    await board.setViewportSize(viewport ?? { width: Math.max(page.viewportSize()?.width ?? 0, 1600), height: Math.max(page.viewportSize()?.height ?? 0, 1200) });
    if (colorScheme) await board.emulateMedia({ colorScheme });
    await board.goto(pathToFileURL(file).href);
    await settle(board);
    const root = board.locator(designRoot);
    if ((await root.count()) !== 1) throw new Error(`compareArtboard: ${artboard} has ${await root.count()} "${designRoot}", one expected`);
    design = await root.evaluate(measureIn, { probes: probes.map((p) => ({ name: p.name, selector: p.design })), inProbes: true });
  } finally {
    await board.close();
  }
  await settle(page);
  const app = typeof appRoot === 'string' ? page.locator(appRoot) : appRoot;
  if ((await app.count()) !== 1) throw new Error(`compareArtboard: the screen has ${await app.count()} roots, one expected`);
  const screen = await app.evaluate(measureIn, { probes: probes.map((p) => ({ name: p.name, selector: p.app })), inProbes: false });

  const differences = [];
  const skipped = (name, key) =>
    NOT_STYLE.some((n) => n.match.test(key)) ||
    exclude.some((e) => (!e.probe || e.probe === name) && e.properties.includes(key)) ||
    (probes.find((p) => p.name === name)?.without ?? []).includes(key);
  const compare = (name, at, want, got) => {
    for (const key of [...GEOMETRY, 'text']) {
      if (skipped(name, key) || (want[key] === undefined && got[key] === undefined)) continue;
      if (!sameValue(String(want[key] ?? ''), String(got[key] ?? ''))) differences.push(`${at}: ${key} is ${got[key] ?? 'not drawn'} on the screen, ${want[key] ?? 'not drawn'} on the artboard`);
    }
    for (const key of Object.keys(want.style)) {
      if (skipped(name, key)) continue;
      const [a, b] = key === 'font-family' ? [firstFamily(want.style[key]), firstFamily(got.style[key])] : [want.style[key], got.style[key]];
      if (!sameValue(a, b)) differences.push(`${at}: ${key} is ${got.style[key] ?? 'not set'} on the screen, ${want.style[key]} on the artboard`);
    }
  };
  for (const [i, want] of design.root.entries()) {
    if (screen.root[i]) compare('root', `root ${want.at}`, want, screen.root[i]);
    else differences.push(`root ${want.at}: the artboard paints the root, the screen does not`);
  }
  for (const probe of probes) {
    const wanted = design[probe.name];
    const got = screen[probe.name];
    if (wanted.length === 0) differences.push(`probe "${probe.name}": the artboard draws no "${probe.design}"`);
    if (!skipped(probe.name, 'count') && got.length !== wanted.length) differences.push(`probe "${probe.name}": ${got.length} on the screen, ${wanted.length} on the artboard`);
    for (const [m, items] of wanted.entries()) {
      const mine = got[m];
      if (!mine) continue;
      if (mine.length !== items.length) {
        differences.push(`probe "${probe.name}" #${m + 1}: draws ${mine.length} things on the screen (${mine.map((x) => x.at).join(', ')}), ${items.length} on the artboard (${items.map((x) => x.at).join(', ')})`);
      }
      for (const [n, want] of items.entries()) if (mine[n]) compare(probe.name, `probe "${probe.name}" #${m + 1}, ${want.at} (screen ${mine[n].at})`, want, mine[n]);
    }
  }
  return { differences, uncovered: design.uncovered };
}
