#!/usr/bin/env node
'use strict';
// Windows entry point for Cloudflare's validator: its CLI refuses to open files where O_NOFOLLOW does not
// exist (Windows), so this runs the same schema + semantic checks on a plain read. The symlink guard is
// the only thing skipped; the output dir is ours and outside the repo. Elsewhere, call the original CLI.
const fs = require('node:fs');
const path = require('node:path');
const { validateDocument, collectSchemaErrors } = require('./security-audit/validate-findings.cjs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node validate-findings.cjs <findings.json>');
  process.exit(2);
}
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'security-audit', 'report-schema.json'), 'utf8'));
const schemaErrors = collectSchemaErrors(schema);
if (schemaErrors.length > 0) {
  console.error(schemaErrors.join('\n'));
  process.exit(1);
}
const findings = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = validateDocument(findings, schema);
if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
const count = Array.isArray(findings) ? findings.length : Array.isArray(findings.findings) ? findings.findings.length : 0;
console.log(`PASS: ${count} findings valid`);
