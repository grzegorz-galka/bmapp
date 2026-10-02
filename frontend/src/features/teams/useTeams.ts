import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  addMember,
  createTeam,
  getTeam,
  listTeams,
  makeLeader,
  removeMember,
  type Team,
  type TeamDetail,
} from '../../api/teams';

const TEAMS_QUERY_KEY = ['teams'] as const;

function teamQueryKey(teamId: string) {
  return ['teams', teamId] as const;
}

/** The registered teams, in the order the API returns them. */
export function useTeams() {
  return useQuery<Team[]>({ queryKey: TEAMS_QUERY_KEY, queryFn: listTeams });
}

/** Register a team, refreshing the list on success. */
export function useRegisterTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTeam,
    // Exact, so that a cached team detail is not refetched for a team that
    // registering another one cannot have changed.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY, exact: true }),
  });
}

/** One team with its members. */
export function useTeam(teamId: string) {
  return useQuery<TeamDetail>({
    queryKey: teamQueryKey(teamId),
    queryFn: () => getTeam(teamId),
  });
}

/**
 * Every membership mutation answers with the whole team, so the response is
 * written straight into the detail's cache rather than refetched. The list is
 * invalidated exactly: its member counts and leader follow, while a prefix
 * match would also refetch the detail that has just been written.
 */
function storeTeam(queryClient: QueryClient, teamId: string, team: TeamDetail) {
  queryClient.setQueryData(teamQueryKey(teamId), team);
  return queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY, exact: true });
}

export function useAddMember(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => addMember(teamId, email),
    onSuccess: (team) => storeTeam(queryClient, teamId, team),
  });
}

export function useRemoveMember(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) => removeMember(teamId, employeeId),
    onSuccess: (team) => storeTeam(queryClient, teamId, team),
  });
}

export function useMakeLeader(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) => makeLeader(teamId, employeeId),
    onSuccess: (team) => storeTeam(queryClient, teamId, team),
  });
}
