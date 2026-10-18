import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import type { MeetingBoard } from '../../api/metrics';
import type { PulseResults } from '../../api/pulse';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import styles from './board.module.css';

/** The address fragment that opens the board with the panel in view. */
export const READINESS_ANCHOR = 'readiness';

/**
 * The addresses of the people owing data that the viewer may see: the
 * missing metrics' owners and, when the server names them, the members who
 * have not answered. Each once, lower-cased, in email order. For a member this
 * is the same set the server counts as `completeness.owing` (design D1).
 */
export function owingAddresses(board: MeetingBoard, pulse: PulseResults | undefined): string[] {
  const emails = new Set<string>();
  for (const metric of board.completeness.missing) {
    if (metric.owner) emails.add(metric.owner.email.toLowerCase());
  }
  for (const member of pulse?.missing ?? []) emails.add(member.email.toLowerCase());
  return [...emails].sort();
}

/** Whether a meeting gets the panel: it still takes values and has not passed. */
export function showsReadiness(board: MeetingBoard, today: string): boolean {
  return board.editable && board.meeting.date >= today;
}

type Copy = { state: 'idle' } | { state: 'copied'; count: number } | { state: 'failed' };

/**
 * What is still missing for a coming meeting and who owes it, for the host to
 * chase. Built from the board and the pulse results the page already loads,
 * so it follows a recorded value without a reload. With names hidden it
 * names no one and offers nothing to copy.
 */
export function ReadinessPanel({
  board,
  pulse,
  hideNames,
}: {
  board: MeetingBoard;
  pulse: PulseResults | undefined;
  hideNames: boolean;
}) {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const panel = useRef<HTMLDetailsElement>(null);
  const scrolledTo = useRef<string | null>(null);
  const [copy, setCopy] = useState<Copy>({ state: 'idle' });
  const named = hash.slice(1);

  // Once per fragment, as ItemLists does, so a refetch does not pull the reader back.
  useEffect(() => {
    if (named !== READINESS_ANCHOR) {
      scrolledTo.current = null;
      return;
    }
    if (scrolledTo.current === named) return;
    scrolledTo.current = named;
    panel.current?.scrollIntoView({ block: 'start' });
  }, [named]);

  const { missing, owing } = board.completeness;
  const missingCount = pulse?.missing_count ?? 0;
  const complete = missing.length === 0 && pulse !== undefined && missingCount === 0;
  const addresses = owingAddresses(board, pulse);
  const namesWithheld = pulse !== undefined && pulse.missing === null;
  const list = addresses.join('; ');

  async function copyAddresses() {
    try {
      await navigator.clipboard.writeText(list);
      setCopy({ state: 'copied', count: addresses.length });
    } catch {
      setCopy({ state: 'failed' });
    }
  }

  return (
    <details
      ref={panel}
      id={READINESS_ANCHOR}
      className={styles.readiness}
      open
      aria-labelledby="readiness-heading"
    >
      <summary className={styles.readinessSummary}>
        <h2 id="readiness-heading" className={styles.readinessHeading}>
          {t('readiness.heading')}
        </h2>
      </summary>
      {complete ? (
        <p>{t('readiness.complete')}</p>
      ) : (
        <>
          <p className={styles.readinessOwing}>{t('readiness.owing', { count: owing })}</p>
          <div className={styles.readinessColumns}>
            <section aria-labelledby="readiness-metrics">
              <h3 id="readiness-metrics" className={styles.readinessSubheading}>
                {t('readiness.metricsHeading')}
              </h3>
              {missing.length === 0 ? (
                <p className={styles.muted}>{t('readiness.allRecorded')}</p>
              ) : (
                <ul className={styles.readinessList}>
                  {missing.map((metric) => (
                    <li key={metric.metric_id}>
                      {metric.name}
                      {!hideNames && (
                        <>
                          {' – '}
                          <span className={styles.muted}>
                            {metric.owner?.email ?? t('readiness.noOwner')}
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="readiness-pulse">
              <h3 id="readiness-pulse" className={styles.readinessSubheading}>
                {t('readiness.pulseHeading')}
              </h3>
              {pulse === undefined ? (
                <p className={styles.muted}>{t('readiness.pulseLoading')}</p>
              ) : missingCount === 0 ? (
                <p className={styles.muted}>{t('readiness.allAnswered')}</p>
              ) : hideNames || pulse.missing === null ? (
                <p>{t('readiness.unanswered', { count: missingCount })}</p>
              ) : (
                <ul className={styles.readinessList}>
                  {pulse.missing.map((member) => (
                    <li key={member.employee_id}>{member.email}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          {!hideNames && (
            <div className={styles.readinessCopy}>
              {namesWithheld && <p className={styles.muted}>{t('readiness.ownersOnly')}</p>}
              {addresses.length > 0 && (
                <button type="button" className={controls.button} onClick={copyAddresses}>
                  {t('readiness.copy')}
                </button>
              )}
              <p role="status" aria-live="polite" className={styles.muted}>
                {copy.state === 'copied'
                  ? t('readiness.copied', { count: copy.count })
                  : copy.state === 'failed'
                    ? t('readiness.copyFailed')
                    : ''}
              </p>
              {copy.state === 'failed' && <AddressField value={list} />}
            </div>
          )}
        </>
      )}
    </details>
  );
}

/** The fallback when the clipboard is refused: the list, selected, to copy by hand. */
function AddressField({ value }: { value: string }) {
  const { t } = useTranslation();
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  return (
    <textarea
      ref={field}
      readOnly
      className={`${teamStyles.input} ${styles.readinessField}`}
      aria-label={t('readiness.addressesLabel')}
      value={value}
      rows={2}
    />
  );
}
