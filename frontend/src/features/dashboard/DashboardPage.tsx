import { useTranslation } from 'react-i18next';
import { useDashboardSummary } from './useDashboardSummary';
import { DeclarationsBand } from './DeclarationsBand';
import { TeamsPanel } from './TeamsPanel';
import { MeetingsTile } from './MeetingsTile';
import { ItemsTile } from './ItemsTile';
import styles from './DashboardPage.module.css';

/**
 * The landing page.
 *
 * A failure here leaves the page usable: the hero and the footer need no data,
 * and the header controls live above this component entirely, so language and
 * theme still work when the summary cannot be fetched.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const summary = useDashboardSummary();

  return (
    <main className={styles.page}>
      {summary.data && <DeclarationsBand declarations={summary.data.declarations} />}

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            {t('dashboard.eyebrow')}
          </p>
          <h1 className={styles.title}>{t('dashboard.heroTitle')}</h1>
          <p className={styles.lede}>{t('dashboard.heroBody')}</p>
        </div>

        {summary.data && <TeamsPanel teams={summary.data.teams} />}
      </section>

      {summary.isPending && <p className={styles.status}>{t('dashboard.loading')}</p>}
      {summary.isError && (
        <p className={styles.status} role="alert">
          {t('dashboard.loadFailed')}
        </p>
      )}

      {summary.data && (
        <div className={styles.tiles}>
          <MeetingsTile meetings={summary.data.meetings} />
          <ItemsTile
            funnel={summary.data.funnel}
            teams={summary.data.teams}
            items={summary.data.assigned_items}
            email={summary.data.current_user.email}
          />
        </div>
      )}

      <footer className={styles.footer}>
        <span>BMAPP · {t('dashboard.footerNote')}</span>
        <span>{t('dashboard.footerEnv')}</span>
      </footer>
    </main>
  );
}
