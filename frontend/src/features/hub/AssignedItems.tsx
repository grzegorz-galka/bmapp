import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { AssignedItem } from '../../api/hub';
import { useFormat } from '../../i18n/format';
import { PdcaBall } from '../board/items/PdcaBall';
import styles from './AssignedItems.module.css';

/**
 * The problems and tasks assigned to the current user.
 *
 * Overdue is marked with a word, not only the red pill the mockup uses: the
 * spec does not allow colour to be the only carrier. Whether an item is
 * overdue is the server's call, on the organization's calendar, so the hub
 * and the board agree whatever the reader's time zone. The summary is shown as
 * it was typed, whatever the active language, and leads to the item's board.
 */
export function AssignedItems({ items, email }: { items: AssignedItem[]; email: string }) {
  const { t } = useTranslation();
  const format = useFormat();

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
            const overdue = item.overdue;
            return (
              <li key={item.id} className={styles.item}>
                <span className={styles.kind}>{t(`items.kind_${item.kind}`)}</span>

                <div className={styles.identity}>
                  <Link to={`/teams/${item.team_id}`} className={styles.summary}>
                    {item.summary}
                  </Link>
                  <div className={styles.team}>{item.team}</div>
                </div>

                <span className={styles.stage}>
                  <PdcaBall stage={item.stage} />
                </span>

                {item.due_on === null ? (
                  <span className={styles.due}>{t('items.noDueDate')}</span>
                ) : (
                  <span className={overdue ? styles.overdue : styles.due}>
                    {t('items.due', { date: format.date(item.due_on) })}
                    {overdue && <span className={styles.overdueWord}>{t('items.overdue')}</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
