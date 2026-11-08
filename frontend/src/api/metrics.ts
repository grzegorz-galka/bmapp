/**
 * Typed client for metrics, their thresholds, and the values recorded at meetings.
 *
 * Every number is a decimal string ("95.3"), never a JavaScript number: the
 * server compares it with a boundary exactly, and a float could put 71.0 a
 * hair under 71. Statuses come from the server too; the interface renders the
 * status it is given and never works one out.
 */
import { request } from './client';
import type { Meeting } from './meetings';
import type { Employee } from './teams';

export type Direction = 'higher_is_better' | 'lower_is_better' | 'within_band';
export const DIRECTIONS: readonly Direction[] = [
  'higher_is_better',
  'lower_is_better',
  'within_band',
];

/** A colour a member may set by hand. */
export type Colour = 'green' | 'amber' | 'red';
export const COLOURS: readonly Colour[] = ['green', 'amber', 'red'];

export type Status = Colour | 'no_data' | 'no_threshold';

/** The four stored boundaries; which are set depends on the metric's direction. */
export interface Bounds {
  green_lo: string | null;
  green_hi: string | null;
  amber_lo: string | null;
  amber_hi: string | null;
}

/**
 * A threshold version as read. Its four boundaries are the resolved ones: for
 * a version with tolerances, what they amount to around the target value,
 * possibly with more than 6 decimal places. A version recorded before target
 * values existed has none, and reads as its boundaries alone.
 */
export interface Threshold extends Bounds {
  id: string;
  metric_id: string;
  effective_from: string;
  /** The number the metric aims at from this version on; null on an earlier version. */
  target_value: string | null;
  /** Per cent of the target value; set only when the target value is not 0. */
  green_pct: string | null;
  amber_pct: string | null;
  reason: string;
  recorded_by_email: string;
  /** Derived from the email when the recorder has no employee record. */
  recorded_by_display_name: string;
  recorded_at: string;
}

/**
 * Whose definition a metric on a board is: the board's own, or a global
 * metric from the company-wide catalogue that the board includes. A global
 * metric's name, unit, decimals, direction and thresholds are read-only on a
 * board; only its placement there (group, position, owner, retirement) is the
 * board's.
 */
export type MetricScope = 'board' | 'global';

/** One of a board's own groups of metrics, named and ordered on that board. */
export interface MetricGroup {
  id: string;
  name: string;
  /** 0 for the board's first group. */
  position: number;
}

/**
 * A board's whole arrangement: every group in order with its metrics in order,
 * then the metrics in no group. Retired metrics are named too; a layout that
 * misses one, or names one the board no longer has, is refused as stale.
 */
export interface MetricLayout {
  groups: { id: string; metric_ids: string[] }[];
  ungrouped: string[];
}

/**
 * How a board's own metric is worked out from other metrics recorded in the
 * same ISO week: their mean, their sum, their mean weighted per source, or the
 * change of one since its team's previous meeting. Deriving fills the number
 * field; what is saved is an ordinary value.
 */
export type DerivationKind = 'mean' | 'sum' | 'weighted_mean' | 'delta';
export const DERIVATION_KINDS: readonly DerivationKind[] = [
  'mean',
  'sum',
  'weighted_mean',
  'delta',
];

/** One source as sent: a metric on a named team's board. */
export interface DerivationSourceWrite {
  team_id: string;
  metric_id: string;
  /** An exact decimal greater than 0 on a `weighted_mean`'s source; absent or null otherwise. */
  weight?: string | null;
}

/** A derivation as sent: `delta` takes exactly one source, the others one or more. */
export interface DerivationWrite {
  kind: DerivationKind;
  sources: DerivationSourceWrite[];
}

/** One source as read, in order, with its team's and metric's names. */
export interface DerivationSource {
  team: { id: string; name: string };
  metric: { id: string; name: string };
  /** A canonical decimal on a `weighted_mean`'s source, null on any other kind. */
  weight: string | null;
}

export interface Derivation {
  kind: DerivationKind;
  sources: DerivationSource[];
}

export interface MetricDefinition {
  id: string;
  /** The board being read, for a global metric as for an own one. */
  team_id: string;
  scope: MetricScope;
  name: string;
  unit: string;
  decimals: number;
  direction: Direction;
  /** The board's group it sits in, or none: then it is shown among the ungrouped. */
  group: MetricGroup | null;
  /** Its place within its group, or among the ungrouped. */
  position: number;
  owner: Employee | null;
  retired: boolean;
  /** Retired by an administrator; bringing it back on the board would not show it. */
  retired_in_catalogue: boolean;
  /** Still active and recorded, but the board shows no tile for it. */
  hidden: boolean;
  /** How its number is derived; only ever on a board's own metric. */
  derivation: Derivation | null;
}

/** A metric as the settings list it, with the threshold in force today. */
export interface Metric extends MetricDefinition {
  threshold: Threshold | null;
}

export interface MetricCreate {
  name: string;
  unit: string;
  decimals: number;
  direction: Direction;
  /** Placed last in this group, or last among the ungrouped when null. */
  group_id: string | null;
  owner_employee_id: string | null;
  /** Hidden on the board as it arrives; shown when left out. */
  hidden?: boolean;
  /**
   * None when left out. On a change: left out leaves it alone, null removes
   * it, a derivation replaces it.
   */
  derivation?: DerivationWrite | null;
}

/** A global metric placed on a board. Its definition comes from the catalogue. */
export interface MetricInclusion {
  global_metric_id: string;
  group_id: string | null;
  owner_employee_id: string | null;
  hidden?: boolean;
}

/**
 * A copy of another board's own metric, with its thresholds, under its own
 * name unless a new one is given.
 */
export interface MetricCopy {
  source_metric_id: string;
  name?: string;
  /** A group of the target board; the source's group is never taken. */
  group_id?: string | null;
  /** The source's own setting is never taken. */
  hidden?: boolean;
}

/**
 * A partial change: a key left out is left alone. The direction cannot change.
 * A new `group_id` puts the metric last in that group; `null` ungroups it.
 */
export type MetricChange = Partial<Omit<MetricCreate, 'direction'>> & { retired?: boolean };

/**
 * A threshold version. A target value other than 0 takes `green_pct` and
 * `amber_pct`, tolerances in per cent of it, and no boundary. A target value
 * of 0 takes boundaries instead: `green` and `amber` for a one-sided metric,
 * the four `_lo` / `_hi` for a band.
 */
export interface ThresholdCreate {
  effective_from: string;
  reason: string;
  target_value: string;
  green_pct?: string;
  amber_pct?: string;
  green?: string;
  amber?: string;
  green_lo?: string;
  green_hi?: string;
  amber_lo?: string;
  amber_hi?: string;
}

/** What is recorded for a metric at a meeting. All three are sent every time. */
export interface MetricValueWrite {
  value: string | null;
  manual_status: Colour | null;
  comment: string | null;
  /** Only read for an administrator's correction at a frozen meeting. */
  reason?: string;
}

export interface MetricValue {
  metric_id: string;
  meeting_id: string;
  value: string | null;
  manual_status: Colour | null;
  comment: string | null;
  status: Status;
  set_by_hand: boolean;
  recorded_by_email: string | null;
  recorded_by_display_name: string | null;
  recorded_at: string | null;
}

export interface SparklinePoint {
  meeting_id: string;
  date: string;
  value: string | null;
  status: Status;
}

export interface BoardMetric {
  metric: MetricDefinition;
  threshold: Threshold | null;
  value: string | null;
  status: Status;
  set_by_hand: boolean;
  comment: string | null;
  manual_status: Colour | null;
  previous: string | null;
  change: string | null;
  /** True or false for a one-sided metric; null for a band, or with no change. */
  improvement: boolean | null;
  /** The number at the team's meeting four meetings before this one, and the change since. */
  previous_4: string | null;
  change_4: string | null;
  improvement_4: boolean | null;
  sparkline: SparklinePoint[];
}

export interface MissingMetric {
  metric_id: string;
  name: string;
  owner: Employee | null;
}

export interface MeetingBoard {
  meeting: Meeting;
  editable: boolean;
  /** `owing` counts the people still owing a value or a pulse answer, each once. */
  completeness: { recorded: number; total: number; missing: MissingMetric[]; owing: number };
  metrics: BoardMetric[];
}

/** A number at one meeting of a source's team. */
export interface DerivedReading {
  meeting_id: string;
  date: string;
  value: string;
}

/** A source as deriving read it: where, and the number found, and for a delta the one before. */
export interface DerivedSource extends DerivedReading {
  team: { id: string; name: string };
  metric: { id: string; name: string };
  previous: DerivedReading | null;
  /** The source's weight on a `weighted_mean`, null on any other kind. */
  weight: string | null;
}

/** A derived number and the numbers it was worked out from. Nothing is recorded. */
export interface DerivedValue {
  value: string;
  kind: DerivationKind;
  sources: DerivedSource[];
}

export interface TrendPoint {
  meeting_id: string;
  date: string;
  value: string | null;
  status: Status;
  set_by_hand: boolean;
  manual_status: Colour | null;
  comment: string | null;
  threshold: Threshold | null;
}

export interface Correction {
  id: string;
  meeting_id: string;
  old_value: string | null;
  old_manual_status: Colour | null;
  old_comment: string | null;
  new_value: string | null;
  new_manual_status: Colour | null;
  new_comment: string | null;
  reason: string;
  corrected_by_email: string;
  corrected_by_display_name: string;
  corrected_at: string;
}

export interface MetricTrend {
  metric: MetricDefinition;
  /** Every meeting of the team, earliest first. */
  points: TrendPoint[];
  /** Most recent first. */
  corrections: Correction[];
}

const enc = encodeURIComponent;

function metricsPath(teamId: string): string {
  return `/teams/${enc(teamId)}/metrics`;
}

export function getMetrics(teamId: string): Promise<Metric[]> {
  return request<Metric[]>(metricsPath(teamId));
}

export function addMetric(teamId: string, metric: MetricCreate): Promise<Metric> {
  return request<Metric>(metricsPath(teamId), { method: 'POST', body: JSON.stringify(metric) });
}

export function includeGlobalMetric(teamId: string, inclusion: MetricInclusion): Promise<Metric> {
  return request<Metric>(`${metricsPath(teamId)}/inclusions`, {
    method: 'POST',
    body: JSON.stringify(inclusion),
  });
}

export function copyMetric(teamId: string, copy: MetricCopy): Promise<Metric> {
  return request<Metric>(`${metricsPath(teamId)}/copies`, {
    method: 'POST',
    body: JSON.stringify(copy),
  });
}

export function changeMetric(
  teamId: string,
  metricId: string,
  change: MetricChange,
): Promise<Metric> {
  return request<Metric>(`${metricsPath(teamId)}/${enc(metricId)}`, {
    method: 'PATCH',
    body: JSON.stringify(change),
  });
}

export function deleteMetric(teamId: string, metricId: string): Promise<void> {
  return request<void>(`${metricsPath(teamId)}/${enc(metricId)}`, { method: 'DELETE' });
}

function groupsPath(teamId: string): string {
  return `/teams/${enc(teamId)}/metric-groups`;
}

/** A board's groups in order, the empty ones included. */
export function getMetricGroups(teamId: string): Promise<MetricGroup[]> {
  return request<MetricGroup[]>(groupsPath(teamId));
}

export function addMetricGroup(teamId: string, name: string): Promise<MetricGroup> {
  return request<MetricGroup>(groupsPath(teamId), {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function renameMetricGroup(
  teamId: string,
  groupId: string,
  name: string,
): Promise<MetricGroup> {
  return request<MetricGroup>(`${groupsPath(teamId)}/${enc(groupId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

/** Its metrics move, in order, after the board's ungrouped ones. */
export function deleteMetricGroup(teamId: string, groupId: string): Promise<void> {
  return request<void>(`${groupsPath(teamId)}/${enc(groupId)}`, { method: 'DELETE' });
}

/** Replace the board's whole arrangement; the response is not read. */
export function putMetricLayout(teamId: string, layout: MetricLayout): Promise<unknown> {
  return request<unknown>(`/teams/${enc(teamId)}/metric-layout`, {
    method: 'PUT',
    body: JSON.stringify(layout),
  });
}

export function getThresholds(teamId: string, metricId: string): Promise<Threshold[]> {
  return request<Threshold[]>(`${metricsPath(teamId)}/${enc(metricId)}/thresholds`);
}

export function addThreshold(
  teamId: string,
  metricId: string,
  threshold: ThresholdCreate,
): Promise<Threshold> {
  return request<Threshold>(`${metricsPath(teamId)}/${enc(metricId)}/thresholds`, {
    method: 'POST',
    body: JSON.stringify(threshold),
  });
}

export function getTrend(teamId: string, metricId: string): Promise<MetricTrend> {
  return request<MetricTrend>(`${metricsPath(teamId)}/${enc(metricId)}/trend`);
}

export function getBoard(teamId: string, meetingId: string): Promise<MeetingBoard> {
  return request<MeetingBoard>(`/teams/${enc(teamId)}/meetings/${enc(meetingId)}/board`);
}

/**
 * Work a derived metric's number out for a meeting. Refused with 409 and one
 * `derivation.source_missing` entry per missing source (`sources[i]`), or
 * `derivation.previous_missing` for a delta's previous meeting.
 */
export function getDerivedValue(
  teamId: string,
  meetingId: string,
  metricId: string,
): Promise<DerivedValue> {
  return request<DerivedValue>(
    `/teams/${enc(teamId)}/meetings/${enc(meetingId)}/metrics/${enc(metricId)}/derivation`,
  );
}

export function putValue(
  teamId: string,
  meetingId: string,
  metricId: string,
  write: MetricValueWrite,
): Promise<MetricValue> {
  return request<MetricValue>(
    `/teams/${enc(teamId)}/meetings/${enc(meetingId)}/values/${enc(metricId)}`,
    { method: 'PUT', body: JSON.stringify(write) },
  );
}
