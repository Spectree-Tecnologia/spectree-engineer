// The bootstrap's two edits to `NestFactory.create(...)` land on every shape `nest new` has written (0.52.2): the
// scaffold of 2026-11 passes `{ instrument: ObserveInstrument }`, the edits matched the bare call only, did nothing and
// said nothing, and the release image wrote Nest's start-up lines as plain text with CORS never restricted to the frontend.
//   node --test tests/nest-main.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { withBufferedLogs, withCors } from '../skills/monolith/utils/nest-main.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BARE = `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
`;
const OBSERVE = `import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
`;

test('the start-up logs are buffered on the bare call and on a call that already has options', () => {
  assert.match(withBufferedLogs(BARE), /NestFactory\.create\(AppModule, \{ bufferLogs: true \}\);/);
  assert.match(withBufferedLogs(OBSERVE), /NestFactory\.create\(AppModule, \{\n    bufferLogs: true,\n    instrument: ObserveInstrument,\n  \}\);/);
  assert.match(withBufferedLogs(BARE.replace('create(AppModule)', 'create<NestExpressApplication>(AppModule, { cors: false })')), /\{ bufferLogs: true, cors: false \}/);
});

test('CORS is restricted to the frontend on both shapes, before the listen', () => {
  for (const main of [BARE, OBSERVE]) {
    assert.match(withCors(main), /\n  app\.enableCors\(\{ origin: process\.env\.FRONTEND_URL\?\.split\(','\) \?\? false \}\);\n  await app\.listen\(/);
  }
});

test('both edits are idempotent, and refuse a main.ts they cannot edit instead of passing in silence', () => {
  for (const main of [BARE, OBSERVE]) {
    const once = withCors(withBufferedLogs(main));
    assert.equal(withCors(withBufferedLogs(once)), once);
  }
  assert.throws(() => withBufferedLogs(BARE.replace('create(AppModule)', 'create(AppModule, options)')), /not an object literal/);
  assert.throws(() => withBufferedLogs('export {};\n'), /no `NestFactory\.create\(AppModule`/);
  assert.throws(() => withCors('export {};\n'), /no `await app\.listen\(`/);
});

test('the two bootstrap scripts use these edits, not a literal of their own', () => {
  const init = fs.readFileSync(path.join(repo, 'skills/monolith/config-project/scripts/project-init.mjs'), 'utf8');
  const apply = fs.readFileSync(path.join(repo, 'skills/monolith/config-shared-backend/scripts/apply.js'), 'utf8');
  assert.match(init, /content = withCors\(content\);/);
  assert.match(apply, /withBufferedLogs\(content\)/);
  assert.doesNotMatch(init + apply, /NestFactory\.create\(AppModule\)/);
});
