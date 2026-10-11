import { useTranslation } from 'react-i18next';
import type { PulseAnswerRead } from '../../../api/pulse';
import { RatingDot, ratingCaption } from './rating';
import styles from './pulse.module.css';

/**
 * Every answer at a meeting, in the order the API returns them (by email).
 * With names hidden each row is "Person n" in that same order.
 */
export function PulseAnswers({
  answers,
  hideNames,
}: {
  answers: PulseAnswerRead[];
  hideNames: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="pulse-answers-heading">
      <h2 id="pulse-answers-heading" className={styles.heading}>
        {t('pulse.answersHeading')}
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('pulse.colPerson')}</th>
              <th scope="col">{t('pulse.colRating')}</th>
              <th scope="col">{t('pulse.colPositive')}</th>
              <th scope="col">{t('pulse.colNegative')}</th>
              <th scope="col">{t('pulse.colBetter')}</th>
            </tr>
          </thead>
          <tbody>
            {answers.map((answer, index) => (
              <tr key={answer.employee_id}>
                <th scope="row" className={styles.person}>
                  {hideNames ? t('pulse.person', { n: index + 1 }) : answer.email}
                </th>
                <td className={styles.rating} data-status={answer.status}>
                  <RatingDot status={answer.status} /> {ratingCaption(t, answer.rating)}
                </td>
                <td>{answer.positive}</td>
                <td>{answer.negative}</td>
                <td>{answer.better}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
