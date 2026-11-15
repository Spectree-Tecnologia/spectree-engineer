import { StrongPassword, ValidationError } from '../../src/index.js';

const error = 'strong-password.too-weak';

test('throws on an empty password', () => {
  expect(() => new StrongPassword()).toThrow(error);
  expect(() => new StrongPassword('')).toThrow(error);
});

test('throws on a password with digits only', () => {
  expect(() => new StrongPassword('1234567890')).toThrow(error);
});

test('throws on a password with letters only', () => {
  expect(() => new StrongPassword('AbCdEfGhIj')).toThrow(error);
});

test('throws on a password without lowercase letters', () => {
  expect(() => new StrongPassword('ABC12345!')).toThrow(error);
});

test('throws on a password without a special character', () => {
  expect(() => new StrongPassword('Password1')).toThrow(error);
});

test('throws on a password with special characters only', () => {
  expect(() => new StrongPassword('!@#$%¨&*()_+')).toThrow(error);
});

test('throws on a password shorter than 8 characters', () => {
  expect(() => new StrongPassword('%S3nh4%')).toThrow(error);
});

test('creates a strong password', () => {
  const pass = 'S3nh4F0rt3%';
  expect(new StrongPassword(pass).value).toBe(pass);
});

test('tries to create a password and succeeds', () => {
  const password = StrongPassword.tryCreate('S3nh4F0rt3%');
  expect(password.isOk).toBe(true);
});

test('tries to create an invalid password', () => {
  const password = StrongPassword.tryCreate('1234567890');
  expect(password.isOk).toBe(false);
  expect(password.errors[0]?.code).toBe('strong-password.too-weak');
});
