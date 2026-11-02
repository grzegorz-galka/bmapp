/**
 * A board's own metric worked out from other metrics recorded in the same
 * week: the editor in the create dialog and the change form, and how a
 * derivation reads on the metric's row.
 */
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  DERIVATION_KINDS,
  type Derivation,
  type DerivationKind,
  type DerivationSourceWrite,
  type DerivationWrite,
} from '../../api/metrics';
import { describeFieldFailure } from '../../i18n/apiErrors';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from '../../components/icons';
import { useTeams } from '../teams/useTeams';
import { useMetrics } from './useMetrics';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import styles from './metrics.module.css';

/** What the editor holds: no kind for a metric that is typed in. */
export interface DerivationDraft {
  kind: DerivationKind | null;
  sources: DerivationSourceWrite[];
}

export const NO_DERIVATION: DerivationDraft = { kind: null, sources: [] };

export function toDerivationDraft(derivation: Derivation | null): DerivationDraft {
  if (!derivation) return NO_DERIVATION;
  return {
    kind: derivation.kind,
    sources: derivation.sources.map((source) => ({
      team_id: source.team.id,
      metric_id: source.metric.id,
    })),
  };
}

/** The request's form of a draft: null for none. */
export function toDerivationWrite(draft: DerivationDraft): DerivationWrite | null {
  return draft.kind === null ? null : { kind: draft.kind, sources: draft.sources };
}

/** A source still waiting for its metric to be chosen; it cannot be sent. */
export function isIncomplete(draft: DerivationDraft): boolean {
  return draft.kind !== null && draft.sources.some((source) => source.metric_id === '');
}

/** The fields the API reports a derivation's errors against. */
export function derivationFields(draft: DerivationDraft): string[] {
  return [
    'derivation',
    'derivation.kind',
    'derivation.sources',
    ...draft.sources.map((_, index) => `derivation.sources[${index}]`),
  ];
}

/** A source by its metric's name, followed by its team's when that is another team. */
export function sourceName(
  t: TFunction,
  source: { team: { id: string; name: string }; metric: { name: string } },
  ownTeamId: string,
): string {
  return source.team.id === ownTeamId
    ? source.metric.name
    : t('metrics.sourceOfTeam', { metric: source.metric.name, team: source.team.name });
}

/** A delta takes one source; anything past it is dropped. */
function withKind(draft: DerivationDraft, kind: DerivationKind | null): DerivationDraft {
  if (kind === null) return { ...draft, kind };
  const sources = kind === 'delta' ? draft.sources.slice(0, 1) : draft.sources;
  return { kind, sources };
}

function moved<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/**
 * The kind, then the ordered sources, each a team and then a metric of that
 * team's board. `metricId` is the metric being changed, never offered as its
 * own source; `incomplete` says a source was left without its metric.
 */
export function DerivationEditor({
  idPrefix,
  teamId,
  metricId,
  value,
  onChange,
  error,
  incomplete,
}: {
  idPrefix: string;
  teamId: string;
  metricId?: string;
  value: DerivationDraft;
  onChange: (draft: DerivationDraft) => void;
  error: Error | null;
  incomplete: boolean;
}) {
  const { t } = useTranslation();
  const id = (field: string) => `${idPrefix}-derivation-${field}`;
  const kindError =
    describeFieldFailure(t, error, 'derivation') ??
    describeFieldFailure(t, error, 'derivation.kind');
  const countError = describeFieldFailure(t, error, 'derivation.sources');
  const full = value.kind === 'delta' && value.sources.length >= 1;

  function setSource(index: number, source: DerivationSourceWrite) {
    onChange({ ...value, sources: value.sources.map((s, i) => (i === index ? source : s)) });
  }

  return (
    <fieldset className={styles.derivation} aria-describedby={id('hint')}>
      <legend className={teamStyles.label}>{t('metrics.derivationHeading')}</legend>
      <p id={id('hint')} className={styles.hint}>
        {t('metrics.derivationHint')}
      </p>
      <div className={teamStyles.field}>
        <label className={teamStyles.label} htmlFor={id('kind')}>
          {t('metrics.derivationKindLabel')}
        </label>
        <select
          id={id('kind')}
          className={meetingStyles.select}
          value={value.kind ?? ''}
          aria-invalid={kindError !== undefined}
          onChange={(event) =>
            onChange(withKind(value, (event.target.value || null) as DerivationKind | null))
          }
        >
          <option value="">{t('metrics.derivationNone')}</option>
          {DERIVATION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`metrics.kind_${kind}`)}
            </option>
          ))}
        </select>
        {kindError && (
          <p role="alert" className={teamStyles.error}>
            {kindError}
          </p>
        )}
      </div>
      {value.kind !== null && (
        <>
          <ol className={styles.sources} aria-label={t('metrics.sourcesLabel')}>
            {value.sources.map((source, index) => (
              <SourceRow
                // Sources have no identity of their own until both halves are chosen.
                key={index}
                idPrefix={id(`source-${index}`)}
                position={index + 1}
                count={value.sources.length}
                teamId={teamId}
                metricId={metricId}
                source={source}
                onChange={(next) => setSource(index, next)}
                onRemove={() =>
                  onChange({ ...value, sources: value.sources.filter((_, i) => i !== index) })
                }
                onMove={(to) => onChange({ ...value, sources: moved(value.sources, index, to) })}
                error={describeFieldFailure(t, error, `derivation.sources[${index}]`)}
              />
            ))}
          </ol>
          {value.kind === 'delta' && <p className={styles.hint}>{t('metrics.deltaHint')}</p>}
          {!full && (
            <span>
              <button
                type="button"
                className={controls.button}
                onClick={() =>
                  onChange({
                    ...value,
                    sources: [...value.sources, { team_id: teamId, metric_id: '' }],
                  })
                }
              >
                <PlusIcon />
                {t('metrics.addSource')}
              </button>
            </span>
          )}
          {countError && (
            <p role="alert" className={teamStyles.error}>
              {countError}
            </p>
          )}
          {incomplete && (
            <p role="alert" className={teamStyles.error}>
              {t('metrics.derivationIncomplete')}
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}

/** One source: every team, the board's own first, then that team's placed metrics. */
function SourceRow({
  idPrefix,
  position,
  count,
  teamId,
  metricId,
  source,
  onChange,
  onRemove,
  onMove,
  error,
}: {
  idPrefix: string;
  position: number;
  count: number;
  teamId: string;
  metricId?: string;
  source: DerivationSourceWrite;
  onChange: (source: DerivationSourceWrite) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  error: string | undefined;
}) {
  const { t } = useTranslation();
  const teams = useTeams();
  const metrics = useMetrics(source.team_id, source.team_id !== '');
  const all = teams.data ?? [];
  const ordered = [
    ...all.filter((team) => team.id === teamId),
    ...all.filter((team) => team.id !== teamId),
  ];
  const candidates = (metrics.data ?? []).filter(
    (metric) => !(source.team_id === teamId && metric.id === metricId),
  );
  const index = position - 1;

  return (
    <li className={styles.source}>
      <select
        id={`${idPrefix}-team`}
        className={`${meetingStyles.select} ${styles.sourceSelect}`}
        aria-label={t('metrics.sourceTeamLabel', { position })}
        value={source.team_id}
        onChange={(event) => onChange({ team_id: event.target.value, metric_id: '' })}
      >
        <option value="">{t('metrics.chooseTeam')}</option>
        {ordered.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <select
        id={`${idPrefix}-metric`}
        className={`${meetingStyles.select} ${styles.sourceSelect}`}
        aria-label={t('metrics.sourceMetricLabel', { position })}
        value={source.metric_id}
        disabled={source.team_id === ''}
        aria-invalid={error !== undefined}
        onChange={(event) => onChange({ ...source, metric_id: event.target.value })}
      >
        <option value="">{t('metrics.chooseMetric')}</option>
        {candidates.map((metric) => (
          <option key={metric.id} value={metric.id}>
            {metric.retired ? t('metrics.retiredOption', { name: metric.name }) : metric.name}
          </option>
        ))}
      </select>
      <span className={teamStyles.actions}>
        {index > 0 ? (
          <button
            type="button"
            className={controls.iconOnly}
            aria-label={t('metrics.sourceUpLabel', { position })}
            title={t('metrics.moveUp')}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUpIcon />
          </button>
        ) : (
          <span className={styles.moveSlot} />
        )}
        {index < count - 1 ? (
          <button
            type="button"
            className={controls.iconOnly}
            aria-label={t('metrics.sourceDownLabel', { position })}
            title={t('metrics.moveDown')}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDownIcon />
          </button>
        ) : (
          <span className={styles.moveSlot} />
        )}
        <button
          type="button"
          className={controls.button}
          aria-label={t('metrics.removeSourceLabel', { position })}
          onClick={onRemove}
        >
          <TrashIcon />
          {t('metrics.removeSource')}
        </button>
      </span>
      {error && (
        <p role="alert" className={teamStyles.error}>
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * How a derivation reads on the metric's row - "Mean of 6 metrics" - with its
 * sources in order on expand. Reading it is open to anyone who sees the row.
 */
export function DerivationReading({
  derivation,
  teamId,
  idPrefix,
}: {
  derivation: Derivation;
  teamId: string;
  idPrefix: string;
}) {
  const { t } = useTranslation();
  const names = derivation.sources.map((source) => sourceName(t, source, teamId));
  const listId = `${idPrefix}-sources`;

  // A change since the previous meeting has one source, named in the reading itself.
  if (derivation.kind === 'delta') {
    return (
      <span className={teamStyles.itemMeta}>
        {t('metrics.derived_delta', { source: names[0] ?? '' })}
      </span>
    );
  }

  // A native disclosure: the summary is the reading, and opening it lists the sources.
  return (
    <details className={`${teamStyles.itemMeta} ${styles.sourcesPanel}`}>
      <summary>
        <ChevronRightIcon className={styles.chevron} width={14} height={14} />
        {t(`metrics.derived_${derivation.kind}`, { count: names.length })}
      </summary>
      <ol id={listId} className={styles.sourceList}>
        {names.map((name, index) => (
          <li key={index}>{name}</li>
        ))}
      </ol>
    </details>
  );
}
