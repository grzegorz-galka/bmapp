import { useTranslation } from 'react-i18next';
import type { ItemMeeting, ProblemRead, TaskRead } from '../../../api/items';
import { useFormat } from '../../../i18n/format';
import { useProblems, useTasks } from './useItems';
import meetingStyles from '../../meetings/meetings.module.css';
import styles from './items.module.css';

/**
 * The team's closed problems and tasks, latest closed first, with the
 * meetings at which each was raised and closed. Read-only for everyone:
 * archiving is the end state, and nothing here changes it.
 */
export function ArchivedView({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const problems = useProblems(teamId, 'archived');
  const tasks = useTasks(teamId, 'archived');

  if (problems.isPending || tasks.isPending) return <p>{t('archive.loading')}</p>;
  if (problems.isError || tasks.isError) return <p role="alert">{t('archive.loadFailed')}</p>;
  if (problems.data.length === 0 && tasks.data.length === 0) return <p>{t('archive.empty')}</p>;

  return (
    <>
      <ArchiveTable
        id="archive-problems"
        heading={t('archive.problemsHeading')}
        empty={t('archive.noProblems')}
        items={problems.data}
      />
      <ArchiveTable
        id="archive-tasks"
        heading={t('archive.tasksHeading')}
        empty={t('archive.noTasks')}
        items={tasks.data}
      />
    </>
  );
}

function ArchiveTable({
  id,
  heading,
  empty,
  items,
}: {
  id: string;
  heading: string;
  empty: string;
  items: (ProblemRead | TaskRead)[];
}) {
  const { t } = useTranslation();
  const format = useFormat();

  /** The meeting's date, or the day itself when no meeting was recorded. */
  const when = (meeting: ItemMeeting | null, instant: string | null) =>
    meeting
      ? format.meetingDate(meeting.date)
      : instant
        ? t('archive.noMeeting', { date: format.date(instant) })
        : '—';

  return (
    <section className={styles.archiveSection} aria-labelledby={id}>
      <h2 id={id} className={meetingStyles.subheading}>
        {heading}
      </h2>
      {items.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('archive.colSummary')}</th>
                <th scope="col">{t('archive.colResponsible')}</th>
                <th scope="col">{t('archive.colDue')}</th>
                <th scope="col">{t('archive.colRaised')}</th>
                <th scope="col">{t('archive.colClosed')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.summary}</th>
                  <td>{item.responsible?.email ?? t('items.noResponsible')}</td>
                  <td>{item.due_on ? format.date(item.due_on) : t('items.noDueDate')}</td>
                  <td>{when(item.raised_meeting, item.raised_at)}</td>
                  <td>{when(item.closed_meeting, item.closed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
