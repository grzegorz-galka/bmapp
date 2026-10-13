/**
 * What each relationship to a team is offered, as design D2 of
 * add-leader-deputies tables it. The server decides; this pins the courtesy.
 */
import { describe, expect, it } from 'vitest';
import { teamAuthority } from './teamAuthority';
import type { Member } from '../../api/teams';

function member(email: string, flags: Partial<Pick<Member, 'is_leader' | 'is_deputy'>> = {}) {
  return {
    employee_id: `emp-${email}`,
    email,
    is_leader: flags.is_leader ?? false,
    is_deputy: flags.is_deputy ?? false,
  };
}

const TEAM = {
  members: [
    member('leader@example.com', { is_leader: true }),
    member('deputy@example.com', { is_deputy: true }),
    member('member@example.com'),
  ],
};

describe('teamAuthority', () => {
  it.each([
    [
      'a leader',
      'leader@example.com',
      false,
      { configure: true, manageMembers: true, chooseDeputies: true, handOver: false },
    ],
    [
      'a deputy',
      'deputy@example.com',
      false,
      { configure: true, manageMembers: true, chooseDeputies: false, handOver: false },
    ],
    [
      'an ordinary member',
      'member@example.com',
      false,
      { configure: false, manageMembers: false, chooseDeputies: false, handOver: false },
    ],
    [
      'a stranger',
      'stranger@example.com',
      false,
      { configure: false, manageMembers: false, chooseDeputies: false, handOver: false },
    ],
    [
      'an administrator outside the team',
      'admin@example.com',
      true,
      { configure: true, manageMembers: true, chooseDeputies: true, handOver: true },
    ],
    [
      'nobody signed in',
      null,
      false,
      { configure: false, manageMembers: false, chooseDeputies: false, handOver: false },
    ],
  ])('gives %s what they may do', (_who, email, isAdmin, expected) => {
    expect(teamAuthority(TEAM, email, isAdmin)).toEqual(expected);
  });
});
