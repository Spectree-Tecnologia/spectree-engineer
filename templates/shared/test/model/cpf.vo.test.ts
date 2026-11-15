import { Cpf, ValidationError } from '../../src/index.js';

test('validates a CPF', () => {
  const cpf = new Cpf('12345678909');
  expect(cpf.formatted).toBe('123.456.789-09');
  expect(cpf.value).toBe('123.456.789-09');
});

test('throws when creating an invalid CPF', () => {
  expect(() => new Cpf('12345678900')).toThrow('cpf.invalid');
});

test('unformats a CPF', () => {
  const cpf = new Cpf('123.456.789-09');
  expect(cpf.unformatted).toBe('12345678909');
});

test('validates a CPF', () => {
  expect(Cpf.isValid(null as any)).toBe(false);
  expect(Cpf.isValid('')).toBe(false);
  expect(Cpf.isValid('123')).toBe(false);
  expect(Cpf.isValid('12345678909')).toBe(true);
});

test('creates a valid CPF through create', () => {
  const cpf = Cpf.create('12345678909');
  expect(cpf.formatted).toBe('123.456.789-09');
});

test('throws when creating an invalid CPF through create', () => {
  expect(() => Cpf.create('12345678900')).toThrow();
});

test('tries to create a CPF and succeeds', () => {
  const cpf = Cpf.tryCreate('12345678909');
  expect(cpf.isOk).toBe(true);
});

test('tries to create an invalid CPF', () => {
  const cpf = Cpf.tryCreate('12345678900');
  expect(cpf.isOk).toBe(false);
  expect(cpf.errors[0]?.code).toBe('cpf.invalid');
});
