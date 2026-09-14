import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PreparationCounts } from '../../api/hub';
import { useFormat } from '../../i18n/format';
import styles from './Tiles.module.css';

/**
 * The five things a person comes to BMAPP to do.
 *
 * Every destination is unbuilt, so none of them is a link. The mockup draws
 * them as anchors; an anchor that goes nowhere is worse than a panel that says
 * so, and a screen reader has to be told rather than shown.
 */
function Tile({
  className,
  ordinal,
  children,
}: {
  // CSS-module lookups are string | undefined under noUncheckedIndexedAccess,
  // and the DOM prop accepts that as readily as this does.
  className?: string;
  ordinal: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <section className={[styles.tile, className].filter(Boolean).join(' ')} aria-disabled="true">
      <span className={styles.ordinal} aria-hidden="true">
        {ordinal}
      </span>
      {children}
      <p className={styles.unavailable}>{t('nav.notYetAvailable')}</p>
    </section>
  );
}

export function Tiles({
  preparation,
  meetingInSession,
}: {
  preparation: PreparationCounts;
  meetingInSession: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();

  const counts: [number, string][] = [
    [preparation.metrics_due, t('tiles.metricsDue')],
    [preparation.problems_to_review, t('tiles.problemsReview')],
    [preparation.open_tasks, t('tiles.openTasks')],
  ];

  return (
    <>
      <h2 className="visually-hidden">{t('tiles.heading')}</h2>

      <div className={styles.grid}>
        <Tile className={styles.conduct} ordinal="03">
          {meetingInSession && (
            <span className={styles.inSession}>
              <span className={styles.pulse} aria-hidden="true" />
              {t('tiles.inSession')}
            </span>
          )}
          <div className={styles.conductBody}>
            <div className={styles.conductText}>
              <h3 className={styles.bigTitle}>{t('tiles.conductTitle')}</h3>
              <p className={styles.body}>{t('tiles.conductBody')}</p>
            </div>
            <ul className={styles.steps}>
              {[t('tiles.conductStep1'), t('tiles.conductStep2'), t('tiles.conductStep3')].map(
                (step) => (
                  <li key={step} className={styles.step}>
                    {step}
                  </li>
                ),
              )}
            </ul>
          </div>
        </Tile>

        <Tile className={styles.prepare} ordinal="02">
          <h3 className={styles.title}>{t('tiles.prepareTitle')}</h3>
          <p className={styles.body}>{t('tiles.prepareBody')}</p>
          <ul className={styles.counts}>
            {counts.map(([value, label]) => (
              <li key={label} className={styles.count}>
                <span className={styles.countValue}>{format.number(value)}</span>
                <span className={styles.countLabel}>{label}</span>
              </li>
            ))}
          </ul>
        </Tile>

        <Tile className={styles.browse} ordinal="04">
          <h3 className={styles.title}>{t('tiles.browseTitle')}</h3>
          <p className={styles.body}>{t('tiles.browseBody')}</p>
        </Tile>
      </div>
    </>
  );
}

/**
 * Configure and Manage access.
 *
 * Their own section, below the funnel, as the mockup has them: they are set up
 * once per team rather than touched at a meeting.
 */
export function AdminTiles() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="admin-heading">
      <div className={styles.adminHead}>
        <h2 id="admin-heading" className={styles.adminLabel}>
          {t('tiles.adminSection')}
        </h2>
        <span className={styles.rule} aria-hidden="true" />
        <span className={styles.adminNote}>{t('tiles.adminNote')}</span>
      </div>

      <div className={styles.adminGrid}>
        <Tile className={styles.admin} ordinal="01">
          <h3 className={styles.title}>{t('tiles.configureTitle')}</h3>
          <p className={styles.body}>{t('tiles.configureBody')}</p>
        </Tile>

        <Tile className={styles.admin} ordinal="05">
          <h3 className={styles.title}>{t('tiles.accessTitle')}</h3>
          <p className={styles.body}>{t('tiles.accessBody')}</p>
        </Tile>
      </div>
    </section>
  );
}
