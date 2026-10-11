import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMetric,
  addThreshold,
  changeMetric,
  deleteMetric,
  getMetrics,
  getThresholds,
  getTrend,
  type Metric,
  type MetricChange,
  type MetricCreate,
  type MetricTrend,
  type Threshold,
  type ThresholdCreate,
} from '../../api/metrics';

/*
 * Everything about a team's metrics - the list, each metric's thresholds and
 * trend, and the board at each meeting - sits under one key prefix, because a
 * change to any of it can change the rest: a back-dated threshold recolours
 * every board it reaches back to.
 */
export function metricsQueryKey(teamId: string) {
  return ['teams', teamId, 'metrics'] as const;
}

export function boardQueryKey(teamId: string, meetingId: string) {
  return ['teams', teamId, 'metrics', 'board', meetingId] as const;
}

/** A board's metrics, retired ones included, each with its threshold in force today. */
export function useMetrics(teamId: string) {
  return useQuery<Metric[]>({
    queryKey: metricsQueryKey(teamId),
    queryFn: () => getMetrics(teamId),
  });
}

export function useThresholds(teamId: string, metricId: string, enabled = true) {
  return useQuery<Threshold[]>({
    queryKey: [...metricsQueryKey(teamId), metricId, 'thresholds'],
    queryFn: () => getThresholds(teamId, metricId),
    enabled,
  });
}

export function useTrend(teamId: string, metricId: string) {
  return useQuery<MetricTrend>({
    queryKey: [...metricsQueryKey(teamId), metricId, 'trend'],
    queryFn: () => getTrend(teamId, metricId),
  });
}

function useMetricsMutation<Variables, Result>(
  teamId: string,
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: metricsQueryKey(teamId) }),
  });
}

export function useAddMetric(teamId: string) {
  return useMetricsMutation(teamId, (metric: MetricCreate) => addMetric(teamId, metric));
}

export function useChangeMetric(teamId: string) {
  return useMetricsMutation(
    teamId,
    ({ metricId, change }: { metricId: string; change: MetricChange }) =>
      changeMetric(teamId, metricId, change),
  );
}

export function useDeleteMetric(teamId: string) {
  return useMetricsMutation(teamId, (metricId: string) => deleteMetric(teamId, metricId));
}

export function useAddThreshold(teamId: string) {
  return useMetricsMutation(
    teamId,
    ({ metricId, threshold }: { metricId: string; threshold: ThresholdCreate }) =>
      addThreshold(teamId, metricId, threshold),
  );
}
