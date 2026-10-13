import { useLocation } from 'react-router';

/**
 * The router's current address, shown for a test to read.
 *
 * Tests render under a MemoryRouter, which keeps its address out of
 * `window.location`; this is how a test asserts where a link or an action led.
 * The location state is shown beside it, as JSON, for the tests about where a
 * page was opened from.
 */
export function AddressProbe() {
  const location = useLocation();
  return (
    <>
      <output data-testid="address">{`${location.pathname}${location.search}${location.hash}`}</output>
      <output data-testid="location-state">{JSON.stringify(location.state ?? null)}</output>
    </>
  );
}
