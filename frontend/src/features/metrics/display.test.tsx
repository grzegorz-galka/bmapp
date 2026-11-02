/**
 * How a threshold reads when amber equals green: there is no amber zone, so
 * past green is red at once, and the reading says so rather than naming an
 * amber boundary nobody can be in.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import i18n from '../../i18n';
import { useFormat } from '../../i18n/format';
import type { Direction } from '../../api/metrics';
import { describeThreshold } from './display';

const NO_BOUNDS = { green_lo: null, green_hi: null, amber_lo: null, amber_hi: null };

async function read(
  language: 'en' | 'pl',
  direction: Direction,
  threshold: Parameters<typeof describeThreshold>[3],
  unit = '',
) {
  await i18n.changeLanguage(language);
  const format = renderHook(() => useFormat()).result.current;
  return describeThreshold(i18n.t, format, { direction, decimals: 0, unit }, threshold);
}

function target(value: string, green: string, amber: string) {
  return { ...NO_BOUNDS, target_value: value, green_pct: green, amber_pct: amber };
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('a threshold with no amber zone', () => {
  it('reads a target value with both tolerances 0 as the line between green and red', async () => {
    expect(await read('en', 'higher_is_better', target('395', '0', '0'))).toBe(
      'Target value 395 · red below it',
    );
    expect(await read('en', 'lower_is_better', target('397', '0', '0'))).toBe(
      'Target value 397 · red above it',
    );
    expect(await read('en', 'within_band', target('72.3', '0', '0'))).toBe(
      'Target value 72.3 · red off it',
    );
    expect(await read('pl', 'higher_is_better', target('395', '0', '0'))).toBe(
      'Wartość docelowa 395 · czerwony poniżej niej',
    );
  });

  it('reads equal non-zero tolerances as green and then red', async () => {
    expect(await read('en', 'higher_is_better', target('100', '5', '5.000000'), '%')).toBe(
      'Target value 100 % · green −5% · red below',
    );
    expect(await read('en', 'within_band', target('72.3', '2', '2'))).toBe(
      'Target value 72.3 · green ±2% · red outside',
    );
  });

  it('reads equal boundaries as green and then red', async () => {
    expect(
      await read('en', 'lower_is_better', { ...NO_BOUNDS, green_hi: '0', amber_hi: '0' }),
    ).toBe('Green up to 0, red above');
    expect(
      await read('en', 'higher_is_better', { ...NO_BOUNDS, green_lo: '35', amber_lo: '35' }),
    ).toBe('Green from 35, red below');
    expect(
      await read('pl', 'within_band', {
        green_lo: '71',
        green_hi: '72',
        amber_lo: '71',
        amber_hi: '72',
      }),
    ).toBe('Zielony od 71 do 72, czerwony poza');
  });

  it('keeps the amber zone where amber differs from green', async () => {
    expect(await read('en', 'higher_is_better', target('100', '5', '10'))).toBe(
      'Target value 100 · green −5% · amber −10%',
    );
    expect(
      await read('en', 'lower_is_better', { ...NO_BOUNDS, green_hi: '5', amber_hi: '10' }),
    ).toBe('Green up to 5, amber up to 10');
  });
});
