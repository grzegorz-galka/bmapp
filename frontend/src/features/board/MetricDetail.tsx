import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { MetricDefinition, Status, TrendPoint } from '../../api/metrics';
import { describeFailure } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { describeThreshold, StatusBadge, ThresholdList } from '../metrics/display';
import { useThresholds, useTrend } from '../metrics/useMetrics';
import { StatusDot } from './Sparkline';
import styles from './board.module.css';

/** How many of the most recent meetings the detail lists beneath the chart. */
const RECENT = 8;

/** One meeting as the chart plots it: the number, and each boundary in force then. */
export interface TrendRow {
  date: string;
  value: number | null;
  status: Status;
  greenLo: number | null;
  greenHi: number | null;
  amberLo: number | null;
  amberHi: number | null;
}

const plot = (value: string | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

/**
 * The chart's rows. Each carries the boundaries in force on its own date, so a
 * new version shows as a step at the first meeting it applies to.
 */
export function trendRows(points: TrendPoint[]): TrendRow[] {
  return points.map((point) => ({
    date: point.date,
    value: plot(point.value),
    status: point.status,
    greenLo: plot(point.threshold?.green_lo),
    greenHi: plot(point.threshold?.green_hi),
    amberLo: plot(point.threshold?.amber_lo),
    amberHi: plot(point.threshold?.amber_hi),
  }));
}

const BOUND_LINES = [
  ['greenLo', 'var(--status-green)', undefined],
  ['greenHi', 'var(--status-green)', undefined],
  ['amberLo', 'var(--status-amber)', '4 3'],
  ['amberHi', 'var(--status-amber)', '4 3'],
] as const;

/**
 * A metric's trend over every meeting of its team, the threshold drawn as a
 * stepped line, and beneath it the recent values, the threshold history and
 * the corrections. Shown over the board.
 */
export function MetricDetail({
  teamId,
  metric,
  onClose,
}: {
  teamId: string;
  metric: MetricDefinition;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const trend = useTrend(teamId, metric.id);
  const thresholds = useThresholds(teamId, metric.id);
  const close = useRef<HTMLButtonElement>(null);
  const headingId = `detail-${metric.id}-heading`;

  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const show = (value: string | null) => format.metricValue(value, metric.decimals, metric.unit);

  return (
    <div className={styles.overlay}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={styles.detail}
      >
        <header className={styles.detailHeader}>
          <h2 id={headingId} className={styles.detailHeading}>
            {metric.name}
          </h2>
          <button ref={close} type="button" className={styles.button} onClick={onClose}>
            {t('detail.close')}
          </button>
        </header>

        {trend.isPending ? (
          <p>{t('detail.loading')}</p>
        ) : trend.isError ? (
          <p role="alert">{describeFailure(t, trend.error) ?? t('detail.loadFailed')}</p>
        ) : (
          <>
            <TrendChart
              name={metric.name}
              rows={trendRows(trend.data.points)}
              dateLabel={format.meetingDate}
            />
            <table className="visually-hidden">
              <caption>{t('detail.chartData')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('detail.meeting')}</th>
                  <th scope="col">{t('detail.value')}</th>
                  <th scope="col">{t('detail.status')}</th>
                  <th scope="col">{t('detail.thresholdColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {trend.data.points.map((point) => (
                  <tr key={point.meeting_id}>
                    <th scope="row">{format.meetingDate(point.date)}</th>
                    <td>{show(point.value)}</td>
                    <td>{t(`status.${point.status}`)}</td>
                    <td>{describeThreshold(t, format, metric, point.threshold)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className={styles.detailSubheading}>{t('detail.recentHeading')}</h3>
            <RecentValues points={trend.data.points} show={show} />

            <h3 className={styles.detailSubheading}>{t('detail.correctionsHeading')}</h3>
            {trend.data.corrections.length === 0 ? (
              <p>{t('detail.noCorrections')}</p>
            ) : (
              <ul className={styles.plainList}>
                {trend.data.corrections.map((correction) => {
                  const meeting = trend.data.points.find(
                    (point) => point.meeting_id === correction.meeting_id,
                  );
                  return (
                    <li key={correction.id}>
                      <strong>{meeting ? format.meetingDate(meeting.date) : ''}</strong>{' '}
                      {t('detail.correction', {
                        old: show(correction.old_value),
                        new: show(correction.new_value),
                      })}
                      <span className={styles.muted}>
                        {correction.reason} ·{' '}
                        {t('detail.recordedBy', {
                          email: correction.corrected_by_email,
                          date: format.dateTime(correction.corrected_at),
                        })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <h3 className={styles.detailSubheading}>{t('detail.thresholdsHeading')}</h3>
        {thresholds.isPending ? (
          <p>{t('detail.loading')}</p>
        ) : thresholds.isError ? (
          <p role="alert">{t('detail.loadFailed')}</p>
        ) : thresholds.data.length === 0 ? (
          <p>{t('detail.noThresholds')}</p>
        ) : (
          <ThresholdList metric={metric} versions={thresholds.data} format={format} />
        )}
      </section>
    </div>
  );
}

function TrendChart({
  name,
  rows,
  dateLabel,
}: {
  name: string;
  rows: TrendRow[];
  dateLabel: (date: string) => string;
}) {
  const { t } = useTranslation();
  const present = new Set(
    BOUND_LINES.filter(([key]) => rows.some((row) => row[key] !== null)).map(([key]) => key),
  );
  return (
    <div role="img" aria-label={t('detail.chartLabel', { name })} className={styles.chart}>
      <LineChart
        responsive
        style={{ width: '100%', height: 240 }}
        data={rows}
        margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
      >
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={dateLabel}
          stroke="var(--ink-3)"
          tick={{ fill: 'var(--ink-2)', fontSize: 11 }}
        />
        <YAxis
          domain={['auto', 'auto']}
          stroke="var(--ink-3)"
          tick={{ fill: 'var(--ink-2)', fontSize: 11 }}
          width={48}
        />
        <Tooltip
          labelFormatter={(label) => dateLabel(String(label))}
          contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line-control)' }}
        />
        {BOUND_LINES.filter(([key]) => present.has(key)).map(([key, colour, dash]) => (
          <Line
            key={key}
            type="stepAfter"
            dataKey={key}
            stroke={colour}
            strokeDasharray={dash}
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        ))}
        <Line
          type="linear"
          dataKey="value"
          stroke="var(--ink-2)"
          strokeWidth={2}
          connectNulls
          dot={StatusDot}
          isAnimationActive={false}
        />
      </LineChart>
    </div>
  );
}

function RecentValues({
  points,
  show,
}: {
  points: TrendPoint[];
  show: (value: string | null) => string;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const recorded = points
    .filter((point) => point.value !== null || point.manual_status !== null || point.comment)
    .slice(-RECENT)
    .reverse();
  if (recorded.length === 0) return <p>{t('detail.noValues')}</p>;
  return (
    <ul className={styles.plainList}>
      {recorded.map((point) => (
        <li key={point.meeting_id}>
          <strong>{format.meetingDate(point.date)}</strong> {show(point.value)}{' '}
          <StatusBadge status={point.status} setByHand={point.set_by_hand} />
          {point.comment && <span className={styles.muted}>{point.comment}</span>}
        </li>
      ))}
    </ul>
  );
}
