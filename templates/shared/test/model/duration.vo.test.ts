import { Duration, ValidationError } from '../../src/index.js';

test('creates a duration from seconds', () => {
  const duration = Duration.inSeconds(123);
  expect(duration.inSeconds).toBe(123);
});

test('creates a duration from days, hours, minutes and seconds', () => {
  const duration = Duration.from({ d: 1, h: 2, m: 3, s: 4 });
  expect(duration.inSeconds).toBe(93784);
});

test('creates a one-day duration', () => {
  const duration = Duration.from({ d: 1 });
  expect(duration.inDays).toBe(1);
  expect(duration.inHours).toBe(24);
  expect(duration.inMinutes).toBe(1440);
  expect(duration.inSeconds).toBe(86400);
});

test('creates a 30-second duration', () => {
  const duration = Duration.from({ s: 30 });
  expect(duration.inDays).toBe(0);
  expect(duration.inHours).toBe(0);
  expect(duration.inMinutes).toBe(0);
  expect(duration.inSeconds).toBe(30);
  expect(duration.toHMS).toBe('00h 00m 30s');
});

test('creates a zero duration', () => {
  const duration = Duration.zero();
  expect(duration.inSeconds).toBe(0);
});

test('converts a duration into days, hours, minutes and seconds', () => {
  const duration = Duration.from({ d: 1, h: 2, m: 3, s: 4 });
  expect(duration.inDays).toBe(1);
  expect(duration.inHours).toBe(26);
  expect(duration.inMinutes).toBe(1563);
});

test('formats a duration as HH:mm:ss', () => {
  const duration = Duration.from({ d: 1, h: 2, m: 3, s: 4 });
  expect(duration.toHMS).toBe('26h 03m 04s');
});

test('formats a duration as HH:mm', () => {
  const duration = Duration.from({ d: 1, h: 2, m: 3, s: 4 });
  expect(duration.toHM).toBe('26h 03m');
});

test('formats a duration as HH:mm', () => {
  const duration = Duration.from({ d: 1, h: 2, m: 3, s: 4 });
  expect(duration.toMS).toBe('1563m 04s');
});

test('adds two durations', () => {
  const duration1 = Duration.from({ d: 1, h: 2, m: 3, s: 4 });
  const duration2 = Duration.from({ d: 0, h: 1, m: 2, s: 3 });
  const duration3 = duration1.add(duration2);
  expect(duration3.inSeconds).toBe(97507);
});

test('throws when creating a negative duration', () => {
  expect(() => Duration.inSeconds(-10)).toThrow('duration.negative');
});

test('gets the hours and minutes of a duration', () => {
  const duration = Duration.from({ d: 1, h: 2, m: 3, s: 4 });
  expect(duration.hoursAndMinutes).toEqual({ hours: '26', minutes: '03' });
});

test('tries to create a duration and succeeds', () => {
  const duration = Duration.tryCreate(10000);
  expect(duration.isOk).toBe(true);
});

test('tries to create an invalid duration', () => {
  const duration = Duration.tryCreate(-10000);
  expect(duration.isOk).toBe(false);
  expect(duration.errors[0]?.code).toBe('duration.negative');
});

test('creates a valid duration through create', () => {
  const duration = Duration.create(60);
  expect(duration.inSeconds).toBe(60);
});

test('throws when creating a negative duration through create', () => {
  expect(() => Duration.create(-1)).toThrow();
});
