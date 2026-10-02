import { Navigate, Outlet, Route, Routes } from 'react-router';
import { AppHeader } from './components/AppHeader';
import { HubPage } from './features/hub/HubPage';
import { TeamMembersPage } from './features/teams/TeamMembersPage';
import { TeamsPage } from './features/teams/TeamsPage';

/**
 * The route table.
 *
 * The header is on the layout route, so every page has it by construction.
 * An address nobody recognises lands on the hub rather than on an error: the
 * hub is the page that explains the application, which is what someone who
 * mistyped a URL needs.
 */
export function AppRoutes() {
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
        <Route index element={<HubPage />} />
        <Route path="teams" element={<TeamsPage />} />
        {/* The bare /teams/:teamId is left free on purpose: a team's page is
            its board, and the board capability will want that address. */}
        <Route path="teams/:teamId/members" element={<TeamMembersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
