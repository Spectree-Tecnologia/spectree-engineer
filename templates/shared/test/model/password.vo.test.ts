import { Password } from '../../src/index.js';

test('returns a password', () => {
  expect(new Password('123').value).toBeDefined();
  expect(new Password('abc123').value).toBeDefined();
  expect(new Password('%%StrongPassword123').value).toBeDefined();
});

test('throws on an empty password', () => {
  expect(() => new Password(undefined as any)).toThrow('password.empty');
  expect(() => new Password('')).toThrow('password.empty');
  expect(() => new Password('     ')).toThrow('password.empty');
});

test('tries to create a password and succeeds', () => {
  const password = Password.tryCreate('123');
  expect(password.isOk).toBe(true);
});

test('tries to create an invalid password', () => {
  const password = Password.tryCreate('    ');
  expect(password.isOk).toBe(false);
  expect(password.errors[0]?.code).toBe('password.empty');
});

test('creates a valid password through create', () => {
  const password = Password.create('secret123');
  expect(password.value).toBe('secret123');
});

test('throws when creating an invalid password through create', () => {
  expect(() => Password.create('')).toThrow();
});
