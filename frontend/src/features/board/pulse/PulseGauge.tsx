import { useTranslation } from 'react-i18next';
import type { PulseStatus } from '../../../api/pulse';
import { useFormat } from '../../../i18n/format';
import { statusColour } from '../../metrics/display';
import styles from './pulse.module.css';

const CENTRE = 100;
const RADIUS = 78;

/**
 * The average on a half circle from 1 to 5, as the sample draws it. Inline
 * SVG rather than a Recharts radial bar: one arc, which Recharts would need
 * more code to shape the same. The colour is the server's status.
 */
export function PulseGauge({ average, status }: { average: string | null; status: PulseStatus }) {
  const { t } = useTranslation();
  const format = useFormat();
  const shown = average === null ? null : format.metricValue(average, 1, '');
  // A picture of the number, not a judgement of it: the float only places the arc's end.
  const share = average === null ? 0 : Math.min(1, Math.max(0, (Number(average) - 1) / 4));
  const angle = Math.PI * (1 - share);
  const x = CENTRE + RADIUS * Math.cos(angle);
  const y = CENTRE - RADIUS * Math.sin(angle);

  return (
    <svg
      className={styles.gauge}
      viewBox="0 0 200 118"
      role="img"
      aria-label={
        shown === null ? t('pulse.gaugeNoData') : t('pulse.gaugeLabel', { average: shown })
      }
    >
      <path
        d="M22,100 A78,78 0 0 1 178,100"
        fill="none"
        stroke="var(--line-2)"
        strokeWidth="18"
        strokeLinecap="round"
      />
      {shown !== null && share > 0 && (
        <path
          d={`M22,100 A78,78 0 0 1 ${x.toFixed(1)},${y.toFixed(1)}`}
          fill="none"
          stroke={statusColour(status) ?? 'var(--ink-3)'}
          strokeWidth="18"
          strokeLinecap="round"
        />
      )}
      <text x="100" y="96" textAnchor="middle" className={styles.gaugeValue}>
        {shown ?? '–'}
      </text>
      <text x="22" y="116" textAnchor="middle" className={styles.gaugeScale}>
        {format.number(1)}
      </text>
      <text x="178" y="116" textAnchor="middle" className={styles.gaugeScale}>
        {format.number(5)}
      </text>
    </svg>
  );
}
