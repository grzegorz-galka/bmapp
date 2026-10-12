import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSummary, type DashboardSummary } from '../../api/dashboard';
import { useAuth } from '../auth/AuthProvider';

export const DASHBOARD_QUERY_KEY = ['dashboard'] as const;

/**
 * The dashboard summary.
 *
 * One key, so the header and the page share a single request rather than each
 * fetching the identity for itself.
 *
 * Only while somebody is signed in: the summary is of the signed-in person's
 * teams and items, so asking for it with no session would be refused, and
 * holding on to the last one would leave one person's board on the screen for
 * whoever signs in next.
 */
export function useDashboardSummary() {
  const { status } = useAuth();
  return useQuery<DashboardSummary>({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboardSummary,
    enabled: status === 'signedIn',
  });
}
