import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PulseTrendPoint } from '../../../api/pulse';
import { useFormat } from '../../../i18n/format';
import { StatusDot } from '../Sparkline';
import styles from './pulse.module.css';

/**
 * The average and the number of answers at the team's last meetings with
 * answers. The averages become floats here, and only here: this is a picture.
 *
 * Each point is coloured by the status the server gave it; the interface
 * never judges a number itself. The green area shows where the 4-5 band lies.
 */
export function PulseTrend({ points }: { points: PulseTrendPoint[] }) {
  const { t } = useTranslation();
  const format = useFormat();

  if (points.length < 2) {
    return <p className={styles.muted}>{t('pulse.trendPending')}</p>;
  }

  const rows = points.map((point) => ({
    date: point.date,
    average: Number(point.average),
    status: point.status,
    exact: point.average,
    answered: point.answered,
  }));

  return (
    <>
      <div role="img" aria-label={t('pulse.trendLabel')} className={styles.chart}>
        <ComposedChart
          responsive
          style={{ width: '100%', height: 220 }}
          data={rows}
          margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
        >
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <ReferenceArea
            yAxisId="average"
            y1={4}
            y2={5}
            fill="var(--status-green)"
            fillOpacity={0.12}
            ifOverflow="hidden"
          />
          <XAxis
            dataKey="date"
            tickFormatter={format.date}
            stroke="var(--ink-3)"
            tick={{ fill: 'var(--ink-2)', fontSize: 11 }}
          />
          <YAxis
            yAxisId="average"
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tickFormatter={format.number}
            stroke="var(--ink-3)"
            tick={{ fill: 'var(--ink-2)', fontSize: 11 }}
            width={32}
          />
          <YAxis
            yAxisId="answered"
            orientation="right"
            allowDecimals={false}
            tickFormatter={format.number}
            stroke="var(--ink-3)"
            tick={{ fill: 'var(--ink-2)', fontSize: 11 }}
            width={32}
          />
          <Tooltip
            labelFormatter={(label) => format.date(String(label))}
            // The average from its string, so the tooltip writes it as the gauge does.
            formatter={(value, _name, item) =>
              item.dataKey === 'average'
                ? format.metricValue((item.payload as { exact: string }).exact, 2, '')
                : format.number(Number(value))
            }
            contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line-control)' }}
            labelStyle={{ color: 'var(--ink)' }}
            itemStyle={{ color: 'var(--ink)' }}
          />
          <Bar
            yAxisId="answered"
            dataKey="answered"
            name={t('pulse.trendAnswered')}
            fill="var(--line-2)"
            barSize={14}
            isAnimationActive={false}
          />
          <Line
            yAxisId="average"
            type="linear"
            dataKey="average"
            name={t('pulse.trendAverage')}
            stroke="var(--accent)"
            strokeWidth={2}
            dot={StatusDot}
            isAnimationActive={false}
          />
        </ComposedChart>
      </div>
      <p className={styles.muted}>{t('pulse.trendLegend')}</p>
      <table className="visually-hidden">
        <caption>{t('pulse.trendTitle')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('detail.meeting')}</th>
            <th scope="col">{t('pulse.trendAverage')}</th>
            <th scope="col">{t('pulse.trendAnswered')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.meeting_id}>
              <th scope="row">{format.meetingDate(point.date)}</th>
              <td>{format.metricValue(point.average, 2, '')}</td>
              <td>{format.number(point.answered)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
