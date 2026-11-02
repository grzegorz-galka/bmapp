/** What a tile's badge names as the target, in both languages. */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import type { Direction, Threshold } from '../../api/metrics';
import { useFormat } from '../../i18n/format';
import type { Language } from '../../i18n/languages';
import { renderWithLanguage } from '../../test/render';
import { threshold } from '../board/boardFixture';
import { describeTarget } from './display';

function Target({
  direction,
  version,
}: {
  direction: Direction;
  version: Partial<Threshold> | null;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const metric = { direction, unit: '%', decimals: 1 };
  return <p>{describeTarget(t, format, metric, version && threshold(version))}</p>;
}

async function target(
  language: Language,
  direction: Direction,
  version: Partial<Threshold> | null,
): Promise<string> {
  await renderWithLanguage(<Target direction={direction} version={version} />, language);
  return screen.getByRole('paragraph').textContent!;
}

describe('describeTarget', () => {
  it.each([
    ['en', 'Target: 72.3 %'],
    ['pl', 'Cel: 72,3 %'],
  ] as const)('names the target value (%s)', async (language, text) => {
    const version = { target_value: '72.3', green_pct: '5', amber_pct: '10' };

    expect(await target(language, 'higher_is_better', version)).toBe(text);
  });

  it.each([
    ['en', 'higher_is_better', 'Target: ≥ 95.0 %'],
    ['en', 'lower_is_better', 'Target: ≤ 5.0 %'],
    ['en', 'within_band', 'Target: 90.0–110.0 %'],
    ['pl', 'higher_is_better', 'Cel: ≥ 95,0 %'],
    ['pl', 'lower_is_better', 'Cel: ≤ 5,0 %'],
    ['pl', 'within_band', 'Cel: 90,0–110,0 %'],
  ] as const)(
    'names the green boundary of a version with no target value (%s, %s)',
    async (language, direction, text) => {
      const version = {
        green_lo:
          direction === 'lower_is_better' ? null : direction === 'within_band' ? '90' : '95',
        green_hi:
          direction === 'higher_is_better' ? null : direction === 'within_band' ? '110' : '5',
      };

      expect(await target(language, direction, version)).toBe(text);
    },
  );

  it('names the boundaries of a version whose target value is 0', async () => {
    const version = { target_value: '0', green_lo: null, green_hi: '5' };

    expect(await target('en', 'lower_is_better', version)).toBe('Target: ≤\u00a05.0\u00a0%');
  });

  it.each([
    ['en', 'No threshold'],
    ['pl', 'Brak progu'],
  ] as const)('reads "No threshold" with no version (%s)', async (language, text) => {
    expect(await target(language, 'higher_is_better', null)).toBe(text);
  });
});
