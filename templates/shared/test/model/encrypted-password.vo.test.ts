import { EncryptedPassword, ValidationError } from '../../src/index.js';

const VALID_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
const INVALID_HASH = 'not-a-bcrypt-hash';

test('accepts a valid bcrypt hash', () => {
  const ep = new EncryptedPassword(VALID_HASH);
  expect(ep.value).toBe(VALID_HASH);
});

test('throws ValidationError for an invalid hash', () => {
  expect(() => new EncryptedPassword(INVALID_HASH)).toThrow(ValidationError);
});

test('throws ValidationError when value is undefined', () => {
  expect(() => new EncryptedPassword(undefined)).toThrow(ValidationError);
});

test('validates a bcrypt hash through isValid', () => {
  expect(EncryptedPassword.isValid(VALID_HASH)).toBe(true);
  expect(EncryptedPassword.isValid(INVALID_HASH)).toBe(false);
});

test('creates through create with a valid hash', () => {
  const ep = EncryptedPassword.create(VALID_HASH);
  expect(ep.value).toBe(VALID_HASH);
});

test('throws through create with an invalid hash', () => {
  expect(() => EncryptedPassword.create(INVALID_HASH)).toThrow();
});

test('returns an ok result through tryCreate with a valid hash', () => {
  const result = EncryptedPassword.tryCreate(VALID_HASH);
  expect(result.isOk).toBe(true);
  expect(result.instance.value).toBe(VALID_HASH);
});

test('returns a failure result through tryCreate with an invalid hash', () => {
  const result = EncryptedPassword.tryCreate(INVALID_HASH);
  expect(result.isOk).toBe(false);
  expect(result.errors[0]?.code).toBe('encrypted-password.invalid');
});
