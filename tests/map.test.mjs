// The product's index is generated from the code, never written by an agent (analysis of 2026-11-15: a wiki agent
// was declined; what the squad lacked was the map the solutions-architect rebuilt by hand for every request).
// `goal map` writes docs/index.md from the monolith's one shape, and `--check` decides by exit code whether the page
// still says what the code says. Run, not read:
//   node --test tests/map.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { tmpDir } from './tmp.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = path.join(plugin, 'skills', 'monolith', 'config-project', 'assets', 'scripts');
const goal = path.join(scripts, 'goal.mjs');
const read = (rel) => fs.readFileSync(path.join(plugin, rel), 'utf8');

function project(files) {
  const dir = tmpDir('spectree-map-');
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}
const run = (dir, ...args) => spawnSync(process.execPath, [goal, 'map', ...args], { cwd: dir, encoding: 'utf8' });

const monolith = () =>
  project({
    'skills.config.json': JSON.stringify({ namespace: '@acme', backendAppPath: 'apps/backend', frontendAppPath: 'apps/frontend' }),
    'modules/billing/src/charge/model/charge.entity.ts': 'export class Charge {}',
    'modules/billing/src/charge/model/money.vo.ts': 'export class Money {}',
    'modules/billing/src/charge/use-case/issue-charge.use-case.ts': 'export class IssueCharge {}',
    'modules/billing/src/charge/use-case/issue-charge.use-case.test.ts': 'test',
    'modules/billing/src/charge/query/list-charges.query.ts': 'export interface ListCharges {}',
    'modules/billing/src/charge/provider/charge.repository.ts': 'export interface ChargeRepository {}',
    'modules/billing/src/charge/dto/charge-events.dto.ts': "export const CHARGE_PAID = 'ChargePaid';",
    'modules/billing/src/index.ts': "export * from './charge';",
    'modules/audit/src/entry/model/entry.entity.ts': 'export class Entry {}',
    'apps/backend/src/modules/billing/charges.controller.ts': "@Controller('charges')\nclass C {\n  @Get()\n  list() {}\n  @Post(':id/pay')\n  pay() {}\n}",
    'apps/backend/src/modules/audit/charge-paid.subscriber.ts': "import { CHARGE_PAID } from '@acme/billing';\nbus.subscribe(CHARGE_PAID, handler);",
    'apps/backend/prisma/models/billing.model.prisma': 'model Charge {\n  id String @id\n}\n\nmodel Payer {\n  id String @id\n}\n',
    'apps/frontend/src/modules/billing/pages/charges.page.tsx': 'export default function Page() {}',
    'apps/frontend/src/app/(private)/charges/page.tsx': "import Page from '@/modules/billing/pages/charges.page';\nexport default Page;",
    'apps/frontend/src/app/(public)/entrar/page.tsx': 'export default function Login() {}',
    'docs/adr/0001-charges-are-paid-once.md': '# Charges are paid once\n\n`modules/billing/` owns the charge.',
    'docs/goals/charges.md': '# Goal: charges\n\nStatus: met on 2026-11-15\n\nThe `billing` module issues charges.',
  });

test('the index says what the code says, module by module', () => {
  const dir = monolith();
  const out = run(dir);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /docs\/index\.md written \(2 modules\)/);
  const index = fs.readFileSync(path.join(dir, 'docs', 'index.md'), 'utf8');
  assert.match(index, /^# Product index/);
  assert.match(index, /Nothing here is a rule/);
  assert.match(index, /\| \[billing\]\(#billing\) \| 1 \| 1 \| 1 \| 1 \| 2 \| 2 \| 1 \| - \|/);
  assert.match(index, /`charge`: entities `charge`; value objects `money`; use cases `issue-charge`; queries `list-charges`; repositories `charge`; publishes `ChargePaid`/);
  assert.doesNotMatch(index, /issue-charge\.use-case\.test/, 'a test is not a use case');
  assert.match(index, /routes: `GET \/charges`, `POST \/charges\/:id\/pay`/);
  assert.match(index, /tables: `Charge`, `Payer`/);
  assert.match(index, /reacts to: `ChargePaid` \(billing\)/, 'rule 13: the subscriber is found in the backend wiring');
  assert.match(index, /imports the packages of `billing`/);
  assert.match(index, /screens `\/charges`/, 'the route group is not part of the path');
  assert.match(index, /## Screens outside a module\n\n`\/entrar`/);
  assert.match(index, /\*\*ADRs\*\*: `0001-charges-are-paid-once`/);
  assert.match(index, /\*\*Goals\*\*: `charges` \(met\)/);
});

test('--check decides by exit code whether the page is current', () => {
  const dir = monolith();
  const missing = run(dir, '--check');
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /docs\/index\.md is missing/);
  assert.equal(run(dir).status, 0);
  const current = run(dir, '--check');
  assert.equal(current.status, 0, current.stdout);
  assert.match(current.stdout, /is current/);
  assert.match(run(dir).stdout, /unchanged/, 'a second run writes nothing');
  // the code moves and the page does not: stale
  fs.writeFileSync(path.join(dir, 'modules/billing/src/charge/use-case/refund-charge.use-case.ts'), 'export class RefundCharge {}');
  const stale = run(dir, '--check');
  assert.equal(stale.status, 1);
  assert.match(stale.stdout, /docs\/index\.md is stale: run `npm run goal -- map` and commit it/);
  // a hand edit is stale too: the page is the code's, not an agent's
  run(dir);
  fs.appendFileSync(path.join(dir, 'docs', 'index.md'), '\nThe billing module is the heart of the product.\n');
  assert.equal(run(dir, '--check').status, 1);
});

test('the same tree gives the same page, whatever the line endings', () => {
  const dir = monolith();
  run(dir);
  const file = path.join(dir, 'docs', 'index.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
  assert.equal(run(dir, '--check').status, 0, 'a checkout with CRLF is not stale');
});

test('a project with no module has nothing to index, and says so', () => {
  const dir = project({ 'skills.config.json': '{}' });
  const out = run(dir);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /nothing to index/);
  assert.equal(run(dir, 'extra').status, 2, 'an unexpected argument is a usage error');
});

test('the squad reads the index and check:pr keeps it current', () => {
  const checkPr = read('skills/monolith/config-project/assets/scripts/check-pr.mjs');
  assert.match(checkPr, /'scripts\/goal\.mjs', 'map', '--check'/);
  assert.match(checkPr, /if \(hasModule \|\| fs\.existsSync\(path\.join\(root, 'docs', 'index\.md'\)\)\)/, 'a project with a module and no index is told to make one');
  const command = read('commands/engineer.md');
  assert.match(command, /`docs\/index\.md`/);
  assert.match(command, /npm run goal -- map/);
  assert.match(read('agents/solutions-architect.md'), /`docs\/index\.md`/);
});

test('the goal close regenerates the index after the merge and leaves no remote branch behind', () => {
  // A pilot's goal (2026-11-23): `Status: met` went to main after the merge with the index still saying `approved`,
  // and the goal's branch survived `gh pr merge --delete-branch`.
  const close = read('commands/engineer.md').split('\n').find((line) => line.startsWith('11. **Retro.**'));
  assert.ok(close, 'step 11 exists');
  assert.ok(close.indexOf('npm run goal -- map') > close.indexOf('Status: met on <date>'), 'the map runs after met is written');
  assert.match(close, /commit `docs\/index\.md` with the contract/);
  const merge = read('agents/platform-engineer.md');
  assert.match(merge, /gh pr merge --squash --delete-branch`, without asking, then `git ls-remote --exit-code --heads origin <branch>`/);
  assert.match(merge, /exit 0 is a branch left behind: `git push origin --delete <branch>`/);
});
