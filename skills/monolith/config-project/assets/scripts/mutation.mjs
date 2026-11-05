// Mutation testing of one module with StrykerJS: `npm run mutation -- <module>`. Stryker changes the
// module's code one mutant at a time and expects a test to fail; a mutant that survives names a line
// no test proves. The score is the module's; the survivors in the files a ticket touched are the review's.
// Incremental: a second run re-tests only what changed (reports/stryker-incremental.json, not in git).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [module] = process.argv.slice(2);
if (!module) {
  console.error('usage: npm run mutation -- <module>   (a folder under modules/)');
  process.exit(2);
}
const dir = path.join(process.cwd(), 'modules', module);
if (!fs.existsSync(path.join(dir, 'stryker.config.json'))) {
  console.error(`mutation: no stryker.config.json in ${dir}; config-new-module writes one per module`);
  process.exit(2);
}
// One command string + shell: npx is a .cmd shim on Windows.
const res = spawnSync('npx stryker run', { cwd: dir, shell: true, stdio: 'inherit' });
process.exit(res.status ?? 1);
