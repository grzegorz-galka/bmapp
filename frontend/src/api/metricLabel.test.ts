import { describe, expect, it } from 'vitest';
import { metricLabel } from './metricLabel';

describe('metricLabel', () => {
  it('the label for a project', () => {
    expect(
      metricLabel({
        name: 'Budget consumed',
        project: { id: 'p1', code: 'PRJ-042', name: 'Billing rewrite', active: true },
        product: null,
      }),
    ).toBe('PRJ-042 · Budget consumed');
  });

  it('the label for a product', () => {
    expect(
      metricLabel({
        name: 'NPS',
        project: null,
        product: { id: 'd1', name: 'Customer portal', active: true },
      }),
    ).toBe('Customer portal · NPS');
  });

  it('the label for neither', () => {
    expect(metricLabel({ name: 'Open bugs', project: null, product: null })).toBe('Open bugs');
  });
});
