/**
 * The moves both dragging and the move controls make on a board's layout.
 */
import { describe, expect, it } from 'vitest';
import type { Metric, MetricGroup, MetricLayout } from '../../api/metrics';
import { applyLayout, changesNothing, layoutOf, locate, moveInLayout } from './layout';

const LAYOUT: MetricLayout = {
  groups: [
    { id: 'quality', metric_ids: ['bugs', 'defects'] },
    { id: 'finance', metric_ids: ['revenue'] },
    { id: 'delivery', metric_ids: [] },
  ],
  ungrouped: ['morale'],
};

const QUALITY: MetricGroup = { id: 'quality', name: 'Quality', position: 0 };
const FINANCE: MetricGroup = { id: 'finance', name: 'Finance', position: 1 };

function metric(id: string, group: MetricGroup | null, position: number): Metric {
  return {
    id,
    team_id: 'team-1',
    scope: 'board',
    name: id,
    unit: '',
    decimals: 0,
    direction: 'higher_is_better',
    group,
    position,
    owner: null,
    retired: false,
    retired_in_catalogue: false,
    threshold: null,
  };
}

describe('moving within a group', () => {
  it('puts a metric before the one it is dropped on', () => {
    const next = moveInLayout(LAYOUT, {
      kind: 'metric',
      id: 'defects',
      to: 'quality',
      before: 'bugs',
    });
    expect(next.groups[0]!.metric_ids).toEqual(['defects', 'bugs']);
  });

  it('puts a metric last when it lands before nothing', () => {
    const next = moveInLayout(LAYOUT, { kind: 'metric', id: 'bugs', to: 'quality', before: null });
    expect(next.groups[0]!.metric_ids).toEqual(['defects', 'bugs']);
  });

  it('knows a move to where the metric already is changes nothing', () => {
    expect(
      changesNothing(LAYOUT, { kind: 'metric', id: 'bugs', to: 'quality', before: 'defects' }),
    ).toBe(true);
    expect(
      changesNothing(LAYOUT, { kind: 'metric', id: 'bugs', to: 'quality', before: null }),
    ).toBe(false);
  });
});

describe('moving across groups', () => {
  it('takes a metric out of its group and into another', () => {
    const next = moveInLayout(LAYOUT, {
      kind: 'metric',
      id: 'morale',
      to: 'quality',
      before: 'bugs',
    });
    expect(next.groups[0]!.metric_ids).toEqual(['morale', 'bugs', 'defects']);
    expect(next.ungrouped).toEqual([]);
  });

  it('fills an empty group', () => {
    const next = moveInLayout(LAYOUT, {
      kind: 'metric',
      id: 'revenue',
      to: 'delivery',
      before: null,
    });
    expect(next.groups[1]!.metric_ids).toEqual([]);
    expect(next.groups[2]!.metric_ids).toEqual(['revenue']);
  });
});

describe('moving to the ungrouped', () => {
  it('takes a metric out of every group, last among the ungrouped', () => {
    const next = moveInLayout(LAYOUT, { kind: 'metric', id: 'bugs', to: null, before: null });
    expect(next.groups[0]!.metric_ids).toEqual(['defects']);
    expect(next.ungrouped).toEqual(['morale', 'bugs']);
  });
});

describe('reordering groups', () => {
  it('moves a group up, before the one above it', () => {
    const next = moveInLayout(LAYOUT, { kind: 'group', id: 'finance', before: 'quality' });
    expect(next.groups.map(({ id }) => id)).toEqual(['finance', 'quality', 'delivery']);
    expect(next.groups[0]!.metric_ids).toEqual(['revenue']);
  });

  it('moves a group to the end', () => {
    const next = moveInLayout(LAYOUT, { kind: 'group', id: 'quality', before: null });
    expect(next.groups.map(({ id }) => id)).toEqual(['finance', 'delivery', 'quality']);
  });
});

describe('reading and applying a layout', () => {
  it('reads the layout from the metrics and groups as the board has them', () => {
    const layout = layoutOf(
      [metric('morale', null, 0), metric('revenue', FINANCE, 0), metric('defects', QUALITY, 1)],
      [FINANCE, QUALITY],
    );
    expect(layout).toEqual({
      groups: [
        { id: 'quality', metric_ids: ['defects'] },
        { id: 'finance', metric_ids: ['revenue'] },
      ],
      ungrouped: ['morale'],
    });
  });

  it('finds where a metric sits', () => {
    expect(locate(LAYOUT, 'defects')).toEqual({ container: 'quality', index: 1 });
    expect(locate(LAYOUT, 'morale')).toEqual({ container: null, index: 0 });
    expect(locate(LAYOUT, 'nowhere')).toBeUndefined();
  });

  it('gives each metric its new group and position, and each group its new position', () => {
    const metrics = [metric('bugs', QUALITY, 0), metric('morale', null, 0)];
    const arranged = applyLayout(metrics, [QUALITY, FINANCE], {
      groups: [
        { id: 'finance', metric_ids: ['morale'] },
        { id: 'quality', metric_ids: ['bugs'] },
      ],
      ungrouped: [],
    });
    expect(arranged.groups).toEqual([
      { ...FINANCE, position: 0 },
      { ...QUALITY, position: 1 },
    ]);
    expect(arranged.metrics.map(({ id, group, position }) => [id, group?.id, position])).toEqual([
      ['morale', 'finance', 0],
      ['bugs', 'quality', 0],
    ]);
  });
});
