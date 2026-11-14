import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { getProduct, type Product } from '../../api/products';
import { DetailMarks, DetailShell, RecordLink, useDetailContext } from './DetailShell';
import { DetailMetrics } from './DetailMetrics';
import { productsQueryKey } from './useProjectsAndProducts';
import styles from './DetailPage.module.css';
import teamStyles from '../teams/teams.module.css';

/**
 * One product, at `/teams/:teamId/products/:productId`: its details, the
 * link to its Jira board, and its metrics, each by its bare name with its
 * latest value and trend.
 */
export function ProductPage() {
  const { teamId = '', productId = '' } = useParams();
  const { t } = useTranslation();
  // Under the list's key, so a change made on the list refreshes this page too.
  const product = useQuery<Product>({
    queryKey: [...productsQueryKey(teamId), productId],
    queryFn: () => getProduct(teamId, productId),
  });
  const context = useDetailContext(teamId);

  return (
    <DetailShell
      teamId={teamId}
      context={context}
      subject={product}
      notFound={t('projectsAndProducts.detail.productNotFound')}
    >
      {(found, { team, metrics, groups, mayConfigure, mayRecord }) => (
        <>
          <div className={styles.headingRow}>
            <h1 className={teamStyles.heading}>{found.name}</h1>
            <DetailMarks active={found.active} />
          </div>
          <dl className={styles.details} aria-label={t('projectsAndProducts.detail.detailsLabel')}>
            <dt>{t('projectsAndProducts.common.productOwner')}</dt>
            <dd>{found.owner.display_name}</dd>
            <dt>{t('projectsAndProducts.detail.jiraLink')}</dt>
            <dd>
              {found.jira_url ? (
                // Followed, never read from: a new tab, and no opener for the other site.
                <a href={found.jira_url} target="_blank" rel="noopener noreferrer">
                  {`${found.jira_url} `}
                  <span className="visually-hidden">{t('projectsAndProducts.detail.newTab')}</span>
                </a>
              ) : (
                t('projectsAndProducts.detail.noJira')
              )}
            </dd>
          </dl>
          {found.active ? (
            mayRecord && <RecordLink teamId={teamId} />
          ) : (
            <p className={styles.note}>{t('projectsAndProducts.detail.productInactiveNote')}</p>
          )}
          <DetailMetrics
            teamId={teamId}
            parent={{ product_id: found.id }}
            metrics={metrics.filter((metric) => metric.product?.id === found.id)}
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
