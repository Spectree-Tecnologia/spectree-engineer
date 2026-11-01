// Runs the Engineer panel's tests with `claude plugin test` from a copy that holds only the
// manifest, the hooks module and tests/: the command scans every *.test.ts under the folder it is
// given, and templates/shared/test/ holds the generated project's Vitest files, which it cannot load.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'engineer-desk-'));
try {
  for (const part of ['.claude-plugin', 'hooks', 'tests']) cpSync(join(REPO, part), join(dir, part), { recursive: true });
  // One command string: on Windows `claude` is a .cmd shim, which needs the shell.
  const run = spawnSync(`claude plugin test "${dir}"`, { stdio: 'inherit', shell: true });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
