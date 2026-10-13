import { Link } from 'react-router';
import { useHere } from '../../components/origin';
import { useTranslation } from 'react-i18next';
import { useDashboardSummary } from '../dashboard/useDashboardSummary';
import { useTeams } from '../teams/useTeams';
import styles from '../teams/teams.module.css';

/**
 * The way into a team's metric settings from the Configuration group: every
 * registered team, the viewer's own first, since those are the ones they are
 * most likely to configure. Whether they may is the settings page's to say.
 */
export function TeamMetricsPage() {
  const { t } = useTranslation();
  const here = useHere('teamMetrics');
  const teams = useTeams();
  const summary = useDashboardSummary();
  const mine = new Set((summary.data?.teams ?? []).map((team) => team.id));

  const ordered = [...(teams.data ?? [])].sort(
    (a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || a.name.localeCompare(b.name),
  );

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>{t('personal.teamMetricsHeading')}</h1>
      {teams.isPending ? (
        <p>{t('personal.loading')}</p>
      ) : teams.isError ? (
        <p role="alert">{t('personal.loadFailed')}</p>
      ) : ordered.length === 0 ? (
        <p>{t('teams.empty')}</p>
      ) : (
        <>
          <p>{t('personal.teamMetricsIntro')}</p>
          <ul className={styles.list}>
            {ordered.map((team) => (
              <li key={team.id} className={styles.item}>
                <span className={styles.itemMain}>
                  <Link
                    className={styles.itemName}
                    to={`/teams/${encodeURIComponent(team.id)}/metrics`}
                    state={here}
                  >
                    {team.name}
                  </Link>
                  {mine.has(team.id) && (
                    <span className={styles.itemMeta}>{t('personal.yourTeam')}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
