import { useTranslation } from 'react-i18next';
import type { HubTeam } from '../../api/hub';
import { useFormat } from '../../i18n/format';
import { Countdown } from './Countdown';
import styles from './TeamsPanel.module.css';

/**
 * The user's teams, soonest meeting first, with a countdown to the nearest.
 *
 * Readiness carries a word as well as a colour. The mockup distinguishes the
 * two states by colour alone, which the spec does not allow.
 */
export function TeamsPanel({ teams }: { teams: HubTeam[] }) {
  const { t } = useTranslation();
  const format = useFormat();
  const nearest = teams[0];

  return (
    <section className={styles.panel} aria-labelledby="my-teams-heading">
      <div className={styles.head}>
        <h2 id="my-teams-heading" className={styles.heading}>
          {t('myTeams.heading')}
        </h2>
        <span className={styles.count} aria-label={t('myTeams.count', { count: teams.length })}>
          {format.number(teams.length)}
        </span>
      </div>

      {nearest && (
        <div className={styles.nearest}>
          <div>
            <div className={styles.nearestName}>{nearest.name}</div>
            <div className={styles.nearestWhen}>{format.dateTime(nearest.next_meeting_at)}</div>
          </div>
          <Countdown until={nearest.next_meeting_at} />
        </div>
      )}

      <ul className={styles.list}>
        {teams.map((team) => (
          <li key={team.id} className={styles.team}>
            <span className={styles.initials} aria-hidden="true">
              {team.initials}
            </span>
            <div className={styles.identity}>
              <div className={styles.name}>{team.name}</div>
              <div className={styles.meta}>
                {t(`myTeams.role_${team.role}`)} · {format.weekdayAndTime(team.next_meeting_at)}
              </div>
            </div>
            <div className={styles.when}>
              <div className={styles.whenValue}>{format.dateTime(team.next_meeting_at)}</div>
              <div className={team.readiness.code === 'ready' ? styles.ready : styles.notReady}>
                {team.readiness.code === 'ready'
                  ? t('myTeams.ready')
                  : t('myTeams.metricsMissing', { count: team.readiness.count ?? 0 })}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
