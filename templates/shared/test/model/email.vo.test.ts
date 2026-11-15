import { Email, ValidationError } from '../../src/index.js';

const error = 'email.invalid';

test('creates a valid email', () => {
  const email = new Email('fulano@zmail.com');
  expect(email.value).toBe('fulano@zmail.com');
});

test('returns the user name', () => {
  const email = new Email('fulano@zmail.com');
  expect(email.username).toBe('fulano');
});

test('returns the domain', () => {
  const email = new Email('fulano@zmail.com');
  expect(email.domain).toBe('zmail.com');
});

test('validates an email', () => {
  expect(Email.isValid('user@email.com')).toBeTruthy();
  expect(Email.isValid('user@email')).toBeFalsy();
});

test('throws when creating an invalid email', () => {
  expect(() => new Email(undefined as any)).toThrow(error);
  expect(() => new Email('')).toThrow(error);
  expect(() => new Email('fulano')).toThrow(error);
  expect(() => new Email('fulano@zmail')).toThrow(error);
});

test('tries to create an email and succeeds', () => {
  const email = Email.tryCreate('johndoe@example.com');
  expect(email.isOk).toBe(true);
});

test('tries to create an invalid email', () => {
  const email = Email.tryCreate('invalid-email@');
  expect(email.isOk).toBe(false);
  expect(email.errors[0]?.code).toBe('email.invalid');
});
