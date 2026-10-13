/**
 * A board's arrangement as plain data, and the moves made on it.
 *
 * Dragging and the keyboard's move controls both end in `moveInLayout`, so the
 * two cannot disagree about where an item lands. A move names the item it
 * lands before, or none for the end, rather than an index: an index shifts
 * once the moved item leaves its old place, and that is where off-by-one
 * mistakes live.
 */
import type { Metric, MetricGroup, MetricLayout } from '../../api/metrics';

/** A group's identifier, or null for the metrics in no group. */
export type Container = string | null;

export type Move =
  | { kind: 'metric'; id: string; to: Container; before: string | null }
  | { kind: 'group'; id: string; before: string | null };

/** The layout the board has now: its groups in order, its metrics in theirs. */
export function layoutOf(metrics: Metric[], groups: MetricGroup[]): MetricLayout {
  const ordered = [...metrics].sort((a, b) => a.position - b.position);
  return {
    groups: [...groups]
      .sort((a, b) => a.position - b.position)
      .map((group) => ({
        id: group.id,
        metric_ids: ordered.filter((metric) => metric.group?.id === group.id).map(({ id }) => id),
      })),
    ungrouped: ordered.filter((metric) => metric.group === null).map(({ id }) => id),
  };
}

function metricsIn(layout: MetricLayout, container: Container): string[] {
  if (container === null) return layout.ungrouped;
  return layout.groups.find((group) => group.id === container)?.metric_ids ?? [];
}

/** Where a metric sits: its container and its index there, or undefined when absent. */
export function locate(
  layout: MetricLayout,
  metricId: string,
): { container: Container; index: number } | undefined {
  for (const group of layout.groups) {
    const index = group.metric_ids.indexOf(metricId);
    if (index >= 0) return { container: group.id, index };
  }
  const index = layout.ungrouped.indexOf(metricId);
  return index >= 0 ? { container: null, index } : undefined;
}

function insert(list: string[], id: string, before: string | null): string[] {
  const rest = list.filter((item) => item !== id);
  const at = before === null ? -1 : rest.indexOf(before);
  return at < 0 ? [...rest, id] : [...rest.slice(0, at), id, ...rest.slice(at)];
}

/** The layout after one move. Every other item keeps its relative order. */
export function moveInLayout(layout: MetricLayout, move: Move): MetricLayout {
  if (move.kind === 'group') {
    const order = insert(
      layout.groups.map(({ id }) => id),
      move.id,
      move.before,
    );
    return {
      ...layout,
      groups: order.flatMap((id) => layout.groups.filter((group) => group.id === id)),
    };
  }
  const without = (list: string[]) => list.filter((id) => id !== move.id);
  const target = insert(without(metricsIn(layout, move.to)), move.id, move.before);
  return {
    groups: layout.groups.map((group) => ({
      id: group.id,
      metric_ids: group.id === move.to ? target : without(group.metric_ids),
    })),
    ungrouped: move.to === null ? target : without(layout.ungrouped),
  };
}

/** True when the move would leave the layout as it is. */
export function changesNothing(layout: MetricLayout, move: Move): boolean {
  return JSON.stringify(moveInLayout(layout, move)) === JSON.stringify(layout);
}

/** The metrics and groups as they read once a layout is saved, for showing it at once. */
export function applyLayout(
  metrics: Metric[],
  groups: MetricGroup[],
  layout: MetricLayout,
): { metrics: Metric[]; groups: MetricGroup[] } {
  const arrangedGroups = layout.groups.flatMap(({ id }, position) => {
    const group = groups.find((candidate) => candidate.id === id);
    return group ? [{ ...group, position }] : [];
  });
  const placed = (ids: string[], group: MetricGroup | null) =>
    ids.flatMap((id, position) => {
      const metric = metrics.find((candidate) => candidate.id === id);
      return metric ? [{ ...metric, group, position }] : [];
    });
  return {
    groups: arrangedGroups,
    metrics: [
      ...layout.groups.flatMap(({ id, metric_ids }) =>
        placed(metric_ids, arrangedGroups.find((group) => group.id === id) ?? null),
      ),
      ...placed(layout.ungrouped, null),
    ],
  };
}
