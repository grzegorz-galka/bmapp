/**
 * The one grouping the tiles and the recording table share: the board's
 * groups in order, the ungrouped last, position inside a group, and whether a
 * metric hidden on the board is kept.
 */
import { describe, expect, it } from 'vitest';
import type { MetricGroup } from '../../api/metrics';
import { definition, tile } from './boardFixture';
import { groupMetrics } from './groupMetrics';

const delivery: MetricGroup = { id: 'g-delivery', name: 'Delivery', position: 0 };
const quality: MetricGroup = { id: 'g-quality', name: 'Quality', position: 1 };

function at(name: string, group: MetricGroup | null, position: number, hidden = false) {
  return tile({ metric: definition({ id: `metric-${name}`, name, group, position, hidden }) });
}

function names(board: Parameters<typeof groupMetrics>[0], hidden: boolean) {
  return groupMetrics(board, { hidden }).map((section) => [
    section.group?.name ?? null,
    section.entries.map((entry) => entry.metric.name),
  ]);
}

describe('groupMetrics', () => {
  it('lists the groups by position, whatever order the metrics come in', () => {
    const board = { metrics: [at('Bugs', quality, 0), at('Lead time', delivery, 0)] };

    expect(names(board, false)).toEqual([
      ['Delivery', ['Lead time']],
      ['Quality', ['Bugs']],
    ]);
  });

  it('lists the ungrouped metrics last, keyed by an empty id', () => {
    const board = { metrics: [at('Morale', null, 0), at('Bugs', quality, 0)] };

    const sections = groupMetrics(board, { hidden: false });
    expect(sections.map((section) => section.key)).toEqual(['g-quality', '']);
    expect(sections[1]!.group).toBeNull();
    expect(sections[1]!.entries.map((entry) => entry.metric.name)).toEqual(['Morale']);
  });

  it('orders a group’s metrics by position, ties in the order they came', () => {
    const board = {
      metrics: [at('Escapes', quality, 1), at('Bugs', quality, 0), at('Flaky tests', quality, 1)],
    };

    expect(names(board, false)).toEqual([['Quality', ['Bugs', 'Escapes', 'Flaky tests']]]);
  });

  it('keeps a hidden metric under its group when asked to', () => {
    const board = { metrics: [at('Bugs', quality, 0), at('Base', quality, 1, true)] };

    expect(names(board, true)).toEqual([['Quality', ['Bugs', 'Base']]]);
  });

  it('leaves a hidden metric out otherwise, and a group of hidden metrics only', () => {
    const board = {
      metrics: [at('Lead time', delivery, 0), at('Base', quality, 0, true), at('Bugs', null, 0)],
    };

    expect(names(board, false)).toEqual([
      ['Delivery', ['Lead time']],
      [null, ['Bugs']],
    ]);
    expect(names(board, true)).toEqual([
      ['Delivery', ['Lead time']],
      ['Quality', ['Base']],
      [null, ['Bugs']],
    ]);
  });

  it('lists nothing for a board with no metrics', () => {
    expect(groupMetrics({ metrics: [] }, { hidden: true })).toEqual([]);
  });
});
