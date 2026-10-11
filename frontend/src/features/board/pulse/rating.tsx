/**
 * How a pulse rating reads wherever it appears: as its number, its word and a
 * coloured dot - never the colour alone.
 */
import type { TFunction } from 'i18next';
import type { PulseRating, PulseStatus } from '../../../api/pulse';
import { statusColour } from '../../metrics/display';
import styles from './pulse.module.css';

/*
 * The fixed bands of one whole rating (specs/pulse-check, "The colour of a
 * rating"), for the distribution bars and the form's options, which carry no
 * status from the server. An average is never judged here: its status always
 * comes from the API.
 */
export const RATING_STATUS: Record<PulseRating, PulseStatus> = {
  5: 'green',
  4: 'green',
  3: 'amber',
  2: 'red',
  1: 'red',
};

/** "4 – Good". */
export function ratingCaption(t: TFunction, rating: PulseRating): string {
  return t('pulse.ratingOption', { rating, word: t(`pulse.rating${rating}`) });
}

/**
 * The word for an average: that of the whole rating it has reached, so 3.57
 * reads "Neutral", which sits in the same band as its amber colour.
 */
export function averageWord(t: TFunction, average: string): string {
  const reached = Math.min(5, Math.max(1, Math.floor(Number(average)))) as PulseRating;
  return t(`pulse.rating${reached}`);
}

/** A status as a dot; the text beside it says what the colour does. */
export function RatingDot({ status }: { status: PulseStatus }) {
  const colour = statusColour(status);
  return (
    <span
      className={styles.dot}
      style={colour ? { background: colour } : undefined}
      aria-hidden="true"
    />
  );
}
