/**
 * The board's metrics as the board arranges them: its groups in order, each
 * with its metrics, then the ungrouped ones.
 *
 * Whoever configures the board rearranges it here, by dragging a metric or a
 * group, or with the move controls on each, which do the same from the
 * keyboard. Both paths compute the new layout with `moveInLayout` and save it
 * whole; the server refuses one made against a board that has changed since.
 */
import { useState, type DragEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Metric, MetricGroup, MetricLayout } from '../../api/metrics';
import type { Member } from '../../api/teams';
import { describeFailure, describeFieldFailure, describeOtherFailure } from '../../i18n/apiErrors';
import { Modal } from '../../components/Modal';
import {
  changesNothing,
  layoutOf,
  locate,
  moveInLayout,
  type Container,
  type Move,
} from './layout';
import { MetricRow } from './MetricRow';
import {
  useAddMetricGroup,
  useArrangeMetrics,
  useDeleteMetricGroup,
  useRenameMetricGroup,
} from './useMetrics';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import styles from './metrics.module.css';

type Dragged = { kind: 'metric' | 'group'; id: string };
type Drop =
  | { kind: 'metric'; to: Container; before: string | null }
  | { kind: 'group'; before: string | null };

/** True when the pointer is past the middle of the element it is over. */
function inLowerHalf(event: DragEvent<HTMLElement>): boolean {
  const box = event.currentTarget.getBoundingClientRect();
  return box.height > 0 && event.clientY > box.top + box.height / 2;
}

export function ArrangedMetrics({
  teamId,
  metrics,
  groups,
  members,
  mayConfigure,
}: {
  teamId: string;
  metrics: Metric[];
  groups: MetricGroup[];
  members: Member[];
  mayConfigure: boolean;
}) {
  const { t } = useTranslation();
  const arrange = useArrangeMetrics(teamId);
  const [announcement, setAnnouncement] = useState('');
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const layout = layoutOf(metrics, groups);
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));
  const containerName = (container: Container) =>
    container === null
      ? t('metrics.ungrouped')
      : (groups.find((group) => group.id === container)?.name ?? '');

  function save(move: Move) {
    if (changesNothing(layout, move)) return;
    const next = moveInLayout(layout, move);
    arrange.mutate(next);
    setAnnouncement(describeMove(next, move));
  }

  function describeMove(next: MetricLayout, move: Move): string {
    if (move.kind === 'group') {
      return t('metrics.groupMoved', {
        name: containerName(move.id),
        position: next.groups.findIndex((group) => group.id === move.id) + 1,
        count: next.groups.length,
      });
    }
    const place = locate(next, move.id);
    const siblings =
      move.to === null
        ? next.ungrouped
        : (next.groups.find((group) => group.id === move.to)?.metric_ids ?? []);
    return t('metrics.metricMoved', {
      name: byId.get(move.id)?.name ?? '',
      group: containerName(move.to),
      position: (place?.index ?? 0) + 1,
      count: siblings.length,
    });
  }

  function endDrag() {
    setDragged(null);
    setDrop(null);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (dragged && drop?.kind === 'metric' && dragged.kind === 'metric') {
      save({ kind: 'metric', id: dragged.id, to: drop.to, before: drop.before });
    } else if (dragged && drop?.kind === 'group' && dragged.kind === 'group') {
      save({ kind: 'group', id: dragged.id, before: drop.before });
    }
    endDrag();
  }

  function startDrag(event: DragEvent<HTMLElement>, item: Dragged) {
    event.stopPropagation();
    // Firefox starts a drag only when something is set to carry.
    event.dataTransfer?.setData('text/plain', item.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    setDragged(item);
  }

  /** Over a container's open space: a metric lands at its end. */
  function overContainer(event: DragEvent<HTMLElement>, container: Container) {
    if (dragged?.kind !== 'metric') return;
    event.preventDefault();
    setDrop({ kind: 'metric', to: container, before: null });
  }

  /** Over a group: a dragged group lands before it, or after it past its middle. */
  function overGroup(event: DragEvent<HTMLElement>, index: number) {
    if (dragged?.kind !== 'group') return;
    event.preventDefault();
    const at = inLowerHalf(event) ? index + 1 : index;
    setDrop({ kind: 'group', before: layout.groups[at]?.id ?? null });
  }

  function metricList(container: Container, ids: string[], label: string) {
    const dropsAtEnd =
      drop?.kind === 'metric' && drop.to === container && drop.before === null && dragged !== null;
    return (
      <ul
        className={`${teamStyles.list} ${styles.metricList} ${dropsAtEnd ? styles.dropEnd : ''}`}
        aria-label={label}
      >
        {ids.flatMap((id, index) => {
          const metric = byId.get(id);
          if (!metric) return [];
          const before = drop?.kind === 'metric' && drop.to === container && drop.before === id;
          return [
            <MetricRow
              key={id}
              teamId={teamId}
              metric={metric}
              members={members}
              mayConfigure={mayConfigure}
              arrange={
                mayConfigure && (
                  <MetricMoves
                    metric={metric}
                    container={container}
                    index={index}
                    ids={ids}
                    groups={layout.groups.map((group) => ({
                      id: group.id,
                      name: containerName(group.id),
                    }))}
                    onMove={save}
                  />
                )
              }
              rowProps={
                mayConfigure
                  ? {
                      draggable: true,
                      className: [
                        styles.draggable,
                        dragged?.id === id ? styles.dragging : '',
                        before ? styles.dropBefore : '',
                      ].join(' '),
                      onDragStart: (event) => startDrag(event, { kind: 'metric', id }),
                      onDragOver: (event) => {
                        if (dragged?.kind !== 'metric') return;
                        event.preventDefault();
                        event.stopPropagation();
                        setDrop({
                          kind: 'metric',
                          to: container,
                          before: inLowerHalf(event) ? (ids[index + 1] ?? null) : id,
                        });
                      },
                      onDrop: handleDrop,
                      onDragEnd: endDrag,
                    }
                  : undefined
              }
            />,
          ];
        })}
      </ul>
    );
  }

  return (
    <>
      {arrange.error && (
        <p role="alert" className={teamStyles.itemError}>
          {describeFailure(t, arrange.error)}
        </p>
      )}
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
      <div aria-label={t('metrics.groupsLabel')} role="group">
        {layout.groups.map((entry, index) => {
          const group = groups.find((candidate) => candidate.id === entry.id);
          if (!group) return null;
          const before = drop?.kind === 'group' && drop.before === group.id;
          return (
            <section
              key={group.id}
              aria-labelledby={`group-${group.id}`}
              className={[
                styles.group,
                dragged?.id === group.id ? styles.dragging : '',
                before ? styles.dropBefore : '',
              ].join(' ')}
              onDragOver={(event) =>
                dragged?.kind === 'group' ? overGroup(event, index) : overContainer(event, group.id)
              }
              onDrop={handleDrop}
            >
              <GroupHeader
                teamId={teamId}
                group={group}
                metricCount={entry.metric_ids.length}
                mayConfigure={mayConfigure}
                first={index === 0}
                last={index === layout.groups.length - 1}
                onMove={(direction) =>
                  save({
                    kind: 'group',
                    id: group.id,
                    before:
                      direction === 'up'
                        ? (layout.groups[index - 1]?.id ?? null)
                        : (layout.groups[index + 2]?.id ?? null),
                  })
                }
                onDragStart={(event) => startDrag(event, { kind: 'group', id: group.id })}
                onDragEnd={endDrag}
              />
              {entry.metric_ids.length === 0 ? (
                <p
                  className={`${styles.hint} ${styles.emptyGroup} ${
                    drop?.kind === 'metric' && drop.to === group.id ? styles.dropEnd : ''
                  }`}
                >
                  {mayConfigure ? t('metrics.groupEmptyDrop') : t('metrics.groupEmpty')}
                </p>
              ) : (
                metricList(group.id, entry.metric_ids, group.name)
              )}
            </section>
          );
        })}
        {(layout.ungrouped.length > 0 || (mayConfigure && metrics.length > 0)) && (
          <section
            aria-labelledby="group-ungrouped"
            className={styles.group}
            onDragOver={(event) => {
              if (dragged?.kind === 'group') {
                event.preventDefault();
                setDrop({ kind: 'group', before: null });
              } else {
                overContainer(event, null);
              }
            }}
            onDrop={handleDrop}
          >
            <h2 id="group-ungrouped" className={`${meetingStyles.subheading} ${styles.groupName}`}>
              {t('metrics.ungrouped')}
            </h2>
            {metricList(null, layout.ungrouped, t('metrics.ungrouped'))}
          </section>
        )}
      </div>
    </>
  );
}

/** Up, down and to another group, for one metric: dragging without a pointer. */
function MetricMoves({
  metric,
  container,
  index,
  ids,
  groups,
  onMove,
}: {
  metric: Metric;
  container: Container;
  index: number;
  ids: string[];
  groups: { id: string; name: string }[];
  onMove: (move: Move) => void;
}) {
  const { t } = useTranslation();
  const name = metric.name;
  const move = (to: Container, before: string | null) =>
    onMove({ kind: 'metric', id: metric.id, to, before });
  const elsewhere = [
    ...groups.filter((group) => group.id !== container),
    ...(container === null ? [] : [{ id: '', name: t('metrics.ungrouped') }]),
  ];

  return (
    <>
      {index > 0 && (
        <button
          type="button"
          className={teamStyles.button}
          aria-label={t('metrics.moveUpLabel', { name })}
          onClick={() => move(container, ids[index - 1] ?? null)}
        >
          {t('metrics.moveUp')}
        </button>
      )}
      {index < ids.length - 1 && (
        <button
          type="button"
          className={teamStyles.button}
          aria-label={t('metrics.moveDownLabel', { name })}
          onClick={() => move(container, ids[index + 2] ?? null)}
        >
          {t('metrics.moveDown')}
        </button>
      )}
      {elsewhere.length > 0 && (
        <select
          className={`${meetingStyles.select} ${styles.moveTo}`}
          aria-label={t('metrics.moveToGroupLabel', { name })}
          value=""
          onChange={(event) => {
            if (event.target.value === '') return;
            move(event.target.value === UNGROUPED ? null : event.target.value, null);
          }}
        >
          <option value="">{t('metrics.moveToGroupPrompt')}</option>
          {elsewhere.map((group) => (
            <option key={group.id || UNGROUPED} value={group.id || UNGROUPED}>
              {group.name}
            </option>
          ))}
        </select>
      )}
    </>
  );
}

/** The select's value for "no group": an option's empty value is its prompt. */
const UNGROUPED = '-ungrouped';

type GroupDialog = 'none' | 'rename' | 'delete';

function GroupHeader({
  teamId,
  group,
  metricCount,
  mayConfigure,
  first,
  last,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  teamId: string;
  group: MetricGroup;
  metricCount: number;
  mayConfigure: boolean;
  first: boolean;
  last: boolean;
  onMove: (direction: 'up' | 'down') => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteMetricGroup(teamId);
  const [dialog, setDialog] = useState<GroupDialog>('none');
  const name = group.name;
  const close = () => setDialog('none');

  function handleDelete() {
    remove.reset();
    // An empty group takes nothing with it, so it goes without asking.
    if (metricCount === 0) remove.mutate(group.id);
    else setDialog('delete');
  }

  return (
    <div
      className={`${styles.groupHeader} ${mayConfigure ? styles.draggable : ''}`}
      draggable={mayConfigure}
      onDragStart={mayConfigure ? onDragStart : undefined}
      onDragEnd={mayConfigure ? onDragEnd : undefined}
    >
      <h2 id={`group-${group.id}`} className={`${meetingStyles.subheading} ${styles.groupName}`}>
        {name}
      </h2>
      {mayConfigure && (
        <span className={teamStyles.actions}>
          {!first && (
            <button
              type="button"
              className={teamStyles.button}
              aria-label={t('metrics.moveGroupUpLabel', { name })}
              onClick={() => onMove('up')}
            >
              {t('metrics.moveUp')}
            </button>
          )}
          {!last && (
            <button
              type="button"
              className={teamStyles.button}
              aria-label={t('metrics.moveGroupDownLabel', { name })}
              onClick={() => onMove('down')}
            >
              {t('metrics.moveDown')}
            </button>
          )}
          <button
            type="button"
            className={teamStyles.button}
            aria-haspopup="dialog"
            aria-label={t('metrics.renameGroupLabel', { name })}
            onClick={() => setDialog('rename')}
          >
            {t('metrics.renameGroup')}
          </button>
          <button
            type="button"
            className={teamStyles.button}
            disabled={remove.isPending}
            aria-label={t('metrics.deleteGroupLabel', { name })}
            onClick={handleDelete}
          >
            {t('metrics.deleteGroup')}
          </button>
        </span>
      )}
      {remove.error && dialog === 'none' && (
        <p role="alert" className={teamStyles.itemError}>
          {describeFailure(t, remove.error)}
        </p>
      )}
      {dialog === 'rename' && <GroupNameDialog teamId={teamId} group={group} onClose={close} />}
      {dialog === 'delete' && (
        <Modal labelledBy={`delete-group-${group.id}`} onClose={close}>
          <section className={styles.dialogBody}>
            <h2
              id={`delete-group-${group.id}`}
              className={`${meetingStyles.subheading} ${styles.dialogHeading}`}
            >
              {t('metrics.deleteGroupHeading', { name })}
            </h2>
            <p>{t('metrics.deleteGroupBody', { count: metricCount })}</p>
            <span className={teamStyles.actions}>
              <button
                type="button"
                className={teamStyles.primary}
                disabled={remove.isPending}
                onClick={() => remove.mutate(group.id, { onSuccess: close })}
              >
                {t('metrics.deleteGroup')}
              </button>
              <button type="button" className={teamStyles.button} onClick={close}>
                {t('metrics.cancel')}
              </button>
            </span>
            {remove.error && (
              <p role="alert" className={teamStyles.itemError}>
                {describeFailure(t, remove.error)}
              </p>
            )}
          </section>
        </Modal>
      )}
    </div>
  );
}

/** A new group's name, or a new name for an existing one. */
export function GroupNameDialog({
  teamId,
  group,
  onClose,
}: {
  teamId: string;
  /** The group being renamed; none to add a new one. */
  group?: MetricGroup;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const add = useAddMetricGroup(teamId);
  const rename = useRenameMetricGroup(teamId);
  const save = group ? rename : add;
  const [name, setName] = useState(group?.name ?? '');
  const id = group ? `rename-group-${group.id}` : 'new-group';
  const nameError = describeFieldFailure(t, save.error, 'name');
  const otherError = describeOtherFailure(t, save.error, ['name']);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A rejection keeps the dialog open with what was typed.
    if (group) rename.mutate({ groupId: group.id, name }, { onSuccess: onClose });
    else add.mutate(name, { onSuccess: onClose });
  }

  return (
    <Modal labelledBy={`${id}-heading`} onClose={onClose}>
      <section className={styles.dialogBody}>
        <h2 id={`${id}-heading`} className={`${meetingStyles.subheading} ${styles.dialogHeading}`}>
          {group ? t('metrics.renameGroupHeading', { name: group.name }) : t('metrics.addGroup')}
        </h2>
        <form className={teamStyles.form} onSubmit={handleSubmit} noValidate>
          <div className={teamStyles.field}>
            <label className={teamStyles.label} htmlFor={`${id}-name`}>
              {t('metrics.groupNameLabel')}
            </label>
            <input
              id={`${id}-name`}
              className={teamStyles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={nameError !== undefined}
            />
            {nameError && (
              <p role="alert" className={teamStyles.error}>
                {nameError}
              </p>
            )}
          </div>
          <span className={`${teamStyles.actions} ${teamStyles.submit}`}>
            <button type="submit" className={teamStyles.primary} disabled={save.isPending}>
              {save.isPending
                ? group
                  ? t('metrics.saving')
                  : t('metrics.addingGroup')
                : group
                  ? t('metrics.save')
                  : t('metrics.addGroup')}
            </button>
            <button type="button" className={teamStyles.button} onClick={onClose}>
              {t('metrics.cancel')}
            </button>
          </span>
          {otherError && (
            <p role="alert" className={teamStyles.itemError}>
              {otherError}
            </p>
          )}
        </form>
      </section>
    </Modal>
  );
}
