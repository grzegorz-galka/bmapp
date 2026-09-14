import { useTranslation } from 'react-i18next';
import { localized, type Declarations } from '../../api/hub';
import { activeLanguage } from '../../i18n/format';
import styles from './DeclarationsBand.module.css';

/**
 * The company declarations, which appear on every board.
 *
 * They arrive from the API carrying both languages, so switching language
 * re-reads what is already loaded rather than fetching again.
 */
export function DeclarationsBand({ declarations }: { declarations: Declarations }) {
  const { t, i18n } = useTranslation();
  const language = activeLanguage(i18n.language);
  const read = (text: Parameters<typeof localized>[0]) => localized(text, language);

  return (
    <section className={styles.band} aria-labelledby="declarations-heading">
      <div className={styles.bandHead}>
        <h2 id="declarations-heading" className={styles.bandLabel}>
          {t('declarations.band')}
        </h2>
        <span className={styles.bandNote}>{t('declarations.bandNote')}</span>
      </div>

      <div className={styles.grid}>
        <div>
          <h3 className={styles.columnHeading}>{t('declarations.mission')}</h3>
          <p className={styles.prose}>{read(declarations.mission)}</p>
        </div>

        <div>
          <h3 className={styles.columnHeading}>{t('declarations.vision')}</h3>
          <p className={styles.prose}>{read(declarations.vision)}</p>
        </div>

        <div>
          <h3 className={styles.columnHeading}>{t('declarations.goals')}</h3>
          <ul className={styles.goals}>
            {declarations.goals.map((goal) => (
              <li key={goal.en} className={styles.goal}>
                <span className={styles.bullet} aria-hidden="true" />
                <span>{read(goal)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className={styles.columnHeading}>{t('declarations.values')}</h3>
          <ul className={styles.values}>
            {declarations.values.map((value) => (
              <li key={value.en} className={styles.value}>
                {read(value)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
