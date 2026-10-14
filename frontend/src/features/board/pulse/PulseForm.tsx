import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PULSE_RATINGS,
  type PulseAnswerRead,
  type PulseAnswerWrite,
  type PulseRating,
} from '../../../api/pulse';
import { describeFieldFailure, describeOtherFailure } from '../../../i18n/apiErrors';
import { useFormat } from '../../../i18n/format';
import { useSavePulseAnswer } from './usePulse';
import { RatingDot, RATING_STATUS, ratingCaption } from './rating';
import controls from '../../../styles/controls.module.css';
import teamStyles from '../../teams/teams.module.css';
import styles from './pulse.module.css';

const TEXTS = [
  ['positive', 'pulse.questionPositive'],
  ['negative', 'pulse.questionNegative'],
  ['better', 'pulse.questionBetter'],
] as const;

type Text = (typeof TEXTS)[number][0];

/**
 * The viewer's own answer at one meeting: the rating as five labelled options
 * and three optional texts, filled with the answer they already gave.
 */
export function PulseForm({
  teamId,
  meetingId,
  meetingDate,
  own,
  onSaved,
}: {
  teamId: string;
  meetingId: string;
  meetingDate: string;
  own: PulseAnswerRead | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const save = useSavePulseAnswer(teamId, meetingId);
  const [rating, setRating] = useState<PulseRating | null>(own?.rating ?? null);
  const [texts, setTexts] = useState<Record<Text, string>>({
    positive: own?.positive ?? '',
    negative: own?.negative ?? '',
    better: own?.better ?? '',
  });
  const [unrated, setUnrated] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) {
      setUnrated(true);
      return;
    }
    const body: PulseAnswerWrite = { rating, ...texts };
    save.mutate(body, { onSuccess: onSaved });
  }

  const ratingError = unrated
    ? t('errors.pulse_rating.out_of_range')
    : describeFieldFailure(t, save.error, 'rating');
  const otherError = describeOtherFailure(t, save.error, ['rating', ...TEXTS.map(([f]) => f)]);

  return (
    <section className={`${styles.card} ${styles.form}`} aria-labelledby="pulse-form-heading">
      <h2 id="pulse-form-heading" className={styles.heading}>
        {t('pulse.formHeading', { date: format.meetingDate(meetingDate) })}
      </h2>
      <form onSubmit={submit} noValidate className={styles.formFields}>
        <fieldset
          className={styles.ratings}
          aria-describedby={ratingError ? 'pulse-rating-error' : undefined}
        >
          <legend className={teamStyles.label}>{t('pulse.questionRating')}</legend>
          {PULSE_RATINGS.map((option) => (
            <label key={option} className={styles.option}>
              <input
                type="radio"
                name="pulse-rating"
                value={option}
                checked={rating === option}
                onChange={() => {
                  setRating(option);
                  setUnrated(false);
                }}
              />
              <RatingDot status={RATING_STATUS[option]} />
              {ratingCaption(t, option)}
            </label>
          ))}
          {ratingError && (
            <p id="pulse-rating-error" role="alert" className={teamStyles.error}>
              {ratingError}
            </p>
          )}
        </fieldset>

        {TEXTS.map(([field, question]) => {
          const error = describeFieldFailure(t, save.error, field);
          const id = `pulse-${field}`;
          return (
            <div key={field} className={teamStyles.field}>
              <label className={teamStyles.label} htmlFor={id}>
                {t(question)}
              </label>
              <textarea
                id={id}
                rows={3}
                className={teamStyles.input}
                value={texts[field]}
                onChange={(event) => setTexts({ ...texts, [field]: event.target.value })}
                aria-invalid={error !== undefined}
                aria-describedby={error ? `${id}-error` : undefined}
              />
              {error && (
                <p id={`${id}-error`} role="alert" className={teamStyles.error}>
                  {error}
                </p>
              )}
            </div>
          );
        })}

        {otherError && (
          <p role="alert" className={teamStyles.error}>
            {otherError}
          </p>
        )}
        <p className={styles.actions}>
          <button type="submit" className={controls.default} disabled={save.isPending}>
            {save.isPending ? t('pulse.saving') : own ? t('pulse.update') : t('pulse.save')}
          </button>
          {own && <span className={styles.muted}>{t('pulse.hasAnswer')}</span>}
        </p>
      </form>
    </section>
  );
}
