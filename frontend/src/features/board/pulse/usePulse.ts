import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPulse,
  putOwnPulseAnswer,
  type PulseAnswerWrite,
  type PulseResults,
} from '../../../api/pulse';

/*
 * Every meeting's pulse results sit under one team prefix: an answer at one
 * meeting moves the trend and the "previous" of the meetings after it.
 */
export function pulseQueryKey(teamId: string) {
  return ['teams', teamId, 'pulse'] as const;
}

export function pulseResultsQueryKey(teamId: string, meetingId: string) {
  return ['teams', teamId, 'pulse', meetingId] as const;
}

/** The pulse check's results at one meeting. */
export function usePulse(teamId: string, meetingId: string | undefined) {
  return useQuery<PulseResults>({
    queryKey: pulseResultsQueryKey(teamId, meetingId ?? ''),
    queryFn: () => getPulse(teamId, meetingId ?? ''),
    enabled: meetingId !== undefined,
  });
}

/** Save the caller's own answer at a meeting, then refetch the team's results. */
export function useSavePulseAnswer(teamId: string, meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PulseAnswerWrite) => putOwnPulseAnswer(teamId, meetingId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pulseQueryKey(teamId) }),
  });
}
