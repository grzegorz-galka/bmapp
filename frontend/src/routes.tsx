import { Navigate, Outlet, Route, Routes } from 'react-router';
import { AppHeader } from './components/AppHeader';
import { useAuth } from './features/auth/AuthProvider';
import { AuthCallbackPage } from './features/auth/AuthCallbackPage';
import { SignedOutPanel } from './features/auth/SignedOutPanel';
import { BoardPage } from './features/board/BoardPage';
import { CALLBACK_PATH } from './features/auth/config';
import { GlobalMetricsPage } from './features/globalMetrics/GlobalMetricsPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TeamMeetingsPage } from './features/meetings/TeamMeetingsPage';
import { MetricSettingsPage } from './features/metrics/MetricSettingsPage';
import { MyMeetingsPage } from './features/personal/MyMeetingsPage';
import { MyPulsePage } from './features/personal/MyPulsePage';
import { MyTeamsPage } from './features/personal/MyTeamsPage';
import { TeamMetricsPage } from './features/personal/TeamMetricsPage';
import { TeamMembersPage } from './features/teams/TeamMembersPage';
import { TeamsPage } from './features/teams/TeamsPage';

/**
 * The route table.
 *
 * The header is on the layout route, so every page has it by construction.
 * An address nobody recognises lands on the dashboard rather than on an error: the
 * dashboard is the way in to everything else, which is what someone who
 * mistyped a URL needs.
 *
 * Every page but the sign-in return sits behind the session: without one the
 * signed-out panel takes its place, so no page mounts, nothing is fetched to be
 * refused, and no page hangs on its loading text. While a session is being
 * restored the pages render as they always have.
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
        {/* Outside the gate: it is how a session begins. */}
        <Route
          path={CALLBACK_PATH.replace(/^\//, '')}
          element={<AuthCallbackPage complete={completeSignIn} />}
        />
        <Route element={<SessionGate />}>
          <Route index element={<DashboardPage />} />
          <Route path="my-teams" element={<MyTeamsPage />} />
          <Route path="my-meetings" element={<MyMeetingsPage />} />
          <Route path="my-pulse" element={<MyPulsePage />} />
          <Route path="team-metrics" element={<TeamMetricsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          {/* A team's own address is its board. */}
          <Route path="teams/:teamId" element={<BoardPage />} />
          <Route path="teams/:teamId/members" element={<TeamMembersPage />} />
          <Route path="teams/:teamId/meetings" element={<TeamMeetingsPage />} />
          <Route path="teams/:teamId/metrics" element={<MetricSettingsPage />} />
          <Route path="global-metrics" element={<GlobalMetricsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

function SessionGate() {
  const { status } = useAuth();
  return status === 'signedIn' || status === 'restoring' ? <Outlet /> : <SignedOutPanel />;
}
