import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useHere } from '../../components/origin';
import { useTranslation } from 'react-i18next';
import { getPulse } from '../../api/pulse';
import type { Meeting } from '../../api/meetings';
import { useFormat } from '../../i18n/format';
import { useDashboardSummary } from '../dashboard/useDashboardSummary';
import { pulseResultsQueryKey } from '../board/pulse/usePulse';
import { useMyMeetings } from './useMyMeetings';
import styles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';

/**
 * The pulse checks the viewer can answer now, team by team.
 *
 * Only the latest held and the next meeting take answers, so those two are
 * the only candidates; which of them really does is the pulse API's call
 * (`editable`), not this page's, so the page and the board cannot disagree.
 */
export function MyPulsePage() {
  const { t } = useTranslation();
  const here = useHere('myPulse');
  const format = useFormat();
  const summary = useDashboardSummary();
  const teams = summary.data?.teams ?? [];
  const meetings = useMyMeetings(teams);
  const [now] = useState(() => Date.now());

  const candidates = meetings.byTeam.flatMap(({ team, list }) => {
    const all = list?.meetings ?? [];
    const held = all.filter((meeting) => Date.parse(meeting.starts_at) <= now).at(-1);
    const next = all.find((meeting) => Date.parse(meeting.starts_at) > now);
    return [held, next]
      .filter((meeting): meeting is Meeting => meeting !== undefined)
      .map((meeting) => ({ team, meeting }));
  });

  const pulses = useQueries({
    queries: candidates.map(({ team, meeting }) => ({
      queryKey: pulseResultsQueryKey(team.id, meeting.id),
      queryFn: () => getPulse(team.id, meeting.id),
    })),
  });

  const failed = summary.isError || meetings.isError || pulses.some((pulse) => pulse.isError);
  const pending = summary.isPending || meetings.isPending || pulses.some((p) => p.isPending);

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>{t('personal.pulseHeading')}</h1>
      {failed ? (
        <p role="alert">{t('personal.loadFailed')}</p>
      ) : pending ? (
        <p>{t('personal.loading')}</p>
      ) : teams.length === 0 ? (
        <p>{t('personal.noTeams')}</p>
      ) : (
        teams.map((team) => {
          const teamPath = `/teams/${encodeURIComponent(team.id)}`;
          const open = candidates
            .map((candidate, index) => ({ ...candidate, pulse: pulses[index]?.data }))
            .filter(({ team: owner, pulse }) => owner.id === team.id && pulse?.editable);
          const headingId = `pulse-${team.id}`;
          return (
            <section key={team.id} className={meetingStyles.section} aria-labelledby={headingId}>
              <h2 id={headingId} className={meetingStyles.subheading}>
                {team.name}
              </h2>
              {open.length === 0 ? (
                <p>{t('personal.pulseNoneOpen')}</p>
              ) : (
                <ul className={styles.list} aria-labelledby={headingId}>
                  {open.map(({ meeting, pulse }) => {
                    const date = format.meetingDate(meeting.date);
                    const answered = pulse?.own != null;
                    return (
                      <li key={meeting.id} className={styles.item}>
                        <span className={styles.itemMain}>
                          <span className={styles.itemName}>
                            {t('personal.pulseMeeting', { date })}
                          </span>
                          <span className={styles.itemMeta}>
                            {answered
                              ? t('meetingsTile.pulseAnswered')
                              : t('meetingsTile.pulseNotAnswered')}
                          </span>
                        </span>
                        <span className={styles.actions}>
                          <Link
                            className={answered ? styles.button : styles.primary}
                            to={`${teamPath}?meeting=${encodeURIComponent(meeting.id)}&view=pulse&mode=answer`}
                            state={here}
                            aria-label={t(
                              answered ? 'personal.changeAnswerLabel' : 'personal.answerLabel',
                              { team: team.name, date },
                            )}
                          >
                            {answered ? t('personal.changeAnswer') : t('personal.answer')}
                          </Link>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p>
                <Link
                  to={`${teamPath}?view=pulse`}
                  state={here}
                  aria-label={t('personal.resultsLabel', { team: team.name })}
                >
                  {t('personal.results')}
                </Link>
              </p>
            </section>
          );
        })
      )}
    </main>
  );
}
