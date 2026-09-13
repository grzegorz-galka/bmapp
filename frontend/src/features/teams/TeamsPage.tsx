import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/teams';
import { useRegisterTeam, useTeams } from './useTeams';

export function TeamsPage() {
  // Local UI state only. The team list is server state and lives in the query.
  const [name, setName] = useState('');
  const teams = useTeams();
  const registerTeam = useRegisterTeam();

  const nameError =
    registerTeam.error instanceof ApiError ? registerTeam.error.messageFor('name') : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    registerTeam.mutate(name, { onSuccess: () => setName('') });
  }

  return (
    <main>
      <h1>Teams</h1>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="team-name">Team name</label>
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
          {registerTeam.isPending ? 'Registering…' : 'Register team'}
        </button>
      </form>

      {teams.isPending && <p>Loading teams…</p>}
      {teams.isError && <p role="alert">Could not load teams.</p>}
      {teams.data &&
        (teams.data.length === 0 ? (
          <p>No teams registered yet.</p>
        ) : (
          <ul>
            {teams.data.map((team) => (
              <li key={team.id}>
                {team.name} — board: {team.board.name}
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
