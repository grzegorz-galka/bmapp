import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import {
  DIRECTIONS,
  type Direction,
  type Metric,
  type MetricCreate,
  type ThresholdCreate,
} from '../../api/metrics';
import type { Member } from '../../api/teams';
import {
  describeFailure,
  describeFieldFailure,
  describeOtherFailure,
  isNotFound,
} from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdmin } from '../auth/useCurrentUser';
import { organizationToday } from '../board/organizationDate';
import { useTeam } from '../teams/useTeams';
import { describeThreshold, ThresholdList } from './display';
import {
  useAddMetric,
  useAddThreshold,
  useChangeMetric,
  useDeleteMetric,
  useMetrics,
  useThresholds,
} from './useMetrics';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import styles from './metrics.module.css';

const METRIC_FIELDS = [
  'name',
  'unit',
  'decimals',
  'direction',
  'group_label',
  'position',
  'owner_employee_id',
] as const;

export function MetricSettingsPage() {
  const { teamId = '' } = useParams();
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { email: signedInEmail } = useAuth();
  const team = useTeam(teamId);
  const metrics = useMetrics(teamId);

  const back = (
    <Link className={teamStyles.back} to={`/teams/${encodeURIComponent(teamId)}`}>
      {t('metrics.back')}
    </Link>
  );

  if (team.isPending || metrics.isPending) {
    return (
      <main className={teamStyles.page}>
        {back}
        <p>{t('metrics.loading')}</p>
      </main>
    );
  }

  if (team.isError || metrics.isError) {
    return (
      <main className={teamStyles.page}>
        {back}
        {isNotFound(team.error) || isNotFound(metrics.error) ? (
          <h1 className={teamStyles.heading}>{t('metrics.notFound')}</h1>
        ) : (
          <p role="alert">{t('metrics.loadFailed')}</p>
        )}
      </main>
    );
  }

  // As the API decides it: what is measured is the leader's or an
  // administrator's. Everyone else reads the same page without the controls.
  const viewer = team.data.members.find((member) => member.email === signedInEmail);
  const mayConfigure = isAdmin || viewer?.is_leader === true;

  return (
    <main className={teamStyles.page}>
      {back}
      <h1 className={teamStyles.heading}>{t('metrics.heading', { name: team.data.name })}</h1>
      <nav className={`${teamStyles.actions} ${meetingStyles.section}`} aria-label={t('nav.label')}>
        <Link className={teamStyles.button} to={`/teams/${encodeURIComponent(teamId)}`}>
          {t('teams.boardLink')}
        </Link>
        <Link className={teamStyles.button} to={`/teams/${encodeURIComponent(teamId)}/meetings`}>
          {t('board.meetingsLink')}
        </Link>
      </nav>

      {mayConfigure && <AddMetric teamId={teamId} members={team.data.members} />}

      {metrics.data.length === 0 ? (
        <p>{t('metrics.empty')}</p>
      ) : (
        <ul className={teamStyles.list} aria-label={t('metrics.listLabel')}>
          {metrics.data.map((metric) => (
            <MetricRow
              key={metric.id}
              teamId={teamId}
              metric={metric}
              members={team.data.members}
              mayConfigure={mayConfigure}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

const BLANK_METRIC: MetricCreate = {
  name: '',
  unit: '',
  decimals: 0,
  direction: 'higher_is_better',
  group_label: null,
  position: 0,
  owner_employee_id: null,
};

function AddMetric({ teamId, members }: { teamId: string; members: Member[] }) {
  const { t } = useTranslation();
  const addMetric = useAddMetric(teamId);
  const [draft, setDraft] = useState<MetricCreate>(BLANK_METRIC);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addMetric.mutate(draft, { onSuccess: () => setDraft(BLANK_METRIC) });
  }

  return (
    <MetricForm
      idPrefix="new-metric"
      draft={draft}
      onChange={setDraft}
      onSubmit={handleSubmit}
      members={members}
      error={addMetric.error}
      submitLabel={addMetric.isPending ? t('metrics.adding') : t('metrics.add')}
      pending={addMetric.isPending}
    />
  );
}

/** The properties of a metric, with the error the API reported against each. */
function MetricForm({
  idPrefix,
  draft,
  onChange,
  onSubmit,
  onCancel,
  members,
  error,
  submitLabel,
  pending,
  directionFixed = false,
}: {
  idPrefix: string;
  draft: MetricCreate;
  onChange: (draft: MetricCreate) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  members: Member[];
  error: Error | null;
  submitLabel: string;
  pending: boolean;
  directionFixed?: boolean;
}) {
  const { t } = useTranslation();
  const fieldError = (field: string) => describeFieldFailure(t, error, field);
  const otherError = describeOtherFailure(t, error, METRIC_FIELDS);
  const id = (field: string) => `${idPrefix}-${field}`;

  function text(field: 'name' | 'unit') {
    const message = fieldError(field);
    return (
      <div className={teamStyles.field}>
        <label className={teamStyles.label} htmlFor={id(field)}>
          {t(`metrics.${field}Label`)}
        </label>
        <input
          id={id(field)}
          className={teamStyles.input}
          value={draft[field]}
          onChange={(event) => onChange({ ...draft, [field]: event.target.value })}
          aria-invalid={message !== undefined}
        />
        {message && (
          <p role="alert" className={teamStyles.error}>
            {message}
          </p>
        )}
      </div>
    );
  }

  function whole(field: 'decimals' | 'position', label: string) {
    const message = fieldError(field);
    return (
      <div className={`${teamStyles.field} ${styles.narrow}`}>
        <label className={teamStyles.label} htmlFor={id(field)}>
          {label}
        </label>
        <input
          id={id(field)}
          type="number"
          step={1}
          className={teamStyles.input}
          value={draft[field]}
          onChange={(event) => onChange({ ...draft, [field]: Number(event.target.value) })}
          aria-invalid={message !== undefined}
        />
        {message && (
          <p role="alert" className={teamStyles.error}>
            {message}
          </p>
        )}
      </div>
    );
  }

  const directionError = fieldError('direction');
  const groupError = fieldError('group_label');
  const ownerError = fieldError('owner_employee_id');

  return (
    <form className={teamStyles.form} onSubmit={onSubmit} noValidate>
      {text('name')}
      {text('unit')}
      {whole('decimals', t('metrics.decimalsLabel'))}
      <div className={teamStyles.field}>
        <label className={teamStyles.label} htmlFor={id('direction')}>
          {t('metrics.directionLabel')}
        </label>
        <select
          id={id('direction')}
          className={meetingStyles.select}
          value={draft.direction}
          disabled={directionFixed}
          aria-describedby={directionFixed ? id('direction-fixed') : undefined}
          onChange={(event) => onChange({ ...draft, direction: event.target.value as Direction })}
        >
          {DIRECTIONS.map((direction) => (
            <option key={direction} value={direction}>
              {t(`direction.${direction}`)}
            </option>
          ))}
        </select>
        {directionFixed && (
          <p id={id('direction-fixed')} className={styles.hint}>
            {t('metrics.directionFixed')}
          </p>
        )}
        {directionError && (
          <p role="alert" className={teamStyles.error}>
            {directionError}
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
          value={draft.group_label ?? ''}
          onChange={(event) => onChange({ ...draft, group_label: event.target.value || null })}
        />
        {groupError && (
          <p role="alert" className={teamStyles.error}>
            {groupError}
          </p>
        )}
      </div>
      {whole('position', t('metrics.positionLabel'))}
      <div className={teamStyles.field}>
        <label className={teamStyles.label} htmlFor={id('owner')}>
          {t('metrics.ownerLabel')}
        </label>
        <select
          id={id('owner')}
          className={meetingStyles.select}
          value={draft.owner_employee_id ?? ''}
          onChange={(event) =>
            onChange({ ...draft, owner_employee_id: event.target.value || null })
          }
        >
          <option value="">{t('metrics.noOwner')}</option>
          {members.map((member) => (
            <option key={member.employee_id} value={member.employee_id}>
              {member.email}
            </option>
          ))}
        </select>
        {ownerError && (
          <p role="alert" className={teamStyles.error}>
            {ownerError}
          </p>
        )}
      </div>
      <span className={`${teamStyles.actions} ${teamStyles.submit}`}>
        <button type="submit" className={teamStyles.primary} disabled={pending}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={teamStyles.button} onClick={onCancel}>
            {t('metrics.cancel')}
          </button>
        )}
      </span>
      {otherError && (
        <p role="alert" className={teamStyles.itemError}>
          {otherError}
        </p>
      )}
    </form>
  );
}

type Panel = 'none' | 'edit' | 'threshold' | 'history';

function MetricRow({
  teamId,
  metric,
  members,
  mayConfigure,
}: {
  teamId: string;
  metric: Metric;
  members: Member[];
  mayConfigure: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const changeMetric = useChangeMetric(teamId);
  const deleteMetric = useDeleteMetric(teamId);
  const [panel, setPanel] = useState<Panel>('none');
  const [draft, setDraft] = useState<MetricCreate>(() => toDraft(metric));
  const name = metric.name;

  function open(next: Panel) {
    changeMetric.reset();
    deleteMetric.reset();
    if (next === 'edit') setDraft(toDraft(metric));
    setPanel(panel === next ? 'none' : next);
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The direction is never sent: it cannot change, and the form cannot change it.
    const change = {
      name: draft.name,
      unit: draft.unit,
      decimals: draft.decimals,
      group_label: draft.group_label,
      position: draft.position,
      owner_employee_id: draft.owner_employee_id,
    };
    changeMetric.mutate({ metricId: metric.id, change }, { onSuccess: () => setPanel('none') });
  }

  const meta = [
    t(`direction.${metric.direction}`),
    metric.unit,
    t('metrics.decimals', { count: metric.decimals }),
    metric.group_label ? t('metrics.group', { name: metric.group_label }) : null,
    metric.owner ? t('metrics.owner', { email: metric.owner.email }) : null,
  ].filter(Boolean);
  const rowError =
    panel === 'edit' ? undefined : describeFailure(t, changeMetric.error ?? deleteMetric.error);

  return (
    <li className={teamStyles.item}>
      <span className={teamStyles.itemMain}>
        <span className={teamStyles.itemName}>
          {name}
          {metric.retired && <span className={teamStyles.leaderMark}>{t('metrics.retired')}</span>}
        </span>
        <span className={teamStyles.itemMeta}>{meta.join(' · ')}</span>
        <span className={teamStyles.itemMeta}>
          {describeThreshold(t, format, metric, metric.threshold)}
          {metric.threshold &&
            ` · ${t('threshold.effectiveFrom', {
              date: format.meetingDate(metric.threshold.effective_from),
            })}`}
        </span>
      </span>
      <span className={teamStyles.actions}>
        <button
          type="button"
          className={teamStyles.button}
          aria-expanded={panel === 'history'}
          aria-label={t('metrics.historyLabel', { name })}
          onClick={() => open('history')}
        >
          {t('metrics.history')}
        </button>
        {mayConfigure && (
          <>
            <button
              type="button"
              className={teamStyles.button}
              aria-label={t('metrics.editLabel', { name })}
              onClick={() => open('edit')}
            >
              {t('metrics.edit')}
            </button>
            <button
              type="button"
              className={teamStyles.button}
              aria-label={t('metrics.changeThresholdLabel', { name })}
              onClick={() => open('threshold')}
            >
              {t('metrics.changeThreshold')}
            </button>
            <button
              type="button"
              className={teamStyles.button}
              disabled={changeMetric.isPending}
              aria-label={t(metric.retired ? 'metrics.bringBackLabel' : 'metrics.retireLabel', {
                name,
              })}
              onClick={() =>
                changeMetric.mutate({ metricId: metric.id, change: { retired: !metric.retired } })
              }
            >
              {metric.retired ? t('metrics.bringBack') : t('metrics.retire')}
            </button>
            <button
              type="button"
              className={teamStyles.button}
              disabled={deleteMetric.isPending}
              aria-label={t('metrics.deleteLabel', { name })}
              onClick={() => deleteMetric.mutate(metric.id)}
            >
              {t('metrics.delete')}
            </button>
          </>
        )}
      </span>
      {rowError && (
        <p role="alert" className={teamStyles.itemError}>
          {rowError}
        </p>
      )}
      {panel === 'edit' && (
        <div className={meetingStyles.rowForm}>
          <MetricForm
            idPrefix={`metric-${metric.id}`}
            draft={draft}
            onChange={setDraft}
            onSubmit={handleEdit}
            onCancel={() => setPanel('none')}
            members={members}
            error={changeMetric.error}
            submitLabel={changeMetric.isPending ? t('metrics.saving') : t('metrics.save')}
            pending={changeMetric.isPending}
            directionFixed
          />
        </div>
      )}
      {panel === 'threshold' && (
        <ThresholdDialog teamId={teamId} metric={metric} onClose={() => setPanel('none')} />
      )}
      {panel === 'history' && <ThresholdHistory teamId={teamId} metric={metric} />}
    </li>
  );
}

function toDraft(metric: Metric): MetricCreate {
  return {
    name: metric.name,
    unit: metric.unit,
    decimals: metric.decimals,
    direction: metric.direction,
    group_label: metric.group_label,
    position: metric.position,
    owner_employee_id: metric.owner?.id ?? null,
  };
}

type BoundField = 'green' | 'amber' | 'green_lo' | 'green_hi' | 'amber_lo' | 'amber_hi';

/** The boundaries a metric's direction takes, and what each is called. */
type BoundLabel =
  `metrics.${'greenFrom' | 'amberFrom' | 'greenUpTo' | 'amberUpTo' | 'greenTo' | 'amberTo'}`;

const BOUND_FIELDS: Record<Direction, [BoundField, BoundLabel][]> = {
  higher_is_better: [
    ['green', 'metrics.greenFrom'],
    ['amber', 'metrics.amberFrom'],
  ],
  lower_is_better: [
    ['green', 'metrics.greenUpTo'],
    ['amber', 'metrics.amberUpTo'],
  ],
  within_band: [
    ['green_lo', 'metrics.greenFrom'],
    ['green_hi', 'metrics.greenTo'],
    ['amber_lo', 'metrics.amberFrom'],
    ['amber_hi', 'metrics.amberTo'],
  ],
};

/**
 * A new threshold version: the date it takes effect from, its boundaries in
 * the metric's terms, and why. Effective dates may be in the past.
 */
function ThresholdDialog({
  teamId,
  metric,
  onClose,
}: {
  teamId: string;
  metric: Metric;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const addThreshold = useAddThreshold(teamId);
  const [effectiveFrom, setEffectiveFrom] = useState(organizationToday);
  const [reason, setReason] = useState('');
  const [bounds, setBounds] = useState<Partial<Record<BoundField, string>>>({});
  const [unreadable, setUnreadable] = useState<BoundField[]>([]);
  const first = useRef<HTMLInputElement>(null);
  const headingId = `threshold-${metric.id}-heading`;
  const fields = BOUND_FIELDS[metric.direction];

  useEffect(() => first.current?.focus(), []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = fields.map(([field]) => [field, format.parseDecimal(bounds[field] ?? '')]);
    const bad = parsed.filter(([, value]) => value === null).map(([field]) => field as BoundField);
    setUnreadable(bad);
    if (bad.length > 0) return;
    const threshold: ThresholdCreate = {
      effective_from: effectiveFrom,
      reason,
      ...Object.fromEntries(parsed),
    };
    addThreshold.mutate({ metricId: metric.id, threshold }, { onSuccess: onClose });
  }

  const reasonError = describeFieldFailure(t, addThreshold.error, 'reason');
  const dateError = describeFieldFailure(t, addThreshold.error, 'effective_from');
  const otherError = describeOtherFailure(t, addThreshold.error, ['reason', 'effective_from']);

  return (
    <section role="dialog" aria-labelledby={headingId} className={styles.dialog}>
      <h2 id={headingId} className={meetingStyles.subheading}>
        {t('metrics.thresholdHeading', { name: metric.name })}
      </h2>
      <form className={teamStyles.form} onSubmit={handleSubmit} noValidate>
        <div className={teamStyles.field}>
          <label className={teamStyles.label} htmlFor={`${headingId}-from`}>
            {t('metrics.effectiveFromLabel')}
          </label>
          <input
            ref={first}
            id={`${headingId}-from`}
            type="date"
            className={teamStyles.input}
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
          {dateError && (
            <p role="alert" className={teamStyles.error}>
              {dateError}
            </p>
          )}
        </div>
        {fields.map(([field, label]) => (
          <div key={field} className={`${teamStyles.field} ${styles.narrow}`}>
            <label className={teamStyles.label} htmlFor={`${headingId}-${field}`}>
              {t(label)}
            </label>
            <input
              id={`${headingId}-${field}`}
              inputMode="decimal"
              className={teamStyles.input}
              value={bounds[field] ?? ''}
              onChange={(event) => setBounds({ ...bounds, [field]: event.target.value })}
              aria-invalid={unreadable.includes(field)}
            />
            {unreadable.includes(field) && (
              <p role="alert" className={teamStyles.error}>
                {t('recording.notANumber', { example: format.metricValue('95.3', 1, '') })}
              </p>
            )}
          </div>
        ))}
        <div className={teamStyles.field}>
          <label className={teamStyles.label} htmlFor={`${headingId}-reason`}>
            {t('metrics.reasonLabel')}
          </label>
          <input
            id={`${headingId}-reason`}
            className={teamStyles.input}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={reasonError !== undefined}
          />
          {reasonError && (
            <p role="alert" className={teamStyles.error}>
              {reasonError}
            </p>
          )}
        </div>
        <span className={`${teamStyles.actions} ${teamStyles.submit}`}>
          <button type="submit" className={teamStyles.primary} disabled={addThreshold.isPending}>
            {addThreshold.isPending ? t('metrics.saving') : t('metrics.recordThreshold')}
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

/** Every version of a metric's threshold, the most recent first. */
function ThresholdHistory({ teamId, metric }: { teamId: string; metric: Metric }) {
  const { t } = useTranslation();
  const format = useFormat();
  const history = useThresholds(teamId, metric.id);

  return (
    <div className={meetingStyles.rowForm}>
      <h2 className={meetingStyles.subheading}>
        {t('metrics.historyLabel', { name: metric.name })}
      </h2>
      {history.isPending ? (
        <p>{t('metrics.loading')}</p>
      ) : history.isError ? (
        <p role="alert">{t('metrics.loadFailed')}</p>
      ) : history.data.length === 0 ? (
        <p>{t('detail.noThresholds')}</p>
      ) : (
        <ThresholdList metric={metric} versions={history.data} format={format} />
      )}
    </div>
  );
}
