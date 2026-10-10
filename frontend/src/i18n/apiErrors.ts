/**
 * Turning an API failure into text the user can read.
 *
 * The API names a reason with a code; the wording for that reason lives here,
 * in the catalogues. A code this build does not know degrades to the generic
 * message rather than showing the API's English text to a Polish reader.
 */
import type { TFunction } from 'i18next';
import { en } from './en';
import { ApiError, type ApiFieldError } from '../api/teams';

type ErrorCode = keyof typeof en.errors;

function isKnownCode(code: string | undefined): code is ErrorCode {
  return code !== undefined && code in en.errors;
}

/** The message to show for one field error. */
export function translateErrorCode(t: TFunction, error: ApiFieldError): string {
  if (isKnownCode(error.code)) {
    return t(`errors.${error.code}`);
  }
  // Not shown to the user, but a developer needs to know a code arrived that
  // this build has no wording for.
  console.warn(`Untranslated API error code: ${error.code ?? '(none)'} - ${error.message}`);
  return t('errors.generic');
}

/**
 * The text for a failed request: the error on `field` if the API named one,
 * otherwise its first error, otherwise the generic message. A failure always
 * says something, in the language being read, and never the API's English.
 */
export function describeFailure(
  t: TFunction,
  error: Error | null,
  field?: string,
): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiError) {
    const failure = (field ? error.errorFor(field) : undefined) ?? error.errors[0];
    if (failure) return translateErrorCode(t, failure);
  }
  return t('errors.generic');
}

/**
 * Whether a read failed because the thing addressed does not exist.
 *
 * A 422 counts as well: on a GET with no body the only thing to reject is the
 * identifier in the address, and an identifier that is not even well formed
 * names nothing either.
 */
export function isNotFound(error: Error | null): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 422);
}

/**
 * The text for the error the API reported against `field`, and nothing when
 * it reported none there - for forms with a message slot under each field.
 */
export function describeFieldFailure(
  t: TFunction,
  error: Error | null,
  field: string,
): string | undefined {
  const failure = error instanceof ApiError ? error.errorFor(field) : undefined;
  return failure ? translateErrorCode(t, failure) : undefined;
}

/**
 * The text for a failure that belongs to none of `fields`: a refusal, a
 * missing meeting, a network error. Nothing when every error has a field slot.
 */
export function describeOtherFailure(
  t: TFunction,
  error: Error | null,
  fields: readonly string[],
): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiError) {
    const other = error.errors.find((e) => e.field === null || !fields.includes(e.field));
    if (other) return translateErrorCode(t, other);
    if (error.errors.length > 0) return undefined;
  }
  return t('errors.generic');
}
