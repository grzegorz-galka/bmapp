import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeProblem,
  changeTask,
  createProblem,
  createTask,
  getProblems,
  getTasks,
  type ItemKind,
  type ItemState,
  type ProblemChange,
  type ProblemCreate,
  type ProblemRead,
  type TaskChange,
  type TaskCreate,
  type TaskRead,
} from '../../../api/items';

/*
 * Both states of a kind sit under one prefix: closing an item moves it from
 * the active list to the archived one, so a change refetches the two.
 */
export function itemsQueryKey(teamId: string, kind: ItemKind) {
  return ['teams', teamId, kind === 'problem' ? 'problems' : 'tasks'] as const;
}

export function itemListQueryKey(teamId: string, kind: ItemKind, state: ItemState) {
  return [...itemsQueryKey(teamId, kind), state] as const;
}

/** The hub's funnel and assigned items are counted from these same items. */
const HUB_QUERY_KEY = ['hub'] as const;

export function useProblems(teamId: string, state: ItemState) {
  return useQuery<ProblemRead[]>({
    queryKey: itemListQueryKey(teamId, 'problem', state),
    queryFn: () => getProblems(teamId, state),
  });
}

export function useTasks(teamId: string, state: ItemState) {
  return useQuery<TaskRead[]>({
    queryKey: itemListQueryKey(teamId, 'task', state),
    queryFn: () => getTasks(teamId, state),
  });
}

/** Refetch both states of every kind named, and the hub. */
function useItemMutation<Variables, Result>(
  teamId: string,
  kinds: readonly ItemKind[],
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        ...kinds.map((kind) =>
          queryClient.invalidateQueries({ queryKey: itemsQueryKey(teamId, kind) }),
        ),
        queryClient.invalidateQueries({ queryKey: HUB_QUERY_KEY }),
      ]),
  });
}

export function useRaiseProblem(teamId: string) {
  return useItemMutation(teamId, ['problem'], (body: ProblemCreate) => createProblem(teamId, body));
}

/** A task names its problem's summary, so a problem change refetches the tasks too. */
export function useChangeProblem(teamId: string) {
  return useItemMutation(
    teamId,
    ['problem', 'task'],
    ({ id, change }: { id: string; change: ProblemChange }) => changeProblem(teamId, id, change),
  );
}

export function useRaiseTask(teamId: string) {
  return useItemMutation(teamId, ['task'], (body: TaskCreate) => createTask(teamId, body));
}

export function useChangeTask(teamId: string) {
  return useItemMutation(teamId, ['task'], ({ id, change }: { id: string; change: TaskChange }) =>
    changeTask(teamId, id, change),
  );
}
