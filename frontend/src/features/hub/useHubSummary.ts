import { useQuery } from '@tanstack/react-query';
import { fetchHubSummary, type HubSummary } from '../../api/hub';

const HUB_QUERY_KEY = ['hub'] as const;

/**
 * The hub summary.
 *
 * One key, so the header and the page share a single request rather than each
 * fetching the identity for itself.
 */
export function useHubSummary() {
  return useQuery<HubSummary>({ queryKey: HUB_QUERY_KEY, queryFn: fetchHubSummary });
}
