import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addGlobalMetric,
  addGlobalThreshold,
  changeGlobalMetric,
  deleteGlobalMetric,
  getGlobalMetrics,
  getGlobalThresholds,
  type GlobalMetric,
  type GlobalMetricChange,
  type GlobalMetricCreate,
} from '../../api/globalMetrics';
import type { Threshold, ThresholdCreate } from '../../api/metrics';

export const GLOBAL_METRICS_QUERY_KEY = ['globalMetrics'] as const;

/** The catalogue, by name, retired metrics included. */
export function useGlobalMetrics() {
  return useQuery<GlobalMetric[]>({
    queryKey: GLOBAL_METRICS_QUERY_KEY,
    queryFn: getGlobalMetrics,
  });
}

export function useGlobalThresholds(metricId: string) {
  return useQuery<Threshold[]>({
    queryKey: [...GLOBAL_METRICS_QUERY_KEY, metricId, 'thresholds'],
    queryFn: () => getGlobalThresholds(metricId),
  });
}

/*
 * A catalogue write reaches every board that includes the metric - a rename
 * relabels them, a back-dated threshold recolours them - so it refreshes
 * every team's metrics as well as the catalogue itself.
 */
function useCatalogueMutation<Variables, Result>(
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: GLOBAL_METRICS_QUERY_KEY }),
        queryClient.invalidateQueries({
          predicate: ({ queryKey }) => queryKey[0] === 'teams' && queryKey[2] === 'metrics',
        }),
      ]),
  });
}

export function useAddGlobalMetric() {
  return useCatalogueMutation((metric: GlobalMetricCreate) => addGlobalMetric(metric));
}

export function useChangeGlobalMetric() {
  return useCatalogueMutation(
    ({ metricId, change }: { metricId: string; change: GlobalMetricChange }) =>
      changeGlobalMetric(metricId, change),
  );
}

export function useDeleteGlobalMetric() {
  return useCatalogueMutation((metricId: string) => deleteGlobalMetric(metricId));
}

export function useAddGlobalThreshold() {
  return useCatalogueMutation(
    ({ metricId, threshold }: { metricId: string; threshold: ThresholdCreate }) =>
      addGlobalThreshold(metricId, threshold),
  );
}
