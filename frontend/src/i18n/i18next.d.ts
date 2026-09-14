/**
 * Types `t()` against the English catalogue, so an unknown or mistyped key is
 * a compile error instead of a key rendered on screen.
 */
import type { Translations } from './en';
import type { NAMESPACE } from './index';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof NAMESPACE;
    resources: { translation: Translations };
  }
}
