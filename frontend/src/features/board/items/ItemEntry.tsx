import { useTranslation } from 'react-i18next';
import type { ProblemRead, TaskRead } from '../../../api/items';
import { useFormat } from '../../../i18n/format';
import { PdcaBall } from './PdcaBall';
import styles from './items.module.css';

/**
 * One active problem or task on the board: its summary, who is responsible,
 * when it is due, its stage, and the marks the sample shows beside them.
 *
 * Given `onOpen` the summary opens the item for changing, and given
 * `onMoveOn` the ball moves the stage on; a viewer who may do neither reads
 * the same entry without controls.
 */
export function ItemEntry({
  item,
  meetingId,
  onOpen,
  onMoveOn,
  hideNames = false,
}: {
  item: ProblemRead | TaskRead;
  /** The meeting the board shows: an item raised at it is new. */
  meetingId: string | undefined;
  onOpen?: () => void;
  onMoveOn?: () => void;
  /** Names hidden for screen sharing: the responsible member is left out. */
  hideNames?: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const isNew = meetingId !== undefined && item.raised_meeting?.id === meetingId;
  const problem = 'problem' in item ? item.problem : null;

  return (
    <li className={styles.entry}>
      <span className={styles.entryHead}>
        {onOpen ? (
          <button
            type="button"
            className={styles.summary}
            aria-label={t('items.editLabel', { summary: item.summary })}
            onClick={onOpen}
          >
            {item.summary}
          </button>
        ) : (
          <span className={styles.summaryText}>{item.summary}</span>
        )}
        <PdcaBall stage={item.stage} onMoveOn={onMoveOn} />
      </span>
      <span className={styles.meta}>
        {!hideNames && <span>{item.responsible?.email ?? t('items.noResponsible')}</span>}
        {item.due_on === null ? (
          <span>{t('items.noDueDate')}</span>
        ) : item.overdue ? (
          <span className={styles.late}>
            {t('items.overdueSince', { date: format.date(item.due_on) })}
          </span>
        ) : (
          <span>{t('items.due', { date: format.date(item.due_on) })}</span>
        )}
        {isNew && (
          <span className={styles.new} title={t('items.newLabel')}>
            {t('items.new')}
          </span>
        )}
        {problem && <span>{t('items.fromProblem', { summary: problem.summary })}</span>}
        {item.metric && <span>{t('items.metric', { name: item.metric.name })}</span>}
      </span>
    </li>
  );
}
