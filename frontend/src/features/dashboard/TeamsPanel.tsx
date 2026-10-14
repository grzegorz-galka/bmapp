import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { DashboardTeam } from '../../api/dashboard';
import { useFormat } from '../../i18n/format';
import { ArrowRightIcon, PeopleIcon } from '../../components/icons';
import { useHere } from '../../components/origin';
import controls from '../../styles/controls.module.css';
import { Countdown } from './Countdown';
import { TILE_LIMIT } from './tileLimit';
import styles from './TeamsPanel.module.css';

/**
 * The viewer's first few teams, soonest next meeting first, with a countdown
 * on the nearest one's row. The order is the server's; a team with no next
 * meeting comes last there, so the first row that has one is the nearest.
 */
export function TeamsPanel({ teams }: { teams: DashboardTeam[] }) {
  const { t } = useTranslation();
  const format = useFormat();
  const here = useHere('dashboard');
  const shown = teams.slice(0, TILE_LIMIT);
  const nearest = shown.find((team) => team.next_meeting_at !== null);

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

      {shown.length > 0 && (
        <ul className={styles.list}>
          {shown.map((team) => (
            <li key={team.id} className={styles.team}>
              <span className={styles.initials} aria-hidden="true">
                {team.initials}
              </span>
              <div className={styles.identity}>
                <Link to={`/teams/${team.id}/members`} state={here} className={styles.name}>
                  {team.name}
                </Link>
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
                <Link
                  to={`/teams/${team.id}/meetings`}
                  state={here}
                  className={team.next_meeting_at ? styles.date : styles.none}
                >
                  {team.next_meeting_at
                    ? format.dateTime(team.next_meeting_at)
                    : t('myTeams.noNextMeeting')}
                </Link>
                {team === nearest && team.next_meeting_at && (
                  <Countdown until={team.next_meeting_at} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {teams.length > TILE_LIMIT && (
        <Link
          to="/my-teams"
          state={here}
          className={`${controls.link} ${styles.more}`}
          aria-label={t('dashboard.moreTeams')}
        >
          {t('dashboard.more')}
          <ArrowRightIcon />
        </Link>
      )}
    </section>
  );
}
