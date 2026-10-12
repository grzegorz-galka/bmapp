import { useTranslation } from 'react-i18next';
import type { DashboardTeam } from '../../api/dashboard';
import { useFormat } from '../../i18n/format';
import { PeopleIcon } from '../../components/icons';
import { Countdown } from './Countdown';
import styles from './TeamsPanel.module.css';

/**
 * The viewer's teams, soonest next meeting first, with a countdown to the
 * nearest. The order is the server's; a team with no next meeting comes last
 * there, so the first team that has one is the nearest.
 */
export function TeamsPanel({ teams }: { teams: DashboardTeam[] }) {
  const { t } = useTranslation();
  const format = useFormat();
  const nearest = teams.find((team) => team.next_meeting_at !== null);

  return (
    <section className={styles.panel} aria-labelledby="my-teams-heading">
      <div className={styles.head}>
        <h2 id="my-teams-heading" className={styles.heading}>
          <PeopleIcon />
          {t('myTeams.heading')}
        </h2>
        <span className={styles.count} aria-label={t('myTeams.count', { count: teams.length })}>
          {format.number(teams.length)}
        </span>
      </div>

      {teams.length === 0 && <p className={styles.empty}>{t('myTeams.noTeams')}</p>}

      {nearest?.next_meeting_at && (
        <div className={styles.nearest}>
          <div>
            <div className={styles.nearestName}>{nearest.name}</div>
            <div className={styles.nearestWhen}>{format.dateTime(nearest.next_meeting_at)}</div>
          </div>
          <Countdown until={nearest.next_meeting_at} />
        </div>
      )}

      {teams.length > 0 && (
        <ul className={styles.list}>
          {teams.map((team) => (
            <li key={team.id} className={styles.team}>
              <span className={styles.initials} aria-hidden="true">
                {team.initials}
              </span>
              <div className={styles.identity}>
                <div className={styles.name}>{team.name}</div>
                <div className={styles.meta}>
                  {t(`myTeams.role_${team.role}`)} ·{' '}
                  {team.schedule
                    ? t('myTeams.schedule', {
                        weekday: format.scheduleWeekday(team.schedule.weekday),
                        // An ISO time of day may carry seconds; a schedule is to the minute.
                        time: format.meetingTime(team.schedule.start_time.slice(0, 5)),
                      })
                    : t('myTeams.noSchedule')}
                </div>
              </div>
              <div className={styles.when}>
                {team.next_meeting_at ? (
                  format.dateTime(team.next_meeting_at)
                ) : (
                  <span className={styles.none}>{t('myTeams.noNextMeeting')}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
