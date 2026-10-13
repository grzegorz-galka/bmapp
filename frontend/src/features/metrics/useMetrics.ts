import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMetric,
  addMetricGroup,
  addThreshold,
  changeMetric,
  copyMetric,
  deleteMetric,
  deleteMetricGroup,
  getMetricGroups,
  getMetrics,
  getThresholds,
  getTrend,
  includeGlobalMetric,
  putMetricLayout,
  renameMetricGroup,
  type Metric,
  type MetricChange,
  type MetricCopy,
  type MetricCreate,
  type MetricGroup,
  type MetricInclusion,
  type MetricLayout,
  type MetricTrend,
  type Threshold,
  type ThresholdCreate,
} from '../../api/metrics';
import { GLOBAL_METRICS_QUERY_KEY } from '../globalMetrics/useGlobalMetrics';
import { applyLayout } from './layout';

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

/** Under the metrics prefix: a group change reorders the metrics and the board too. */
export function groupsQueryKey(teamId: string) {
  return ['teams', teamId, 'metrics', 'groups'] as const;
}

/** A board's metrics, retired ones included, each with its threshold in force today. */
export function useMetrics(teamId: string, enabled = true) {
  return useQuery<Metric[]>({
    queryKey: metricsQueryKey(teamId),
    queryFn: () => getMetrics(teamId),
    enabled,
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

/** Include a global metric. Its catalogue entry counts one more board. */
export function useIncludeGlobalMetric(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inclusion: MetricInclusion) => includeGlobalMetric(teamId, inclusion),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: metricsQueryKey(teamId) }),
        queryClient.invalidateQueries({ queryKey: GLOBAL_METRICS_QUERY_KEY }),
      ]),
  });
}

export function useCopyMetric(teamId: string) {
  return useMetricsMutation(teamId, (copy: MetricCopy) => copyMetric(teamId, copy));
}

export function useChangeMetric(teamId: string) {
  return useMetricsMutation(
    teamId,
    ({ metricId, change }: { metricId: string; change: MetricChange }) =>
      changeMetric(teamId, metricId, change),
  );
}

/** Delete an own metric, or remove a global one from the board - which changes its board count. */
export function useDeleteMetric(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (metricId: string) => deleteMetric(teamId, metricId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: metricsQueryKey(teamId) }),
        queryClient.invalidateQueries({ queryKey: GLOBAL_METRICS_QUERY_KEY }),
      ]),
  });
}

export function useAddThreshold(teamId: string) {
  return useMetricsMutation(
    teamId,
    ({ metricId, threshold }: { metricId: string; threshold: ThresholdCreate }) =>
      addThreshold(teamId, metricId, threshold),
  );
}

/** A board's groups in order, the empty ones included. */
export function useMetricGroups(teamId: string, enabled = true) {
  return useQuery<MetricGroup[]>({
    queryKey: groupsQueryKey(teamId),
    queryFn: () => getMetricGroups(teamId),
    enabled,
  });
}

export function useAddMetricGroup(teamId: string) {
  return useMetricsMutation(teamId, (name: string) => addMetricGroup(teamId, name));
}

export function useRenameMetricGroup(teamId: string) {
  return useMetricsMutation(teamId, ({ groupId, name }: { groupId: string; name: string }) =>
    renameMetricGroup(teamId, groupId, name),
  );
}

export function useDeleteMetricGroup(teamId: string) {
  return useMetricsMutation(teamId, (groupId: string) => deleteMetricGroup(teamId, groupId));
}

/**
 * Save a whole new arrangement. It is shown at once, before the server
 * answers; whatever the answer, the board is read again, so a layout refused
 * as stale gives way to the board as it now is.
 */
export function useArrangeMetrics(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (layout: MetricLayout) => putMetricLayout(teamId, layout),
    onMutate: async (layout: MetricLayout) => {
      await queryClient.cancelQueries({ queryKey: metricsQueryKey(teamId) });
      const metrics = queryClient.getQueryData<Metric[]>(metricsQueryKey(teamId));
      const groups = queryClient.getQueryData<MetricGroup[]>(groupsQueryKey(teamId));
      if (metrics && groups) {
        const arranged = applyLayout(metrics, groups, layout);
        queryClient.setQueryData(metricsQueryKey(teamId), arranged.metrics);
        queryClient.setQueryData(groupsQueryKey(teamId), arranged.groups);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: metricsQueryKey(teamId) }),
  });
}
