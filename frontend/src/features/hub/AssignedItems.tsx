import { useTranslation } from 'react-i18next';
import { localized, type AssignedItem } from '../../api/hub';
import { activeLanguage, useFormat } from '../../i18n/format';
import styles from './AssignedItems.module.css';

/** A due date is overdue once the day it names is behind us. */
function isOverdue(dueOn: string, today: Date): boolean {
  const due = new Date(`${dueOn}T00:00:00`);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return due < startOfToday;
}

/**
 * The problems and tasks assigned to the current user.
 *
 * Overdue is marked with a word, not only the red pill the mockup uses: the
 * spec does not allow colour to be the only carrier.
 */
export function AssignedItems({ items, email }: { items: AssignedItem[]; email: string }) {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const language = activeLanguage(i18n.language);
  const today = new Date();

  return (
    <section aria-labelledby="assigned-heading">
      <div className={styles.head}>
        <h2 id="assigned-heading" className={styles.heading}>
          {t('items.heading')}
        </h2>
        <span className={styles.who}>{t('items.assignedTo', { email })}</span>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>{t('items.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const overdue = isOverdue(item.due_on, today);
            return (
              <li key={item.id} className={styles.item}>
                <span className={styles.kind}>{t(`items.kind_${item.kind}`)}</span>

                <div className={styles.identity}>
                  <div className={styles.summary}>{localized(item.summary, language)}</div>
                  <div className={styles.team}>{item.team}</div>
                </div>

                <div className={styles.progress}>
                  <span className={styles.percent}>
                    {t('items.progress', { percent: item.progress })}
                  </span>
                  <span className={styles.track}>
                    <span
                      className={item.progress >= 70 ? styles.barDone : styles.bar}
                      style={{ width: `${item.progress}%` }}
                    />
                  </span>
                </div>

                <span className={overdue ? styles.overdue : styles.due}>
                  {t('items.due', { date: format.date(item.due_on) })}
                  {overdue && <span className={styles.overdueWord}>{t('items.overdue')}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
