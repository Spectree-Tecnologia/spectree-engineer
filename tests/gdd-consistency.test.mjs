// 0.35.0: three places where what Goal Driven Development declared and what the squad practised disagreed, found by
// reading the whole repository on 2026-11-15 (the Founder's "Sim, corrija 1 a 3").
//   node --test tests/gdd-consistency.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');
const EXCLUDE = "-- . ':(exclude).scratch'";

test('whoever verifies never reads the plan, and the plan is committed: the diff leaves .scratch/ out', () => {
  // .scratch/ is tracked in a generated project (goal.mjs counts it as documents of the diff), so a plain three-dot
  // diff carried plan.md, the tickets and decisions.md to the verifiers that must not see them
  assert.ok(read('agents/quality-engineer.md').includes(`git diff <baseline>...HEAD ${EXCLUDE}`));
  assert.ok(read('agents/security-engineer.md').includes(EXCLUDE));
  assert.ok(read('skills/engineering/code-review/SKILL.md').includes(`git diff <fixed-point>...HEAD ${EXCLUDE}`));
  const command = read('commands/engineer.md');
  assert.ok(command.includes(`sem \`.scratch/\` (\`${EXCLUDE}\`)`));
  // at a checkpoint the criteria come from the graph, by number, and the ticket stays with whoever built it
  assert.match(command, /com os números dos critérios que o ticket avança \(`npm run goal -- graph <slug> --json`\), nunca o ticket/);
  const card = read('agents/quality-engineer.md');
  assert.match(card, /Dê o veredito dos critérios que a missão numera/);
  assert.doesNotMatch(card, /critérios que o ticket diz avançar/);
  assert.match(card, /É a única missão em que você lê tickets/);
});

test('the modular monolith has one book of rules: what the cards charge has a number in ARCHITECTURE.md', () => {
  const architecture = read('ARCHITECTURE.md');
  const rule = (n) => architecture.match(new RegExp(`^\\|\\s*${n}\\s*\\|.*$`, 'm'))?.[0] ?? '';
  assert.match(rule(16), /`modules\/<m>\/src\/app\/`[^\n]*kebab-case[^\n]*never `UserEntity`/);
  assert.match(rule(17), /`tryCreate`[^\n]*`cloneWith`/);
  assert.match(rule(18), /at most 50 rows/);
  assert.match(rule(19), /\*\*A controller is thin\.\*\*/);
  // the plan gate fails a plan on a numbered rule only, so a rule the verification blocks on must have a number
  const reading = read('agents/quality-engineer.md');
  const list = reading.slice(reading.indexOf('Mais o que só a leitura pega'), reading.indexOf('\n## Lean'));
  const items = list.split('\n').filter((line) => line.startsWith('- ') && !/assert enfraquecido/.test(line));
  assert.ok(items.length >= 5);
  for (const item of items) assert.match(item, /\(regra \d+\)/, `no rule number: ${item.slice(0, 60)}`);
  assert.match(reading, /O como só é achado contra regra numerada, GLOSSARY ou ADR/);
  assert.doesNotMatch(reading, /ou desta lista\)/);
  const builder = read('agents/full-stack-developer.md');
  const rules = builder.slice(builder.indexOf('## As regras que a verificação vai cobrar'), builder.indexOf('## Os limites do contrato'));
  for (const n of [16, 17, 18, 19]) assert.match(rules, new RegExp(`regra ${n}\\b`), `the full-stack-developer's card does not cite rule ${n}`);
});

test('a bug has a contract, because the final verification reads one', () => {
  const command = read('commands/engineer.md');
  const bug = command.slice(command.indexOf('### Bug'), command.indexOf('### Auditoria'));
  assert.doesNotMatch(bug, /sem contrato em arquivo/);
  assert.match(bug, /`Type: fix`[^\n]*`Verification rounds: 2`[^\n]*`Status: approved by engineer on <data>`/);
  assert.match(bug, /segue os passos 8 a 11/);
  assert.match(bug, /o bug roda numa sessão de item/);
  assert.match(read('skills/engineering/to-goal/SKILL.md'), /A bug is the exception: its contract has `Type: fix` and one criterion/);
  // the check accepts it: one criterion is a warning, and the status is one the script knows
  const script = read('skills/monolith/config-project/assets/scripts/goal.mjs');
  assert.match(script, /goal\.criteria\.length < 3\) warnings\.push/);
  assert.match(script, /approved by \.\+ on/);
});

// 0.36.0: the rest of the same reading (the Founder's "Execute a rodada: achados 4 a 8 e as três dualidades").
const command = read('commands/engineer.md');
const STATUS = /^(proposed|approved by .+ on \d{4}-\d{2}-\d{2})$/;

test('a deterministic git command is the Engineer\'s and is logged; judgement is the platform-engineer\'s', () => {
  assert.match(command, /\*\*Comando determinístico de git é seu; o que pede leitura e julgamento é do platform-engineer\*\*/);
  assert.match(command, /`\[CMD\] <comando> → exit <n>` em `decisions\.md`/);
  // a session opened with `worktree` no longer sends the platform-engineer to run the script the Engineer runs
  assert.doesNotMatch(command, /a missão do platform-engineer é `npm run worktree/);
  const card = read('agents/platform-engineer.md');
  assert.doesNotMatch(card, /Tudo que muda o repositório fora do código de um objetivo passa por você/);
  assert.doesNotMatch(card, /no checkout principal: sem worktree/);
  assert.match(card, /Quem cria e remove a worktree é o Engineer, por script/);
  assert.doesNotMatch(read('agents/full-stack-developer.md'), /remove worktree: é do platform-engineer/);
});

test('the design stage records every approval and has a way back', () => {
  assert.match(command, /grava `Approved by founder on <data>` em `docs\/design\/design-system\.md`/);
  assert.match(command, /`design-system\.md` sem essa linha, em projeto sem contrato nenhum, é o design system esperando o fundador/);
  assert.match(command, /estado de tela que falta no protótipo aprovado é uma rodada do ui-ux-designer só para esse artboard, com nova aprovação/);
  const card = read('agents/ui-ux-designer.md');
  assert.match(card, /A exceção é a rodada que o Engineer abre para um estado de tela que faltou/);
  assert.match(card, /em módulo que ainda não existe, de `decisions\.md` e do `GLOSSARY\.md`/);
  assert.doesNotMatch(card, /que pergunta ao solutions-architect/);
});

test('the audit every five items has a count and a line that resets it', () => {
  const audit = command.slice(command.indexOf('### Auditoria'), command.indexOf('### Pergunta sobre API'));
  assert.match(audit, /`Audited on <data>, through <slug>`/);
  assert.match(audit, /Cinco ou mais: a auditoria `quick` roda antes do item/);
  assert.match(command, /a contagem da Auditoria, e abra o próximo item/);
  assert.match(command, /faça a contagem da Auditoria e comece o próximo item/);
});

test('one order of construction: support modules first, the tracer bullet before breadth', () => {
  assert.doesNotMatch(read('ARCHITECTURE.md'), /breadth before depth/);
  assert.match(read('ARCHITECTURE.md'), /inside a goal, the tracer bullet comes before breadth/);
  assert.doesNotMatch(read('agents/solutions-architect.md'), /largura antes de profundidade/);
  assert.match(command, /tracer bullet antes de largura/);
});

test('the plan is committed before the first ticket, because lane 2 is born from HEAD', () => {
  assert.match(command, /você commita `docs\/goals\/<slug>\.md` e `\.scratch\/<slug>\/` \(`docs\(<slug>\): plan`/);
});

test('scope: the criteria are the Engineer\'s, and the test of a new business rule is written once', () => {
  assert.match(command, /`Status: approved by engineer under the roadmap approved on <data da aprovação do roadmap>`/);
  assert.match('approved by engineer under the roadmap approved on 2026-11-15', STATUS);
  const gates = command.slice(command.indexOf('## 6. Os quatro gates'), command.indexOf('## 7.'));
  assert.match(gates, /muda o que o usuário final pode fazer, pagar ou ver e não está no roadmap, no `GLOSSARY\.md`, num ADR nem no protótipo aprovado/);
});

test('a should pays for one round, and only a real failure climbs to fable', () => {
  assert.match(command, /\*\*`should` paga uma rodada, não duas\.\*\*/);
  assert.match(command, /Reprovou na segunda com critério `not met` ou `weak proof`, `blocking`, ou `confirmed` de `medium` para cima/);
  assert.match(command, /ou da segunda rodada final em diante/);
  assert.doesNotMatch(read('README.md'), /`should` espera a verificação final/);
});

test('two full-stack-developers per machine, whichever way they are opened', () => {
  assert.match(command, /só se `git worktree list` mostra só este checkout \(o teto é de dois full-stack-developers por máquina/);
  assert.match(command, /a linha `Spent:` do último objetivo fechado não tem horas no limite de uso/);
  assert.match(command, /`git worktree list` mostra só o checkout principal \(a primeira não está em duas pistas/);
});
