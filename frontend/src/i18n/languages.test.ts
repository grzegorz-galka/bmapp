/** The language list is the toggle's precondition, so it is pinned here. */
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from './languages';

describe('SUPPORTED_LANGUAGES', () => {
  it('holds exactly two languages, because the header control is a toggle', () => {
    expect(
      SUPPORTED_LANGUAGES,
      'The language control is a two-state toggle (components/LanguageToggle.tsx). ' +
        'A third language would never be reached by it: replace the toggle with a ' +
        'control that can offer every language before adding one here.',
    ).toHaveLength(2);
  });
});
