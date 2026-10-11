/**
 * Today's date on the organization's clock, as the API writes dates.
 *
 * The same zone the server fixes meeting dates in, so "the first meeting
 * dated today or later" means the same thing on both sides wherever the
 * reader happens to be.
 */
export const ORGANIZATION_TIME_ZONE = 'Europe/Warsaw';

export function organizationToday(now: number = Date.now()): string {
  // en-CA writes dates as YYYY-MM-DD, the API's own format.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ORGANIZATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
