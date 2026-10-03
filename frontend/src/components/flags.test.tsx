/** The flags are pictures only: present, but never announced. */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PolishFlag, UnionFlag } from './flags';

describe.each([
  ['UnionFlag', UnionFlag],
  ['PolishFlag', PolishFlag],
])('%s', (_, FlagComponent) => {
  it('renders an svg hidden from the accessibility tree', () => {
    const { container } = render(<FlagComponent />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('passes a class name through, for the outline', () => {
    const { container } = render(<FlagComponent className="outlined" />);

    expect(container.querySelector('svg')).toHaveClass('outlined');
  });
});
