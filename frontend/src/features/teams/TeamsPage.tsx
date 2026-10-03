import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError } from '../../api/teams';
import { translateErrorCode } from '../../i18n/apiErrors';
import { useRegisterTeam, useTeams } from './useTeams';
import { useIsAdmin } from '../auth/useCurrentUser';
import styles from './teams.module.css';

export function TeamsPage() {
  // Registering a team is an administrator's: there is no leader before the
  // team exists, so there is nobody else it could belong to. Everyone else
  // still sees the list, because reading is open to anyone signed in.
  const isAdmin = useIsAdmin();
  // Local UI state only. The team list is server state and lives in the query.
  const [name, setName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const { t } = useTranslation();
  const teams = useTeams();
  const registerTeam = useRegisterTeam();

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
    registerTeam.mutate(
      { name, leaderEmail },
      {
        onSuccess: () => {
          setName('');
          setLeaderEmail('');
        },
      },
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>{t('teams.heading')}</h1>

      {isAdmin && (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="team-name">
              {t('teams.nameLabel')}
            </label>
            <input
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
          <button
            type="submit"
            className={`${styles.primary} ${styles.submit}`}
            disabled={registerTeam.isPending}
          >
            {registerTeam.isPending ? t('teams.registering') : t('teams.register')}
          </button>
        </form>
      )}

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
                    {t('teams.memberCount', { count: team.member_count })}
                  </span>
                </span>
                <Link
                  to={`/teams/${encodeURIComponent(team.id)}/members`}
                  aria-label={t('teams.membersLinkLabel', { name: team.name })}
                >
                  {t('teams.membersLink')}
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
