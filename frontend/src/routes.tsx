import { Navigate, Outlet, Route, Routes } from 'react-router';
import { AppHeader } from './components/AppHeader';
import { AuthCallbackPage } from './features/auth/AuthCallbackPage';
import { BoardPage } from './features/board/BoardPage';
import { CALLBACK_PATH } from './features/auth/config';
import { GlobalMetricsPage } from './features/globalMetrics/GlobalMetricsPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TeamMeetingsPage } from './features/meetings/TeamMeetingsPage';
import { MetricSettingsPage } from './features/metrics/MetricSettingsPage';
import { TeamMembersPage } from './features/teams/TeamMembersPage';
import { TeamsPage } from './features/teams/TeamsPage';

/**
 * The route table.
 *
 * The header is on the layout route, so every page has it by construction.
 * An address nobody recognises lands on the dashboard rather than on an error: the
 * dashboard is the way in to everything else, which is what someone who
 * mistyped a URL needs.
 */
export function AppRoutes({ completeSignIn }: { completeSignIn: () => Promise<boolean> }) {
  return (
    <Routes>
      <Route
        element={
          <>
            <AppHeader />
            <Outlet />
          </>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path={CALLBACK_PATH.replace(/^\//, '')}
          element={<AuthCallbackPage complete={completeSignIn} />}
        />
        <Route path="teams" element={<TeamsPage />} />
        {/* A team's own address is its board. */}
        <Route path="teams/:teamId" element={<BoardPage />} />
        <Route path="teams/:teamId/members" element={<TeamMembersPage />} />
        <Route path="teams/:teamId/meetings" element={<TeamMeetingsPage />} />
        <Route path="teams/:teamId/metrics" element={<MetricSettingsPage />} />
        <Route path="global-metrics" element={<GlobalMetricsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
