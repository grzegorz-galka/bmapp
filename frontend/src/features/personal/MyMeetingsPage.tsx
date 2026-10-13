import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useFormat } from '../../i18n/format';
import { useDashboardSummary } from '../dashboard/useDashboardSummary';
import { allMeetings, useMyMeetings, type TeamMeeting } from './useMyMeetings';
import styles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';

/**
 * The meetings of every team the viewer is in, upcoming apart from past, as
 * the meetings page shows one team's. Each leads to its team's board at that
 * meeting.
 */
export function MyMeetingsPage() {
  const { t } = useTranslation();
  const summary = useDashboardSummary();
  const teams = summary.data?.teams ?? [];
  const meetings = useMyMeetings(teams);
  // Split at the moment the page was opened, as the meetings page does.
  const [now] = useState(() => Date.now());

  const failed = summary.isError || meetings.isError;
  const pending = summary.isPending || meetings.isPending;
  const all = allMeetings(meetings.byTeam);
  const upcoming = all.filter((meeting) => Date.parse(meeting.starts_at) > now);
  const past = all.filter((meeting) => Date.parse(meeting.starts_at) <= now).reverse();

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>{t('personal.meetingsHeading')}</h1>
      {failed ? (
        <p role="alert">{t('personal.loadFailed')}</p>
      ) : pending ? (
        <p>{t('personal.loading')}</p>
      ) : all.length === 0 ? (
        <p>{t('personal.noMeetings')}</p>
      ) : (
        <>
          <Section
            id="my-upcoming"
            heading={t('meetings.upcomingHeading')}
            empty={t('meetings.upcomingEmpty')}
            meetings={upcoming}
          />
          <Section
            id="my-past"
            heading={t('meetings.pastHeading')}
            empty={t('meetings.pastEmpty')}
            meetings={past}
          />
        </>
      )}
    </main>
  );
}

function Section({
  id,
  heading,
  empty,
  meetings,
}: {
  id: string;
  heading: string;
  empty: string;
  meetings: TeamMeeting[];
}) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <section className={meetingStyles.section} aria-labelledby={id}>
      <h2 id={id} className={meetingStyles.subheading}>
        {heading}
      </h2>
      {meetings.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul className={styles.list} aria-labelledby={id}>
          {meetings.map((meeting) => (
            <li key={meeting.id} className={styles.item}>
              <span className={styles.itemMain}>
                <Link
                  className={styles.itemName}
                  to={`/teams/${encodeURIComponent(meeting.team_id)}?meeting=${encodeURIComponent(meeting.id)}`}
                  aria-label={t('personal.meetingLabel', {
                    team: meeting.team,
                    date: format.meetingDate(meeting.date),
                  })}
                >
                  {meeting.team} · {format.meetingDate(meeting.date)}
                </Link>
                <span className={styles.itemMeta}>
                  {format.meetingTime(meeting.time)} ·{' '}
                  {meeting.host
                    ? t('meetings.host', { email: meeting.host.email })
                    : t('meetings.noHost')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
