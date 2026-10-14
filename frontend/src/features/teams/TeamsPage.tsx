import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useHere } from '../../components/origin';
import { ApiError } from '../../api/teams';
import { translateErrorCode } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { useRegisterTeam, useTeams } from './useTeams';
import { useIsAdmin } from '../auth/useCurrentUser';
import controls from '../../styles/controls.module.css';
import styles from './teams.module.css';

export function TeamsPage() {
  // Registering a team is an administrator's: there is no leader before the
  // team exists, so there is nobody else it could belong to. Everyone else
  // still sees the list, because reading is open to anyone signed in.
  const isAdmin = useIsAdmin();
  const [registering, setRegistering] = useState(false);
  const registerButton = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();
  const here = useHere('teams');

  function closeRegistering() {
    setRegistering(false);
    registerButton.current?.focus();
  }
  const format = useFormat();
  const teams = useTeams();

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>{t('teams.heading')}</h1>

      {isAdmin && (
        <p className={styles.form}>
          <button
            ref={registerButton}
            type="button"
            className={controls.default}
            aria-expanded={registering}
            aria-controls="register-team-section"
            onClick={() => setRegistering((open) => !open)}
          >
            {t('teams.register')}
          </button>
        </p>
      )}
      {registering && <RegisterTeamSection onClose={closeRegistering} />}

      {teams.isPending && <p>{t('teams.loading')}</p>}
      {teams.isError && <p role="alert">{t('teams.loadFailed')}</p>}
      {teams.data &&
        (teams.data.length === 0 ? (
          <p>{t('teams.empty')}</p>
        ) : (
          <ul className={styles.list}>
            {teams.data.map((team) => (
              <li key={team.id} className={styles.item}>
                <span className={styles.itemMain}>
                  <span className={styles.itemName}>
                    {team.name} — {t('teams.boardSuffix', { name: team.board.name })}
                  </span>
                  <span className={styles.itemMeta}>
                    {t('teams.leaderSuffix', { email: team.leader.email })} ·{' '}
                    {t('teams.memberCount', { count: team.member_count })} ·{' '}
                    {team.board.schedule
                      ? t('teams.schedule', {
                          weekday: format.scheduleWeekday(team.board.schedule.weekday),
                          time: format.meetingTime(team.board.schedule.time),
                        })
                      : t('teams.noSchedule')}
                  </span>
                </span>
                <span className={styles.actions}>
                  <Link
                    to={`/teams/${encodeURIComponent(team.id)}`}
                    state={here}
                    aria-label={t('teams.boardLinkLabel', { name: team.name })}
                  >
                    {t('teams.boardLink')}
                  </Link>
                  <Link
                    to={`/teams/${encodeURIComponent(team.id)}/meetings`}
                    state={here}
                    aria-label={t('teams.meetingsLinkLabel', { name: team.name })}
                  >
                    {t('teams.meetingsLink')}
                  </Link>
                  <Link
                    to={`/teams/${encodeURIComponent(team.id)}/members`}
                    state={here}
                    aria-label={t('teams.membersLinkLabel', { name: team.name })}
                  >
                    {t('teams.membersLink')}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}

/**
 * The registration form, in a section of the page rather than a dialog, so
 * the team list stays in view. It is mounted only while open, so cancelling
 * discards what was typed; a rejection keeps it open with what was typed, so
 * it can be corrected rather than retyped.
 */
function RegisterTeamSection({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  // Local UI state only. The team list is server state and lives in the query.
  const [name, setName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const registerTeam = useRegisterTeam();
  const nameField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameField.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  }

  // The API says why; the wording is ours, in the language being read.
  function errorOn(field: string): string | undefined {
    const failure =
      registerTeam.error instanceof ApiError ? registerTeam.error.errorFor(field) : undefined;
    return failure ? translateErrorCode(t, failure) : undefined;
  }
  const nameError = errorOn('name');
  const leaderEmailError = errorOn('leader_email');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    registerTeam.mutate({ name, leaderEmail }, { onSuccess: onClose });
  }

  return (
    <section
      id="register-team-section"
      aria-labelledby="register-team-heading"
      className={styles.registerSection}
      onKeyDown={handleKeyDown}
    >
      <h2 id="register-team-heading" className={styles.sectionHeading}>
        {t('teams.register')}
      </h2>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="team-name">
            {t('teams.nameLabel')}
          </label>
          <input
            ref={nameField}
            id="team-name"
            name="name"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError !== undefined}
            aria-describedby={nameError ? 'team-name-error' : undefined}
          />
          {nameError && (
            <p id="team-name-error" role="alert" className={styles.error}>
              {nameError}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="team-leader-email">
            {t('teams.leaderEmailLabel')}
          </label>
          <input
            id="team-leader-email"
            name="leader_email"
            type="email"
            autoComplete="off"
            className={styles.input}
            value={leaderEmail}
            onChange={(event) => setLeaderEmail(event.target.value)}
            aria-invalid={leaderEmailError !== undefined}
            aria-describedby={leaderEmailError ? 'team-leader-email-error' : undefined}
          />
          {leaderEmailError && (
            <p id="team-leader-email-error" role="alert" className={styles.error}>
              {leaderEmailError}
            </p>
          )}
        </div>
        <span className={`${styles.actions} ${styles.submit}`}>
          <button type="submit" className={controls.default} disabled={registerTeam.isPending}>
            {registerTeam.isPending ? t('teams.registering') : t('teams.registerSubmit')}
          </button>
          <button type="button" className={controls.button} onClick={onClose}>
            {t('teams.cancel')}
          </button>
        </span>
      </form>
    </section>
  );
}
