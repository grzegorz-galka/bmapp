/**
 * Raising and changing a problem or a task, in one dialog for both kinds.
 *
 * A native `<dialog>` shown with `showModal()`, as the development login
 * window is: the backdrop, the focus trap and Escape come without a
 * dependency. Moving an item to `act` closes it for good, so the dialog - and
 * the ball on the list - ask first.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STAGES,
  type ItemMetric,
  type ProblemRead,
  type Stage,
  type TaskRead,
} from '../../../api/items';
import type { Member } from '../../../api/teams';
import { describeFieldFailure, describeOtherFailure } from '../../../i18n/apiErrors';
import { Modal } from '../../../components/Modal';
import { useChangeProblem, useChangeTask, useRaiseProblem, useRaiseTask } from './useItems';
import teamStyles from '../../teams/teams.module.css';
import meetingStyles from '../../meetings/meetings.module.css';
import styles from './items.module.css';

/** What the dialog is open on: a new item, an existing one, or a task from a problem. */
export type DialogTarget =
  { kind: 'problem'; item?: ProblemRead } | { kind: 'task'; item?: TaskRead; problemId?: string };

const FIELDS = [
  'summary',
  'reason',
  'solution',
  'details',
  'responsible_employee_id',
  'due_on',
  'metric_id',
  'problem_id',
  'stage',
] as const;

interface Form {
  summary: string;
  reason: string;
  solution: string;
  details: string;
  responsible_employee_id: string | null;
  due_on: string | null;
  metric_id: string | null;
  problem_id: string | null;
  stage: Stage;
}

function formFor(target: DialogTarget): Form {
  const item = target.item;
  return {
    summary: item?.summary ?? '',
    reason: target.kind === 'problem' ? (target.item?.reason ?? '') : '',
    solution: target.kind === 'problem' ? (target.item?.solution ?? '') : '',
    details: target.kind === 'task' ? (target.item?.details ?? '') : '',
    responsible_employee_id: item?.responsible?.employee_id ?? null,
    due_on: item?.due_on ?? null,
    metric_id: item?.metric?.id ?? null,
    problem_id:
      target.kind === 'task' ? (target.item?.problem?.id ?? target.problemId ?? null) : null,
    stage: item?.stage ?? 'not_started',
  };
}

/** The fields of `form` a body of `kind` carries. */
function bodyOf(kind: DialogTarget['kind'], form: Form): Partial<Form> {
  const { reason, solution, details, problem_id, ...common } = form;
  return kind === 'problem' ? { ...common, reason, solution } : { ...common, details, problem_id };
}

/** Only what differs from what the item holds, so a change touches nothing else. */
function changedFields(before: Partial<Form>, after: Partial<Form>): Partial<Form> {
  return Object.fromEntries(
    Object.entries(after).filter(([key, value]) => before[key as keyof Form] !== value),
  );
}

/** "This will be archived": the question asked before an item reaches `act`. */
function CloseConfirmation({
  summary,
  pending,
  onConfirm,
  onBack,
}: {
  summary: string;
  pending: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.form}>
      <h2 id="item-confirm-heading" className={styles.dialogTitle}>
        {t('items.confirmCloseHeading')}
      </h2>
      <p className={styles.hint}>{t('items.confirmCloseBody', { summary })}</p>
      <span className={teamStyles.actions}>
        <button type="button" className={teamStyles.primary} disabled={pending} onClick={onConfirm}>
          {t('items.confirmClose')}
        </button>
        <button type="button" className={teamStyles.button} onClick={onBack}>
          {t('items.confirmBack')}
        </button>
      </span>
    </div>
  );
}

/** The confirmation alone, for closing an item from its ball on the list. */
export function ConfirmCloseDialog({
  summary,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  summary: string;
  pending: boolean;
  error: string | undefined;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal labelledBy="item-confirm-heading" onClose={onClose}>
      <CloseConfirmation
        summary={summary}
        pending={pending}
        onConfirm={onConfirm}
        onBack={onClose}
      />
      {error && (
        <p role="alert" className={`${teamStyles.error} ${styles.dialogError}`}>
          {error}
        </p>
      )}
    </Modal>
  );
}

export function ItemDialog({
  teamId,
  target,
  members,
  metrics,
  problems,
  onClose,
  onRaiseTask,
}: {
  teamId: string;
  target: DialogTarget;
  members: Member[];
  /** The metrics an item may be linked to: those active on the board. */
  metrics: ItemMetric[];
  /** The problems a task may come from: the team's active ones. */
  problems: ProblemRead[];
  onClose: () => void;
  onRaiseTask: (problem: ProblemRead) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Form>(() => formFor(target));
  const [confirming, setConfirming] = useState(false);
  const raiseProblem = useRaiseProblem(teamId);
  const changeProblem = useChangeProblem(teamId);
  const raiseTask = useRaiseTask(teamId);
  const changeTask = useChangeTask(teamId);
  const first = useRef<HTMLInputElement>(null);
  const { kind, item } = target;
  const mutation =
    kind === 'problem' ? (item ? changeProblem : raiseProblem) : item ? changeTask : raiseTask;
  const id = (field: string) => `item-${field}`;

  useEffect(() => first.current?.focus(), []);

  function set<Key extends keyof Form>(key: Key, value: Form[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    const after = bodyOf(kind, form);
    const options = { onSuccess: onClose, onError: () => setConfirming(false) };
    if (!item) {
      if (kind === 'problem') raiseProblem.mutate({ ...after, summary: form.summary }, options);
      else raiseTask.mutate({ ...after, summary: form.summary }, options);
      return;
    }
    const change = changedFields(bodyOf(kind, formFor(target)), after);
    if (Object.keys(change).length === 0) {
      onClose();
      return;
    }
    if (kind === 'problem') changeProblem.mutate({ id: item.id, change }, options);
    else changeTask.mutate({ id: item.id, change }, options);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.stage === 'act' && item?.stage !== 'act') setConfirming(true);
    else save();
  }

  const error = (field: string) => describeFieldFailure(t, mutation.error, field);
  const otherError = describeOtherFailure(t, mutation.error, FIELDS);
  const heading = item
    ? t(kind === 'problem' ? 'items.editProblemHeading' : 'items.editTaskHeading')
    : t(kind === 'problem' ? 'items.newProblemHeading' : 'items.newTaskHeading');

  // An item keeps a responsible person, a metric or a problem it no longer
  // could be given; it is still offered, so saving other fields keeps it.
  const responsibleOptions = [...members];
  if (item?.responsible && !members.some((m) => m.employee_id === item.responsible?.employee_id)) {
    responsibleOptions.push({ ...item.responsible, is_leader: false });
  }
  const metricOptions = [...metrics];
  if (item?.metric && !metrics.some((m) => m.id === item.metric?.id)) {
    metricOptions.push(item.metric);
  }
  const problemOptions: { id: string; summary: string }[] = [...problems];
  const linked = kind === 'task' ? item?.problem : undefined;
  if (linked && !problems.some((p) => p.id === linked.id)) problemOptions.push(linked);

  function textField(field: 'reason' | 'solution' | 'details', label: string) {
    const fieldError = error(field);
    return (
      <div className={teamStyles.field}>
        <label className={teamStyles.label} htmlFor={id(field)}>
          {label}
        </label>
        <textarea
          id={id(field)}
          className={`${teamStyles.input} ${styles.textarea}`}
          value={form[field]}
          onChange={(event) => set(field, event.target.value)}
          aria-invalid={fieldError !== undefined}
        />
        {fieldError && (
          <p role="alert" className={teamStyles.error}>
            {fieldError}
          </p>
        )}
      </div>
    );
  }

  const summaryError = error('summary');
  const responsibleError = error('responsible_employee_id');
  const dueError = error('due_on');
  const metricError = error('metric_id');
  const problemError = error('problem_id');
  const stageError = error('stage');

  return (
    <Modal labelledBy={confirming ? 'item-confirm-heading' : id('heading')} onClose={onClose}>
      {confirming ? (
        <CloseConfirmation
          summary={form.summary.trim()}
          pending={mutation.isPending}
          onConfirm={save}
          onBack={() => setConfirming(false)}
        />
      ) : (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <h2 id={id('heading')} className={styles.dialogTitle}>
            {heading}
          </h2>
          <div className={teamStyles.field}>
            <label className={teamStyles.label} htmlFor={id('summary')}>
              {t('items.summaryLabel')}
            </label>
            <input
              ref={first}
              id={id('summary')}
              className={teamStyles.input}
              value={form.summary}
              maxLength={500}
              onChange={(event) => set('summary', event.target.value)}
              aria-invalid={summaryError !== undefined}
            />
            {summaryError && (
              <p role="alert" className={teamStyles.error}>
                {summaryError}
              </p>
            )}
          </div>
          {kind === 'problem' ? (
            <>
              {textField('reason', t('items.reasonLabel'))}
              {textField('solution', t('items.solutionLabel'))}
            </>
          ) : (
            textField('details', t('items.detailsLabel'))
          )}
          {kind === 'task' && (
            <div className={teamStyles.field}>
              <label className={teamStyles.label} htmlFor={id('problem')}>
                {t('items.problemLabel')}
              </label>
              <select
                id={id('problem')}
                className={meetingStyles.select}
                value={form.problem_id ?? ''}
                onChange={(event) => set('problem_id', event.target.value || null)}
                aria-invalid={problemError !== undefined}
              >
                <option value="">{t('items.noProblem')}</option>
                {problemOptions.map((problem) => (
                  <option key={problem.id} value={problem.id}>
                    {problem.summary}
                  </option>
                ))}
              </select>
              {problemError && (
                <p role="alert" className={teamStyles.error}>
                  {problemError}
                </p>
              )}
            </div>
          )}
          <div className={styles.fieldRow}>
            <div className={teamStyles.field}>
              <label className={teamStyles.label} htmlFor={id('responsible')}>
                {t('items.responsibleLabel')}
              </label>
              <select
                id={id('responsible')}
                className={meetingStyles.select}
                value={form.responsible_employee_id ?? ''}
                onChange={(event) => set('responsible_employee_id', event.target.value || null)}
                aria-invalid={responsibleError !== undefined}
              >
                <option value="">{t('items.noResponsible')}</option>
                {responsibleOptions.map((member) => (
                  <option key={member.employee_id} value={member.employee_id}>
                    {member.email}
                  </option>
                ))}
              </select>
              {responsibleError && (
                <p role="alert" className={teamStyles.error}>
                  {responsibleError}
                </p>
              )}
            </div>
            <div className={teamStyles.field}>
              <label className={teamStyles.label} htmlFor={id('due')}>
                {t('items.dueLabel')}
              </label>
              <input
                id={id('due')}
                type="date"
                className={teamStyles.input}
                value={form.due_on ?? ''}
                onChange={(event) => set('due_on', event.target.value || null)}
                aria-invalid={dueError !== undefined}
              />
              {dueError && (
                <p role="alert" className={teamStyles.error}>
                  {dueError}
                </p>
              )}
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={teamStyles.field}>
              <label className={teamStyles.label} htmlFor={id('metric')}>
                {t('items.metricLabel')}
              </label>
              <select
                id={id('metric')}
                className={meetingStyles.select}
                value={form.metric_id ?? ''}
                onChange={(event) => set('metric_id', event.target.value || null)}
                aria-invalid={metricError !== undefined}
              >
                <option value="">{t('items.noMetric')}</option>
                {metricOptions.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.name}
                  </option>
                ))}
              </select>
              {metricError && (
                <p role="alert" className={teamStyles.error}>
                  {metricError}
                </p>
              )}
            </div>
            <div className={teamStyles.field}>
              <label className={teamStyles.label} htmlFor={id('stage')}>
                {t('items.stageLabel')}
              </label>
              <select
                id={id('stage')}
                className={meetingStyles.select}
                value={form.stage}
                onChange={(event) => set('stage', event.target.value as Stage)}
                aria-invalid={stageError !== undefined}
              >
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {t(`pdca.${stage}`)}
                  </option>
                ))}
              </select>
              {stageError && (
                <p role="alert" className={teamStyles.error}>
                  {stageError}
                </p>
              )}
            </div>
          </div>
          {otherError && (
            <p role="alert" className={teamStyles.error}>
              {otherError}
            </p>
          )}
          <span className={`${teamStyles.actions} ${styles.dialogActions}`}>
            {kind === 'problem' && item && (
              <button type="button" className={teamStyles.button} onClick={() => onRaiseTask(item)}>
                {t('items.taskFromProblem')}
              </button>
            )}
            <button type="submit" className={teamStyles.primary} disabled={mutation.isPending}>
              {mutation.isPending ? t('items.saving') : t('items.save')}
            </button>
            <button type="button" className={teamStyles.button} onClick={onClose}>
              {t('items.cancel')}
            </button>
          </span>
        </form>
      )}
    </Modal>
  );
}
