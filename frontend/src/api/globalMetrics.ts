/**
 * Typed client for the company-wide catalogue of global metrics.
 *
 * A global metric is one definition shared by every board that includes it:
 * its name, unit, decimals, direction and threshold history are set here, by
 * an administrator, and read on each board. Anyone signed in may read the
 * catalogue; only an administrator may write to it.
 */
import { request } from './client';
import type { Direction, Threshold, ThresholdCreate } from './metrics';

export interface GlobalMetric {
  id: string;
  scope: 'global';
  name: string;
  unit: string;
  decimals: number;
  direction: Direction;
  retired: boolean;
  /** The version in force today, or none. */
  threshold: Threshold | null;
  /** How many boards include it. */
  boards: number;
}

export interface GlobalMetricCreate {
  name: string;
  unit: string;
  decimals: number;
  direction: Direction;
}

/** A partial change: a key left out is left alone. The direction cannot change. */
export type GlobalMetricChange = Partial<Omit<GlobalMetricCreate, 'direction'>> & {
  retired?: boolean;
};

const PATH = '/global-metrics';
const enc = encodeURIComponent;

export function getGlobalMetrics(): Promise<GlobalMetric[]> {
  return request<GlobalMetric[]>(PATH);
}

export function addGlobalMetric(metric: GlobalMetricCreate): Promise<GlobalMetric> {
  return request<GlobalMetric>(PATH, { method: 'POST', body: JSON.stringify(metric) });
}

export function changeGlobalMetric(
  metricId: string,
  change: GlobalMetricChange,
): Promise<GlobalMetric> {
  return request<GlobalMetric>(`${PATH}/${enc(metricId)}`, {
    method: 'PATCH',
    body: JSON.stringify(change),
  });
}

export function deleteGlobalMetric(metricId: string): Promise<void> {
  return request<void>(`${PATH}/${enc(metricId)}`, { method: 'DELETE' });
}

export function getGlobalThresholds(metricId: string): Promise<Threshold[]> {
  return request<Threshold[]>(`${PATH}/${enc(metricId)}/thresholds`);
}

export function addGlobalThreshold(
  metricId: string,
  threshold: ThresholdCreate,
): Promise<Threshold> {
  return request<Threshold>(`${PATH}/${enc(metricId)}/thresholds`, {
    method: 'POST',
    body: JSON.stringify(threshold),
  });
}
