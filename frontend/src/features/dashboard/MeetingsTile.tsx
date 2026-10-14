import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { DashboardMeeting } from '../../api/dashboard';
import { useFormat } from '../../i18n/format';
import { describeFailure } from '../../i18n/apiErrors';
import {
  ArrowRightIcon,
  CalendarIcon,
  ClipboardIcon,
  PlayIcon,
  PulseIcon,
} from '../../components/icons';
import { useHere } from '../../components/origin';
import { useOpenMeeting } from '../meetings/useMeetings';
import controls from '../../styles/controls.module.css';
import { DASHBOARD_QUERY_KEY } from './useDashboardSummary';
import { TILE_LIMIT } from './tileLimit';
import styles from './MeetingsTile.module.css';

/** Where each action lands on the board, given the meeting's id. */
const ADDRESSES = {
  prepare: (teamId: string, meetingId: string) =>
    `/teams/${encodeURIComponent(teamId)}?meeting=${encodeURIComponent(meetingId)}&mode=record`,
  fillPulse: (teamId: string, meetingId: string) =>
    `/teams/${encodeURIComponent(teamId)}?meeting=${encodeURIComponent(meetingId)}&view=pulse&mode=answer`,
  start: (teamId: string, meetingId: string) =>
    `/teams/${encodeURIComponent(teamId)}?meeting=${encodeURIComponent(meetingId)}`,
} as const;

type Action = keyof typeof ADDRESSES;

/**
 * The viewer's current and upcoming board meetings, soonest first, each with
 * what is left to do for it and the ways into the board to do it. Only the
 * soonest few are shown; the rest are on My meetings.
 */
export function MeetingsTile({ meetings }: { meetings: DashboardMeeting[] }) {
  const { t } = useTranslation();
  const here = useHere('dashboard');

  return (
    <section className={styles.tile} aria-labelledby="my-meetings-heading">
      <h2 id="my-meetings-heading" className={styles.heading}>
        <CalendarIcon />
        {t('meetingsTile.heading')}
      </h2>

      {meetings.length === 0 ? (
        <p className={styles.empty}>{t('meetingsTile.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {meetings.slice(0, TILE_LIMIT).map((meeting) => (
            <MeetingRow
              // A team has one meeting per date at most. Keyed by date rather
              // than id, a proposed row that turns out to have been opened
              // meanwhile stays the same row, and keeps saying why.
              key={`${meeting.team_id}-${meeting.date}`}
              meeting={meeting}
            />
          ))}
        </ul>
      )}

      {meetings.length > TILE_LIMIT && (
        <Link
          to="/my-meetings"
          state={here}
          className={[controls.link, styles.more].join(' ')}
          aria-label={t('dashboard.moreMeetings')}
        >
          {t('dashboard.more')}
          <ArrowRightIcon />
        </Link>
      )}
    </section>
  );
}

/**
 * One meeting. A row only proposed by the schedule is opened first, through
 * the same request the meetings page uses, so that the values and answers the
 * action leads to have a meeting to belong to. If that is refused - someone
 * opened the date meanwhile - the row says why and the list is refetched,
 * which then shows the opened meeting in its place.
 */
function MeetingRow({ meeting }: { meeting: DashboardMeeting }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const here = useHere('dashboard');
  const queryClient = useQueryClient();
  const open = useOpenMeeting(meeting.team_id);
  // An ISO time of day may carry seconds; meetings are to the minute.
  const time = meeting.start_time.slice(0, 5);
  const proposed = meeting.meeting_id === null;

  const act = async (action: Action) => {
    let meetingId = meeting.meeting_id;
    if (meetingId === null) {
      try {
        meetingId = (await open.mutateAsync({ date: meeting.date, time })).id;
      } catch {
        await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
        return;
      }
    }
    void navigate(ADDRESSES[action](meeting.team_id, meetingId), { state: here });
  };

  // Start meeting is today's row's default; no other row has one.
  const button = (action: Action, icon: ReactNode, caption: string) => (
    <button
      type="button"
      className={action === 'start' ? controls.default : controls.button}
      disabled={open.isPending}
      onClick={() => void act(action)}
    >
      {icon}
      {caption}
    </button>
  );

  return (
    <li className={styles.row}>
      <div className={styles.when}>
        <span className={styles.team}>{meeting.team}</span>
        <span className={styles.date}>
          {format.meetingDate(meeting.date)} · {format.meetingTime(time)}
        </span>
        {meeting.today && <span className={styles.today}>{t('meetingsTile.today')}</span>}
        {proposed && <span className={styles.proposed}>{t('meetingsTile.notOpened')}</span>}
      </div>

      <ul className={styles.facts}>
        {!proposed && (
          <li>
            {meeting.host
              ? t('meetingsTile.host', { email: meeting.host })
              : t('meetingsTile.noHost')}
          </li>
        )}
        {meeting.recorded !== null && meeting.total !== null && (
          <li>
            {t('meetingsTile.recorded', {
              recorded: format.number(meeting.recorded),
              total: format.number(meeting.total),
            })}
          </li>
        )}
        <li className={meeting.pulse_answered ? styles.done : styles.pending}>
          {meeting.pulse_answered
            ? t('meetingsTile.pulseAnswered')
            : t('meetingsTile.pulseNotAnswered')}
        </li>
      </ul>

      <div className={styles.actions}>
        {button('prepare', <ClipboardIcon />, t('meetingsTile.prepare'))}
        {button('fillPulse', <PulseIcon />, t('meetingsTile.fillPulse'))}
        {meeting.today && button('start', <PlayIcon />, t('meetingsTile.start'))}
      </div>

      {open.isPending && <p className={styles.status}>{t('meetingsTile.opening')}</p>}
      {open.isError && (
        <p className={styles.error} role="alert">
          {describeFailure(t, open.error)}
        </p>
      )}
    </li>
  );
}
