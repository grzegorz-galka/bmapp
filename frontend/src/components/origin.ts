/**
 * Where a team's page was opened from.
 *
 * Travels in the router's location state rather than the address: a shared or
 * bookmarked link then carries nobody's origin, and the page falls back to the
 * back link it has always had. See design D1 and D2 of add-navigation-context.
 */
import { useLocation } from 'react-router';

/** The screens a team's page can be opened from; each has its own back caption. */
export const SCREENS = [
  'dashboard',
  'myTeams',
  'myMeetings',
  'myPulse',
  'teams',
  'teamMetrics',
  'board',
  'meetings',
] as const;

export type Screen = (typeof SCREENS)[number];

export interface Origin {
  screen: Screen;
  /** The full address the person was on: pathname, search and hash. */
  path: string;
  /** That page's own location state, restored on the way back (D2). */
  state?: unknown;
}

/** What an entry link passes as its `state`. */
export interface OriginState {
  from: Origin;
}

function isOrigin(value: unknown): value is Origin {
  if (typeof value !== 'object' || value === null) return false;
  const { screen, path } = value as Record<string, unknown>;
  return (
    typeof path === 'string' &&
    typeof screen === 'string' &&
    (SCREENS as readonly string[]).includes(screen)
  );
}

/** The origin this page was opened with, if it was opened with a known one. */
export function useOrigin(): Origin | undefined {
  const { state } = useLocation();
  const from: unknown = (state as { from?: unknown } | null)?.from;
  return isOrigin(from) ? from : undefined;
}

/**
 * The state an entry link on this page passes on: this page, as `screen`, with
 * its full address and its own location state, so that coming back to it
 * restores where it was itself opened from.
 */
export function useHere(screen: Screen): OriginState {
  const { pathname, search, hash, state } = useLocation();
  const from: Origin = { screen, path: `${pathname}${search}${hash}` };
  if (state !== null && state !== undefined) from.state = state;
  return { from };
}
