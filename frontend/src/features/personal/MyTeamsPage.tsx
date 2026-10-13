import { Link } from 'react-router';
import { useHere } from '../../components/origin';
import { useTranslation } from 'react-i18next';
import { useFormat } from '../../i18n/format';
import { useDashboardSummary } from '../dashboard/useDashboardSummary';
import styles from '../teams/teams.module.css';

/**
 * The viewer's teams, each with the way to its board, meetings, members and
 * metric settings. Read from the dashboard summary, which the header has
 * already loaded, so it costs no request of its own.
 */
export function MyTeamsPage() {
  const { t } = useTranslation();
  const here = useHere('myTeams');
  const format = useFormat();
  const summary = useDashboardSummary();

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>{t('personal.teamsHeading')}</h1>
      {summary.isPending ? (
        <p>{t('personal.loading')}</p>
      ) : summary.isError ? (
        <p role="alert">{t('personal.loadFailed')}</p>
      ) : summary.data.teams.length === 0 ? (
        <p>{t('personal.noTeams')}</p>
      ) : (
        <ul className={styles.list}>
          {summary.data.teams.map((team) => {
            const path = `/teams/${encodeURIComponent(team.id)}`;
            return (
              <li key={team.id} className={styles.item}>
                <span className={styles.itemMain}>
                  <span className={styles.itemName}>{team.name}</span>
                  <span className={styles.itemMeta}>
                    {t(`myTeams.role_${team.role}`)} ·{' '}
                    {team.schedule
                      ? t('myTeams.schedule', {
                          weekday: format.scheduleWeekday(team.schedule.weekday),
                          time: format.meetingTime(team.schedule.start_time.slice(0, 5)),
                        })
                      : t('myTeams.noSchedule')}{' '}
                    ·{' '}
                    {team.next_meeting_at
                      ? format.dateTime(team.next_meeting_at)
                      : t('myTeams.noNextMeeting')}
                  </span>
                </span>
                <span className={styles.actions}>
                  <Link
                    to={path}
                    state={here}
                    aria-label={t('teams.boardLinkLabel', { name: team.name })}
                  >
                    {t('teams.boardLink')}
                  </Link>
                  <Link
                    to={`${path}/meetings`}
                    state={here}
                    aria-label={t('teams.meetingsLinkLabel', { name: team.name })}
                  >
                    {t('teams.meetingsLink')}
                  </Link>
                  <Link
                    to={`${path}/members`}
                    state={here}
                    aria-label={t('teams.membersLinkLabel', { name: team.name })}
                  >
                    {t('teams.membersLink')}
                  </Link>
                  <Link
                    to={`${path}/metrics`}
                    state={here}
                    aria-label={t('personal.metricsLinkLabel', { name: team.name })}
                  >
                    {t('personal.metricsLink')}
                  </Link>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
