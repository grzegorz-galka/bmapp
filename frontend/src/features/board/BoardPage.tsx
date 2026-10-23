import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import type { Meeting } from '../../api/meetings';
import type { BoardMetric, MeetingBoard, MetricDefinition } from '../../api/metrics';
import { describeFailure, isNotFound } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { BackLink } from '../../components/BackLink';
import { CalendarIcon, SettingsIcon } from '../../components/icons';
import { useHere } from '../../components/origin';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdmin } from '../auth/useCurrentUser';
import { useMeetings } from '../meetings/useMeetings';
import { describeThreshold, GlobalMark, StatusBadge } from '../metrics/display';
import { useMetrics } from '../metrics/useMetrics';
import { teamAuthority } from '../teams/teamAuthority';
import { useTeam } from '../teams/useTeams';
import { MetricDetail } from './MetricDetail';
import { organizationToday } from './organizationDate';
import { ReadinessPanel, showsReadiness } from './ReadinessPanel';
import { RecordingView, type RecordingMode } from './RecordingView';
import { Sparkline } from './Sparkline';
import { useBoard } from './useBoard';
import { PulseView } from './pulse/PulseView';
import { usePulse } from './pulse/usePulse';
import { ArchivedView } from './items/ArchivedView';
import { ItemLists } from './items/ItemLists';
import controls from '../../styles/controls.module.css';
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

type BoardView = 'metrics' | 'pulse' | 'archived';

function viewOf(param: string | null): BoardView {
  return param === 'pulse' || param === 'archived' ? param : 'metrics';
}

/**
 * A team's board: one meeting's metrics as tiles beside the team's problems
 * and tasks, and the way between its meetings, its pulse check and its archive.
 */
export function BoardPage() {
  const { teamId = '' } = useParams();
  const { t } = useTranslation();
  const format = useFormat();
  const isAdmin = useIsAdmin();
  const { email: signedInEmail } = useAuth();
  const team = useTeam(teamId);
  const meetings = useMeetings(teamId);
  const [search, setSearchParams] = useSearchParams();
  // The board's own views are history entries; each carries the state the
  // board was opened with on, so switching views keeps its back link (D3).
  const location = useLocation();
  const setSearch = (next: Parameters<typeof setSearchParams>[0]) =>
    setSearchParams(next, { state: location.state });
  const here = useHere('board');
  const [today] = useState(() => organizationToday());
  const [detail, setDetail] = useState<MetricDefinition | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  // About the screen right now: kept while the board stays open, across its
  // views and meetings, and never in the address or in storage (D6).
  const [hideNames, setHideNames] = useState(false);

  const all = meetings.data?.meetings ?? [];
  const shown =
    all.find((meeting) => meeting.id === search.get('meeting')) ?? defaultMeeting(all, today);
  const view = viewOf(search.get('view'));
  // The open toggle lives in the address, so a reload or a shared link keeps it.
  // A mode the view does not have is ignored; whether it can be used is
  // decided where the view is drawn.
  const mode = search.get('mode');
  const board = useBoard(teamId, shown?.id);
  // What an item may be linked to; independent of the meeting shown.
  const boardMetrics = useMetrics(teamId);
  // Fetched whichever view is open: the switch shows how many have answered.
  const pulse = usePulse(teamId, shown?.id);
  const teamPath = `/teams/${encodeURIComponent(teamId)}`;

  const back = (
    <BackLink className={teamStyles.back} fallback={{ to: '/teams', label: t('board.back') }} />
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
  const mayConfigure = teamAuthority(team.data, signedInEmail, isAdmin).configure;
  const mayRecord = isAdmin || viewer !== undefined;
  // Membership alone: an administrator does not answer on a team's behalf.
  const mayAnswer = viewer !== undefined;
  // Problems and tasks are meeting data: anyone on the team, or an administrator.
  const mayKeepItems = mayRecord;
  // What an item may be linked to: the metrics on the board, retired ones aside.
  // Read from the board's own list, so a team that has opened no meeting can link one too.
  const linkable = (boardMetrics.data ?? [])
    .filter((metric) => !metric.retired)
    .map((metric) => ({ id: metric.id, name: metric.name }));

  const lists = (
    <ItemLists
      teamId={teamId}
      meetingId={shown?.id}
      members={team.data.members}
      metrics={linkable}
      mayChange={mayKeepItems}
      hideNames={hideNames}
    />
  );

  const hideSwitch = (
    <label className={styles.check}>
      <input
        type="checkbox"
        checked={hideNames}
        onChange={(event) => setHideNames(event.target.checked)}
      />
      {t('pulse.hideNames')}
    </label>
  );

  /**
   * The address keeps both the meeting and the view, so a reload lands on the
   * same one. The recording view stays open from meeting to meeting, as it
   * always has; any other mode belongs to the view and meeting it was set on.
   */
  function show(meeting: Meeting, nextView: BoardView = view) {
    const next: Record<string, string> = { meeting: meeting.id };
    if (nextView !== 'metrics') next.view = nextView;
    if (nextView === 'metrics' && view === 'metrics' && mode === 'record') next.mode = mode;
    setSearch(next);
  }

  /** Opens or leaves a view's mode, keeping the meeting shown in the address. */
  function setMode(meeting: Meeting, nextMode: 'record' | 'answer' | null) {
    setSearch((current) => {
      const next = new URLSearchParams(current);
      next.set('meeting', meeting.id);
      if (nextMode) next.set('mode', nextMode);
      else next.delete('mode');
      return next;
    });
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
          <Link className={controls.link} to={`${teamPath}/meetings`} state={here}>
            <CalendarIcon />
            {t('board.meetingsLink')}
          </Link>
          <Link className={controls.link} to={`${teamPath}/metrics`} state={here}>
            <SettingsIcon />
            {t('board.settingsLink')}
          </Link>
        </nav>
      </header>

      {!shown ? (
        <>
          {/* No meeting, so no pulse check; items closed meanwhile still have an archive. */}
          <div className={styles.boardBar}>{hideSwitch}</div>
          <div
            role="group"
            aria-label={t('pulse.viewSwitchLabel')}
            className={`${controls.segmented} ${styles.viewSwitch}`}
          >
            <button type="button" aria-pressed={view !== 'archived'} onClick={() => setSearch({})}>
              {t('pulse.metricsView')}
            </button>
            <button
              type="button"
              aria-pressed={view === 'archived'}
              onClick={() => setSearch({ view: 'archived' })}
            >
              {t('archive.view')}
            </button>
          </div>
          {view === 'archived' ? (
            <ArchivedView teamId={teamId} hideNames={hideNames} />
          ) : (
            <div className={styles.layout}>
              <p className={styles.layoutMain}>
                {t('board.noMeetings')}{' '}
                <Link to={`${teamPath}/meetings`} state={here}>
                  {t('board.openMeetingLink')}
                </Link>
              </p>
              {lists}
            </div>
          )}
        </>
      ) : (
        <>
          <div className={styles.boardBar}>
            <div role="group" aria-label={t('board.navigatorLabel')} className={styles.navigator}>
              <button
                type="button"
                className={controls.button}
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
                className={controls.button}
                disabled={index >= all.length - 1}
                onClick={() => all[index + 1] && go(all[index + 1]!)}
              >
                {t('board.nextMeeting')} →
              </button>
            </div>
            {hideSwitch}
          </div>

          <div
            role="group"
            aria-label={t('pulse.viewSwitchLabel')}
            className={`${controls.segmented} ${styles.viewSwitch}`}
          >
            <button
              type="button"
              aria-pressed={view === 'metrics'}
              onClick={() => show(shown, 'metrics')}
            >
              {board.data
                ? t('pulse.metricsCount', {
                    recorded: board.data.completeness.recorded,
                    total: board.data.completeness.total,
                  })
                : t('pulse.metricsView')}
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
            <button
              type="button"
              aria-pressed={view === 'archived'}
              onClick={() => show(shown, 'archived')}
            >
              {t('archive.view')}
            </button>
          </div>

          {view === 'pulse' ? (
            <PulseView
              key={shown.id}
              teamId={teamId}
              meeting={shown}
              mayAnswer={mayAnswer}
              answering={mode === 'answer'}
              onAnswering={(answering) => setMode(shown, answering ? 'answer' : null)}
              hideNames={hideNames}
            />
          ) : view === 'archived' ? (
            <ArchivedView teamId={teamId} hideNames={hideNames} />
          ) : (
            <div className={styles.layout}>
              <div className={styles.layoutMain}>
                {board.isPending ? (
                  <p>{t('board.loading')}</p>
                ) : board.isError ? (
                  <p role="alert">{describeFailure(t, board.error)}</p>
                ) : (
                  <>
                    {showsReadiness(board.data, today) && (
                      // Keyed so another meeting starts collapsed, as a view switch does.
                      <ReadinessPanel
                        key={board.data.meeting.id}
                        board={board.data}
                        pulse={pulse.data}
                        hideNames={hideNames}
                      />
                    )}
                    <BoardBody
                      teamId={teamId}
                      board={board.data}
                      mayConfigure={mayConfigure}
                      mayRecord={mayRecord}
                      isAdmin={isAdmin}
                      listing={mode === 'record'}
                      onListing={(listing) => setMode(shown, listing ? 'record' : null)}
                      onDetail={setDetail}
                      hideNames={hideNames}
                    />
                  </>
                )}
              </div>
              {lists}
            </div>
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
  hideNames,
}: {
  teamId: string;
  board: MeetingBoard;
  mayConfigure: boolean;
  mayRecord: boolean;
  isAdmin: boolean;
  listing: boolean;
  onListing: (listing: boolean) => void;
  onDetail: (metric: MetricDefinition) => void;
  hideNames: boolean;
}) {
  const { t } = useTranslation();
  const here = useHere('board');

  if (board.metrics.length === 0) {
    return (
      <p>
        {t('board.noMetrics')}{' '}
        {mayConfigure && (
          <Link to={`/teams/${encodeURIComponent(teamId)}/metrics`} state={here}>
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
          className={controls.button}
          aria-pressed={listing}
          onClick={() => onListing(!listing)}
        >
          {listing ? t('board.showTiles') : t(caption[mode])}
        </button>
      </p>
      {listing ? (
        <RecordingView
          key={board.meeting.id}
          teamId={teamId}
          board={board}
          mode={mode}
          hideNames={hideNames}
        />
      ) : (
        <Tiles board={board} onDetail={onDetail} />
      )}
    </>
  );
}

/**
 * The metrics under the board's groups, in the board's order, the ungrouped
 * ones last. A group with no metric has nothing to show here and is left out;
 * the settings page is where an empty group is seen.
 */
function Tiles({
  board,
  onDetail,
}: {
  board: MeetingBoard;
  onDetail: (metric: MetricDefinition) => void;
}) {
  const { t } = useTranslation();
  const groups = new Map<string, { label: string; order: number; entries: BoardMetric[] }>();
  for (const entry of board.metrics) {
    const { group } = entry.metric;
    const key = group?.id ?? '';
    const section = groups.get(key) ?? {
      label: group?.name ?? t('board.noGroup'),
      order: group?.position ?? Number.POSITIVE_INFINITY,
      entries: [],
    };
    groups.set(key, { ...section, entries: [...section.entries, entry] });
  }
  const sections = [...groups]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, section]) => ({
      key,
      ...section,
      entries: [...section.entries].sort((a, b) => a.metric.position - b.metric.position),
    }));

  return (
    <>
      {sections.map(({ key, label, entries }) => (
        <section key={key} className={styles.group} aria-label={label}>
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
        className={controls.button}
        aria-label={t('board.detailsLabel', { name: metric.name })}
        onClick={() => onDetail(metric)}
      >
        {t('board.details')}
      </button>
    </li>
  );
}
