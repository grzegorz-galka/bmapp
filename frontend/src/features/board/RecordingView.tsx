import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COLOURS,
  type BoardMetric,
  type Colour,
  type MeetingBoard,
  type MetricValueWrite,
} from '../../api/metrics';
import { describeFailure } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { describeThreshold, StatusBadge } from '../metrics/display';
import { useRecordValue } from './useBoard';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import styles from './board.module.css';

/**
 * - `edit`: inside the editing window, by someone on the team.
 * - `correct`: a frozen meeting, by an administrator; every save carries a reason.
 * - `readOnly`: everyone else, who sees the values and no fields.
 */
export type RecordingMode = 'edit' | 'correct' | 'readOnly';

/**
 * Every active metric at one meeting, with fields for its number, comment and
 * a colour set by hand. Each row saves itself when a field loses focus, as the
 * team's previous tool did; there is no form-wide submit.
 */
export function RecordingView({
  teamId,
  board,
  mode,
}: {
  teamId: string;
  board: MeetingBoard;
  mode: RecordingMode;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const [reason, setReason] = useState('');
  const { recorded, total, missing } = board.completeness;

  return (
    <section aria-labelledby="recording-heading" className={styles.recording}>
      <h2 id="recording-heading" className={meetingStyles.subheading}>
        {t('recording.heading', { date: format.meetingDate(board.meeting.date) })}
      </h2>
      <p className={styles.completeness}>{t('recording.completeness', { recorded, total })}</p>
      {missing.length === 0 ? (
        <p className={styles.muted}>{t('recording.allRecorded')}</p>
      ) : (
        <p className={styles.muted}>
          {t('recording.missing')}:{' '}
          {missing
            .map((metric) =>
              metric.owner
                ? t('recording.missingOwner', { name: metric.name, email: metric.owner.email })
                : metric.name,
            )
            .join(', ')}
        </p>
      )}
      {mode === 'readOnly' && !board.editable && <p>{t('recording.readOnly')}</p>}
      {mode === 'correct' && (
        <div className={`${teamStyles.field} ${styles.reason}`}>
          <label className={teamStyles.label} htmlFor="correction-reason">
            {t('recording.reasonLabel')}
          </label>
          <input
            id="correction-reason"
            className={teamStyles.input}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-describedby="correction-reason-hint"
          />
          <p id="correction-reason-hint" className={styles.muted}>
            {t('recording.reasonHint')}
          </p>
        </div>
      )}
      <ul className={teamStyles.list}>
        {board.metrics.map((entry) => (
          <RecordingRow
            key={entry.metric.id}
            teamId={teamId}
            meetingId={board.meeting.id}
            entry={entry}
            mode={mode}
            reason={reason}
          />
        ))}
      </ul>
    </section>
  );
}

type RowState = 'idle' | 'saving' | 'saved' | 'notANumber' | 'failed';

function RecordingRow({
  teamId,
  meetingId,
  entry,
  mode,
  reason,
}: {
  teamId: string;
  meetingId: string;
  entry: BoardMetric;
  mode: RecordingMode;
  reason: string;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const record = useRecordValue(teamId, meetingId);
  const { metric } = entry;
  // Seeded once: what the member is typing is never overwritten by a refetch.
  const [value, setValue] = useState(() => format.editableDecimal(entry.value));
  const [comment, setComment] = useState(entry.comment ?? '');
  const [colour, setColour] = useState<Colour | ''>(entry.manual_status ?? '');
  const [state, setState] = useState<RowState>('idle');
  const show = (number: string | null) => format.metricValue(number, metric.decimals, metric.unit);
  const id = (field: string) => `value-${metric.id}-${field}`;

  function save() {
    const number = value.trim() === '' ? null : format.parseDecimal(value);
    if (number === null && value.trim() !== '') {
      setState('notANumber');
      return;
    }
    const write: MetricValueWrite = {
      value: number,
      manual_status: colour || null,
      comment: comment.trim() || null,
      ...(mode === 'correct' ? { reason } : {}),
    };
    const unchanged =
      write.value === entry.value &&
      write.manual_status === entry.manual_status &&
      write.comment === entry.comment;
    if (unchanged) return;
    setState('saving');
    record.mutate(
      { metricId: metric.id, write },
      { onSuccess: () => setState('saved'), onError: () => setState('failed') },
    );
  }

  const thresholdText = describeThreshold(t, format, metric, entry.threshold);
  const previous = t('recording.previous', { value: show(entry.previous) });

  if (mode === 'readOnly') {
    return (
      <li className={teamStyles.item}>
        <span className={teamStyles.itemMain}>
          <span className={teamStyles.itemName}>{metric.name}</span>
          <span className={teamStyles.itemMeta}>
            {thresholdText} · {previous}
          </span>
        </span>
        <span className={styles.readValue}>
          {show(entry.value)} <StatusBadge status={entry.status} setByHand={entry.set_by_hand} />
        </span>
        {entry.comment && <p className={styles.rowComment}>{entry.comment}</p>}
      </li>
    );
  }

  const message =
    state === 'notANumber'
      ? t('recording.notANumber', { example: format.metricValue('95.3', 1, '') })
      : state === 'failed'
        ? describeFailure(t, record.error)
        : undefined;

  return (
    <li className={teamStyles.item}>
      <span className={teamStyles.itemMain}>
        <span className={teamStyles.itemName}>{metric.name}</span>
        <span className={teamStyles.itemMeta}>
          {thresholdText} · {previous}
        </span>
      </span>
      <StatusBadge status={entry.status} setByHand={entry.set_by_hand} />
      <span className={styles.recordFields}>
        <span className={`${teamStyles.field} ${styles.valueField}`}>
          <label className={teamStyles.label} htmlFor={id('number')}>
            {t('recording.value')}
          </label>
          <input
            id={id('number')}
            aria-label={t('recording.valueLabel', { name: metric.name })}
            inputMode="decimal"
            size={10}
            className={teamStyles.input}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={save}
            aria-invalid={state === 'notANumber'}
          />
        </span>
        {metric.unit && <span className={styles.unit}>{metric.unit}</span>}
        <fieldset
          className={styles.statusField}
          // Saved when focus leaves the toggle, as the other fields save on blur.
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) save();
          }}
        >
          <legend className={teamStyles.label}>{t('recording.status')}</legend>
          <span
            role="radiogroup"
            aria-label={t('recording.statusLabel', { name: metric.name })}
            className={styles.statusToggle}
          >
            {(['', ...COLOURS] as const).map((option) => (
              <label key={option || 'automatic'} className={styles.statusOption}>
                <input
                  type="radio"
                  name={id('status')}
                  value={option}
                  checked={colour === option}
                  onChange={() => setColour(option)}
                />
                <span>{option ? t(`status.${option}`) : t('recording.automatic')}</span>
              </label>
            ))}
          </span>
        </fieldset>
        <span className={`${teamStyles.field} ${styles.commentField}`}>
          <label className={teamStyles.label} htmlFor={id('comment')}>
            {t('recording.comment')}
          </label>
          <input
            id={id('comment')}
            aria-label={t('recording.commentLabel', { name: metric.name })}
            className={teamStyles.input}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            onBlur={save}
          />
        </span>
      </span>
      <span className={styles.rowState} aria-live="polite">
        {state === 'saving' && t('recording.saving')}
        {state === 'saved' && t('recording.saved')}
      </span>
      {message && (
        <p role="alert" className={teamStyles.itemError}>
          {message}
        </p>
      )}
    </li>
  );
}
