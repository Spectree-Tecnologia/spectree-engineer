import { NonNegative, ValidationError } from '../../src/index.js';

test('creates a NonNegative with valid values', () => {
  expect(new NonNegative(0).value).toBe(0);
  expect(new NonNegative(10).value).toBe(10);
  expect(new NonNegative(999.99).value).toBe(999.99);
});

test('throws ValidationError for negative numbers', () => {
  expect(() => new NonNegative(-1)).toThrow(ValidationError);
  expect(() => new NonNegative(-100)).toThrow(ValidationError);
  expect(() => new NonNegative(-0.01)).toThrow(ValidationError);
});

test('tries to create a non-negative number and succeeds', () => {
  const nonNegative = NonNegative.tryCreate(10);
  expect(nonNegative.isOk).toBe(true);
});

test('tries to create an invalid non-negative number', () => {
  const nonNegative = NonNegative.tryCreate(-10);
  expect(nonNegative.isOk).toBe(false);
  expect(nonNegative.errors[0]?.code).toBe('non-negative.invalid');
});

test('creates a valid non-negative number through create', () => {
  const nonNegative = NonNegative.create(0);
  expect(nonNegative.value).toBe(0);
});

test('throws when creating a negative number through create', () => {
  expect(() => NonNegative.create(-1)).toThrow();
});
