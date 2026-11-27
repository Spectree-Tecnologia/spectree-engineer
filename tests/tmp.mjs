// A temp folder for a test, removed when the test file's process exits. KEEP_TMP=1 keeps every folder, to inspect a red test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const made = [];
process.on('exit', () => {
  if (process.env.KEEP_TMP === '1') return;
  for (const dir of made) {
    try {
      // goal.mjs keeps a project's gate logs and receipts in <tmpdir>/spectree-gate/<project folder name>/
      fs.rmSync(path.join(os.tmpdir(), 'spectree-gate', path.basename(dir)), { recursive: true, force: true, maxRetries: 3 });
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // a file a child process still holds on Windows: the folder stays, nothing else depends on it
    }
  }
});

export function tmpDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}
