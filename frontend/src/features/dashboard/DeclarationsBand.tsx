import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { localized, type Declarations, type LocalizedText } from '../../api/dashboard';
import { activeLanguage } from '../../i18n/format';
import { CompassIcon, EyeIcon, FlagIcon, TargetIcon, ValueIcon } from '../../components/icons';
import styles from './DeclarationsBand.module.css';

/**
 * The company declarations, which appear on every board.
 *
 * Headlines only, so the band reads at a glance: the mission and the vision
 * as a sentence each, the values by name, the strategic declaration and the
 * goals grouped by the horizon they look to. They arrive from the API
 * carrying both languages, so switching language re-reads what is already
 * loaded rather than fetching again. Pictograms are decoration beside the
 * words.
 */
export function DeclarationsBand({ declarations }: { declarations: Declarations }) {
  const { t, i18n } = useTranslation();
  const language = activeLanguage(i18n.language);
  const read = (text: LocalizedText) => localized(text, language);

  const heading = (icon: ReactNode, text: string) => (
    <h3 className={styles.columnHeading}>
      <span className={styles.pictogram}>{icon}</span>
      {text}
    </h3>
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
        <div className={styles.column}>
          {heading(<TargetIcon />, t('declarations.mission'))}
          <p className={styles.headline}>{read(declarations.mission)}</p>
          {heading(<EyeIcon />, t('declarations.vision'))}
          <p className={styles.headline}>{read(declarations.vision)}</p>
        </div>

        <div className={styles.column}>
          <h3 className={styles.columnHeading}>{t('declarations.values')}</h3>
          <ul className={styles.values}>
            {declarations.values.map((value) => (
              <li key={value.icon} className={styles.value}>
                <ValueIcon icon={value.icon} className={styles.hexagon} width={28} height={32} />
                <span className={styles.valueName}>{read(value.name)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.column}>
          {heading(<CompassIcon />, t('declarations.strategy'))}
          <h4 className={styles.horizon}>{read(declarations.strategy.horizon)}</h4>
          {declarations.strategy.statements.map((statement) => (
            <p key={statement.en} className={styles.prose}>
              {read(statement)}
            </p>
          ))}
        </div>

        <div className={styles.column}>
          {heading(<FlagIcon />, t('declarations.goals'))}
          {declarations.goals.map((group) => (
            <div key={group.horizon.en} className={styles.goalGroup}>
              <h4 className={styles.horizon}>{read(group.horizon)}</h4>
              <ul className={styles.goals}>
                {group.items.map((goal) => (
                  <li key={goal.en} className={styles.goal}>
                    <span className={styles.bullet} aria-hidden="true" />
                    <span>{read(goal)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
