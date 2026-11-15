import { PersonName, ValidationError } from '../../src/index.js';

test('throws when creating an empty name', () => {
  expect(() => new PersonName()).toThrow();
  expect(() => new PersonName('')).toThrow();
});

test('throws several errors when creating an empty name', () => {
  expect(() => new PersonName()).toThrow();
});

test('throws when creating a name shorter than 3 characters', () => {
  expect(() => new PersonName('L Z')).toThrow();
});

test('throws when creating a name longer than 120 characters', () => {
  const bigName =
    'Pedro de Alcântara João Carlos Leopoldo Salvador Bibiano Francisco Xavier de Paula Leocádio Miguel Gabriel Rafael Gonzaga de Bragança e Habsburgo';
  expect(() => new PersonName(bigName)).toThrow();
});

test('throws when creating a name without a surname', () => {
  expect(() => new PersonName('Guilherme')).toThrow();
});

test('throws when creating a name with special characters', () => {
  expect(() => new PersonName('João @OOOJoao')).toThrow();
});

test('creates a first name and two surnames', () => {
  const name = new PersonName('João Silva Pereira');
  expect(name.value).toBe('João Silva Pereira');
  expect(name.firstName).toBe('João');
  expect(name.lastNames).toEqual(['Silva', 'Pereira']);
  expect(name.lastName).toBe('Pereira');
});

test('creates a name with an apostrophe', () => {
  const nameExample = "João D'Ávila";
  const name = new PersonName(nameExample);
  expect(name.value).toBe(nameExample);
});

test('returns the initials of the name', () => {
  const name = new PersonName('João Silva Pereira');
  expect(name.initials).toBe('JP');
});

test('tries to create a name and succeeds', () => {
  const name = PersonName.tryCreate('João Silva Pereira');
  expect(name.isOk).toBe(true);
});

test('tries to create an invalid name', () => {
  const name = PersonName.tryCreate('João');
  expect(name.isOk).toBe(false);
  expect(name.errors[0]?.code).toBe('person-name.surname-missing');
});
