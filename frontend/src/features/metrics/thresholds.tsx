import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Bounds, Direction, Threshold, ThresholdCreate } from '../../api/metrics';
import { describeFieldFailure, describeOtherFailure } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { organizationToday } from '../board/organizationDate';
import { describeBounds, ThresholdList } from './display';
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
type ToleranceField = 'green_pct' | 'amber_pct';
type NumberField = 'target_value' | ToleranceField | BoundField;

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

const TOLERANCE_FIELDS: [ToleranceField, 'metrics.greenPctLabel' | 'metrics.amberPctLabel'][] = [
  ['green_pct', 'metrics.greenPctLabel'],
  ['amber_pct', 'metrics.amberPctLabel'],
];

/** The fields that show the API's error beneath them; any other error shows under the form. */
const FIELDS_WITH_ERRORS = ['effective_from', 'reason', 'target_value', 'green_pct', 'amber_pct'];

/** A canonical decimal string as an integer scaled by 10^places, exactly. */
function scaled(value: string, places: number): bigint {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace('-', '').split('.');
  const digits = BigInt(`${whole}${fraction.padEnd(places, '0')}`);
  return negative ? -digits : digits;
}

/** An integer scaled by 10^places as a canonical decimal string, trailing zeros dropped. */
function unscaled(value: bigint, places: number): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(places + 1, '0');
  const whole = digits.slice(0, digits.length - places);
  const fraction = digits.slice(digits.length - places).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/**
 * The boundaries a target value and its tolerances amount to, by the rule the
 * server judges with: d = |T| × p / 100, taken off the worse side - short of
 * the target value, over it, or both for a band. Exact, never rounded. Only
 * for the form's preview: the server resolves what is stored and shown.
 */
export function boundsOfTarget(
  direction: Direction,
  target: string,
  green: string,
  amber: string,
): Bounds {
  const fraction = (value: string) => value.split('.')[1]?.length ?? 0;
  const places = Math.max(fraction(target), fraction(green), fraction(amber));
  // T at scale 10^(2·places + 2), the scale of |T| × p / 100.
  const scale = 2 * places + 2;
  const value = scaled(target, places);
  const centre = value * 10n ** BigInt(places + 2);
  const size = value < 0n ? -value : value;
  const off = (pct: string) => size * scaled(pct, places);
  const below = (pct: string) => unscaled(centre - off(pct), scale);
  const above = (pct: string) => unscaled(centre + off(pct), scale);
  const none = { green_lo: null, green_hi: null, amber_lo: null, amber_hi: null };
  switch (direction) {
    case 'higher_is_better':
      return { ...none, green_lo: below(green), amber_lo: below(amber) };
    case 'lower_is_better':
      return { ...none, green_hi: above(green), amber_hi: above(amber) };
    case 'within_band':
      return {
        green_lo: below(green),
        green_hi: above(green),
        amber_lo: below(amber),
        amber_hi: above(amber),
      };
  }
}

/**
 * A new threshold version: the date it takes effect from, its target value
 * with a green and an amber tolerance in per cent of it - or, for a target
 * value of 0, the boundaries in the metric's terms - and why. Effective dates
 * may be in the past.
 *
 * Switching between tolerances and boundaries keeps what was typed in each,
 * so correcting the target value loses nothing. While tolerances are typed,
 * the boundaries they amount to are shown for information.
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
  const [numbers, setNumbers] = useState<Partial<Record<NumberField, string>>>({});
  const [unreadable, setUnreadable] = useState<NumberField[]>([]);
  const first = useRef<HTMLInputElement>(null);
  const headingId = `threshold-${metric.id}-heading`;

  useEffect(() => first.current?.focus(), []);

  const parse = (field: NumberField) => format.parseDecimal(numbers[field] ?? '');
  const target = parse('target_value');
  // Only a target value of 0 asks for boundaries; until one is typed, tolerances.
  const byBounds = target !== null && Number(target) === 0;
  const fields: [NumberField, string][] = byBounds
    ? BOUND_FIELDS[metric.direction].map(([field, label]) => [field, t(label)])
    : TOLERANCE_FIELDS.map(([field, label]) => [field, t(label)]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sent: NumberField[] = ['target_value', ...fields.map(([field]) => field)];
    const parsed = sent.map((field) => [field, parse(field)] as const);
    const bad = parsed.filter(([, value]) => value === null).map(([field]) => field);
    setUnreadable(bad);
    if (bad.length > 0 || target === null) return;
    onSave({
      effective_from: effectiveFrom,
      reason,
      ...Object.fromEntries(parsed),
      target_value: target,
    });
  }

  const green = parse('green_pct');
  const amber = parse('amber_pct');
  const unit = metric.unit ? `\u00a0${metric.unit}` : '';
  const preview =
    !byBounds && target !== null && green !== null && amber !== null
      ? describeBounds(
          t,
          metric,
          boundsOfTarget(metric.direction, target, green, amber),
          (value) =>
            value === null ? '' : `${format.exactDecimal(value, metric.decimals)}${unit}`,
        )
      : null;

  const reasonError = describeFieldFailure(t, error, 'reason');
  const dateError = describeFieldFailure(t, error, 'effective_from');
  const otherError = describeOtherFailure(t, error, FIELDS_WITH_ERRORS);

  function numberField(field: NumberField, label: string) {
    const apiError = describeFieldFailure(t, error, field);
    const message = unreadable.includes(field)
      ? t('recording.notANumber', { example: format.metricValue('95.3', 1, '') })
      : apiError;
    return (
      <div key={field} className={`${teamStyles.field} ${styles.narrow}`}>
        <label className={teamStyles.label} htmlFor={`${headingId}-${field}`}>
          {label}
        </label>
        <input
          id={`${headingId}-${field}`}
          inputMode="decimal"
          className={teamStyles.input}
          value={numbers[field] ?? ''}
          onChange={(event) => setNumbers({ ...numbers, [field]: event.target.value })}
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
        {numberField('target_value', t('metrics.targetValueLabel'))}
        {fields.map(([field, label]) => numberField(field, label))}
        <p className={`${styles.hint} ${styles.formNote}`}>
          {byBounds ? t('metrics.boundsHint') : t(`metrics.toleranceHint_${metric.direction}`)}
        </p>
        {preview && (
          <p className={`${styles.hint} ${styles.formNote}`} aria-live="polite">
            {t('metrics.preview', { threshold: preview })}
          </p>
        )}
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
