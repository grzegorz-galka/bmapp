import { useTranslation } from 'react-i18next';
import { nextStage, STAGES, type Stage } from '../../../api/items';
import styles from './items.module.css';

const CENTRE = 11;
const RADIUS = 9;

/**
 * The legacy board's PDCA ball: a ring filled a quarter per stage from twelve
 * o'clock, solid once closed. Decorative - the stage is always named in words
 * beside it.
 */
export function PdcaSymbol({ stage }: { stage: Stage }) {
  const step = STAGES.indexOf(stage);
  const angle = (step / 4) * 2 * Math.PI;
  const x = (CENTRE + RADIUS * Math.sin(angle)).toFixed(2);
  const y = (CENTRE - RADIUS * Math.cos(angle)).toFixed(2);
  return (
    <svg className={styles.symbol} viewBox="0 0 22 22" aria-hidden="true" data-stage={stage}>
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={RADIUS}
        fill="none"
        stroke="var(--pdca-ring)"
        strokeWidth="1.5"
      />
      {stage === 'act' ? (
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS} fill="var(--pdca-done)" />
      ) : (
        step > 0 && (
          <path
            d={`M${CENTRE} ${CENTRE} L${CENTRE} ${CENTRE - RADIUS} A${RADIUS} ${RADIUS} 0 ${
              step > 2 ? 1 : 0
            } 1 ${x} ${y} Z`}
            fill="var(--pdca-ring)"
          />
        )
      )}
    </svg>
  );
}

/**
 * An item's stage: the ball and the stage's name. Given `onMoveOn`, it is a
 * button that moves the item to the next stage, and its accessible name says
 * both where it is and where it goes.
 */
export function PdcaBall({ stage, onMoveOn }: { stage: Stage; onMoveOn?: () => void }) {
  const { t } = useTranslation();
  const name = t(`pdca.${stage}`);
  const next = nextStage(stage);
  const content = (
    <>
      <PdcaSymbol stage={stage} />
      <span>{name}</span>
    </>
  );

  if (!onMoveOn || !next) {
    return <span className={styles.ball}>{content}</span>;
  }
  return (
    <button
      type="button"
      className={`${styles.ball} ${styles.ballButton}`}
      aria-label={t('items.moveStageLabel', { stage: name, next: t(`pdca.${next}`) })}
      onClick={onMoveOn}
    >
      {content}
    </button>
  );
}
