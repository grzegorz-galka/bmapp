import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  COLOURS,
  type BoardMetric,
  type Colour,
  type DerivedValue,
  type MeetingBoard,
  type MetricValueWrite,
} from '../../api/metrics';
import { metricLabel } from '../../api/metricLabel';
import { describeFailure } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { describeThreshold, StatusBadge } from '../metrics/display';
import { notDerivedMessage } from './derivationMessages';
import { groupMetrics } from './groupMetrics';
import { useDeriveValue, useRecordValue } from './useBoard';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import styles from './board.module.css';

/**
 * - `edit`: inside the editing window, by someone on the team.
 * - `correct`: a frozen meeting, by an administrator; every save carries a reason.
 * - `readOnly`: everyone else, who sees the values and no fields.
 */
export type RecordingMode = 'edit' | 'correct' | 'readOnly';

/** Metric, value, status, comment and the row's state: what a full-width row spans. */
const COLUMNS = 5;

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
                ? t('recording.missingOwner', {
                    name: metricLabel(metric),
                    owner: metric.owner.display_name,
                  })
                : metricLabel(metric),
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
      {/* Its own sideways scroll: a long metric line never widens the page. */}
      <div className={styles.recordScroll}>
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
          {/* One body per group under the one header, so the columns line up
            across groups; a hidden metric still takes a value, so it is listed. */}
          {groupMetrics(board, { hidden: true }).map(({ key, group, entries }) => (
            <tbody key={key}>
              <tr className={styles.groupRow}>
                <th colSpan={COLUMNS} scope="rowgroup">
                  {group?.name ?? t('board.noGroup')}
                </th>
              </tr>
              {entries.map((entry) => (
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
          ))}
        </table>
      </div>
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

/** `notDerived`: "Derive" was refused, and the field was left as it was. */
type RowState = 'idle' | 'saving' | 'saved' | 'notANumber' | 'failed' | 'notDerived';

type Format = ReturnType<typeof useFormat>;

/** The numbers a derived value was worked out from, in one line. */
function derivedNote(t: TFunction, format: Format, derived: DerivedValue): string {
  if (derived.kind === 'delta') {
    const [source] = derived.sources;
    return t('recording.derivedNote_delta', {
      value: format.exactDecimal(source?.value ?? derived.value),
      date: source ? format.meetingDate(source.date) : '',
      previous: source?.previous ? format.exactDecimal(source.previous.value) : '',
      previousDate: source?.previous ? format.meetingDate(source.previous.date) : '',
    });
  }
  // A weighted mean names each number with the weight it was given.
  const weighted = derived.kind === 'weighted_mean';
  return t(`recording.derivedNote_${derived.kind}`, {
    n: derived.sources.length,
    values: derived.sources
      .map((source) => {
        const value = format.exactDecimal(source.value);
        return weighted && source.weight != null
          ? t('recording.weightedValue', { value, weight: format.exactDecimal(source.weight) })
          : value;
      })
      .join(' · '),
  });
}

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
  const derive = useDeriveValue(teamId, meetingId);
  const { metric } = entry;
  const [note, setNote] = useState<string | null>(null);
  // Seeded once: what the member is typing is never overwritten by a refetch.
  const [value, setValue] = useState(() => format.editableDecimal(entry.value));
  const [comment, setComment] = useState(entry.comment ?? '');
  const [colour, setColour] = useState<Colour | ''>(entry.manual_status ?? '');
  const [state, setState] = useState<RowState>('idle');
  const show = (number: string | null) => format.metricValue(number, metric.decimals, metric.unit);
  const id = (field: string) => `value-${metric.id}-${field}`;

  /** `text` is the field's content, passed when it was just set and not yet rendered. */
  function save(text: string = value) {
    const number = text.trim() === '' ? null : format.parseDecimal(text);
    if (number === null && text.trim() !== '') {
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

  /**
   * Fill the field with the derived number and save it as if typed: a number
   * derived but never saved would be the worst outcome. A refusal leaves the
   * field as it was.
   */
  function handleDerive() {
    derive.mutate(metric.id, {
      onSuccess: (derived) => {
        const text = format.editableDecimal(derived.value);
        setValue(text);
        setNote(derivedNote(t, format, derived));
        setState('idle');
        save(text);
      },
      onError: () => {
        setNote(null);
        setState('notDerived');
      },
    });
  }

  const label = metricLabel(metric);
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
        <span className={teamStyles.itemName}>{label}</span>
        {metric.unit && (
          <span className={teamStyles.itemMeta}>{t('recording.unit', { unit: metric.unit })}</span>
        )}
        <span className={`${teamStyles.itemMeta} ${styles.metricMeta}`}>
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
        : state === 'notDerived'
          ? notDerivedMessage(t, entry, derive.error)
          : undefined;

  // The row's message, on a line of its own as wide as the table, so a refusal
  // naming several sources does not stretch any one column (D4).
  const hasMessage = Boolean(note) || Boolean(message);

  return (
    <>
      <tr className={hasMessage ? styles.rowWithMessage : undefined}>
        {metricCell}
        <td data-label={captions.value}>
          <div className={styles.valueField}>
            <input
              id={id('number')}
              aria-label={t('recording.valueLabel', { name: label })}
              aria-describedby={hasMessage ? id('message') : undefined}
              inputMode="decimal"
              size={10}
              className={`${teamStyles.input} ${styles.valueInput}`}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                // Typed over, the number is no longer the one the note names.
                setNote(null);
              }}
              onBlur={() => save()}
              aria-invalid={state === 'notANumber'}
            />
            {metric.derivation && (
              <button
                type="button"
                className={`${controls.button} ${styles.deriveButton}`}
                aria-label={t('recording.deriveLabel', { name: label })}
                disabled={derive.isPending}
                onClick={handleDerive}
              >
                {derive.isPending ? t('recording.deriving') : t('recording.derive')}
              </button>
            )}
          </div>
        </td>
        <td data-label={captions.status}>
          <div className={styles.statusField}>
            <select
              id={id('status')}
              aria-label={t('recording.statusLabel', { name: label })}
              className={`${teamStyles.input} ${styles.statusSelect} ${COLOUR_CLASS[colour] ?? ''}`}
              value={colour}
              onChange={(event) => setColour(event.target.value as Colour | '')}
              onBlur={() => save()}
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
        <td data-label={captions.comment} className={styles.commentCell}>
          <input
            id={id('comment')}
            aria-label={t('recording.commentLabel', { name: label })}
            className={teamStyles.input}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            onBlur={() => save()}
          />
        </td>
        <td data-label={captions.state} className={styles.rowState}>
          <span aria-live="polite">
            {state === 'saving' && t('recording.saving')}
            {state === 'saved' && t('recording.saved')}
          </span>
        </td>
      </tr>
      {hasMessage && (
        <tr className={styles.messageRow}>
          <td id={id('message')} colSpan={COLUMNS}>
            {note && <p className={styles.derivedNote}>{note}</p>}
            {message && (
              <p role="alert" className={teamStyles.itemError}>
                {message}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
