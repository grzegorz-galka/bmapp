import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTeam, listTeams, type Team } from '../../api/teams';

const TEAMS_QUERY_KEY = ['teams'] as const;

/** The registered teams, in the order the API returns them. */
export function useTeams() {
  return useQuery<Team[]>({ queryKey: TEAMS_QUERY_KEY, queryFn: listTeams });
}

/** Register a team, refreshing the list on success. */
export function useRegisterTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTeam,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY }),
  });
}
