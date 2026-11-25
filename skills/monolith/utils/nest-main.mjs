// The two edits the bootstrap makes to the `NestFactory.create(...)` call of apps/backend/src/main.ts.
// `nest new` changes the shape of that call between releases (bare `create(AppModule)`, then
// `create(AppModule, { instrument: ObserveInstrument })`), so neither edit matches one literal text,
// and each throws when it cannot land: an edit that silently does nothing ships plain-text logs or closed CORS.

const CREATE = /NestFactory\.create(?:<[^>]+>)?\(\s*AppModule\b/;
const CORS = "app.enableCors({ origin: process.env.FRONTEND_URL?.split(',') ?? false });";

/** CORS only for the frontend, right before `app.listen`. Leaves a main.ts that already calls enableCors alone. */
export function withCors(content) {
  if (content.includes('app.enableCors(')) return content;
  const listen = /^([ \t]*)(await app\.listen\()/m;
  if (!listen.test(content)) throw new Error('main.ts has no `await app.listen(` to put app.enableCors before');
  return content.replace(listen, `$1${CORS}\n$1$2`);
}

/** `bufferLogs: true` in the options of `NestFactory.create(AppModule, …)`, whatever else the options hold. */
export function withBufferedLogs(content) {
  if (/\bbufferLogs\s*:/.test(content)) return content;
  if (!CREATE.test(content)) throw new Error('main.ts has no `NestFactory.create(AppModule` to buffer the start-up logs of');
  const bare = new RegExp(`(${CREATE.source})\\s*\\)`);
  if (bare.test(content)) return content.replace(bare, '$1, { bufferLogs: true })');
  const withOptions = new RegExp(`(${CREATE.source}\\s*,\\s*\\{)(\\s*)`);
  if (withOptions.test(content)) return content.replace(withOptions, '$1$2bufferLogs: true,$2');
  throw new Error('the options of `NestFactory.create(AppModule, …)` in main.ts are not an object literal: add `bufferLogs: true` to them');
}
