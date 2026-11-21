#!/usr/bin/env node
'use strict';
// Windows entry point for Cloudflare's coverage-ledger validator (issue 107): its CLI refuses every input where
// O_NOFOLLOW does not exist (Windows), so this runs the same preflight and validation on a plain read, keeping the
// regular-file and size checks. The symlink guard is the only thing skipped; the ledger is ours and outside the repo.
// Elsewhere it calls the original CLI.
const fs = require('node:fs');
const path = require('node:path');
const original = path.join(__dirname, 'security-audit', 'validate-coverage-ledger.cjs');
const { preflightJsonText, validateDocument, LIMITS } = require(original);

const file = process.argv[2];
if (!file) {
  console.error('usage: node validate-coverage-ledger.cjs <coverage-ledger.json>');
  process.exit(2);
}
if (Number.isInteger(fs.constants.O_NOFOLLOW) && fs.constants.O_NOFOLLOW !== 0) {
  const r = require('node:child_process').spawnSync(process.execPath, [original, file], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
const stat = fs.statSync(file);
if (!stat.isFile()) {
  console.error('Failed to read coverage ledger: input must be a regular file');
  process.exit(1);
}
if (LIMITS?.inputBytes && stat.size > LIMITS.inputBytes) {
  console.error(`Failed to read coverage ledger: input exceeds ${LIMITS.inputBytes} byte limit`);
  process.exit(1);
}
const contents = fs.readFileSync(file, 'utf8');
try {
  preflightJsonText(contents);
} catch (error) {
  console.error(`Failed to parse coverage ledger: ${error.message}`);
  process.exit(1);
}
let ledger;
try {
  ledger = JSON.parse(contents);
} catch {
  console.error('Failed to parse coverage ledger: invalid JSON syntax');
  process.exit(1);
}
const errors = validateDocument(ledger);
for (const message of errors) console.error('ERROR:', message);
if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} validation error(s)`);
  process.exit(1);
}
console.log(`PASS: ${ledger.length} coverage units valid`);
