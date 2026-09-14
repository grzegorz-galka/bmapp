/** Dates, times and numbers in the conventions of each language. */
import { describe, expect, it } from 'vitest';
import {
  countdownFrom,
  formatDate,
  formatDateTime,
  formatNumber,
  formatWeekdayAndTime,
} from './format';

// A Thursday, given with an explicit offset so the instant is unambiguous.
// The suite runs in UTC (see vitest.setup.ts), so this reads back as 09:30.
const MEETING = '2026-09-17T09:30:00Z';
const UNAVAILABLE = 'Not available';

describe('formatDateTime', () => {
  it('names the weekday and month in English', () => {
    const formatted = formatDateTime(MEETING, 'en', UNAVAILABLE);

    expect(formatted).toContain('Thu');
    expect(formatted).toContain('Sep');
    expect(formatted).toContain('09:30');
  });

  it('names the weekday and month in Polish', () => {
    const formatted = formatDateTime(MEETING, 'pl', UNAVAILABLE);

    expect(formatted).toContain('czw');
    expect(formatted).toContain('wrz');
    expect(formatted).toContain('09:30');
  });

  it('formats the same instant differently in each language', () => {
    expect(formatDateTime(MEETING, 'en', UNAVAILABLE)).not.toBe(
      formatDateTime(MEETING, 'pl', UNAVAILABLE),
    );
  });

  it('reports a value it cannot read as unavailable', () => {
    expect(formatDateTime('not a date', 'en', UNAVAILABLE)).toBe(UNAVAILABLE);
  });
});

describe('formatDate', () => {
  it('formats a calendar date in English', () => {
    expect(formatDate('2026-09-17', 'en', UNAVAILABLE)).toContain('Sep');
  });

  it('formats a calendar date in Polish', () => {
    expect(formatDate('2026-09-17', 'pl', UNAVAILABLE)).toContain('wrz');
  });

  it('keeps a date on the day it names, whatever the reader time zone', () => {
    // Parsed as local midnight rather than UTC midnight: the other way round,
    // a reader west of Greenwich sees the previous day.
    expect(formatDate('2026-09-17', 'en', UNAVAILABLE)).toContain('17');
  });

  it('reports a value it cannot read as unavailable', () => {
    expect(formatDate('', 'pl', UNAVAILABLE)).toBe(UNAVAILABLE);
  });
});

describe('formatWeekdayAndTime', () => {
  it('names the weekday in full in English', () => {
    expect(formatWeekdayAndTime(MEETING, 'en', UNAVAILABLE)).toContain('Thursday');
  });

  it('names the weekday in full in Polish', () => {
    expect(formatWeekdayAndTime(MEETING, 'pl', UNAVAILABLE)).toContain('czwartek');
  });
});

describe('formatNumber', () => {
  it('groups thousands the English way', () => {
    expect(formatNumber(12345, 'en', UNAVAILABLE)).toBe('12,345');
  });

  it('groups thousands the Polish way', () => {
    // Polish uses a non-breaking space as the group separator.
    expect(formatNumber(12345, 'pl', UNAVAILABLE)).not.toBe('12,345');
    expect(formatNumber(12345, 'pl', UNAVAILABLE)).toMatch(/12\s?345/);
  });

  it('reports a value it cannot read as unavailable', () => {
    expect(formatNumber(Number.NaN, 'en', UNAVAILABLE)).toBe(UNAVAILABLE);
  });
});

describe('countdownFrom', () => {
  it('breaks a duration into whole days, hours and minutes', () => {
    const duration = 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 59_000;

    expect(countdownFrom(duration)).toEqual({ days: 2, hours: 3, minutes: 4 });
  });

  it('reads zero for a meeting happening right now', () => {
    expect(countdownFrom(0)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });

  it('reads zero rather than a negative for a meeting already past', () => {
    expect(countdownFrom(-90 * 60_000)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });

  it('carries hours and minutes without letting them exceed their unit', () => {
    const { hours, minutes } = countdownFrom(6 * 86_400_000 + 23 * 3_600_000 + 59 * 60_000);

    expect(hours).toBe(23);
    expect(minutes).toBe(59);
  });
});
