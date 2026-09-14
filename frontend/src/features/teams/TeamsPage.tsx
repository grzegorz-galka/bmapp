import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/teams';
import { translateErrorCode } from '../../i18n/apiErrors';
import { useRegisterTeam, useTeams } from './useTeams';

export function TeamsPage() {
  // Local UI state only. The team list is server state and lives in the query.
  const [name, setName] = useState('');
  const { t } = useTranslation();
  const teams = useTeams();
  const registerTeam = useRegisterTeam();

  const nameFailure =
    registerTeam.error instanceof ApiError ? registerTeam.error.errorFor('name') : undefined;
  // The API says why; the wording is ours, in the language being read.
  const nameError = nameFailure ? translateErrorCode(t, nameFailure) : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    registerTeam.mutate(name, { onSuccess: () => setName('') });
  }

  return (
    <main>
      <h1>{t('teams.heading')}</h1>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="team-name">{t('teams.nameLabel')}</label>
        <input
          id="team-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={nameError !== undefined}
          aria-describedby={nameError ? 'team-name-error' : undefined}
        />
        {nameError && (
          <p id="team-name-error" role="alert">
            {nameError}
          </p>
        )}
        <button type="submit" disabled={registerTeam.isPending}>
          {registerTeam.isPending ? t('teams.registering') : t('teams.register')}
        </button>
      </form>

      {teams.isPending && <p>{t('teams.loading')}</p>}
      {teams.isError && <p role="alert">{t('teams.loadFailed')}</p>}
      {teams.data &&
        (teams.data.length === 0 ? (
          <p>{t('teams.empty')}</p>
        ) : (
          <ul>
            {teams.data.map((team) => (
              <li key={team.id}>
                {team.name} — {t('teams.boardSuffix', { name: team.board.name })}
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
