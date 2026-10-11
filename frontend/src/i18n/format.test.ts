/** Dates, times and numbers in the conventions of each language. */
import { afterEach, describe, expect, it } from 'vitest';
import {
  countdownFrom,
  formatDate,
  formatDateTime,
  formatMeetingDate,
  formatMeetingTime,
  formatMetricValue,
  formatNumber,
  formatScheduleWeekday,
  formatWeekdayAndTime,
  editableDecimal,
  parseLocalizedDecimal,
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

describe('meeting dates and times', () => {
  const readerZone = process.env.TZ;

  afterEach(() => {
    process.env.TZ = readerZone;
  });

  it('names a meeting date in English', () => {
    expect(formatMeetingDate('2026-10-14', 'en', UNAVAILABLE)).toBe('Wed, 14 Oct 2026');
  });

  it('names a meeting date in Polish', () => {
    expect(formatMeetingDate('2026-10-14', 'pl', UNAVAILABLE)).toBe('śr., 14 paź 2026');
  });

  it('shows a start time on a 24-hour clock in both languages', () => {
    expect(formatMeetingTime('13:00', 'en', UNAVAILABLE)).toBe('13:00');
    expect(formatMeetingTime('09:30', 'pl', UNAVAILABLE)).toBe('09:30');
  });

  it('names a schedule weekday in each language', () => {
    expect(formatScheduleWeekday(3, 'en', UNAVAILABLE)).toBe('Wednesday');
    expect(formatScheduleWeekday(3, 'pl', UNAVAILABLE)).toBe('środa');
    expect(formatScheduleWeekday(7, 'en', UNAVAILABLE)).toBe('Sunday');
  });

  it("shows the organization's time to a reader in another zone", () => {
    // Far enough east that local midnight is already the next day in UTC.
    process.env.TZ = 'Pacific/Auckland';

    expect(formatMeetingDate('2026-10-14', 'en', UNAVAILABLE)).toBe('Wed, 14 Oct 2026');
    expect(formatMeetingTime('23:30', 'en', UNAVAILABLE)).toBe('23:30');
    expect(formatScheduleWeekday(1, 'en', UNAVAILABLE)).toBe('Monday');
  });

  it('reports a value it cannot read as unavailable', () => {
    expect(formatMeetingDate('14.10.2026', 'en', UNAVAILABLE)).toBe(UNAVAILABLE);
    expect(formatMeetingTime('1pm', 'en', UNAVAILABLE)).toBe(UNAVAILABLE);
    expect(formatScheduleWeekday(8, 'en', UNAVAILABLE)).toBe(UNAVAILABLE);
  });
});

describe('parseLocalizedDecimal', () => {
  it('reads a Polish decimal comma', () => {
    expect(parseLocalizedDecimal('95,3', 'pl')).toBe('95.3');
  });

  it('reads an English decimal point', () => {
    expect(parseLocalizedDecimal('95.3', 'en')).toBe('95.3');
  });

  it.each([
    ['1 234 567,25', 'pl', '1234567.25'],
    ['1 234,5', 'pl', '1234.5'],
    ['174122665', 'pl', '174122665'],
    ['1,234,567.25', 'en', '1234567.25'],
    ['-0.5', 'en', '-0.5'],
    ['−5,5', 'pl', '-5.5'],
    ['  12  ', 'en', '12'],
  ] as const)('reads %s in %s with thousands separators and signs', (text, language, expected) => {
    expect(parseLocalizedDecimal(text, language)).toBe(expected);
  });

  it.each([
    ['95,3,1', 'pl'],
    ['95,3,1', 'en'],
    ['95,3', 'en'],
    ['95.3', 'pl'],
    ['12 34', 'pl'],
    ['', 'en'],
    ['abc', 'en'],
    ['1e5', 'en'],
  ] as const)('refuses %s in %s', (text, language) => {
    expect(parseLocalizedDecimal(text, language)).toBeNull();
  });
});

describe('formatMetricValue', () => {
  it('shows the metric’s decimals and unit in each language', () => {
    expect(formatMetricValue('95.3', 1, '%', 'pl')).toBe('95,3 %');
    expect(formatMetricValue('95.3', 1, '%', 'en')).toBe('95.3 %');
  });

  it('rounds to the decimals shown and groups thousands', () => {
    expect(formatMetricValue('165.36', 1, 'mln zł', 'pl')).toBe('165,4 mln zł');
    expect(formatMetricValue('174122665', 0, '', 'en')).toBe('174,122,665');
  });

  it('keeps every digit of the largest value stored', () => {
    expect(formatMetricValue('999999999999999.999999', 6, '', 'en')).toBe(
      '999,999,999,999,999.999999',
    );
  });

  it('shows a dash when there is no number', () => {
    expect(formatMetricValue(null, 1, '%', 'en')).toBe('—');
  });
});

describe('editableDecimal', () => {
  it('writes a stored value as the reader would type it, and reads back unchanged', () => {
    expect(editableDecimal('-1234.5', 'pl')).toBe('-1234,5');
    expect(parseLocalizedDecimal(editableDecimal('-1234.5', 'pl'), 'pl')).toBe('-1234.5');
    expect(editableDecimal('95.3', 'en')).toBe('95.3');
    expect(editableDecimal(null, 'en')).toBe('');
  });
});
