import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBoard,
  getDerivedValue,
  putValue,
  type DerivedValue,
  type MeetingBoard,
  type MetricValueWrite,
} from '../../api/metrics';
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

/**
 * Work a derived metric's number out at a meeting. A read that records
 * nothing, asked for on demand, so a mutation rather than a cached query: the
 * sources may have changed since the last time, and nothing should be reused.
 */
export function useDeriveValue(teamId: string, meetingId: string) {
  return useMutation({
    mutationFn: (metricId: string) => getDerivedValue(teamId, meetingId, metricId),
  });
}

/**
 * A derived metric's number worked out again at a meeting, to explain where a
 * recorded value comes from. A cached query, asked for only once `enabled`:
 * the detail's sources section opens it, and reopening it reuses the answer.
 * Keyed under the team's metrics, so recording a value asks again.
 */
export function useDerivation(
  teamId: string,
  meetingId: string,
  metricId: string,
  enabled: boolean,
) {
  return useQuery<DerivedValue>({
    queryKey: [...metricsQueryKey(teamId), metricId, 'derivation', meetingId],
    queryFn: () => getDerivedValue(teamId, meetingId, metricId),
    enabled,
    // A refusal (a source with no number) is an answer, not a failure to retry.
    retry: false,
  });
}
