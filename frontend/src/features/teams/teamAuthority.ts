import type { TeamDetail } from '../../api/teams';

/** What a viewer may do to one team, mirroring the API's rules. */
export interface TeamAuthority {
  /** Configure the board: its metrics, thresholds and schedule. */
  configure: boolean;
  /** Add a member, and remove one who is not a deputy. */
  manageMembers: boolean;
  /** Appoint and revoke deputies, and remove a member who is one. */
  chooseDeputies: boolean;
  /** Make another member the leader. */
  handOver: boolean;
}

/**
 * Decided as the API decides it: from whether the viewer is an administrator
 * and what the team records them as - leader, deputy, member or nobody. The
 * server refuses regardless; this only keeps a control the viewer cannot use
 * off the page.
 */
export function teamAuthority(
  team: Pick<TeamDetail, 'members'>,
  email: string | null,
  isAdmin: boolean,
): TeamAuthority {
  const viewer = email === null ? undefined : team.members.find((member) => member.email === email);
  const leads = viewer?.is_leader === true;
  const deputises = viewer?.is_deputy === true;
  return {
    configure: isAdmin || leads || deputises,
    manageMembers: isAdmin || leads || deputises,
    chooseDeputies: isAdmin || leads,
    handOver: isAdmin,
  };
}
