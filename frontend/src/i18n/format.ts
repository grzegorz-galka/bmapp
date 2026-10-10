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
    }),
    [language, unavailable],
  );
}
