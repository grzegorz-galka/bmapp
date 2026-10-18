/**
 * Typed client for the meetings API.
 *
 * A meeting's `date` ("YYYY-MM-DD") and `time` ("HH:MM") are wall-clock
 * values on the organization's clock, as the team says them; `starts_at` is
 * the same moment as a UTC instant, for comparing with now.
 */
import { request } from './client';
import type { Employee, Schedule } from './teams';

export interface Meeting {
  id: string;
  team_id: string;
  date: string;
  time: string;
  starts_at: string;
  host: Employee | null;
}

/** A date and start time, as proposed for the next meeting or submitted for one. */
export interface MeetingSlot {
  date: string;
  time: string;
}

/** What opening a meeting takes: its slot and, optionally, its host. */
export interface MeetingOpen extends MeetingSlot {
  host_employee_id?: string | null;
}

export interface MeetingList {
  schedule: Schedule | null;
  proposed: MeetingSlot | null;
  /** Earliest first. */
  meetings: Meeting[];
}

/**
 * A partial change. A key left out is left alone; `host_employee_id: null`
 * clears the host.
 */
export interface MeetingChange {
  date?: string;
  time?: string;
  host_employee_id?: string | null;
}

function meetingsPath(teamId: string): string {
  return `/teams/${encodeURIComponent(teamId)}/meetings`;
}

export function getMeetings(teamId: string): Promise<MeetingList> {
  return request<MeetingList>(meetingsPath(teamId));
}

export function openMeeting(teamId: string, slot: MeetingOpen): Promise<Meeting> {
  return request<Meeting>(meetingsPath(teamId), {
    method: 'POST',
    body: JSON.stringify(slot),
  });
}

export function changeMeeting(
  teamId: string,
  meetingId: string,
  change: MeetingChange,
): Promise<Meeting> {
  return request<Meeting>(`${meetingsPath(teamId)}/${encodeURIComponent(meetingId)}`, {
    method: 'PATCH',
    body: JSON.stringify(change),
  });
}

export function deleteMeeting(teamId: string, meetingId: string): Promise<void> {
  return request<void>(`${meetingsPath(teamId)}/${encodeURIComponent(meetingId)}`, {
    method: 'DELETE',
  });
}
