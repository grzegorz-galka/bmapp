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
 * Every active metric at one meeting, one table row each, with fields for its
 * number, comment and a colour set by hand. A frozen meeting uses the same
 * columns, so switching between recording and reading moves nothing. Each row saves itself when a field loses focus, as the
 * team's previous tool did; there is no form-wide submit.
 */
export function RecordingView({
  teamId,
  board,
  mode,
  hideNames = false,
}: {
  teamId: string;
  board: MeetingBoard;
  mode: RecordingMode;
  /** Names hidden for screen sharing: missing metrics are listed without owners. */
  hideNames?: boolean;
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
              metric.owner && !hideNames
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
      <table className={styles.recordTable}>
        <thead>
          <tr>
            <th scope="col">{t('recording.metricColumn')}</th>
            <th scope="col">{t('recording.value')}</th>
            <th scope="col">{t('recording.status')}</th>
            <th scope="col">{t('recording.comment')}</th>
            <th scope="col">
              <span className="visually-hidden">{t('recording.stateColumn')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
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
        </tbody>
      </table>
    </section>
  );
}

/**
 * Each choice of the status list in its own colour, and the closed list in the
 * chosen one; the option's name and the badge beside it say it in words too.
 */
const COLOUR_CLASS: Record<Colour | '', string | undefined> = {
  '': styles.statusAutomatic,
  green: styles.statusGreen,
  amber: styles.statusAmber,
  red: styles.statusRed,
};

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
  // The column captions, shown before each cell when a narrow screen stacks the row.
  const captions = {
    metric: t('recording.metricColumn'),
    value: t('recording.value'),
    status: t('recording.status'),
    comment: t('recording.comment'),
    state: t('recording.stateColumn'),
  };
  const metricCell = (
    <th scope="row" data-label={captions.metric} className={styles.metricCell}>
      <span className={teamStyles.itemMain}>
        <span className={teamStyles.itemName}>{metric.name}</span>
        {metric.unit && (
          <span className={teamStyles.itemMeta}>{t('recording.unit', { unit: metric.unit })}</span>
        )}
        <span className={teamStyles.itemMeta}>
          {thresholdText} · {previous}
        </span>
      </span>
    </th>
  );

  if (mode === 'readOnly') {
    return (
      <tr>
        {metricCell}
        <td data-label={captions.value} className={styles.readValue}>
          {show(entry.value)}
        </td>
        <td data-label={captions.status}>
          <StatusBadge status={entry.status} setByHand={entry.set_by_hand} />
        </td>
        <td data-label={captions.comment} className={styles.rowComment}>
          {entry.comment}
        </td>
        <td data-label={captions.state} />
      </tr>
    );
  }

  const message =
    state === 'notANumber'
      ? t('recording.notANumber', { example: format.metricValue('95.3', 1, '') })
      : state === 'failed'
        ? describeFailure(t, record.error)
        : undefined;

  return (
    <tr>
      {metricCell}
      <td data-label={captions.value}>
        <input
          id={id('number')}
          aria-label={t('recording.valueLabel', { name: metric.name })}
          inputMode="decimal"
          size={10}
          className={`${teamStyles.input} ${styles.valueInput}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={save}
          aria-invalid={state === 'notANumber'}
        />
      </td>
      <td data-label={captions.status}>
        <div className={styles.statusField}>
          <select
            id={id('status')}
            aria-label={t('recording.statusLabel', { name: metric.name })}
            className={`${teamStyles.input} ${styles.statusSelect} ${COLOUR_CLASS[colour] ?? ''}`}
            value={colour}
            onChange={(event) => setColour(event.target.value as Colour | '')}
            onBlur={save}
          >
            {(['', ...COLOURS] as const).map((option) => (
              <option key={option || 'automatic'} value={option} className={COLOUR_CLASS[option]}>
                {option ? t(`status.${option}`) : t('recording.automatic')}
              </option>
            ))}
          </select>
          <StatusBadge status={entry.status} setByHand={entry.set_by_hand} />
        </div>
      </td>
      <td data-label={captions.comment}>
        <input
          id={id('comment')}
          aria-label={t('recording.commentLabel', { name: metric.name })}
          className={teamStyles.input}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          onBlur={save}
        />
      </td>
      <td data-label={captions.state} className={styles.rowState}>
        <span aria-live="polite">
          {state === 'saving' && t('recording.saving')}
          {state === 'saved' && t('recording.saved')}
        </span>
        {message && (
          <p role="alert" className={teamStyles.itemError}>
            {message}
          </p>
        )}
      </td>
    </tr>
  );
}
