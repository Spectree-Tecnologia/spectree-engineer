#!/usr/bin/env node
// Evals do squad: roda `claude plugin eval` sobre este plugin e imprime uma tabela por caso.
// Cada caso em evals/<caso>/ monta um fixture de evals/fixtures/ (scaffold) e aprova por regex /
// tool_used / file_exists — nada de "parece bom". Sai 1 se algum caso ficar abaixo do threshold (1.0).
//
//   node scripts/evals.mjs                 a suíte inteira (1 run por caso; --runs 3 para medir variância)
//   node scripts/evals.mjs --case 'qe-*'   qualquer flag extra vai direto para o `claude plugin eval`
//   node scripts/evals.mjs --control       prova que a suíte mede: copia o plugin com o card do
//                                          quality-engineer SEM o procedimento nem as regras (do `## Criteria` em diante) e exige que o caso do UpdateAccount FALHE
//
// Precisa do Claude Code logado (o eval roda como você, na sua credencial); não roda em CI sem chave.
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
  // corta do bloco `## Criteria` até o fim: somem o procedimento por critério e os vereditos, as regras do monólito,
  // a lista do que a leitura pega e o vocabulário de achado (severidade, arquivo:linha); fica só o nome dos três blocos
  const stripped = original.replace(/\n## Criteria — o contrato, critério por critério[\s\S]*$/, '\n');
  if (stripped === original) throw new Error('control: a âncora do card do quality-engineer mudou; ajuste o corte');
  fs.writeFileSync(card, stripped);
  if (!extra.includes('--case')) extra.push('--case', CONTROL_CASE);
  console.log(`control plugin: ${target} (card do quality-engineer sem o procedimento nem as regras)`);
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
  console.error(`\nsem ${json}: o eval não chegou a rodar (exit ${res.status})`);
  process.exit(res.status || 1);
}
const result = JSON.parse(fs.readFileSync(json, 'utf8'));

console.log(`\n| caso | score | graders | turnos | s | US$ |\n|---|---|---|---|---|---|`);
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
console.log(`\ntotal: ${result.aggregates.casesPassed}/${result.aggregates.casesTotal} casos, ${wall}s de parede, US$ ${(result.costUsd ?? 0).toFixed(2)} · ${json}`);

if (control) {
  const c = result.cases.find((x) => x.name === CONTROL_CASE);
  const failed = !!c && c.aggregates.score < 1;
  console.log(failed
    ? `\nCONTROLE OK: sem a lista de regras, ${CONTROL_CASE} falhou (score ${c.aggregates.score.toFixed(2)}) — a suíte mede o card.`
    : `\nCONTROLE FALHOU: ${CONTROL_CASE} passou mesmo sem a lista de regras — o caso não distingue o card.`);
  fs.rmSync(target, { recursive: true, force: true });
  process.exit(failed ? 0 : 1);
}
process.exit(res.status ?? (anyBelow ? 1 : 0));
