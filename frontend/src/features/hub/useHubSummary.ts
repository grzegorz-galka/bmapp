import { useQuery } from '@tanstack/react-query';
import { fetchHubSummary, type HubSummary } from '../../api/hub';
import { useAuth } from '../auth/AuthProvider';

const HUB_QUERY_KEY = ['hub'] as const;

/**
 * The hub summary.
 *
 * One key, so the header and the page share a single request rather than each
 * fetching the identity for itself.
 *
 * Only while somebody is signed in: the summary is of the signed-in person's
 * teams and items, so asking for it with no session would be refused, and
 * holding on to the last one would leave one person's board on the screen for
 * whoever signs in next.
 */
export function useHubSummary() {
  const { status } = useAuth();
  return useQuery<HubSummary>({
    queryKey: HUB_QUERY_KEY,
    queryFn: fetchHubSummary,
    enabled: status === 'signedIn',
  });
}
