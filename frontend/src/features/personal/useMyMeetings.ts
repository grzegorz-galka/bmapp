import { useQueries } from '@tanstack/react-query';
import type { DashboardTeam } from '../../api/dashboard';
import { getMeetings, type Meeting, type MeetingList } from '../../api/meetings';
import { meetingsQueryKey } from '../meetings/useMeetings';

/** A meeting with the team it belongs to, for pages that list several teams at once. */
export interface TeamMeeting extends Meeting {
  team: string;
}

/**
 * The meetings of each of `teams`, read through each team's own meetings
 * query, so they share its cache with the meetings page and its invalidation
 * when a meeting changes. A viewer is in a handful of teams; a dedicated
 * endpoint can replace the fan-out if that ever stops being true.
 */
export function useMyMeetings(teams: DashboardTeam[]) {
  return useQueries({
    queries: teams.map((team) => ({
      queryKey: meetingsQueryKey(team.id),
      queryFn: () => getMeetings(team.id),
    })),
    combine: (results) => ({
      isPending: results.some((result) => result.isPending),
      isError: results.some((result) => result.isError),
      byTeam: teams.map((team, index) => ({
        team,
        list: results[index]?.data as MeetingList | undefined,
      })),
    }),
  });
}

/** Every listed meeting of every team, earliest first. */
export function allMeetings(byTeam: { team: DashboardTeam; list?: MeetingList }[]): TeamMeeting[] {
  return byTeam
    .flatMap(({ team, list }) =>
      (list?.meetings ?? []).map((meeting) => ({ ...meeting, team: team.name })),
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}
