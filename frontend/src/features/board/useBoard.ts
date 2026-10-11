import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBoard, putValue, type MeetingBoard, type MetricValueWrite } from '../../api/metrics';
import { boardQueryKey, metricsQueryKey } from '../metrics/useMetrics';

/** A team's board at one meeting. */
export function useBoard(teamId: string, meetingId: string | undefined) {
  return useQuery<MeetingBoard>({
    queryKey: boardQueryKey(teamId, meetingId ?? ''),
    queryFn: () => getBoard(teamId, meetingId ?? ''),
    enabled: meetingId !== undefined,
  });
}

/**
 * Record one metric's value at a meeting. Refetches everything under the
 * team's metrics: the board's completeness and changes, the next meeting's
 * "previous", and the metric's trend all read this value.
 */
export function useRecordValue(teamId: string, meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ metricId, write }: { metricId: string; write: MetricValueWrite }) =>
      putValue(teamId, meetingId, metricId, write),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: metricsQueryKey(teamId) }),
  });
}
