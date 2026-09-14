/**
 * Turning an API failure into text the user can read.
 *
 * The API names a reason with a code; the wording for that reason lives here,
 * in the catalogues. A code this build does not know degrades to the generic
 * message rather than showing the API's English text to a Polish reader.
 */
import type { TFunction } from 'i18next';
import { en } from './en';
import type { ApiFieldError } from '../api/teams';

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
