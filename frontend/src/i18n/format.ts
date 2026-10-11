/**
 * Formatting dates, times and numbers for the active language.
 *
 * `Intl` rather than a date library: both formatters are in every browser the
 * application supports, and a dependency here would only re-wrap them.
 *
 * Nothing is formatted until it is displayed. Values arrive from the API as
 * ISO 8601 and as numbers, which is what lets a language change reformat what
 * is already on screen without another request.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FALLBACK_LANGUAGE, isSupported, type Language } from './languages';

/** The locale each supported language formats as. */
export const LOCALES: Record<Language, string> = {
  en: 'en-GB',
  pl: 'pl-PL',
};

/** Whole days, hours and minutes remaining. Never negative. */
export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Break a duration in milliseconds into whole units, clamped at zero.
 *
 * Clamped rather than signed: a meeting that has started is not "minus four
 * minutes away", it is under way, and the hub reads zero for it.
 */
export function countdownFrom(milliseconds: number): Countdown {
  const remaining = Math.max(0, milliseconds);
  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor(remaining / HOUR) % 24,
    minutes: Math.floor(remaining / MINUTE) % 60,
  };
}

/** Parse an ISO 8601 value, or report that it cannot be read as a date. */
function toDate(value: string | number | Date): Date | undefined {
  // A date with no time is midnight UTC rather than midnight wherever the
  // reader is, which would shift it a day either side of the date line.
  const parsed =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function format(
  value: string | number | Date,
  language: Language,
  options: Intl.DateTimeFormatOptions,
  unavailable: string,
): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(LOCALES[language], options).format(date) : unavailable;
}

/** "Thu 17 Sep, 09:30" - a meeting, in the reader's own time zone. */
export function formatDateTime(
  value: string | number | Date,
  language: Language,
  unavailable: string,
): string {
  return format(
    value,
    language,
    { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    unavailable,
  );
}

/** "17 Sep" - a due date, which has no time of its own. */
export function formatDate(
  value: string | number | Date,
  language: Language,
  unavailable: string,
): string {
  return format(value, language, { day: 'numeric', month: 'short' }, unavailable);
}

/** "Thursday, 09:30" - the weekly slot a team meets in. */
export function formatWeekdayAndTime(
  value: string | number | Date,
  language: Language,
  unavailable: string,
): string {
  return format(
    value,
    language,
    { weekday: 'long', hour: '2-digit', minute: '2-digit' },
    unavailable,
  );
}

/*
 * Meetings carry wall-clock values - "2026-10-14", "13:00" - already on the
 * organization's clock, so they are formatted as they stand rather than
 * converted to the reader's zone. Building them as UTC and formatting in UTC
 * is what keeps the reader's zone out: a colleague working from another
 * country still sees the time the team actually meets.
 */
const WALL_CLOCK: Intl.DateTimeFormatOptions = { timeZone: 'UTC' };

function wallClockDate(date: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return undefined;
  const [, year, month, day] = match.map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

/** "Wed, 14 Oct 2026" - the date a meeting falls on. */
export function formatMeetingDate(date: string, language: Language, unavailable: string): string {
  const value = wallClockDate(date);
  return value
    ? new Intl.DateTimeFormat(LOCALES[language], {
        ...WALL_CLOCK,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(value)
    : unavailable;
}

/** "13:00" - a meeting's start, or a schedule's. */
export function formatMeetingTime(time: string, language: Language, unavailable: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return unavailable;
  const value = new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2])));
  return new Intl.DateTimeFormat(LOCALES[language], {
    ...WALL_CLOCK,
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

/** "Wednesday" - an ISO weekday, Monday 1 to Sunday 7. */
export function formatScheduleWeekday(
  weekday: number,
  language: Language,
  unavailable: string,
): string {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return unavailable;
  // 2024-01-01 was a Monday.
  const value = new Date(Date.UTC(2024, 0, weekday));
  return new Intl.DateTimeFormat(LOCALES[language], { ...WALL_CLOCK, weekday: 'long' }).format(
    value,
  );
}

export function formatNumber(value: number, language: Language, unavailable: string): string {
  return Number.isFinite(value)
    ? new Intl.NumberFormat(LOCALES[language]).format(value)
    : unavailable;
}

/*
 * Metric values travel as decimal strings ("95.3"), never as floats, so a
 * boundary comparison on the server is exact. They are parsed from and shown
 * in the reader's own convention - "95,3" in Polish - without passing through
 * a JavaScript number on the way, which could not hold 15 digits and 6 places.
 */

/** The decimal and grouping separators a language writes numbers with. */
function separators(language: Language): { decimal: string; groups: string[] } {
  const parts = new Intl.NumberFormat(LOCALES[language]).formatToParts(12345.6);
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  const group = parts.find((part) => part.type === 'group')?.value ?? ',';
  // Polish groups with a no-break space; people type an ordinary one.
  const groups = /\s/.test(group) ? [group, ' ', '\u202f'] : [group];
  return { decimal, groups };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A number as typed in the active language, as the canonical string the API
 * reads ("1 234,5" in Polish is "1234.5"), or null if it is not one.
 *
 * Thousands separators are accepted only in groups of three, so "95,3" in
 * English is refused rather than read as 953.
 */
export function parseLocalizedDecimal(text: string, language: Language): string | null {
  const { decimal, groups } = separators(language);
  const group = `(?:${groups.map(escape).join('|')})`;
  const pattern = new RegExp(
    `^([-\u2212]?)(\\d{1,3}(?:${group}\\d{3})+|\\d+)(?:${escape(decimal)}(\\d+))?$`,
  );
  const match = pattern.exec(text.trim());
  if (!match) return null;
  const [, sign, whole = '', fraction] = match;
  const digits = whole.replace(new RegExp(group, 'g'), '');
  return `${sign ? '-' : ''}${digits}${fraction ? `.${fraction}` : ''}`;
}

/**
 * A stored value as the reader would type it back: "95,3" in Polish, with no
 * grouping and no unit, so it parses unchanged when the field loses focus.
 */
export function editableDecimal(value: string | null, language: Language): string {
  if (value === null) return '';
  return value.replace('.', separators(language).decimal);
}

/**
 * "95,3 %" - a metric value at the metric's decimals, followed by its unit.
 * A dash for a meeting with no number.
 */
export function formatMetricValue(
  value: string | null,
  decimals: number,
  unit: string,
  language: Language,
): string {
  if (value === null) return '—';
  const number = new Intl.NumberFormat(LOCALES[language], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    // A decimal string is formatted exactly, digit for digit; the cast is
    // only because the ES2022 library types predate that overload.
  }).format(value as unknown as number);
  return unit ? `${number}\u00a0${unit}` : number;
}

/** The language i18next is currently on, as one this module can format for. */
export function activeLanguage(language: string): Language {
  return isSupported(language) ? language : FALLBACK_LANGUAGE;
}

/**
 * The formatters bound to the active language and to the catalogue's wording
 * for a value that cannot be read, so a component never passes either.
 */
export function useFormat() {
  const { t, i18n } = useTranslation();
  const language = activeLanguage(i18n.language);
  const unavailable = t('common.unavailable');

  return useMemo(
    () => ({
      language,
      dateTime: (value: string | number | Date) => formatDateTime(value, language, unavailable),
      date: (value: string | number | Date) => formatDate(value, language, unavailable),
      weekdayAndTime: (value: string | number | Date) =>
        formatWeekdayAndTime(value, language, unavailable),
      number: (value: number) => formatNumber(value, language, unavailable),
      meetingDate: (date: string) => formatMeetingDate(date, language, unavailable),
      meetingTime: (time: string) => formatMeetingTime(time, language, unavailable),
      scheduleWeekday: (weekday: number) => formatScheduleWeekday(weekday, language, unavailable),
      metricValue: (value: string | null, decimals: number, unit: string) =>
        formatMetricValue(value, decimals, unit, language),
      parseDecimal: (text: string) => parseLocalizedDecimal(text, language),
      editableDecimal: (value: string | null) => editableDecimal(value, language),
    }),
    [language, unavailable],
  );
}
