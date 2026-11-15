import { Id } from '../../src/index.js';

test('creates a new valid id', () => {
  const id = Id.createUUID();
  expect(id).toHaveLength(36);
});

test('throws when creating an invalid id', () => {
  expect(() => new Id('123')).toThrow('id.invalid');
});

test('creates a new valid id from an existing id', () => {
  const value = Id.createUUID();
  const id = new Id(value);
  expect(id.value).toHaveLength(36);
});

test('is true for equal ids', () => {
  const id1 = Id.create();
  const id2 = new Id(id1.value);
  expect(id1.equals(id2)).toBe(true);
  expect(id1.notEquals(id2)).toBe(false);
});

test('is false for different ids', () => {
  const id1 = Id.create();
  const id2 = Id.create();
  expect(id1.equals(id2)).toBe(false);
  expect(id1.notEquals(id2)).toBe(true);
});

test('tries to create an id and succeeds', () => {
  const id = Id.tryCreate('70a3a0ad-1eaf-4b66-8555-10b374b949bd');
  expect(id.isOk).toBe(true);
});

test('tries to create an invalid id', () => {
  const id = Id.tryCreate('invalid-id');
  expect(id.isOk).toBe(false);
  expect(id.errors[0]?.code).toBe('id.invalid');
});
