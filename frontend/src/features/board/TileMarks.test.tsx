/** A tile's change indicator on its own: arrow, signed value, colour and words. */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithLanguage } from '../../test/render';
import type { Language } from '../../i18n/languages';
import { ChangeIndicator } from './TileMarks';

const PERCENT = { unit: '%', decimals: 1 };

async function indicator(
  change: string | null,
  improvement: boolean | null,
  since: 'previous' | 'four' = 'previous',
  language: Language = 'en',
): Promise<HTMLElement> {
  await renderWithLanguage(
    <ChangeIndicator change={change} improvement={improvement} since={since} metric={PERCENT} />,
    language,
  );
  return screen.getByRole('img');
}

describe('ChangeIndicator', () => {
  it('draws a rise as an up arrow with a plus sign, green when better', async () => {
    const shown = await indicator('5', true);

    expect(shown).toHaveTextContent('▲+5.0 %week');
    expect(shown).toHaveAttribute('data-improvement', 'true');
    expect(shown).toHaveAccessibleName('Since the previous meeting: +5.0 %, better');
  });

  it('draws a fall as a down arrow with a minus sign, red when worse', async () => {
    const shown = await indicator('-2.5', false, 'four');

    expect(shown).toHaveTextContent('▼−2.5 %4 mtgs');
    expect(shown).toHaveAttribute('data-improvement', 'false');
    expect(shown).toHaveAccessibleName('Since four meetings earlier: −2.5 %, worse');
  });

  it('draws no change as a level arrow with no sign, neutral', async () => {
    const shown = await indicator('0', null);

    expect(shown).toHaveTextContent('→0.0 %week');
    expect(shown).toHaveAttribute('data-improvement', 'null');
    expect(shown).toHaveAccessibleName(
      'Since the previous meeting: 0.0 %, neither better nor worse',
    );
  });

  it('draws nothing to compare as a dash and no arrow', async () => {
    const shown = await indicator(null, null, 'four');

    expect(shown).toHaveTextContent('–4 mtgs');
    expect(shown).toHaveAccessibleName('Since four meetings earlier: nothing to compare');
  });

  it('reads in Polish', async () => {
    const shown = await indicator('-2', true, 'four', 'pl');

    expect(shown).toHaveTextContent('▼−2,0 %4 spotk.');
    expect(shown).toHaveAccessibleName('Od czwartego spotkania wstecz: −2,0 %, lepiej');
  });

  it('captions the previous meeting in Polish', async () => {
    const shown = await indicator(null, null, 'previous', 'pl');

    expect(shown).toHaveTextContent('–tydz.');
    expect(shown).toHaveAccessibleName('Od poprzedniego spotkania: brak porównania');
  });
});
