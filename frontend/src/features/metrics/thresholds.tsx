import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Direction, Threshold, ThresholdCreate } from '../../api/metrics';
import { describeFieldFailure, describeOtherFailure } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { organizationToday } from '../board/organizationDate';
import { ThresholdList } from './display';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import styles from './metrics.module.css';

/** What the threshold editors need to know about a metric, wherever it is defined. */
interface ThresholdSubject {
  id: string;
  name: string;
  unit: string;
  decimals: number;
  direction: Direction;
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
 *
 * The caller owns the request - a board's metric records its versions on the
 * board, a global metric in the catalogue - and passes its state in.
 */
export function ThresholdDialog({
  metric,
  onSave,
  onClose,
  pending,
  error,
}: {
  metric: ThresholdSubject;
  onSave: (threshold: ThresholdCreate) => void;
  onClose: () => void;
  pending: boolean;
  error: Error | null;
}) {
  const { t } = useTranslation();
  const format = useFormat();
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
    onSave({ effective_from: effectiveFrom, reason, ...Object.fromEntries(parsed) });
  }

  const reasonError = describeFieldFailure(t, error, 'reason');
  const dateError = describeFieldFailure(t, error, 'effective_from');
  const otherError = describeOtherFailure(t, error, ['reason', 'effective_from']);

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
          <button type="submit" className={controls.default} disabled={pending}>
            {pending ? t('metrics.saving') : t('metrics.recordThreshold')}
          </button>
          <button type="button" className={controls.button} onClick={onClose}>
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

/** Every version of a metric's threshold, the most recent first, from whichever source holds it. */
export function ThresholdHistory({
  metric,
  history,
}: {
  metric: ThresholdSubject;
  history: UseQueryResult<Threshold[]>;
}) {
  const { t } = useTranslation();
  const format = useFormat();

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
