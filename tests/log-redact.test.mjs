// The generated backend writes no credential to its request log (0.48.0, issue 104): on the pilot project one e2e log
// held 42 refresh tokens from set-cookie and magic-link tokens from the query. The proof is the asset's own spec, run in
// the project (`log-redact.spec.ts`); this checks that the module wires it and the skill copies it.
//   node --test tests/log-redact.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'skills', 'monolith', 'config-shared-backend');
const read = (rel) => fs.readFileSync(path.join(skill, rel), 'utf8');

test('the request line is an allowlist, and the skill copies it with its spec', () => {
  const shared = read('assets/apps/backend/src/shared/shared.module.ts');
  assert.match(shared, /redact: LOG_REDACT_PATHS,\s*serializers: REQUEST_LOG_SERIALIZERS,/);
  const apply = read('scripts/apply.js');
  for (const file of ['log-redact.ts', 'log-redact.spec.ts']) {
    assert.match(apply, new RegExp(`'apps/backend/src/shared/config/${file.replace('.', '\\.')}'`));
    assert.ok(fs.existsSync(path.join(skill, 'assets/apps/backend/src/shared/config', file)));
  }
  assert.match(read('assets/apps/backend/src/shared/config/log-redact.spec.ts'), /set-cookie[\s\S]*\?token=[\s\S]*not\.toContain\(SECRET\)/);
});
