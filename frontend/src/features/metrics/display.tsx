/**
 * How a metric's numbers, thresholds and statuses read, wherever they appear.
 *
 * Colour is never the only signal: every status mark carries its status in
 * words, and a colour set by hand says so.
 */
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Bounds, MetricDefinition, Status, Threshold } from '../../api/metrics';
import { useFormat } from '../../i18n/format';
import styles from './display.module.css';

type Formatted = Pick<MetricDefinition, 'decimals' | 'unit' | 'direction'>;
type Format = ReturnType<typeof useFormat>;

/** The CSS custom property a status is painted with, or none. */
export function statusColour(status: Status): string | undefined {
  return status === 'green' || status === 'amber' || status === 'red'
    ? `var(--status-${status})`
    : undefined;
}

/** What a threshold reads from: boundaries, and a target value with tolerances where it has one. */
type Readable = Bounds & Partial<Pick<Threshold, 'target_value' | 'green_pct' | 'amber_pct'>>;

/**
 * A threshold in the metric's own terms. A version with a target value and
 * tolerances reads as those - "Target value 72.3 % · green ±5% · amber ±10%",
 * signed by the side that is worse. Anything else, a version recorded before
 * target values or one whose target value is 0, reads as its boundaries:
 * "Green from 95 %, amber from 85 %".
 */
export function describeThreshold(
  t: TFunction,
  format: Format,
  metric: Formatted,
  threshold: Readable | null,
): string {
  if (!threshold) return t('threshold.none');
  const { target_value: target, green_pct: green, amber_pct: amber } = threshold;
  if (target != null && green != null && amber != null) {
    const unit = metric.unit ? `\u00a0${metric.unit}` : '';
    // Amber equal to green is no amber zone at all; both 0 is the target value itself.
    const shape = !same(green, amber) ? '' : Number(green) === 0 ? '_exact' : '_noAmber';
    return t(`threshold.target_${metric.direction}${shape}`, {
      target: `${format.exactDecimal(target, metric.decimals)}${unit}`,
      green: format.exactDecimal(green),
      amber: format.exactDecimal(amber),
    });
  }
  return describeBounds(t, metric, threshold, (value) =>
    format.metricValue(value, metric.decimals, metric.unit),
  );
}

/**
 * The short target a tile's badge names: "Target: 72.3 %" from a version's
 * target value, or for a version without one its green boundary on the
 * metric's side - "Target: ≤ 5", "Target: 90–110". No version reads
 * "No threshold". The full definition is `describeThreshold`.
 */
export function describeTarget(
  t: TFunction,
  format: Format,
  metric: Formatted,
  threshold: Readable | null,
): string {
  if (!threshold) return t('threshold.none');
  const number = (value: string | null) =>
    value === null ? '—' : format.exactDecimal(value, metric.decimals);
  const unit = metric.unit ? `\u00a0${metric.unit}` : '';
  let target: string;
  // A target value of 0 takes absolute boundaries, so those are its target.
  if (threshold.target_value != null && Number(threshold.target_value) !== 0) {
    target = number(threshold.target_value);
  } else if (metric.direction === 'higher_is_better') {
    target = t('threshold.atLeast', { value: number(threshold.green_lo) });
  } else if (metric.direction === 'lower_is_better') {
    target = t('threshold.atMost', { value: number(threshold.green_hi) });
  } else {
    target = t('threshold.band', {
      lo: number(threshold.green_lo),
      hi: number(threshold.green_hi),
    });
  }
  return t('tile.target', { target: `${target}${unit}` });
}

/** Boundaries in the metric's terms, each number written by `show`. */
export function describeBounds(
  t: TFunction,
  metric: Pick<Formatted, 'direction'>,
  bounds: Bounds,
  show: (value: string | null) => string,
): string {
  // Amber equal to green leaves no amber zone, so the reading names red instead.
  switch (metric.direction) {
    case 'higher_is_better':
      return t(
        same(bounds.green_lo, bounds.amber_lo)
          ? 'threshold.higher_is_better_noAmber'
          : 'threshold.higher_is_better',
        { green: show(bounds.green_lo), amber: show(bounds.amber_lo) },
      );
    case 'lower_is_better':
      return t(
        same(bounds.green_hi, bounds.amber_hi)
          ? 'threshold.lower_is_better_noAmber'
          : 'threshold.lower_is_better',
        { green: show(bounds.green_hi), amber: show(bounds.amber_hi) },
      );
    case 'within_band':
      return t(
        same(bounds.green_lo, bounds.amber_lo) && same(bounds.green_hi, bounds.amber_hi)
          ? 'threshold.within_band_noAmber'
          : 'threshold.within_band',
        {
          greenLo: show(bounds.green_lo),
          greenHi: show(bounds.green_hi),
          amberLo: show(bounds.amber_lo),
          amberHi: show(bounds.amber_hi),
        },
      );
  }
}

/** Two decimals from the API as numbers: "5" and "5.000000" are the same boundary. */
function same(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && Number(a) === Number(b);
}

/** A status as a coloured dot and the word for it, and whether it was set by hand. */
export function StatusBadge({
  status,
  setByHand = false,
}: {
  status: Status;
  setByHand?: boolean;
}) {
  const { t } = useTranslation();
  const colour = statusColour(status);
  return (
    <span className={styles.badge} data-status={status}>
      <span
        className={styles.dot}
        style={colour ? { background: colour } : undefined}
        aria-hidden="true"
      />
      {t(`status.${status}`)}
      {setByHand && <span className={styles.byHand}>{t('status.setByHand')}</span>}
    </span>
  );
}

/**
 * Threshold versions, each with its date, boundaries, reason and author.
 * `hideNames` leaves the author out, for a board shown on a shared screen.
 */
export function ThresholdList({
  metric,
  versions,
  format,
  hideNames = false,
}: {
  metric: Formatted;
  versions: Threshold[];
  format: Format;
  hideNames?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ul className={styles.history}>
      {versions.map((version) => (
        <li key={version.id}>
          <span className={styles.historyWhen}>
            {t('threshold.effectiveFrom', { date: format.meetingDate(version.effective_from) })}
          </span>{' '}
          {describeThreshold(t, format, metric, version)}
          <span className={styles.historyWhy}>
            {version.reason} ·{' '}
            {hideNames
              ? format.dateTime(version.recorded_at)
              : t('detail.recordedBy', {
                  name: version.recorded_by_display_name,
                  date: format.dateTime(version.recorded_at),
                })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Marks a global metric: a globe drawn inline and the word for it, so the mark
 * never rests on a symbol alone.
 */
export function GlobalMark() {
  const { t } = useTranslation();
  return (
    <span className={styles.globalMark}>
      <svg
        className={styles.globalIcon}
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-hidden="true"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="8" cy="8" r="6.5" />
          <ellipse cx="8" cy="8" rx="2.8" ry="6.5" />
          <path d="M1.5 8h13M2.6 4.5h10.8M2.6 11.5h10.8" />
        </g>
      </svg>
      {t('metrics.global')}
    </span>
  );
}
