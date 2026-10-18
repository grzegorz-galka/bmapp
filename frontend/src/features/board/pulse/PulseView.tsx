import { useTranslation } from 'react-i18next';
import type { Meeting } from '../../../api/meetings';
import { describeFailure } from '../../../i18n/apiErrors';
import { PulseAnswers } from './PulseAnswers';
import { PulseCards } from './PulseCards';
import { PulseForm } from './PulseForm';
import { PulseTrend } from './PulseTrend';
import { usePulse } from './usePulse';
import controls from '../../../styles/controls.module.css';
import boardStyles from '../board.module.css';
import styles from './pulse.module.css';

type Mode = 'results' | 'form';

/**
 * The pulse check of one meeting: its results, and for a member at a meeting
 * that takes answers, the form for their own answer.
 *
 * `mayAnswer` is membership, as the API decides it; an administrator who is
 * not on the team reads the answers but never answers. Who may read names is
 * decided by the server alone: `answers` is null when the viewer may not.
 */
export function PulseView({
  teamId,
  meeting,
  mayAnswer,
  answering,
  onAnswering,
  hideNames,
}: {
  teamId: string;
  meeting: Meeting;
  mayAnswer: boolean;
  /** The board's switch: kept by the board, so it outlives this view. */
  hideNames: boolean;
  /** Whether the address asks for the form; ignored where no form is offered. */
  answering: boolean;
  onAnswering: (answering: boolean) => void;
}) {
  const { t } = useTranslation();
  const pulse = usePulse(teamId, meeting.id);
  const mode: Mode = answering ? 'form' : 'results';
  const setMode = (next: Mode) => onAnswering(next === 'form');

  if (pulse.isPending) return <p>{t('pulse.loading')}</p>;
  if (pulse.isError) {
    return <p role="alert">{describeFailure(t, pulse.error) ?? t('pulse.loadFailed')}</p>;
  }

  const results = pulse.data;
  const offered = mayAnswer && results.editable;
  const shownMode: Mode = offered ? mode : 'results';
  const answers = results.answers;

  return (
    <section aria-label={t('pulse.view')}>
      <div className={boardStyles.toolbar}>
        {!results.editable && <span className={boardStyles.muted}>{t('pulse.frozen')}</span>}
        {offered && (
          <div role="group" aria-label={t('pulse.modesLabel')} className={controls.segmented}>
            {(
              [
                ['results', 'pulse.results'],
                ['form', 'pulse.yourAnswer'],
              ] as const
            ).map(([value, caption]) => (
              <button
                key={value}
                type="button"
                aria-pressed={shownMode === value}
                onClick={() => setMode(value)}
              >
                {t(caption)}
              </button>
            ))}
          </div>
        )}
      </div>

      {shownMode === 'form' ? (
        <PulseForm
          teamId={teamId}
          meetingId={meeting.id}
          meetingDate={meeting.date}
          own={results.own}
          onSaved={() => setMode('results')}
        />
      ) : (
        <>
          <PulseCards results={results} hideNames={hideNames} />
          <section className={styles.card} aria-labelledby="pulse-trend-heading">
            <h2 id="pulse-trend-heading" className={styles.cardLabel}>
              {t('pulse.trendTitle')}
            </h2>
            <PulseTrend points={results.trend} />
          </section>
          {results.answered === 0 ? (
            <p className={styles.empty}>
              {t('pulse.empty')}{' '}
              {offered && (
                <button type="button" className={controls.button} onClick={() => setMode('form')}>
                  {t('pulse.answerFirst')}
                </button>
              )}
            </p>
          ) : (
            answers !== null && <PulseAnswers answers={answers} hideNames={hideNames} />
          )}
        </>
      )}
    </section>
  );
}
