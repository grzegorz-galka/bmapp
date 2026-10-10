import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { Meeting, MeetingSlot } from '../../api/meetings';
import type { Member, Schedule } from '../../api/teams';
import {
  describeFailure,
  describeFieldFailure,
  describeOtherFailure,
  isNotFound,
} from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdmin } from '../auth/useCurrentUser';
import { useTeam } from '../teams/useTeams';
import {
  useChangeMeeting,
  useDeleteMeeting,
  useMeetings,
  useOpenMeeting,
  useSetSchedule,
} from './useMeetings';
import teamStyles from '../teams/teams.module.css';
import styles from './meetings.module.css';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function TeamMeetingsPage() {
  const { teamId = '' } = useParams();
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { email: signedInEmail } = useAuth();
  const team = useTeam(teamId);
  const meetings = useMeetings(teamId);
  // Upcoming and past split at the moment the page was opened, by the
  // instant each meeting starts - read once, as the hub's countdown does.
  const [now] = useState(() => Date.now());

  const back = (
    <Link className={teamStyles.back} to="/teams">
      {t('meetings.back')}
    </Link>
  );

  if (team.isPending || meetings.isPending) {
    return (
      <main className={teamStyles.page}>
        {back}
        <p>{t('meetings.loading')}</p>
      </main>
    );
  }

  if (team.isError || meetings.isError) {
    return (
      <main className={teamStyles.page}>
        {back}
        {isNotFound(team.error) || isNotFound(meetings.error) ? (
          <h1 className={teamStyles.heading}>{t('meetings.notFound')}</h1>
        ) : (
          <p role="alert">{t('meetings.loadFailed')}</p>
        )}
      </main>
    );
  }

  // Decided the way the API decides it: the schedule is the leader's or an
  // administrator's, meetings belong to anyone on the team. The server
  // refuses regardless; hiding what someone cannot use is a courtesy.
  const members = team.data.members;
  const viewer = members.find((member) => member.email === signedInEmail);
  const mayConfigure = isAdmin || viewer?.is_leader === true;
  const mayManage = isAdmin || viewer !== undefined;

  const upcoming = meetings.data.meetings.filter((m) => Date.parse(m.starts_at) > now);
  const past = meetings.data.meetings.filter((m) => Date.parse(m.starts_at) <= now).reverse();

  return (
    <main className={teamStyles.page}>
      {back}
      <h1 className={teamStyles.heading}>{t('meetings.heading', { name: team.data.name })}</h1>

      <ScheduleSection
        teamId={teamId}
        schedule={meetings.data.schedule}
        mayConfigure={mayConfigure}
      />

      {mayManage && <PrepareMeeting teamId={teamId} proposed={meetings.data.proposed} />}

      <MeetingSection
        id="upcoming"
        heading={t('meetings.upcomingHeading')}
        empty={t('meetings.upcomingEmpty')}
        meetings={upcoming}
        teamId={teamId}
        members={members}
        mayManage={mayManage}
      />
      <MeetingSection
        id="past"
        heading={t('meetings.pastHeading')}
        empty={t('meetings.pastEmpty')}
        meetings={past}
        teamId={teamId}
        members={members}
        mayManage={mayManage}
      />
    </main>
  );
}

function ScheduleSection({
  teamId,
  schedule,
  mayConfigure,
}: {
  teamId: string;
  schedule: Schedule | null;
  mayConfigure: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const setSchedule = useSetSchedule(teamId);
  const [weekday, setWeekday] = useState(schedule ? String(schedule.weekday) : '');
  const [time, setTime] = useState(schedule?.time ?? '');

  const weekdayError = describeFieldFailure(t, setSchedule.error, 'weekday');
  const timeError = describeFieldFailure(t, setSchedule.error, 'time');
  const otherError = describeOtherFailure(t, setSchedule.error, ['weekday', 'time']);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSchedule.mutate({ weekday: Number(weekday), time });
  }

  return (
    <section className={styles.section} aria-labelledby="schedule-heading">
      <h2 id="schedule-heading" className={styles.subheading}>
        {t('meetings.scheduleHeading')}
      </h2>
      <p>
        {schedule
          ? t('meetings.scheduleValue', {
              weekday: format.scheduleWeekday(schedule.weekday),
              time: format.meetingTime(schedule.time),
            })
          : t('meetings.scheduleNone')}
      </p>
      {mayConfigure && (
        <form className={teamStyles.form} onSubmit={handleSubmit} noValidate>
          <div className={teamStyles.field}>
            <label className={teamStyles.label} htmlFor="schedule-weekday">
              {t('meetings.weekdayLabel')}
            </label>
            <select
              id="schedule-weekday"
              className={styles.select}
              value={weekday}
              onChange={(event) => setWeekday(event.target.value)}
              aria-invalid={weekdayError !== undefined}
            >
              <option value="" />
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {format.scheduleWeekday(day)}
                </option>
              ))}
            </select>
            {weekdayError && (
              <p role="alert" className={teamStyles.error}>
                {weekdayError}
              </p>
            )}
          </div>
          <div className={teamStyles.field}>
            <label className={teamStyles.label} htmlFor="schedule-time">
              {t('meetings.timeLabel')}
            </label>
            <input
              id="schedule-time"
              type="time"
              className={teamStyles.input}
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
            {timeError && (
              <p role="alert" className={teamStyles.error}>
                {timeError}
              </p>
            )}
          </div>
          <button
            type="submit"
            className={`${teamStyles.primary} ${teamStyles.submit}`}
            disabled={setSchedule.isPending}
          >
            {setSchedule.isPending ? t('meetings.saving') : t('meetings.saveSchedule')}
          </button>
          {otherError && (
            <p role="alert" className={teamStyles.itemError}>
              {otherError}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function PrepareMeeting({ teamId, proposed }: { teamId: string; proposed: MeetingSlot | null }) {
  const { t } = useTranslation();
  const openMeeting = useOpenMeeting(teamId);
  const [slot, setSlot] = useState<MeetingSlot | null>(null);

  if (slot === null) {
    return (
      <p className={styles.section}>
        <button
          type="button"
          className={teamStyles.primary}
          // Pre-filled from the proposal when the board has a schedule;
          // otherwise the member chooses both.
          onClick={() => setSlot(proposed ?? { date: '', time: '' })}
        >
          {t('meetings.prepare')}
        </button>
      </p>
    );
  }

  function close() {
    setSlot(null);
    openMeeting.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (slot) openMeeting.mutate(slot, { onSuccess: close });
  }

  return (
    <section className={styles.section} aria-label={t('meetings.prepare')}>
      <SlotForm
        idPrefix="prepare"
        slot={slot}
        onChange={setSlot}
        onSubmit={handleSubmit}
        onCancel={close}
        error={openMeeting.error}
        submitLabel={openMeeting.isPending ? t('meetings.opening') : t('meetings.open')}
        pending={openMeeting.isPending}
      />
    </section>
  );
}

/** A date and start time, with the field errors the API reported against each. */
function SlotForm({
  idPrefix,
  slot,
  onChange,
  onSubmit,
  onCancel,
  error,
  submitLabel,
  pending,
  children,
}: {
  idPrefix: string;
  slot: MeetingSlot;
  onChange: (slot: MeetingSlot) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  error: Error | null;
  submitLabel: string;
  pending: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const dateError = describeFieldFailure(t, error, 'date');
  const timeError = describeFieldFailure(t, error, 'time');
  const otherError = describeOtherFailure(t, error, ['date', 'time', 'host_employee_id']);

  return (
    <form className={teamStyles.form} onSubmit={onSubmit} noValidate>
      <div className={teamStyles.field}>
        <label className={teamStyles.label} htmlFor={`${idPrefix}-date`}>
          {t('meetings.dateLabel')}
        </label>
        <input
          id={`${idPrefix}-date`}
          type="date"
          className={teamStyles.input}
          value={slot.date}
          onChange={(event) => onChange({ ...slot, date: event.target.value })}
          aria-invalid={dateError !== undefined}
          aria-describedby={dateError ? `${idPrefix}-date-error` : undefined}
        />
        {dateError && (
          <p id={`${idPrefix}-date-error`} role="alert" className={teamStyles.error}>
            {dateError}
          </p>
        )}
      </div>
      <div className={teamStyles.field}>
        <label className={teamStyles.label} htmlFor={`${idPrefix}-time`}>
          {t('meetings.timeLabel')}
        </label>
        <input
          id={`${idPrefix}-time`}
          type="time"
          className={teamStyles.input}
          value={slot.time}
          onChange={(event) => onChange({ ...slot, time: event.target.value })}
        />
        {timeError && (
          <p role="alert" className={teamStyles.error}>
            {timeError}
          </p>
        )}
      </div>
      {children}
      <span className={teamStyles.actions}>
        <button
          type="submit"
          className={`${teamStyles.primary} ${teamStyles.submit}`}
          disabled={pending}
        >
          {submitLabel}
        </button>
        <button type="button" className={teamStyles.button} onClick={onCancel}>
          {t('meetings.cancel')}
        </button>
      </span>
      {otherError && (
        <p role="alert" className={teamStyles.itemError}>
          {otherError}
        </p>
      )}
    </form>
  );
}

function MeetingSection({
  id,
  heading,
  empty,
  meetings,
  teamId,
  members,
  mayManage,
}: {
  id: string;
  heading: string;
  empty: string;
  meetings: Meeting[];
  teamId: string;
  members: Member[];
  mayManage: boolean;
}) {
  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className={styles.subheading}>
        {heading}
      </h2>
      {meetings.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul className={teamStyles.list} aria-labelledby={`${id}-heading`}>
          {meetings.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              teamId={teamId}
              members={members}
              mayManage={mayManage}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function MeetingRow({
  meeting,
  teamId,
  members,
  mayManage,
}: {
  meeting: Meeting;
  teamId: string;
  members: Member[];
  mayManage: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const changeMeeting = useChangeMeeting(teamId);
  const deleteMeeting = useDeleteMeeting(teamId);
  const [editing, setEditing] = useState(false);
  const [slot, setSlot] = useState<MeetingSlot>({ date: meeting.date, time: meeting.time });
  const [hostId, setHostId] = useState(meeting.host?.id ?? '');

  const date = format.meetingDate(meeting.date);

  function startEditing() {
    setSlot({ date: meeting.date, time: meeting.time });
    setHostId(meeting.host?.id ?? '');
    changeMeeting.reset();
    deleteMeeting.reset();
    setEditing(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Only what changed is sent: a host who has since left the team stays the
    // host unless someone deliberately picks another.
    const change = {
      ...(slot.date !== meeting.date ? { date: slot.date } : {}),
      ...(slot.time !== meeting.time ? { time: slot.time } : {}),
      ...(hostId !== (meeting.host?.id ?? '') ? { host_employee_id: hostId || null } : {}),
    };
    changeMeeting.mutate({ meetingId: meeting.id, change }, { onSuccess: () => setEditing(false) });
  }

  // A host who has left the team is still offered, so the select can show
  // who hosts this meeting.
  const hostOptions =
    meeting.host && !members.some((member) => member.employee_id === meeting.host?.id)
      ? [...members, { employee_id: meeting.host.id, email: meeting.host.email, is_leader: false }]
      : members;
  const deleteError = describeFailure(t, deleteMeeting.error);
  const hostError = describeFieldFailure(t, changeMeeting.error, 'host_employee_id');

  return (
    <li className={teamStyles.item}>
      <span className={teamStyles.itemMain}>
        <span className={teamStyles.itemName}>
          {date}, {format.meetingTime(meeting.time)}
        </span>
        <span className={teamStyles.itemMeta}>
          {meeting.host ? t('meetings.host', { email: meeting.host.email }) : t('meetings.noHost')}
        </span>
      </span>
      {mayManage && !editing && (
        <span className={teamStyles.actions}>
          <button
            type="button"
            className={teamStyles.button}
            onClick={startEditing}
            aria-label={t('meetings.changeLabel', { date })}
          >
            {t('meetings.change')}
          </button>
          <button
            type="button"
            className={teamStyles.button}
            disabled={deleteMeeting.isPending}
            onClick={() => deleteMeeting.mutate(meeting.id)}
            aria-label={t('meetings.deleteLabel', { date })}
          >
            {t('meetings.delete')}
          </button>
        </span>
      )}
      {deleteError && (
        <p role="alert" className={teamStyles.itemError}>
          {deleteError}
        </p>
      )}
      {editing && (
        <div className={styles.rowForm}>
          <SlotForm
            idPrefix={`meeting-${meeting.id}`}
            slot={slot}
            onChange={setSlot}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(false)}
            error={changeMeeting.error}
            submitLabel={changeMeeting.isPending ? t('meetings.saving') : t('meetings.save')}
            pending={changeMeeting.isPending}
          >
            <div className={teamStyles.field}>
              <label className={teamStyles.label} htmlFor={`meeting-${meeting.id}-host`}>
                {t('meetings.hostLabel')}
              </label>
              <select
                id={`meeting-${meeting.id}-host`}
                className={styles.select}
                value={hostId}
                onChange={(event) => setHostId(event.target.value)}
              >
                <option value="">{t('meetings.noHost')}</option>
                {hostOptions.map((member) => (
                  <option key={member.employee_id} value={member.employee_id}>
                    {member.email}
                  </option>
                ))}
              </select>
              {hostError && (
                <p role="alert" className={teamStyles.error}>
                  {hostError}
                </p>
              )}
            </div>
          </SlotForm>
        </div>
      )}
    </li>
  );
}
