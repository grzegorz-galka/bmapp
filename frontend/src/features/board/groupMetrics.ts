import type { BoardMetric, MeetingBoard, MetricGroup } from '../../api/metrics';

/** One of a board's groups as the board lists it; `group` is null for the ungrouped. */
export interface MetricSection {
  /** The group's id, or '' for the metrics in no group. */
  key: string;
  group: MetricGroup | null;
  entries: BoardMetric[];
}

/**
 * A meeting's metrics under the board's groups, in the board's order: the
 * groups by position, the ungrouped last, each group's metrics by position
 * (ties keep the order the server returned, which breaks them by name). A
 * group with no metric listed is left out; the settings page is where an
 * empty group is seen.
 *
 * The tiles and the recording table both list through this, so the two
 * cannot drift. `hidden` says whether a metric hidden on the board is listed:
 * the tiles leave it out, the recording table keeps it, since it still takes
 * a value.
 */
export function groupMetrics(
  board: Pick<MeetingBoard, 'metrics'>,
  { hidden }: { hidden: boolean },
): MetricSection[] {
  const sections = new Map<string, MetricSection>();
  for (const entry of board.metrics) {
    if (entry.metric.hidden && !hidden) continue;
    const { group } = entry.metric;
    const key = group?.id ?? '';
    const section = sections.get(key) ?? { key, group, entries: [] };
    section.entries.push(entry);
    sections.set(key, section);
  }
  const order = (section: MetricSection) => section.group?.position ?? Number.POSITIVE_INFINITY;
  return [...sections.values()]
    .sort((a, b) => order(a) - order(b))
    .map((section) => ({
      ...section,
      entries: [...section.entries].sort((a, b) => a.metric.position - b.metric.position),
    }));
}
