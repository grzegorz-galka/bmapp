/**
 * Typed client for the pulse check: each member's answer at a meeting, and the
 * results the server computes from them.
 *
 * Averages and changes are decimal strings ("3.85"), like every number in the
 * API, and the status comes from the server; the interface never works one
 * out. `answers`, `missing` and `own` are null - not empty - when the viewer
 * may not read names, so "you may not see this" stays distinct from "nobody
 * answered".
 */
import { request } from './client';

export type PulseRating = 1 | 2 | 3 | 4 | 5;
export const PULSE_RATINGS: readonly PulseRating[] = [5, 4, 3, 2, 1];

/** The pulse check's status; `no_threshold` never occurs here. */
export type PulseStatus = 'green' | 'amber' | 'red' | 'no_data';

export interface PulseAnswerRead {
  employee_id: string;
  email: string;
  rating: PulseRating;
  status: PulseStatus;
  positive: string;
  negative: string;
  better: string;
  updated_at: string;
}

export interface PulseAnswerWrite {
  rating: PulseRating;
  positive: string;
  negative: string;
  better: string;
}

/** The latest earlier meeting of the team with at least one answer. */
export interface PulsePrevious {
  meeting_id: string;
  date: string;
  average: string;
}

export interface PulseTrendPoint {
  meeting_id: string;
  date: string;
  average: string;
  status: PulseStatus;
  answered: number;
}

export interface PulseMissingMember {
  employee_id: string;
  email: string;
}

export type PulseDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

export interface PulseResults {
  meeting_id: string;
  editable: boolean;
  answered: number;
  members: number;
  average: string | null;
  status: PulseStatus;
  previous: PulsePrevious | null;
  change: string | null;
  distribution: PulseDistribution;
  /** At most 16 meetings with answers, in date order, ending at this meeting. */
  trend: PulseTrendPoint[];
  answers: PulseAnswerRead[] | null;
  missing: PulseMissingMember[] | null;
  /** Always present, for the card shown with names hidden or withheld. */
  missing_count: number;
  own: PulseAnswerRead | null;
}

const enc = encodeURIComponent;

function pulsePath(teamId: string, meetingId: string): string {
  return `/teams/${enc(teamId)}/meetings/${enc(meetingId)}/pulse`;
}

export function getPulse(teamId: string, meetingId: string): Promise<PulseResults> {
  return request<PulseResults>(pulsePath(teamId, meetingId));
}

/** Record or replace the caller's own answer; nobody answers for someone else. */
export function putOwnPulseAnswer(
  teamId: string,
  meetingId: string,
  body: PulseAnswerWrite,
): Promise<PulseAnswerRead> {
  return request<PulseAnswerRead>(`${pulsePath(teamId, meetingId)}/me`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
