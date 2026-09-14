/**
 * The inline script in index.html has to say the same thing as this module.
 *
 * It runs before the bundle loads, so it cannot import these constants and
 * repeats them as literals instead. That duplication is the price of not
 * flashing the wrong theme; this test is what stops the two drifting.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, SUPPORTED_THEMES, THEME_ATTRIBUTE, THEME_STORAGE_KEY } from './themes';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const inlineScript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

describe('the no-flash script in index.html', () => {
  it('is present before the module bundle', () => {
    expect(inlineScript).not.toBe('');
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('type="module"'));
  });

  it('reads the same storage key this module writes', () => {
    expect(inlineScript).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  it('applies the same default theme', () => {
    expect(inlineScript).toContain(`var fallback = '${DEFAULT_THEME}';`);
  });

  it('recognises exactly the supported themes', () => {
    for (const theme of SUPPORTED_THEMES) {
      expect(inlineScript).toContain(`stored === '${theme}'`);
    }
  });

  it('sets the attribute the palettes select on', () => {
    expect(inlineScript).toContain(`setAttribute('${THEME_ATTRIBUTE}'`);
  });

  it('guards every storage access, so blocked site data still starts', () => {
    expect(inlineScript).toMatch(/try\s*\{[\s\S]*localStorage[\s\S]*\}\s*catch/);
  });

  it('marks the document with the default theme before any script runs', () => {
    expect(html).toContain(`<html lang="en" ${THEME_ATTRIBUTE}="${DEFAULT_THEME}">`);
  });
});
