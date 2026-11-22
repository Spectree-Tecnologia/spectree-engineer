import http from 'node:http';
import { Writable } from 'node:stream';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { LOG_REDACT_PATHS, pathOf, REQUEST_LOG_SERIALIZERS } from './log-redact.js';

// A sign-in answers with the refresh token in set-cookie, and a magic link carries its token in the query: on the
// pilot project both reached the request log, 42 tokens in one e2e run.
const SECRET = 'secret-0123456789';

async function logOf(url: string): Promise<string> {
  let lines = '';
  const stream = new Writable({ write: (chunk, _enc, done) => ((lines += chunk), done()) });
  const log = pinoHttp({ logger: pino({ redact: LOG_REDACT_PATHS }, stream), serializers: REQUEST_LOG_SERIALIZERS });
  const server = http.createServer((req, res) => {
    log(req, res);
    res.setHeader('set-cookie', `refresh_token=${SECRET}; HttpOnly`);
    res.end('ok');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await fetch(`http://127.0.0.1:${port}${url}`, { headers: { authorization: `Bearer ${SECRET}`, cookie: `refresh_token=${SECRET}` } });
  await new Promise((resolve) => server.close(resolve));
  return lines;
}

describe('the request log', () => {
  it('writes no credential: not the response cookie, not a request header, not the query', async () => {
    const lines = await logOf(`/auth/magic-link?token=${SECRET}`);
    expect(lines).toContain('/auth/magic-link');
    expect(lines).not.toContain(SECRET);
  });

  it('cuts the path at a query, parameter or fragment, raw or percent-encoded', () => {
    for (const url of ['/a?token=x', '/a;token=x', '/a#x', '/a%3Ftoken=x', '/a%3btoken=x', '/a%23x']) {
      expect(pathOf(url)).toBe('/a');
    }
  });
});
