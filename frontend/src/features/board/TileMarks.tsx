/**
 * A tile's status badge and its change indicators.
 *
 * Both say in words what their colour says: the badge names its status in its
 * accessible name, an indicator whether its change is better or worse.
 */
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardMetric } from '../../api/metrics';
import { useFormat } from '../../i18n/format';
import { describeTarget, describeThreshold } from '../metrics/display';
import styles from './board.module.css';

/**
 * The badge in a tile's top-right corner: filled with the status colour, grey
 * with no number or no threshold, naming the target. The full threshold sits
 * in a tooltip that opens on hover and on focus and closes on Escape.
 */
export function TileBadge({ entry }: { entry: BoardMetric }) {
  const { t } = useTranslation();
  const format = useFormat();
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { metric, status, set_by_hand: byHand } = entry;
  const target = describeTarget(t, format, metric, entry.threshold);
  const statusWord = t(`status.${status}`);
  const open = (hovered || focused) && !dismissed;
  // Escape closes it until the pointer or the focus comes back.
  const leave = (still: boolean) => {
    if (!still) setDismissed(false);
  };

  return (
    <span
      className={styles.badgeWrap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        leave(focused);
      }}
    >
      {byHand && (
        <span className={styles.byHandMark} aria-hidden="true">
          ✎
        </span>
      )}
      <span
        className={styles.badge}
        data-status={status}
        role="img"
        tabIndex={0}
        aria-label={t(byHand ? 'tile.badgeLabelByHand' : 'tile.badgeLabel', {
          status: statusWord,
          target,
        })}
        aria-describedby={tooltipId}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          leave(hovered);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            setDismissed(true);
          }
        }}
      >
        {target}
      </span>
      <span id={tooltipId} role="tooltip" className={styles.tooltip} hidden={!open}>
        <span className={styles.tooltipStatus}>
          {statusWord}
          {byHand && ` · ${t('status.setByHand')}`}
        </span>{' '}
        <span>{describeThreshold(t, format, metric, entry.threshold)}</span>
      </span>
    </span>
  );
}

/**
 * One change: an arrow up, down or level, or a dash with nothing to compare,
 * and the signed difference. Green for better, red for worse, neutral for a
 * band or no change.
 */
export function ChangeIndicator({
  change,
  improvement,
  since,
  metric,
}: {
  change: string | null;
  improvement: boolean | null;
  since: 'previous' | 'four';
  metric: Pick<BoardMetric['metric'], 'decimals' | 'unit'>;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const caption = t(since === 'previous' ? 'tile.sincePrevious' : 'tile.sinceFour');

  if (change === null) {
    return (
      <span
        className={styles.indicator}
        role="img"
        aria-label={t(since === 'previous' ? 'tile.previousNone' : 'tile.fourNone')}
        data-improvement="null"
      >
        <span className={styles.indicatorValue}>–</span>
        <span className={styles.indicatorCaption}>{caption}</span>
      </span>
    );
  }

  const falling = change.startsWith('-');
  const level = Number(change) === 0;
  const magnitude = format.metricValue(
    falling ? change.slice(1) : change,
    metric.decimals,
    metric.unit,
  );
  const signed = level ? magnitude : `${falling ? '−' : '+'}${magnitude}`;
  const arrow = level ? '→' : falling ? '▼' : '▲';
  const verdict =
    improvement === null ? t('tile.neither') : t(improvement ? 'tile.better' : 'tile.worse');

  return (
    <span
      className={styles.indicator}
      role="img"
      aria-label={t(since === 'previous' ? 'tile.previousLabel' : 'tile.fourLabel', {
        change: signed,
        verdict,
      })}
      data-improvement={String(improvement)}
    >
      <span className={styles.indicatorArrow} aria-hidden="true">
        {arrow}
      </span>
      <span className={styles.indicatorValue}>{signed}</span>
      <span className={styles.indicatorCaption}>{caption}</span>
    </span>
  );
}
