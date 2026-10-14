/**
 * The button scheme is enforced here rather than by review (design decision 9).
 *
 * Every CSS module under src/ is read from disk, as contrast.test.ts reads
 * theme.css, so a page that brings back its own filled button or its own
 * `.button` copy fails this test instead of quietly drifting from the scheme.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const CONTROLS = 'styles/controls.module.css';

function modulesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return modulesUnder(path);
    }
    return entry.name.endsWith('.module.css') ? [path] : [];
  });
}

function sourcesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourcesUnder(path);
    }
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
  });
}

type Rule = { file: string; selectors: string[]; body: string };

/** The flat rules of a stylesheet; an @media wrapper is skipped, its rules kept. */
function rulesOf(file: string): Rule[] {
  const css = readFileSync(join(SRC, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    file,
    selectors: (match[1] ?? '').split(',').map((selector) => selector.trim()),
    body: match[2] ?? '',
  }));
}

const RULES = modulesUnder(SRC)
  .map((path) => relative(SRC, path).split('\\').join('/'))
  .sort()
  .flatMap(rulesOf);

const SOLID_FILL = /(^|[;\s])background(-color)?\s*:\s*var\(--accent-solid\)/;
const ON_STATE = /\[aria-pressed='true'\]|\[aria-expanded='true'\]|:checked/;
const BUTTON_CLASS = /\.(button|primary|default)(?![\w-])/;

describe('the button scheme', () => {
  it('fills with the solid accent only a control that is on', () => {
    const offenders = RULES.filter((rule) => SOLID_FILL.test(rule.body)).flatMap((rule) =>
      rule.selectors
        .filter((selector) => {
          if (rule.file === CONTROLS) {
            return !ON_STATE.test(selector);
          }
          // The brand mark is a logo, not a control.
          return !(rule.file === 'components/AppHeader.module.css' && selector === '.brandMark');
        })
        .map((selector) => `${rule.file}: ${selector}`),
    );

    expect(offenders).toEqual([]);
  });

  it('declares the button classes in controls.module.css only', () => {
    const offenders = RULES.filter((rule) => rule.file !== CONTROLS).flatMap((rule) =>
      rule.selectors
        .filter((selector) => BUTTON_CLASS.test(selector))
        .map((selector) => `${rule.file}: ${selector}`),
    );

    expect(offenders).toEqual([]);
  });

  it('No page draws a link as a button', () => {
    // A react-router <Link> only leads somewhere, so it never wears a button's
    // class. Read from the components' source: a rendered page shows only
    // the links its fixture happens to reach.
    const offenders = sourcesUnder(SRC).flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(/<Link\b[^>]*?className=\{([^}]*)\}/g)]
        .filter((match) => /controls\.(button|default)\b/.test(match[1] ?? ''))
        .map((match) => `${relative(SRC, path)}: ${match[1]}`),
    );

    expect(offenders).toEqual([]);
  });

  it('An action is tinted on hover', () => {
    const hover = RULES.find(
      (rule) => rule.file === CONTROLS && rule.selectors.includes('.button:hover'),
    );

    // The caption's 4.5:1 on this mix is held by contrast.test.ts.
    expect(hover?.body).toMatch(
      /background\s*:\s*color-mix\(in oklch,\s*var\(--accent\) var\(--tint\),\s*var\(--panel\)\)/,
    );
  });
});
