import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { TFunction } from 'i18next';
import { ApiError, type Member } from '../../api/teams';
import { translateErrorCode } from '../../i18n/apiErrors';
import { useAddMember, useMakeLeader, useRemoveMember, useTeam } from './useTeams';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdmin } from '../auth/useCurrentUser';
import styles from './teams.module.css';

/**
 * The text for a failed mutation: the error on `field` if the API named one,
 * otherwise its first error, otherwise the generic message. A failure always
 * says something, in the language being read, and never the API's English.
 */
function describeFailure(t: TFunction, error: Error | null, field?: string): string | undefined {
  if (!error) return undefined;
  if (error instanceof ApiError) {
    const failure = (field ? error.errorFor(field) : undefined) ?? error.errors[0];
    if (failure) return translateErrorCode(t, failure);
  }
  return t('errors.generic');
}

/**
 * Whether the team could not be read because there is no such team.
 *
 * A 422 counts as well: on a GET with no body the only thing to reject is the
 * identifier in the address, and an identifier that is not even well formed
 * names no team either.
 */
function isMissingTeam(error: Error | null): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 422);
}

export function TeamMembersPage() {
  const isAdmin = useIsAdmin();
  const { email: signedInEmail } = useAuth();
  const { teamId = '' } = useParams();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const team = useTeam(teamId);
  const addMember = useAddMember(teamId);
  const removeMember = useRemoveMember(teamId);
  const makeLeader = useMakeLeader(teamId);

  const emailError = describeFailure(t, addMember.error, 'email');
  const busy = removeMember.isPending || makeLeader.isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addMember.mutate(email, { onSuccess: () => setEmail('') });
  }

  // Only the latest row action's failure is shown, next to the member it
  // concerns; starting another action clears the earlier one.
  function remove(member: Member) {
    makeLeader.reset();
    removeMember.mutate(member.employee_id);
  }

  function handOver(member: Member) {
    removeMember.reset();
    makeLeader.mutate(member.employee_id);
  }

  function rowError(member: Member): string | undefined {
    if (removeMember.isError && removeMember.variables === member.employee_id) {
      return describeFailure(t, removeMember.error);
    }
    if (makeLeader.isError && makeLeader.variables === member.employee_id) {
      return describeFailure(t, makeLeader.error);
    }
    return undefined;
  }

  const back = (
    <Link className={styles.back} to="/teams">
      {t('members.back')}
    </Link>
  );

  if (team.isPending) {
    return (
      <main className={styles.page}>
        {back}
        <p>{t('members.loading')}</p>
      </main>
    );
  }

  if (team.isError) {
    return (
      <main className={styles.page}>
        {back}
        {isMissingTeam(team.error) ? (
          <h1 className={styles.heading}>{t('members.notFound')}</h1>
        ) : (
          <p role="alert">{t('members.loadFailed')}</p>
        )}
      </main>
    );
  }

  // What this viewer may do here, decided the same way the API decides it:
  // an administrator, or the leader of this very team. The server refuses
  // regardless; hiding a control the person cannot use is a courtesy, not the
  // enforcement.
  const leaderEmail = team.data.members.find((member) => member.is_leader)?.email;
  const mayManageMembers = isAdmin || (signedInEmail !== null && signedInEmail === leaderEmail);
  const mayHandOverLeadership = isAdmin;

  return (
    <main className={styles.page}>
      {back}
      <h1 className={styles.heading}>{t('members.heading', { name: team.data.name })}</h1>

      {mayManageMembers && (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="member-email">
              {t('members.emailLabel')}
            </label>
            <input
              id="member-email"
              name="email"
              type="email"
              autoComplete="off"
              className={styles.input}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={emailError !== undefined}
              aria-describedby={emailError ? 'member-email-error' : undefined}
            />
            {emailError && (
              <p id="member-email-error" role="alert" className={styles.error}>
                {emailError}
              </p>
            )}
          </div>
          <button
            type="submit"
            className={`${styles.primary} ${styles.submit}`}
            disabled={addMember.isPending}
          >
            {addMember.isPending ? t('members.adding') : t('members.add')}
          </button>
        </form>
      )}

      <ul className={styles.list} aria-label={t('members.listLabel')}>
        {team.data.members.map((member) => {
          const error = rowError(member);
          return (
            <li key={member.employee_id} className={styles.item}>
              <span className={styles.itemMain}>
                <span className={styles.itemName}>
                  {member.email}
                  {/* The word is the marker; the badge styling only repeats it. */}
                  {member.is_leader && ' '}
                  {member.is_leader && (
                    <span className={styles.leaderMark}>{t('members.leader')}</span>
                  )}
                </span>
              </span>
              {/* The leader can be neither removed nor made leader again:
                  leadership has to be handed to someone else first. */}
              {!member.is_leader && (mayHandOverLeadership || mayManageMembers) && (
                <span className={styles.actions}>
                  {/* Handing over leadership is an administrator's; adding and
                      removing ordinary members is the leader's too. */}
                  {mayHandOverLeadership && (
                    <button
                      type="button"
                      className={styles.button}
                      disabled={busy}
                      onClick={() => handOver(member)}
                      aria-label={t('members.makeLeaderLabel', { email: member.email })}
                    >
                      {t('members.makeLeader')}
                    </button>
                  )}
                  {mayManageMembers && (
                    <button
                      type="button"
                      className={styles.button}
                      disabled={busy}
                      onClick={() => remove(member)}
                      aria-label={t('members.removeLabel', { email: member.email })}
                    >
                      {t('members.remove')}
                    </button>
                  )}
                </span>
              )}
              {error && (
                <p role="alert" className={styles.itemError}>
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
