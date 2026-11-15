#!/usr/bin/env node
// The squad's evals: runs `claude plugin eval` over this plugin and prints one table row per case.
// Each case in evals/<case>/ builds a fixture from evals/fixtures/ (scaffold) and passes by regex /
// tool_used / file_exists, never by "looks good". Exits 1 if any case scores below the threshold (1.0).
//
//   node scripts/evals.mjs                 the whole suite (1 run per case; --runs 3 to measure variance)
//   node scripts/evals.mjs --case 'qe-*'   any extra flag goes straight to `claude plugin eval`
//   node scripts/evals.mjs --control       proves the suite measures something: copies the plugin with the
//                                          quality-engineer card WITHOUT its procedure and rules (from `## Criteria` on) and requires the UpdateAccount case to FAIL
//
// Needs Claude Code logged in (the eval runs as you, on your credentials); it does not run in CI without a key.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const control = args.includes('--control');
const extra = args.filter((a) => a !== '--control');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(plugin, 'evals', 'results', control ? `${stamp}-control` : stamp);
const CONTROL_CASE = 'qe-update-account-zeroes-balance';

let target = plugin;
if (control) {
  target = fs.mkdtempSync(path.join(os.tmpdir(), 'spectree-eval-control-'));
  fs.cpSync(plugin, target, {
    recursive: true,
    filter: (src) => !/[\\/](\.git|node_modules|results)([\\/]|$)/.test(src),
  });
  const card = path.join(target, 'agents', 'quality-engineer.md');
  const original = fs.readFileSync(card, 'utf8');
  // cut from the `## Criteria` block to the end: the per-criterion procedure and verdicts, the monolith rules,
  // the list of what reading catches and the finding vocabulary (severity, file:line) go; only the three block names stay
  const stripped = original.replace(/\n## Criteria — o contrato, critério por critério[\s\S]*$/, '\n');
  if (stripped === original) throw new Error('control: the anchor in the quality-engineer card changed; adjust the cut');
  fs.writeFileSync(card, stripped);
  if (!extra.includes('--case')) extra.push('--case', CONTROL_CASE);
  console.log(`control plugin: ${target} (quality-engineer card without its procedure and rules)`);
}

fs.mkdirSync(outDir, { recursive: true });
const json = path.join(outDir, 'result.json');
const cmd = [
  'claude plugin eval', JSON.stringify(target),
  '--trust-plugin', '--scaffold', '--ablation none', '--no-publish',
  // Write is a gated tool: a case still gets it only when its own allowed_tools lists it (the goal contract case does)
  '--allow-tools', 'Write',
  '--output-dir', JSON.stringify(outDir), '--json', JSON.stringify(json),
  ...extra.map((a) => (/\s|\*/.test(a) ? JSON.stringify(a) : a)),
].join(' ');
console.log(`> ${cmd}`);
const t0 = Date.now();
const res = spawnSync(cmd, { cwd: plugin, shell: true, stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '0' } });
const wall = Math.round((Date.now() - t0) / 1000);

if (!fs.existsSync(json)) {
  console.error(`\nno ${json}: the eval never ran (exit ${res.status})`);
  process.exit(res.status || 1);
}
const result = JSON.parse(fs.readFileSync(json, 'utf8'));

console.log(`\n| case | score | graders | turns | s | US$ |\n|---|---|---|---|---|---|`);
let anyBelow = false;
for (const c of result.cases) {
  const runs = c.arms.with;
  const graders = runs.flatMap((r) => r.graders.filter((g) => g.scored));
  const passed = graders.filter((g) => g.passed).length;
  const secs = runs.reduce((s, r) => s + (r.durationSeconds ?? 0), 0);
  const cost = runs.reduce((s, r) => s + (r.costUsd ?? 0) + (r.judgeCostUsd ?? 0), 0);
  const turns = runs.map((r) => r.turns).join('/');
  const score = c.aggregates.score;
  if (score < 1) anyBelow = true;
  console.log(`| ${c.name} | ${score.toFixed(2)} | ${passed}/${graders.length} | ${turns} | ${Math.round(secs)} | ${cost.toFixed(2)} |`);
  for (const r of runs) {
    if (r.error) console.log(`    run error: ${r.error}`);
    for (const g of r.graders.filter((g) => g.scored && !g.passed)) console.log(`    ✗ ${g.name}: ${g.explanation}`);
  }
}
console.log(`\ntotal: ${result.aggregates.casesPassed}/${result.aggregates.casesTotal} cases, ${wall}s wall, US$ ${(result.costUsd ?? 0).toFixed(2)} · ${json}`);

if (control) {
  const c = result.cases.find((x) => x.name === CONTROL_CASE);
  const failed = !!c && c.aggregates.score < 1;
  console.log(failed
    ? `\nCONTROL OK: without the rules list, ${CONTROL_CASE} failed (score ${c.aggregates.score.toFixed(2)}): the suite measures the card.`
    : `\nCONTROL FAILED: ${CONTROL_CASE} passed even without the rules list: the case does not tell the card apart.`);
  fs.rmSync(target, { recursive: true, force: true });
  process.exit(failed ? 0 : 1);
}
process.exit(res.status ?? (anyBelow ? 1 : 0));
