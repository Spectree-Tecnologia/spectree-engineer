import { URL, Url, ValidationError } from '../../src/index.js';

const defaultError = 'url.invalid';

test('returns the full domain of the url', () => {
  const url = new Url('https://www.google.com/search?q=typescript');
  expect(url.domain).toBe('www.google.com');
});

test('returns the protocol of the url', () => {
  const url = new Url('https://www.google.com/search?q=typescript');
  expect(url.protocol).toBe('https:');
});

test('returns the path of the url', () => {
  const url = new Url('https://www.google.com/search?q=typescript');
  expect(url.pathname).toBe('/search');
});

test('returns the parameters of the url', () => {
  const url = new Url('https://www.google.com/search?q=typescript&hl=pt-BR');
  expect(url.parameters).toEqual({ q: 'typescript', hl: 'pt-BR' });
  expect(url.parameters.q).toBe('typescript');
  expect(url.parameters.hl).toBe('pt-BR');
});

test('throws on an invalid url', () => {
  expect(() => new Url()).toThrow(defaultError);
  expect(() => new Url('')).toThrow(defaultError);
  expect(() => new Url('www.google.com')).toThrow(defaultError);
  expect(() => new Url('https//www.google.com')).toThrow(defaultError);
});

test('validates a url', () => {
  expect(Url.isValid('https://www.google.com/search?q=typescript')).toBeTruthy();
  expect(Url.isValid('www.google.com')).toBeFalsy();
});

test('tries to create a url and succeeds', () => {
  const url = Url.tryCreate('https://www.google.com/search?q=typescript');
  expect(url.isOk).toBe(true);
});

test('tries to create an invalid url', () => {
  const url = Url.tryCreate('www.google.com');
  expect(url.isOk).toBe(false);
  expect(url.errors[0]?.code).toBe(defaultError);
});

test('creates an instance through the URL subclass', () => {
  const url = new URL('https://example.com');
  expect(url.value).toBe('https://example.com');
});
