/** The icons are pictures only: present, drawn in the text colour, never announced. */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import * as icons from './icons';

const { ValueIcon, ...glyphs } = icons;

describe.each(Object.entries(glyphs))('%s', (_, Icon) => {
  it('renders an svg hidden from the accessibility tree', () => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });
});

describe('ValueIcon', () => {
  const codes = ['effectiveness', 'passion', 'innovation', 'collaboration'] as const;

  it('draws each value with a pictogram hidden from the accessibility tree', () => {
    for (const code of codes) {
      const { container } = render(<ValueIcon icon={code} />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
    }
  });

  it('draws the four values distinctly', () => {
    // The drawing inside the svg, not its attributes, so a differing label
    // could not make two identical pictures pass as distinct.
    const drawings = codes.map(
      (code) => render(<ValueIcon icon={code} />).container.querySelector('svg')?.innerHTML,
    );

    expect(new Set(drawings).size).toBe(4);
  });
});
