import { useTranslation } from 'react-i18next';
import { useHubSummary } from './useHubSummary';
import { DeclarationsBand } from './DeclarationsBand';
import { TeamsPanel } from './TeamsPanel';
import { AdminTiles, Tiles } from './Tiles';
import { FunnelPanel } from './FunnelPanel';
import { AssignedItems } from './AssignedItems';
import styles from './HubPage.module.css';

/**
 * The landing page.
 *
 * A failure here leaves the page usable: the hero and the footer need no data,
 * and the header controls live above this component entirely, so language and
 * theme still work when the summary cannot be fetched.
 */
export function HubPage() {
  const { t } = useTranslation();
  const summary = useHubSummary();

  return (
    <main className={styles.page}>
      {summary.data && <DeclarationsBand declarations={summary.data.declarations} />}

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            {t('hub.eyebrow')}
          </p>
          <h1 className={styles.title}>{t('hub.heroTitle')}</h1>
          <p className={styles.lede}>{t('hub.heroBody')}</p>
        </div>

        {summary.data && <TeamsPanel teams={summary.data.teams} />}
      </section>

      {summary.isPending && <p className={styles.status}>{t('hub.loading')}</p>}
      {summary.isError && (
        <p className={styles.status} role="alert">
          {t('hub.loadFailed')}
        </p>
      )}

      {summary.data && (
        <>
          <Tiles
            preparation={summary.data.preparation}
            meetingInSession={summary.data.meeting_in_session}
          />

          <section className={styles.panel}>
            <FunnelPanel funnel={summary.data.funnel} />
            <hr className={styles.rule} />
            <AssignedItems
              items={summary.data.assigned_items}
              email={summary.data.current_user.email}
            />
          </section>

          <AdminTiles />

          {summary.data.provisional && <p className={styles.provisional}>{t('hub.provisional')}</p>}
        </>
      )}

      <footer className={styles.footer}>
        <span>BMAPP · {t('hub.footerNote')}</span>
        <span>{t('hub.footerEnv')}</span>
      </footer>
    </main>
  );
}
