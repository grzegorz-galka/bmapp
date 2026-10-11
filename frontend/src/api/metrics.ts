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

export interface Threshold extends Bounds {
  id: string;
  metric_id: string;
  effective_from: string;
  reason: string;
  recorded_by_email: string;
  recorded_at: string;
}

export interface MetricDefinition {
  id: string;
  team_id: string;
  name: string;
  unit: string;
  decimals: number;
  direction: Direction;
  group_label: string | null;
  position: number;
  owner: Employee | null;
  retired: boolean;
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
  group_label: string | null;
  position: number;
  owner_employee_id: string | null;
}

/** A partial change: a key left out is left alone. The direction cannot change. */
export type MetricChange = Partial<Omit<MetricCreate, 'direction'>> & { retired?: boolean };

/**
 * A threshold version. A one-sided metric takes `green` and `amber`; a band
 * takes the four `_lo` / `_hi` boundaries.
 */
export interface ThresholdCreate {
  effective_from: string;
  reason: string;
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
  completeness: { recorded: number; total: number; missing: MissingMetric[] };
  metrics: BoardMetric[];
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
