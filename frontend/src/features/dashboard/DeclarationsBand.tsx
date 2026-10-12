import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  localized,
  type Declarations,
  type LocalizedText,
  type Statement,
} from '../../api/dashboard';
import { activeLanguage } from '../../i18n/format';
import { EyeIcon, FlagIcon, TargetIcon, ValueIcon } from '../../components/icons';
import styles from './DeclarationsBand.module.css';

/**
 * The company declarations, which appear on every board.
 *
 * They arrive from the API carrying both languages, so switching language
 * re-reads what is already loaded rather than fetching again. The text is
 * plain: the headline carries the emphasis the legacy board marked up, so
 * nothing here renders markup. Pictograms are decoration beside the words.
 */
export function DeclarationsBand({ declarations }: { declarations: Declarations }) {
  const { t, i18n } = useTranslation();
  const language = activeLanguage(i18n.language);
  const read = (text: LocalizedText) => localized(text, language);

  const statement = (icon: ReactNode, heading: string, value: Statement) => (
    <div className={styles.column}>
      <h3 className={styles.columnHeading}>
        <span className={styles.pictogram}>{icon}</span>
        {heading}
      </h3>
      <p className={styles.headline}>{read(value.headline)}</p>
      <p className={styles.prose}>{read(value.body)}</p>
    </div>
  );

  return (
    <section className={styles.band} aria-labelledby="declarations-heading">
      <div className={styles.bandHead}>
        <h2 id="declarations-heading" className={styles.bandLabel}>
          {t('declarations.band')}
        </h2>
        <span className={styles.bandNote}>{t('declarations.bandNote')}</span>
      </div>

      <div className={styles.grid}>
        {statement(<TargetIcon />, t('declarations.mission'), declarations.mission)}
        {statement(<EyeIcon />, t('declarations.vision'), declarations.vision)}

        <div className={styles.column}>
          <h3 className={styles.columnHeading}>
            <span className={styles.pictogram}>
              <FlagIcon />
            </span>
            {t('declarations.goals')}
          </h3>
          <ul className={styles.goals}>
            {declarations.goals.map((goal) => (
              <li key={goal.en} className={styles.goal}>
                <span className={styles.bullet} aria-hidden="true" />
                <span>{read(goal)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3 className={styles.valuesHeading}>{t('declarations.values')}</h3>
      <ul className={styles.values}>
        {declarations.values.map((value) => (
          <li key={value.icon} className={styles.value}>
            <ValueIcon icon={value.icon} className={styles.hexagon} />
            <h4 className={styles.valueName}>{read(value.name)}</h4>
            <p className={styles.valueText}>{read(value.description)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
