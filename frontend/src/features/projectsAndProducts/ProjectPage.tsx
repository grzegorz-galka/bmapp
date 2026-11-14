import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { getProject, type Project } from '../../api/projects';
import { useFormat } from '../../i18n/format';
import { DetailMarks, DetailShell, RecordLink, useDetailContext } from './DetailShell';
import { DetailMetrics } from './DetailMetrics';
import { projectsQueryKey } from './useProjectsAndProducts';
import styles from './DetailPage.module.css';
import teamStyles from '../teams/teams.module.css';

/**
 * One project, at `/teams/:teamId/projects/:projectId`: its details and its
 * metrics, each by its bare name with its latest value and trend.
 */
export function ProjectPage() {
  const { teamId = '', projectId = '' } = useParams();
  const { t } = useTranslation();
  const format = useFormat();
  // Under the list's key, so a change made on the list refreshes this page too.
  const project = useQuery<Project>({
    queryKey: [...projectsQueryKey(teamId), projectId],
    queryFn: () => getProject(teamId, projectId),
  });
  const context = useDetailContext(teamId);

  return (
    <DetailShell
      teamId={teamId}
      context={context}
      subject={project}
      notFound={t('projectsAndProducts.detail.projectNotFound')}
    >
      {(found, { team, metrics, groups, mayConfigure, mayRecord }) => (
        <>
          <div className={styles.headingRow}>
            <h1 className={teamStyles.heading}>
              {t('projectsAndProducts.detail.projectHeading', {
                code: found.code,
                name: found.name,
              })}
            </h1>
            <DetailMarks active={found.active} pastEnd={found.past_end} />
          </div>
          <dl className={styles.details} aria-label={t('projectsAndProducts.detail.detailsLabel')}>
            <dt>{t('projectsAndProducts.common.code')}</dt>
            <dd>{found.code}</dd>
            <dt>{t('projectsAndProducts.common.name')}</dt>
            <dd>{found.name}</dd>
            <dt>{t('projectsAndProducts.common.projectManager')}</dt>
            <dd>{found.manager.display_name}</dd>
            <dt>{t('projectsAndProducts.common.startDate')}</dt>
            <dd>{format.meetingDate(found.start_date)}</dd>
            <dt>{t('projectsAndProducts.common.endDate')}</dt>
            <dd>{format.meetingDate(found.end_date)}</dd>
          </dl>
          {found.active ? (
            mayRecord && <RecordLink teamId={teamId} />
          ) : (
            <p className={styles.note}>{t('projectsAndProducts.detail.projectInactiveNote')}</p>
          )}
          <DetailMetrics
            teamId={teamId}
            parent={{ project_id: found.id }}
            metrics={metrics.filter((metric) => metric.project?.id === found.id)}
            members={team.members}
            groups={groups}
            active={found.active}
            mayConfigure={mayConfigure}
          />
        </>
      )}
    </DetailShell>
  );
}
