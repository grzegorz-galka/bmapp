import { Line, LineChart, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { SparklinePoint, Status } from '../../api/metrics';
import { statusColour } from '../metrics/display';

const WIDTH = 132;
const HEIGHT = 36;

interface Plotted {
  value: number | null;
  status: Status;
}

/**
 * A tile's last meetings at a glance. The numbers become floats here, and
 * only here: this is a picture, and no status is ever decided from it.
 */
export function Sparkline({ name, points }: { name: string; points: SparklinePoint[] }) {
  const { t } = useTranslation();
  const data: Plotted[] = points.map((point) => ({
    value: point.value === null ? null : Number(point.value),
    status: point.status,
  }));

  return (
    <div role="img" aria-label={t('board.sparklineLabel', { name, count: points.length })}>
      <LineChart
        width={WIDTH}
        height={HEIGHT}
        data={data}
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
      >
        <YAxis hide domain={['auto', 'auto']} />
        <Line
          type="linear"
          dataKey="value"
          stroke="var(--ink-3)"
          strokeWidth={1.5}
          isAnimationActive={false}
          connectNulls
          dot={StatusDot}
          activeDot={false}
        />
      </LineChart>
    </div>
  );
}

/** A point painted with its status; one with no status colour is left as a ring. */
export function StatusDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: { status: Status; value: number | null };
}) {
  const { cx, cy, payload, index } = props;
  if (cx === undefined || cy === undefined || !payload || payload.value === null) {
    return <g key={index} />;
  }
  const colour = statusColour(payload.status);
  return (
    <circle
      key={index}
      cx={cx}
      cy={cy}
      r={3}
      fill={colour ?? 'var(--panel)'}
      stroke={colour ?? 'var(--ink-3)'}
      strokeWidth={1}
    />
  );
}
