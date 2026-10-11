import { useTranslation } from 'react-i18next';
import { PULSE_RATINGS, type PulseResults } from '../../../api/pulse';
import { useFormat } from '../../../i18n/format';
import { statusColour } from '../../metrics/display';
import { PulseGauge } from './PulseGauge';
import { averageWord, RATING_STATUS, ratingCaption } from './rating';
import styles from './pulse.module.css';

/**
 * The three cards of a meeting's results: how many answered and who has not,
 * the average on its gauge with the change, and the distribution of ratings.
 */
export function PulseCards({ results, hideNames }: { results: PulseResults; hideNames: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { answered, members, missing, missing_count: missingCount } = results;

  let missingText: string;
  if (missingCount === 0) missingText = t('pulse.everyone');
  else if (hideNames || missing === null)
    missingText = t('pulse.missingCount', { count: missingCount });
  else
    missingText = t('pulse.missing', { names: missing.map((member) => member.email).join(', ') });

  const most = Math.max(1, ...PULSE_RATINGS.map((rating) => results.distribution[rating]));

  return (
    <div className={styles.top}>
      <section className={styles.card} aria-labelledby="pulse-answered">
        <h2 id="pulse-answered" className={styles.cardLabel}>
          {t('pulse.answeredLabel')}
        </h2>
        <p className={styles.big}>{t('pulse.answeredOf', { answered, members })}</p>
        <p className={styles.muted}>{missingText}</p>
      </section>

      <section className={`${styles.card} ${styles.centred}`} aria-labelledby="pulse-average">
        <h2 id="pulse-average" className={styles.cardLabel}>
          {t('pulse.questionRating')}
        </h2>
        <div className={styles.gaugeBox}>
          <PulseGauge average={results.average} status={results.status} />
        </div>
        {results.average !== null && (
          <p className={styles.word} data-status={results.status}>
            {averageWord(t, results.average)}
          </p>
        )}
        {results.change !== null && results.previous !== null && (
          <Change change={results.change} date={format.date(results.previous.date)} />
        )}
      </section>

      <section className={styles.card} aria-labelledby="pulse-distribution">
        <h2 id="pulse-distribution" className={styles.cardLabel}>
          {t('pulse.distributionTitle')}
        </h2>
        <ul className={styles.bars}>
          {PULSE_RATINGS.map((rating) => {
            const count = results.distribution[rating];
            const colour = statusColour(RATING_STATUS[rating]);
            return (
              <li key={rating} className={styles.bar}>
                <span>{ratingCaption(t, rating)}</span>
                <span className={styles.track} aria-hidden="true">
                  <i style={{ width: `${(count / most) * 100}%`, background: colour }} />
                </span>
                <b>{format.number(count)}</b>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** "▲ +0.2 vs 7 Oct": the sign says the direction; the arrow only repeats it. */
function Change({ change, date }: { change: string; date: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const shown = format.metricValue(change, 1, '');
  const direction = change.startsWith('-') ? 'down' : Number(change) === 0 ? 'same' : 'up';
  const arrow = { down: '▼', same: '■', up: '▲' }[direction];
  const signed = direction === 'up' ? `+${shown}` : shown;
  return (
    <p className={styles.change} data-direction={direction}>
      <span aria-hidden="true">{arrow} </span>
      {t('pulse.change', { change: signed, date })}
    </p>
  );
}
