// The generated CI runs by moment (decided by the Founder on 2026-11-13, measured on SYND): fast checks on every push
// to a pull request, the merge gate on a ready one, everything every night on main with the latency budget reporting,
// and the latency budget as a gate only in the `pre-release` run. A red p95 never sends a goal back for another round.
// Run, not only read: the scope step and the latency step of the template are executed in bash.
//   node --test tests/ci-moments.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { allPromptFiles, role } from './prompts.mjs';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8').split('\r\n').join('\n');
const ci = read('skills/monolith/config-project/assets/workflows/ci.yml');
const bash = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' }).stdout?.trim() === 'ok';

// the `run: |` block of a named step, de-indented
function stepRun(name) {
  const lines = ci.split('\n');
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  assert.ok(start >= 0, `step "${name}" exists`);
  const at = lines.findIndex((l, i) => i > start && l.trim() === 'run: |');
  const out = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() === '') break;
    out.push(line.replace(/^ {10}/, ''));
  }
  return out.join('\n');
}
const stepIf = (name) => ci.match(new RegExp(`- name: ${name}\\n\\s+if: (.+)`))?.[1];

test('the template runs by moment and never on push', () => {
  assert.match(ci, /pull_request:\n\s+#[^\n]*\n\s+types:\n\s+- opened\n\s+- synchronize\n\s+- reopened\n\s+- ready_for_review\n/);
  assert.match(ci, /- cron: '17 6 \* \* \*'/, 'every night, not once a week');
  assert.match(ci, /workflow_dispatch:\n\s+inputs:\n\s+stage:[\s\S]*?options:\n\s+- nightly\n\s+- pre-release\n\s+default: nightly/);
  assert.doesNotMatch(ci.replace(/#.*$/gm, ''), /^\s+push:/m);
  assert.match(ci, /STAGE: \$\{\{ inputs\.stage \}\}/);
});

test('the latency budget never runs on a pull request and gates only pre-release', () => {
  assert.equal(stepIf('Latency budget'), "steps.scope.outputs.code == 'true' && github.event_name != 'pull_request'");
  assert.doesNotMatch(stepRun('Latency budget'), /--changed/);
  assert.equal(stepIf('Backend e2e'), "steps.scope.outputs.code == 'true' && github.event.pull_request.draft != true");
});

test('a red latency budget reports, and fails only the pre-release run', { skip: !bash && 'no bash' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-moments-'));
  const script = path.join(dir, 'perf-step.sh');
  fs.writeFileSync(script, stepRun('Latency budget'));
  const run = (stage, exit) => {
    const summary = path.join(dir, `summary-${stage}-${exit}.md`);
    const res = spawnSync('bash', ['-eo', 'pipefail', '-c', `npm() { return ${exit}; }; source "${script.replace(/\\/g, '/')}"`], {
      encoding: 'utf8',
      env: { ...process.env, STAGE: stage, GITHUB_STEP_SUMMARY: summary.replace(/\\/g, '/') },
    });
    return { code: res.status, out: `${res.stdout}${res.stderr}`, summary: fs.readFileSync(summary, 'utf8') };
  };
  for (const stage of ['', 'nightly']) {
    assert.equal(run(stage, 0).code, 0);
    for (const exit of [1, 3]) {
      const r = run(stage, exit);
      assert.equal(r.code, 0, `stage "${stage}", perf exit ${exit}: reported, not failed`);
      assert.match(r.out, /::warning title=Latency budget::/);
      assert.match(r.summary, /over budget, reported/);
    }
  }
  assert.equal(run('pre-release', 0).code, 0);
  const gate = run('pre-release', 1);
  assert.equal(gate.code, 1, 'pre-release: the gate fails the run');
  assert.match(gate.out, /::error title=Latency budget::/);
});

test('the scope step chooses the Playwright smoke from the diff', { skip: !bash && 'no bash' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-scope-'));
  const script = path.join(dir, 'scope.sh').replace(/\\/g, '/');
  fs.writeFileSync(script, stepRun('What this run has to prove'));
  const repo = path.join(dir, 'repo');
  const e2e = path.join(repo, 'apps', 'frontend', 'e2e');
  fs.mkdirSync(e2e, { recursive: true });
  const sh = (cmd) => {
    const res = spawnSync('bash', ['-c', cmd], { cwd: repo, encoding: 'utf8' });
    assert.equal(res.status, 0, `${cmd}\n${res.stderr}`);
  };
  const commit = (msg) => sh(`git add -A && git -c user.email=t@t -c user.name=t -c core.autocrlf=false commit -qm ${msg}`);
  const scope = () => {
    const res = spawnSync('bash', ['-eo', 'pipefail', script], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, BASE_REF: 'main', GITHUB_OUTPUT: '/dev/null' },
    });
    return { code: res.status, playwright: res.stdout.match(/^playwright=(.*)$/m)?.[1]?.trim(), out: `${res.stdout}${res.stderr}` };
  };
  sh('git init -q -b main');
  fs.writeFileSync(path.join(e2e, 'smoke.txt'), '# the journeys\r\ne2e/a.spec.ts\r\ne2e/b.spec.ts # why\r\n');
  for (const f of ['a.spec.ts', 'b.spec.ts', 'c.spec.ts', 'login.ts']) fs.writeFileSync(path.join(e2e, f), '');
  commit('base');
  sh('git update-ref refs/remotes/origin/main HEAD && git switch -q -c change');

  fs.writeFileSync(path.join(e2e, 'c.spec.ts'), 'x');
  commit('spec');
  assert.equal(scope().playwright, 'e2e/a.spec.ts e2e/b.spec.ts e2e/c.spec.ts', 'the smoke and the spec this change wrote');

  fs.writeFileSync(path.join(e2e, 'login.ts'), 'x');
  commit('helper');
  assert.equal(scope().playwright, 'full', 'the harness changed: the whole suite');

  sh('git reset -q --hard origin/main');
  fs.appendFileSync(path.join(e2e, 'smoke.txt'), 'e2e/gone.spec.ts\n');
  commit('typo');
  const typo = scope();
  assert.equal(typo.code, 1, 'a smoke name that does not exist fails the step');
  assert.match(typo.out, /refused Playwright spec: e2e\/gone\.spec\.ts/);
});

test('the squad reads the moments: a red p95 is reported, never a round', () => {
  const command = role('engineer');
  assert.match(command, /\*\*O p95 reporta, não bloqueia:\*\* a tabela vai à evidência como `reported`/);
  assert.match(command, /viram item do roadmap, nunca rodada\. Quem bloqueia é o run `pre-release`, antes do deploy\./);
  assert.match(command, /toda camada determinística sai 0, menos o p95\./);
  assert.match(command, /O PR abre pronto, nunca em draft: o run de PR pronto é o gate do merge\./);
  assert.doesNotMatch(command, /perf vermelho vai ao full-stack-developer/);
  const platform = role('platform-engineer');
  assert.match(platform, /\*\*um workflow, um job, nunca em push\*\*/);
  assert.match(platform, /gh workflow run ci\.yml --ref main -f stage=pre-release/);
  assert.match(platform, /\*\*sem `--` antes dos nomes\*\*/);
  assert.match(role('quality-engineer'), /Um p95 acima do orçamento não é achado: achado é a rota sem número/);
  assert.match(read('ARCHITECTURE.md'), /gates the `pre-release` run before production/);
});
