import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { countdownFrom } from '../../i18n/format';
import styles from './Countdown.module.css';

/** How often the countdown is recomputed. Its granularity is a minute. */
const TICK_MS = 30_000;

/**
 * The time remaining until a meeting.
 *
 * Recomputed from the instant the API gave, not decremented from a number the
 * server sent: a tab left open overnight would otherwise drift.
 */
export function Countdown({ until }: { until: string }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const target = new Date(until).getTime();
  const { days, hours, minutes } = countdownFrom(Number.isNaN(target) ? 0 : target - now);
  const pad = (value: number) => String(value).padStart(2, '0');

  const units: [number, string][] = [
    [days, t('myTeams.days')],
    [hours, t('myTeams.hours')],
    [minutes, t('myTeams.minutes')],
  ];

  return (
    <div className={styles.countdown} role="timer" aria-label={t('myTeams.countdownLabel')}>
      {units.map(([value, label], index) => (
        <div key={label} className={styles.group}>
          {index > 0 && (
            <span className={styles.separator} aria-hidden="true">
              :
            </span>
          )}
          <span className={styles.unit}>
            <span className={styles.value}>{pad(value)}</span>
            <span className={styles.label}>{label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
