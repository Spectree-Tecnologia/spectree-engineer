/** Request headers that carry a credential: they never reach a log line, from any logger. */
export const LOG_REDACT_PATHS = ['req.headers.authorization', 'req.headers.cookie'];

/**
 * A request URL's path, cut at the first query (`?`), parameter (`;`) or fragment (`#`) delimiter, raw or
 * percent-encoded: what follows may carry a credential (`?token=` of a magic link, or `%3Ftoken=` on a path no route matches).
 */
export const pathOf = (url: string): string => url.split(/[?;#]|%(?:3f|3b|23)/i)[0]!;

/**
 * What the request line keeps, by allowlist: the method, the path, the client address (Express's `req.ip`, which honours
 * `trust proxy`) and the status. No header of the request or of the response (`set-cookie` carries a refresh token) and
 * no query string is ever written, whichever credential a later route adds. pino-http hands each one its standard
 * serialization (`url` is `originalUrl`, `raw` the request).
 */
export const REQUEST_LOG_SERIALIZERS = {
  req: (req: { method: string; url: string; raw: { ip?: string } }) => ({
    method: req.method,
    path: pathOf(req.url),
    ip: req.raw.ip,
  }),
  res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
};
