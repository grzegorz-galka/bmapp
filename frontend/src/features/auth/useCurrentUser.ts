/**
 * Who the signed-in person is, and whether they are an administrator.
 *
 * Its own request rather than something read out of another payload: whether
 * someone is an administrator is decided by server configuration the browser
 * never sees, so nothing already on the page can be used to work it out.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser, type CurrentUser } from '../../api/auth';
import { useAuth } from './AuthProvider';

export function useCurrentUser() {
  const { status } = useAuth();
  return useQuery<CurrentUser>({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    enabled: status === 'signedIn',
    staleTime: Infinity,
  });
}

/** Whether the viewer may act as an administrator. False while unknown. */
export function useIsAdmin(): boolean {
  return useCurrentUser().data?.is_admin ?? false;
}
