import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';
import type { Meeting } from '../../api/meetings';
import type { BoardMetric, MeetingBoard, MetricDefinition } from '../../api/metrics';
import { describeFailure, isNotFound } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdmin } from '../auth/useCurrentUser';
import { useMeetings } from '../meetings/useMeetings';
import { describeThreshold, GlobalMark, StatusBadge } from '../metrics/display';
import { useTeam } from '../teams/useTeams';
import { MetricDetail } from './MetricDetail';
import { organizationToday } from './organizationDate';
import { RecordingView, type RecordingMode } from './RecordingView';
import { Sparkline } from './Sparkline';
import { useBoard } from './useBoard';
import { PulseView } from './pulse/PulseView';
import { usePulse } from './pulse/usePulse';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import styles from './board.module.css';

/**
 * The meeting a board opens on: the first dated today or later - the one
 * being prepared or held - or else the latest.
 */
export function defaultMeeting(meetings: Meeting[], today: string): Meeting | undefined {
  return meetings.find((meeting) => meeting.date >= today) ?? meetings.at(-1);
}

/** A team's board: one meeting's metrics as tiles, and the way between its meetings. */
export function BoardPage() {
  const { teamId = '' } = useParams();
  const { t } = useTranslation();
  const format = useFormat();
  const isAdmin = useIsAdmin();
  const { email: signedInEmail } = useAuth();
  const team = useTeam(teamId);
  const meetings = useMeetings(teamId);
  const [search, setSearch] = useSearchParams();
  const [today] = useState(() => organizationToday());
  const [listing, setListing] = useState(false);
  const [detail, setDetail] = useState<MetricDefinition | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);

  const all = meetings.data?.meetings ?? [];
  const shown =
    all.find((meeting) => meeting.id === search.get('meeting')) ?? defaultMeeting(all, today);
  const view = search.get('view') === 'pulse' ? 'pulse' : 'metrics';
  const board = useBoard(teamId, shown?.id);
  // Fetched whichever view is open: the switch shows how many have answered.
  const pulse = usePulse(teamId, shown?.id);
  const teamPath = `/teams/${encodeURIComponent(teamId)}`;

  const back = (
    <Link className={teamStyles.back} to="/teams">
      {t('board.back')}
    </Link>
  );

  if (team.isPending || meetings.isPending) {
    return (
      <main className={styles.page}>
        {back}
        <p>{t('board.loading')}</p>
      </main>
    );
  }

  if (team.isError || meetings.isError) {
    return (
      <main className={styles.page}>
        {back}
        {isNotFound(team.error) || isNotFound(meetings.error) ? (
          <h1 className={teamStyles.heading}>{t('board.notFound')}</h1>
        ) : (
          <p role="alert">{t('board.loadFailed')}</p>
        )}
      </main>
    );
  }

  // As the API decides it. The server refuses regardless; offering only what
  // the viewer may use is a courtesy.
  const viewer = team.data.members.find((member) => member.email === signedInEmail);
  const mayConfigure = isAdmin || viewer?.is_leader === true;
  const mayRecord = isAdmin || viewer !== undefined;
  // Membership alone: an administrator does not answer on a team's behalf.
  const mayAnswer = viewer !== undefined;

  /** The address keeps both the meeting and the view, so a reload lands on the same one. */
  function show(meeting: Meeting, nextView: 'metrics' | 'pulse' = view) {
    setSearch(
      nextView === 'pulse' ? { meeting: meeting.id, view: 'pulse' } : { meeting: meeting.id },
    );
  }

  function go(meeting: Meeting) {
    show(meeting);
  }

  const index = shown ? all.indexOf(shown) : -1;

  return (
    <main className={styles.page}>
      {back}
      <header className={styles.header}>
        <h1 className={teamStyles.heading}>{t('board.heading', { name: team.data.name })}</h1>
        <nav className={teamStyles.actions} aria-label={t('nav.label')}>
          <Link className={teamStyles.button} to={`${teamPath}/meetings`}>
            {t('board.meetingsLink')}
          </Link>
          <Link className={teamStyles.button} to={`${teamPath}/metrics`}>
            {t('board.settingsLink')}
          </Link>
        </nav>
      </header>

      {!shown ? (
        <p>
          {t('board.noMeetings')}{' '}
          <Link to={`${teamPath}/meetings`}>{t('board.openMeetingLink')}</Link>
        </p>
      ) : (
        <>
          <div role="group" aria-label={t('board.navigatorLabel')} className={styles.navigator}>
            <button
              type="button"
              className={teamStyles.button}
              disabled={index <= 0}
              onClick={() => all[index - 1] && go(all[index - 1]!)}
            >
              ← {t('board.previousMeeting')}
            </button>
            <label className="visually-hidden" htmlFor="board-meeting">
              {t('board.meetingSelectLabel')}
            </label>
            <select
              id="board-meeting"
              className={`${meetingStyles.select} ${styles.meetingSelect}`}
              value={shown.id}
              onChange={(event) => {
                const next = all.find((meeting) => meeting.id === event.target.value);
                if (next) go(next);
              }}
            >
              {all.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {t('board.meetingOn', { date: format.meetingDate(meeting.date) })}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={teamStyles.button}
              disabled={index >= all.length - 1}
              onClick={() => all[index + 1] && go(all[index + 1]!)}
            >
              {t('board.nextMeeting')} →
            </button>
          </div>

          <div
            role="group"
            aria-label={t('pulse.viewSwitchLabel')}
            className={`${styles.segmented} ${styles.viewSwitch}`}
          >
            <button
              type="button"
              aria-pressed={view === 'metrics'}
              onClick={() => show(shown, 'metrics')}
            >
              {t('pulse.metricsView')}
            </button>
            <button
              type="button"
              aria-pressed={view === 'pulse'}
              onClick={() => show(shown, 'pulse')}
            >
              {pulse.data
                ? t('pulse.switchCount', {
                    answered: pulse.data.answered,
                    members: pulse.data.members,
                  })
                : t('pulse.view')}
            </button>
          </div>

          {view === 'pulse' ? (
            <PulseView key={shown.id} teamId={teamId} meeting={shown} mayAnswer={mayAnswer} />
          ) : board.isPending ? (
            <p>{t('board.loading')}</p>
          ) : board.isError ? (
            <p role="alert">{describeFailure(t, board.error)}</p>
          ) : (
            <BoardBody
              teamId={teamId}
              board={board.data}
              mayConfigure={mayConfigure}
              mayRecord={mayRecord}
              isAdmin={isAdmin}
              listing={listing}
              onListing={setListing}
              onDetail={setDetail}
            />
          )}
        </>
      )}
      {detail && <MetricDetail teamId={teamId} metric={detail} onClose={closeDetail} />}
    </main>
  );
}

function BoardBody({
  teamId,
  board,
  mayConfigure,
  mayRecord,
  isAdmin,
  listing,
  onListing,
  onDetail,
}: {
  teamId: string;
  board: MeetingBoard;
  mayConfigure: boolean;
  mayRecord: boolean;
  isAdmin: boolean;
  listing: boolean;
  onListing: (listing: boolean) => void;
  onDetail: (metric: MetricDefinition) => void;
}) {
  const { t } = useTranslation();

  if (board.metrics.length === 0) {
    return (
      <p>
        {t('board.noMetrics')}{' '}
        {mayConfigure && (
          <Link to={`/teams/${encodeURIComponent(teamId)}/metrics`}>
            {t('board.configureLink')}
          </Link>
        )}
      </p>
    );
  }

  // Recording is offered only to those who may record here: anyone on the
  // team inside the editing window, an administrator - as a correction -
  // outside it. Everyone else may still list the values.
  const mode: RecordingMode =
    board.editable && mayRecord ? 'edit' : !board.editable && isAdmin ? 'correct' : 'readOnly';
  const caption = {
    edit: 'board.record',
    correct: 'board.correct',
    readOnly: 'board.list',
  } as const;

  return (
    <>
      <p className={styles.toolbar}>
        {!board.editable && <span className={styles.muted}>{t('board.frozen')}</span>}
        <button
          type="button"
          className={listing ? teamStyles.button : teamStyles.primary}
          aria-pressed={listing}
          onClick={() => onListing(!listing)}
        >
          {listing ? t('board.showTiles') : t(caption[mode])}
        </button>
      </p>
      {listing ? (
        <RecordingView key={board.meeting.id} teamId={teamId} board={board} mode={mode} />
      ) : (
        <Tiles board={board} onDetail={onDetail} />
      )}
    </>
  );
}

/** The metrics under their group labels, in the board's own order. */
function Tiles({
  board,
  onDetail,
}: {
  board: MeetingBoard;
  onDetail: (metric: MetricDefinition) => void;
}) {
  const { t } = useTranslation();
  const groups = new Map<string, BoardMetric[]>();
  for (const entry of board.metrics) {
    const label = entry.metric.group_label ?? t('board.noGroup');
    groups.set(label, [...(groups.get(label) ?? []), entry]);
  }

  return (
    <>
      {[...groups].map(([label, entries]) => (
        <section key={label} className={styles.group} aria-label={label}>
          <h2 className={meetingStyles.subheading}>{label}</h2>
          <ul className={styles.tiles}>
            {entries.map((entry) => (
              <Tile key={entry.metric.id} entry={entry} onDetail={onDetail} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function Tile({
  entry,
  onDetail,
}: {
  entry: BoardMetric;
  onDetail: (metric: MetricDefinition) => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const { metric } = entry;
  const show = (value: string | null) => format.metricValue(value, metric.decimals, metric.unit);

  let change = t('board.noChange');
  if (entry.change !== null) {
    const signed = entry.change.startsWith('-') ? show(entry.change) : `+${show(entry.change)}`;
    const verdict =
      entry.improvement === null
        ? ''
        : ` · ${t(entry.improvement ? 'board.better' : 'board.worse')}`;
    change = `${t('board.change', { change: signed })}${verdict}`;
  }

  return (
    <li className={styles.tile} data-status={entry.status}>
      <h3 className={styles.tileName}>{metric.name}</h3>
      {metric.scope === 'global' && <GlobalMark />}
      <p className={styles.tileValue}>{show(entry.value)}</p>
      <StatusBadge status={entry.status} setByHand={entry.set_by_hand} />
      <p className={styles.tileMeta} data-improvement={String(entry.improvement)}>
        {change}
      </p>
      <p className={styles.tileMeta}>{describeThreshold(t, format, metric, entry.threshold)}</p>
      {entry.comment && <p className={styles.tileComment}>{entry.comment}</p>}
      <Sparkline name={metric.name} points={entry.sparkline} />
      <button
        type="button"
        className={teamStyles.button}
        aria-label={t('board.detailsLabel', { name: metric.name })}
        onClick={() => onDetail(metric)}
      >
        {t('board.details')}
      </button>
    </li>
  );
}
