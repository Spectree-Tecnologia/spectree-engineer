#!/usr/bin/env node
// Empties every apps/*/.next before `npm run build` (the root `prebuild`), keeping only .next/cache.
// turbo restores a cached build on top of what is already there and deletes nothing: a .next left by an earlier
// build kept its pages next to the restored ones, and the dev server and Playwright served stale pages.
// .next/cache is Next's own incremental cache: it is not a turbo output (`!.next/cache/**`) and survives the clean.
//   node scripts/clean-next.mjs [dir ...]   the app dirs to clean; default every apps/* that has a .next
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appsDir = path.join(root, 'apps');
const dirs = process.argv.length > 2
  ? process.argv.slice(2).map((dir) => path.resolve(root, dir))
  : fs.existsSync(appsDir) ? fs.readdirSync(appsDir).map((name) => path.join(appsDir, name)) : [];

for (const dir of dirs) {
  const next = path.join(dir, '.next');
  if (!fs.existsSync(next)) continue;
  const removed = fs.readdirSync(next).filter((name) => name !== 'cache');
  for (const name of removed) fs.rmSync(path.join(next, name), { recursive: true, force: true });
  if (removed.length > 0) console.log(`clean-next: ${path.relative(root, next)} emptied (cache kept)`);
}
