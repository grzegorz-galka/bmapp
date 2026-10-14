/**
 * The declarations band's type styles.
 * See specs/dashboard/spec.md, "The declarations use four type styles".
 *
 * jsdom applies no CSS-module styles, so the test compares class names: every
 * element holding text of its own carries exactly one of the four.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { DeclarationsBand } from './DeclarationsBand';
import { dashboardSummary } from './dashboardFixture';
import moduleStyles from './DeclarationsBand.module.css';

const { declarations } = dashboardSummary();

function className(name: string): string {
  const resolved = moduleStyles[name];
  if (!resolved) throw new Error(`DeclarationsBand.module.css has no .${name}`);
  return resolved;
}

const styles = {
  label: className('label'),
  headline: className('headline'),
  subheading: className('subheading'),
  body: className('body'),
};
const STYLES = Object.values(styles);

async function renderBand() {
  await renderWithLanguage(<DeclarationsBand declarations={declarations} />, 'en');
  return screen.getByRole('region', { name: en.declarations.band });
}

/** The elements with a text node of their own, which is what a type style sets. */
function textBearing(root: HTMLElement): HTMLElement[] {
  return [root, ...root.querySelectorAll<HTMLElement>('*')].filter((element) =>
    [...element.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    ),
  );
}

function styleOf(element: HTMLElement): string {
  const found = STYLES.filter((style) => element.classList.contains(style));
  expect(found, element.textContent ?? '').toHaveLength(1);
  return found[0] ?? '';
}

function styleOfText(band: HTMLElement, text: string): string {
  const element = textBearing(band).find((candidate) => candidate.textContent?.trim() === text);
  expect(element, text).toBeDefined();
  return styleOf(element!);
}

describe('DeclarationsBand', () => {
  it('Every text in the band uses one of the four styles', async () => {
    const band = await renderBand();
    // Four distinct class names, or the comparisons below prove nothing.
    expect(new Set(STYLES).size).toBe(4);

    for (const element of textBearing(band)) styleOf(element);

    const expected: [string, string][] = [
      [en.declarations.band, styles.label],
      [en.declarations.bandNote, styles.label],
      [en.declarations.mission, styles.label],
      [en.declarations.vision, styles.label],
      [en.declarations.values, styles.label],
      [en.declarations.strategy, styles.label],
      [en.declarations.goals, styles.label],
      [declarations.mission.en, styles.headline],
      [declarations.vision.en, styles.headline],
      ...declarations.values.map((value): [string, string] => [value.name.en, styles.headline]),
      ...declarations.strategy.statements.map((s): [string, string] => [s.en, styles.body]),
      ...declarations.goals.flatMap((group) =>
        group.items.map((goal): [string, string] => [goal.en, styles.body]),
      ),
    ];
    for (const [text, style] of expected) expect(styleOfText(band, text), text).toBe(style);

    const horizons = [
      declarations.strategy.horizon.en,
      ...declarations.goals.map((group) => group.horizon.en),
    ];
    for (const horizon of horizons) {
      const elements = textBearing(band).filter((e) => e.textContent?.trim() === horizon);
      expect(elements.length, horizon).toBeGreaterThan(0);
      for (const element of elements) expect(styleOf(element), horizon).toBe(styles.subheading);
    }
  });

  it('Values read at the same weight as the mission', async () => {
    const band = await renderBand();
    const mission = styleOfText(band, declarations.mission.en);

    for (const value of declarations.values) {
      expect(styleOfText(band, value.name.en), value.name.en).toBe(mission);
    }
  });
});
