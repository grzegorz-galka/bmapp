/**
 * The two ways a metric arrives on a board other than being typed in: copied
 * from another board, or included from the catalogue of global metrics.
 *
 * A copy becomes the board's own metric, independent of its source. An
 * included global metric stays one shared definition; the board chooses only
 * where it appears and who owns it.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Member } from '../../api/teams';
import { describeFieldFailure, describeOtherFailure } from '../../i18n/apiErrors';
import { useGlobalMetrics } from '../globalMetrics/useGlobalMetrics';
import { useTeams } from '../teams/useTeams';
import { OwnerSelect } from './MetricForm';
import { useCopyMetric, useIncludeGlobalMetric, useMetrics } from './useMetrics';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import styles from './metrics.module.css';

const COPY_FIELDS = ['source_metric_id', 'name'] as const;
const INCLUDE_FIELDS = [
  'global_metric_id',
  'group_label',
  'position',
  'owner_employee_id',
] as const;

/** Choose a team, then one of its board's own metrics, and optionally rename it. */
export function CopyMetricDialog({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const teams = useTeams();
  const copy = useCopyMetric(teamId);
  const [sourceTeam, setSourceTeam] = useState('');
  const [source, setSource] = useState('');
  const [name, setName] = useState('');
  const sourceMetrics = useMetrics(sourceTeam, sourceTeam !== '');
  const first = useRef<HTMLSelectElement>(null);
  const id = (field: string) => `copy-metric-${field}`;

  useEffect(() => first.current?.focus(), []);

  // A global metric is not copied: it is included, so it is never offered here.
  const candidates = (sourceMetrics.data ?? []).filter((metric) => metric.scope === 'board');
  const otherTeams = (teams.data ?? []).filter((team) => team.id !== teamId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!source) return;
    copy.mutate(
      { source_metric_id: source, ...(name.trim() ? { name } : {}) },
      { onSuccess: onClose },
    );
  }

  const sourceError = describeFieldFailure(t, copy.error, 'source_metric_id');
  const nameError = describeFieldFailure(t, copy.error, 'name');
  const otherError = describeOtherFailure(t, copy.error, COPY_FIELDS);

  return (
    <section role="dialog" aria-labelledby={id('heading')} className={styles.dialog}>
      <h2 id={id('heading')} className={meetingStyles.subheading}>
        {t('metrics.copy')}
      </h2>
      <form className={teamStyles.form} onSubmit={handleSubmit} noValidate>
        <div className={teamStyles.field}>
          <label className={teamStyles.label} htmlFor={id('team')}>
            {t('metrics.copyTeamLabel')}
          </label>
          <select
            ref={first}
            id={id('team')}
            className={meetingStyles.select}
            value={sourceTeam}
            onChange={(event) => {
              setSourceTeam(event.target.value);
              setSource('');
            }}
          >
            <option value="">{t('metrics.chooseTeam')}</option>
            {otherTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div className={teamStyles.field}>
          <label className={teamStyles.label} htmlFor={id('source')}>
            {t('metrics.copySourceLabel')}
          </label>
          <select
            id={id('source')}
            className={meetingStyles.select}
            value={source}
            disabled={sourceTeam === '' || candidates.length === 0}
            onChange={(event) => setSource(event.target.value)}
            aria-invalid={sourceError !== undefined}
          >
            <option value="">{t('metrics.chooseMetric')}</option>
            {candidates.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.retired ? t('metrics.retiredOption', { name: metric.name }) : metric.name}
              </option>
            ))}
          </select>
          {sourceTeam !== '' && sourceMetrics.isPending && (
            <p className={styles.hint}>{t('metrics.loading')}</p>
          )}
          {sourceMetrics.isSuccess && candidates.length === 0 && (
            <p className={styles.hint}>{t('metrics.copyNoMetrics')}</p>
          )}
          {sourceError && (
            <p role="alert" className={teamStyles.error}>
              {sourceError}
            </p>
          )}
        </div>
        <div className={teamStyles.field}>
          <label className={teamStyles.label} htmlFor={id('name')}>
            {t('metrics.copyNameLabel')}
          </label>
          <input
            id={id('name')}
            className={teamStyles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-describedby={id('name-hint')}
            aria-invalid={nameError !== undefined}
          />
          <p id={id('name-hint')} className={styles.hint}>
            {t('metrics.copyNameHint')}
          </p>
          {nameError && (
            <p role="alert" className={teamStyles.error}>
              {nameError}
            </p>
          )}
        </div>
        <span className={`${teamStyles.actions} ${teamStyles.submit}`}>
          <button
            type="submit"
            className={teamStyles.primary}
            disabled={copy.isPending || source === ''}
          >
            {copy.isPending ? t('metrics.copying') : t('metrics.copySubmit')}
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
  );
}

/** Choose an active global metric this board does not include yet, and place it. */
export function IncludeGlobalMetricDialog({
  teamId,
  members,
  onBoard,
  onClose,
}: {
  teamId: string;
  members: Member[];
  /** The identifiers of the metrics already on this board. */
  onBoard: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const catalogue = useGlobalMetrics();
  const include = useIncludeGlobalMetric(teamId);
  const [chosen, setChosen] = useState('');
  const [group, setGroup] = useState('');
  const [position, setPosition] = useState(0);
  const [owner, setOwner] = useState<string | null>(null);
  const first = useRef<HTMLSelectElement>(null);
  const id = (field: string) => `include-metric-${field}`;

  useEffect(() => first.current?.focus(), [catalogue.isSuccess]);

  const available = (catalogue.data ?? []).filter(
    (metric) => !metric.retired && !onBoard.includes(metric.id),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) return;
    include.mutate(
      {
        global_metric_id: chosen,
        position,
        group_label: group || null,
        owner_employee_id: owner,
      },
      { onSuccess: onClose },
    );
  }

  const fieldError = (field: string) => describeFieldFailure(t, include.error, field);
  const chosenError = fieldError('global_metric_id');
  const groupError = fieldError('group_label');
  const positionError = fieldError('position');
  const otherError = describeOtherFailure(t, include.error, INCLUDE_FIELDS);

  let body;
  if (catalogue.isPending) {
    body = <p>{t('globalMetrics.loading')}</p>;
  } else if (catalogue.isError) {
    body = <p role="alert">{t('globalMetrics.loadFailed')}</p>;
  } else if (available.length === 0) {
    body = (
      <p>
        {t('metrics.includeNone')}{' '}
        <button type="button" className={teamStyles.button} onClick={onClose}>
          {t('metrics.cancel')}
        </button>
      </p>
    );
  } else {
    body = (
      <form className={teamStyles.form} onSubmit={handleSubmit} noValidate>
        <div className={teamStyles.field}>
          <label className={teamStyles.label} htmlFor={id('source')}>
            {t('metrics.includeSourceLabel')}
          </label>
          <select
            ref={first}
            id={id('source')}
            className={meetingStyles.select}
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            aria-invalid={chosenError !== undefined}
          >
            <option value="">{t('metrics.chooseGlobal')}</option>
            {available.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.name}
              </option>
            ))}
          </select>
          {chosenError && (
            <p role="alert" className={teamStyles.error}>
              {chosenError}
            </p>
          )}
        </div>
        <div className={teamStyles.field}>
          <label className={teamStyles.label} htmlFor={id('group')}>
            {t('metrics.groupLabel')}
          </label>
          <input
            id={id('group')}
            className={teamStyles.input}
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          />
          {groupError && (
            <p role="alert" className={teamStyles.error}>
              {groupError}
            </p>
          )}
        </div>
        <div className={`${teamStyles.field} ${styles.narrow}`}>
          <label className={teamStyles.label} htmlFor={id('position')}>
            {t('metrics.positionLabel')}
          </label>
          <input
            id={id('position')}
            type="number"
            step={1}
            className={teamStyles.input}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            aria-invalid={positionError !== undefined}
          />
          {positionError && (
            <p role="alert" className={teamStyles.error}>
              {positionError}
            </p>
          )}
        </div>
        <OwnerSelect
          id={id('owner')}
          value={owner}
          onChange={setOwner}
          members={members}
          error={fieldError('owner_employee_id')}
        />
        <span className={`${teamStyles.actions} ${teamStyles.submit}`}>
          <button
            type="submit"
            className={teamStyles.primary}
            disabled={include.isPending || chosen === ''}
          >
            {include.isPending ? t('metrics.including') : t('metrics.includeSubmit')}
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
    );
  }

  return (
    <section role="dialog" aria-labelledby={id('heading')} className={styles.dialog}>
      <h2 id={id('heading')} className={meetingStyles.subheading}>
        {t('metrics.include')}
      </h2>
      {body}
    </section>
  );
}
