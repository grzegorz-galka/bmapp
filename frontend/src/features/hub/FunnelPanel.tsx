import { useTranslation } from 'react-i18next';
import type { Funnel } from '../../api/hub';
import { useFormat } from '../../i18n/format';
import styles from './FunnelPanel.module.css';

const STAGE_CLASS = {
  open: styles.open,
  in_progress: styles.inProgress,
  archived: styles.archived,
} as const;

/**
 * Where the problems and tasks of the user's teams stand.
 *
 * The stage total is summed here rather than sent: three numbers that must
 * agree are better derived than transmitted.
 */
export function FunnelPanel({ funnel }: { funnel: Funnel }) {
  const { t } = useTranslation();
  const format = useFormat();

  return (
    <section aria-labelledby="funnel-heading">
      <div className={styles.head}>
        <h2 id="funnel-heading" className={styles.heading}>
          {t('funnel.heading')}
        </h2>
        <span className={styles.scope}>{t('funnel.scope', { count: funnel.scope_meetings })}</span>
      </div>

      <ol className={styles.stages}>
        {funnel.stages.map((stage) => (
          <li key={stage.stage} className={[styles.stage, STAGE_CLASS[stage.stage]].join(' ')}>
            <span className={styles.stageName}>{t(`funnel.stage_${stage.stage}`)}</span>
            <span className={styles.total}>{format.number(stage.problems + stage.tasks)}</span>
            <span className={styles.split}>
              {t('funnel.split', { problems: stage.problems, tasks: stage.tasks })}
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.foot}>
        <span>{t('funnel.footLeft')}</span>
        <span>{t('funnel.footRight')}</span>
      </div>
    </section>
  );
}
