import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import {
  nextStage,
  type ItemKind,
  type ItemMetric,
  type ProblemRead,
  type TaskRead,
} from '../../../api/items';
import type { Member } from '../../../api/teams';
import { describeFailure } from '../../../i18n/apiErrors';
import { ConfirmCloseDialog, ItemDialog, type DialogTarget } from './ItemDialog';
import { ItemEntry } from './ItemEntry';
import { useChangeProblem, useChangeTask, useProblems, useTasks } from './useItems';
import teamStyles from '../../teams/teams.module.css';
import styles from './items.module.css';

/** The address fragment that names each list: `/teams/:id#problems`. */
const anchors: Record<ItemKind, string> = { problem: 'problems', task: 'tasks' };

type Closing = { kind: 'problem'; item: ProblemRead } | { kind: 'task'; item: TaskRead };

/**
 * The team's active problems and tasks, beside the metric tiles, as the
 * legacy board's aside. The lists are the items as they are now, whichever
 * meeting is shown: a stage has no history to show it as it was then. The
 * meeting shown only decides which entries are new and what was closed at it.
 */
export function ItemLists({
  teamId,
  meetingId,
  members,
  metrics,
  mayChange,
}: {
  teamId: string;
  meetingId: string | undefined;
  members: Member[];
  metrics: ItemMetric[];
  /** Whether the viewer may raise and change the team's items. */
  mayChange: boolean;
}) {
  const { t } = useTranslation();
  const problems = useProblems(teamId, 'active');
  const tasks = useTasks(teamId, 'active');
  const archivedProblems = useProblems(teamId, 'archived');
  const archivedTasks = useTasks(teamId, 'archived');
  const changeProblem = useChangeProblem(teamId);
  const changeTask = useChangeTask(teamId);
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [closing, setClosing] = useState<Closing | null>(null);
  // Each opening starts from the item as it is then.
  const [opened, setOpened] = useState(0);
  const { hash } = useLocation();
  const scrolledTo = useRef<string | null>(null);
  const named = hash.slice(1);
  const isList = named === anchors.problem || named === anchors.task;
  // Both, since the problems list above the tasks moves them as it fills.
  const namedReady = isList && !problems.isPending && !tasks.isPending;

  // Brought into view once the lists have their entries, not on mount: they
  // arrive later and would push the list away again. Once per fragment, so a
  // reader scrolling on is not pulled back by a refetch.
  useEffect(() => {
    if (!namedReady) {
      if (!isList) scrolledTo.current = null;
      return;
    }
    if (scrolledTo.current === named) return;
    scrolledTo.current = named;
    document.getElementById(named)?.scrollIntoView({ block: 'start' });
  }, [named, isList, namedReady]);

  function open(target: DialogTarget) {
    setDialog(target);
    setOpened((count) => count + 1);
  }

  /** Steps the ball on; the last step closes the item, so it asks first. */
  function moveOn(kind: ItemKind, item: ProblemRead | TaskRead) {
    const next = nextStage(item.stage);
    if (!next) return;
    if (next === 'act') {
      // The confirmation shares the mutation; an earlier step's failure is not this one's.
      (kind === 'problem' ? changeProblem : changeTask).reset();
      setClosing(
        kind === 'problem'
          ? { kind, item: item as ProblemRead }
          : { kind: 'task', item: item as TaskRead },
      );
      return;
    }
    const mutation = kind === 'problem' ? changeProblem : changeTask;
    mutation.mutate({ id: item.id, change: { stage: next } });
  }

  function confirmClose() {
    if (!closing) return;
    const mutation = closing.kind === 'problem' ? changeProblem : changeTask;
    mutation.mutate(
      { id: closing.item.id, change: { stage: 'act' } },
      { onSuccess: () => setClosing(null) },
    );
  }

  const closingMutation = closing?.kind === 'problem' ? changeProblem : changeTask;
  const closedHere =
    meetingId === undefined || !archivedProblems.data || !archivedTasks.data
      ? undefined
      : [...archivedProblems.data, ...archivedTasks.data].filter(
          (item) => item.closed_meeting?.id === meetingId,
        ).length;
  const stepFailure = changeProblem.error ?? changeTask.error;

  function list(kind: ItemKind) {
    const query = kind === 'problem' ? problems : tasks;
    const headingId = `items-${kind}-heading`;
    const items: (ProblemRead | TaskRead)[] = query.data ?? [];
    return (
      <section id={anchors[kind]} className={styles.listSection} aria-labelledby={headingId}>
        <header className={styles.listHeader}>
          <h2 id={headingId} className={styles.listHeading}>
            {t(kind === 'problem' ? 'items.problemsHeading' : 'items.tasksHeading')}
          </h2>
          {query.data && (
            <span className={styles.count}>
              {t('items.activeCount', { count: query.data.length })}
            </span>
          )}
          {mayChange && (
            <button
              type="button"
              className={`${teamStyles.button} ${styles.add}`}
              onClick={() => open({ kind } as DialogTarget)}
            >
              {t(kind === 'problem' ? 'items.addProblem' : 'items.addTask')}
            </button>
          )}
        </header>
        {query.isPending ? (
          <p className={styles.empty}>{t('items.loading')}</p>
        ) : query.isError ? (
          <p role="alert" className={styles.empty}>
            {t('items.loadFailed')}
          </p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>
            {t(kind === 'problem' ? 'items.noProblems' : 'items.noTasks')}
          </p>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => (
              <ItemEntry
                key={item.id}
                item={item}
                meetingId={meetingId}
                onOpen={
                  mayChange
                    ? () =>
                        open(
                          kind === 'problem'
                            ? { kind, item: item as ProblemRead }
                            : { kind: 'task', item: item as TaskRead },
                        )
                    : undefined
                }
                onMoveOn={mayChange ? () => moveOn(kind, item) : undefined}
              />
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <aside className={styles.side} aria-label={t('items.listsLabel')}>
      {list('problem')}
      {list('task')}
      {closedHere !== undefined && (
        <p className={styles.closed}>{t('items.closedAtMeeting', { count: closedHere })}</p>
      )}
      {stepFailure && !closing && !dialog && (
        <p role="alert" className={teamStyles.error}>
          {describeFailure(t, stepFailure)}
        </p>
      )}
      {dialog && (
        <ItemDialog
          key={opened}
          teamId={teamId}
          target={dialog}
          members={members}
          metrics={metrics}
          problems={problems.data ?? []}
          onClose={() => setDialog(null)}
          onRaiseTask={(problem) => open({ kind: 'task', problemId: problem.id })}
        />
      )}
      {closing && (
        <ConfirmCloseDialog
          summary={closing.item.summary}
          pending={closingMutation.isPending}
          error={closingMutation.error ? describeFailure(t, closingMutation.error) : undefined}
          onConfirm={confirmClose}
          onClose={() => setClosing(null)}
        />
      )}
    </aside>
  );
}
