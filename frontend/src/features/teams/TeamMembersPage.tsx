import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { Member } from '../../api/teams';
import { describeFailure, isNotFound } from '../../i18n/apiErrors';
import { teamAuthority } from './teamAuthority';
import {
  useAddMember,
  useAppointDeputy,
  useMakeLeader,
  useRemoveMember,
  useRevokeDeputy,
  useTeam,
} from './useTeams';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdmin } from '../auth/useCurrentUser';
import styles from './teams.module.css';

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
  const appointDeputy = useAppointDeputy(teamId);
  const revokeDeputy = useRevokeDeputy(teamId);
  const rowActions = [removeMember, makeLeader, appointDeputy, revokeDeputy];

  const emailError = describeFailure(t, addMember.error, 'email');
  const busy = rowActions.some((action) => action.isPending);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addMember.mutate(email, { onSuccess: () => setEmail('') });
  }

  // Only the latest row action's failure is shown, next to the member it
  // concerns; starting another action clears the earlier one.
  function act(action: (typeof rowActions)[number], member: Member) {
    for (const other of rowActions) {
      if (other !== action) other.reset();
    }
    action.mutate(member.employee_id);
  }

  function rowError(member: Member): string | undefined {
    const failed = rowActions.find(
      (action) => action.isError && action.variables === member.employee_id,
    );
    return failed ? describeFailure(t, failed.error) : undefined;
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
        {isNotFound(team.error) ? (
          <h1 className={styles.heading}>{t('members.notFound')}</h1>
        ) : (
          <p role="alert">{t('members.loadFailed')}</p>
        )}
      </main>
    );
  }

  // What this viewer may do here, decided the same way the API decides it.
  // The server refuses regardless; hiding a control the person cannot use is
  // a courtesy, not the enforcement.
  const authority = teamAuthority(team.data, signedInEmail, isAdmin);

  return (
    <main className={styles.page}>
      {back}
      <h1 className={styles.heading}>{t('members.heading', { name: team.data.name })}</h1>

      {authority.manageMembers && (
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
          // A deputy is removed only by whoever chooses deputies, or removing
          // and re-adding would be a deputy's way round that.
          const mayRemove = member.is_deputy ? authority.chooseDeputies : authority.manageMembers;
          const mayActOnRow = authority.handOver || authority.chooseDeputies || mayRemove;
          return (
            <li key={member.employee_id} className={styles.item}>
              <span className={styles.itemMain}>
                <span className={styles.itemName}>
                  {member.email}
                  {/* The word is the marker; the badge styling only repeats it. */}
                  {(member.is_leader || member.is_deputy) && ' '}
                  {member.is_leader && (
                    <span className={styles.leaderMark}>{t('members.leader')}</span>
                  )}
                  {member.is_deputy && (
                    <span className={styles.deputyMark}>{t('members.deputy')}</span>
                  )}
                </span>
              </span>
              {/* The leader can be neither removed nor made leader again, nor
                  be a deputy: leadership has to be handed to someone else first. */}
              {!member.is_leader && mayActOnRow && (
                <span className={styles.actions}>
                  {/* Handing over leadership is an administrator's; choosing
                      deputies is the leader's too; adding and removing
                      ordinary members is a deputy's as well. */}
                  {authority.handOver && (
                    <button
                      type="button"
                      className={styles.button}
                      disabled={busy}
                      onClick={() => act(makeLeader, member)}
                      aria-label={t('members.makeLeaderLabel', { email: member.email })}
                    >
                      {t('members.makeLeader')}
                    </button>
                  )}
                  {authority.chooseDeputies && !member.is_deputy && (
                    <button
                      type="button"
                      className={styles.button}
                      disabled={busy}
                      onClick={() => act(appointDeputy, member)}
                      aria-label={t('members.makeDeputyLabel', { email: member.email })}
                    >
                      {t('members.makeDeputy')}
                    </button>
                  )}
                  {authority.chooseDeputies && member.is_deputy && (
                    <button
                      type="button"
                      className={styles.button}
                      disabled={busy}
                      onClick={() => act(revokeDeputy, member)}
                      aria-label={t('members.revokeDeputyLabel', { email: member.email })}
                    >
                      {t('members.revokeDeputy')}
                    </button>
                  )}
                  {mayRemove && (
                    <button
                      type="button"
                      className={styles.button}
                      disabled={busy}
                      onClick={() => act(removeMember, member)}
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
