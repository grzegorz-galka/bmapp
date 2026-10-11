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

/** "Green from 95 %, amber from 85 %" - a threshold in the metric's own terms. */
export function describeThreshold(
  t: TFunction,
  format: Format,
  metric: Formatted,
  threshold: Bounds | null,
): string {
  if (!threshold) return t('threshold.none');
  const show = (value: string | null) => format.metricValue(value, metric.decimals, metric.unit);
  switch (metric.direction) {
    case 'higher_is_better':
      return t('threshold.higher_is_better', {
        green: show(threshold.green_lo),
        amber: show(threshold.amber_lo),
      });
    case 'lower_is_better':
      return t('threshold.lower_is_better', {
        green: show(threshold.green_hi),
        amber: show(threshold.amber_hi),
      });
    case 'within_band':
      return t('threshold.within_band', {
        greenLo: show(threshold.green_lo),
        greenHi: show(threshold.green_hi),
        amberLo: show(threshold.amber_lo),
        amberHi: show(threshold.amber_hi),
      });
  }
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

/** Threshold versions, each with its date, boundaries, reason and author. */
export function ThresholdList({
  metric,
  versions,
  format,
}: {
  metric: Formatted;
  versions: Threshold[];
  format: Format;
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
            {t('detail.recordedBy', {
              email: version.recorded_by_email,
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
