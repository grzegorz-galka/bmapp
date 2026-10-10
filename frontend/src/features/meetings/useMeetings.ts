import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeMeeting,
  deleteMeeting,
  getMeetings,
  openMeeting,
  type MeetingChange,
  type MeetingList,
  type MeetingSlot,
} from '../../api/meetings';
import { setSchedule, type Schedule } from '../../api/teams';

export function meetingsQueryKey(teamId: string) {
  return ['teams', teamId, 'meetings'] as const;
}

/** A team's meetings, with its schedule and the proposed next meeting. */
export function useMeetings(teamId: string) {
  return useQuery<MeetingList>({
    queryKey: meetingsQueryKey(teamId),
    queryFn: () => getMeetings(teamId),
  });
}

/**
 * Every meeting mutation refetches the list rather than patching the cache:
 * the proposal for the next meeting depends on the whole list, and only the
 * server knows what it proposes.
 */
function useMeetingMutation<Variables, Result>(
  teamId: string,
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meetingsQueryKey(teamId) }),
  });
}

export function useOpenMeeting(teamId: string) {
  return useMeetingMutation(teamId, (slot: MeetingSlot) => openMeeting(teamId, slot));
}

export function useChangeMeeting(teamId: string) {
  return useMeetingMutation(
    teamId,
    ({ meetingId, change }: { meetingId: string; change: MeetingChange }) =>
      changeMeeting(teamId, meetingId, change),
  );
}

export function useDeleteMeeting(teamId: string) {
  return useMeetingMutation(teamId, (meetingId: string) => deleteMeeting(teamId, meetingId));
}

/**
 * The schedule lives on the board, so the team list shows it too: that list
 * is invalidated exactly, leaving every team's detail and meetings alone.
 */
export function useSetSchedule(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: Schedule) => setSchedule(teamId, schedule),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: meetingsQueryKey(teamId) }),
        queryClient.invalidateQueries({ queryKey: ['teams'], exact: true }),
      ]),
  });
}
