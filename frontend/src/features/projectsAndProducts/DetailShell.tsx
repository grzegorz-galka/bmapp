/**
 * What a project's page and a product's page share: the back link, the
 * loading and failure states, the team and its metrics they read, and the
 * marks beside the heading.
 */
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Metric, MetricGroup } from '../../api/metrics';
import type { TeamDetail } from '../../api/teams';
import { BackLink } from '../../components/BackLink';
import { ClipboardIcon } from '../../components/icons';
import { isNotFound } from '../../i18n/apiErrors';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdmin } from '../auth/useCurrentUser';
import { useMetricGroups, useMetrics } from '../metrics/useMetrics';
import { teamAuthority } from '../teams/teamAuthority';
import { useTeam } from '../teams/useTeams';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import styles from './DetailPage.module.css';

/** The team's reads a detail page needs beside its own subject. */
export function useDetailContext(teamId: string) {
  return {
    team: useTeam(teamId),
    // The board's own list, filtered on the page: no aggregate read (design decision 6).
    metrics: useMetrics(teamId),
    groups: useMetricGroups(teamId),
  };
}

export interface DetailContext {
  team: TeamDetail;
  metrics: Metric[];
  groups: MetricGroup[];
  mayConfigure: boolean;
  mayRecord: boolean;
}

export function DetailShell<T>({
  teamId,
  context,
  subject,
  notFound,
  children,
}: {
  teamId: string;
  context: ReturnType<typeof useDetailContext>;
  subject: UseQueryResult<T>;
  notFound: string;
  children: (found: T, context: DetailContext) => ReactNode;
}) {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { email } = useAuth();
  const { team, metrics, groups } = context;

  const back = (
    <BackLink
      className={teamStyles.back}
      fallback={{
        to: `/teams/${encodeURIComponent(teamId)}/projects-and-products`,
        label: t('back.projectsAndProducts'),
      }}
    />
  );

  if (team.isPending || metrics.isPending || groups.isPending || subject.isPending) {
    return (
      <main className={teamStyles.page}>
        {back}
        <p>{t('projectsAndProducts.detail.loading')}</p>
      </main>
    );
  }

  if (team.isError || metrics.isError || groups.isError || subject.isError) {
    return (
      <main className={teamStyles.page}>
        {back}
        {isNotFound(subject.error) || isNotFound(team.error) ? (
          <h1 className={teamStyles.heading}>{notFound}</h1>
        ) : (
          <p role="alert">{t('projectsAndProducts.detail.loadFailed')}</p>
        )}
      </main>
    );
  }

  // As the API decides it; offering only what the viewer may use is a courtesy.
  const mayConfigure = teamAuthority(team.data, email, isAdmin).configure;
  const mayRecord = isAdmin || team.data.members.some((member) => member.email === email);

  return (
    <main className={teamStyles.page}>
      {back}
      {children(subject.data, {
        team: team.data,
        metrics: metrics.data,
        groups: groups.data,
        mayConfigure,
        mayRecord,
      })}
    </main>
  );
}

/** Active or inactive, and for a project whether it has run past its end date. */
export function DetailMarks({ active, pastEnd = false }: { active: boolean; pastEnd?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={styles.marks}>
      <span className={styles.mark}>
        {active ? t('projectsAndProducts.common.active') : t('projectsAndProducts.common.inactive')}
      </span>
      {pastEnd && (
        <span className={`${styles.mark} ${styles.pastEnd}`}>
          {t('projectsAndProducts.common.pastEnd')}
        </span>
      )}
    </span>
  );
}

/**
 * Values are recorded at a meeting, on the board, never here: this leads to
 * the board's recording view. Not offered for an inactive project or product,
 * whose metrics take no value.
 */
export function RecordLink({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  return (
    <p className={styles.note}>
      <Link className={controls.link} to={`/teams/${encodeURIComponent(teamId)}?mode=record`}>
        <ClipboardIcon />
        {t('projectsAndProducts.detail.recordValues')}
      </Link>
    </p>
  );
}
