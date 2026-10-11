/**
 * Setting a scene through the API, for steps that are not what a spec proves.
 *
 * Signed in through the backend's development login, as the browser is, so
 * the same guards are crossed.
 */
import { expect, type APIRequestContext } from '@playwright/test';
import { devPassword } from './auth';

export async function apiAs(request: APIRequestContext, email: string) {
  const login = await request.post('/api/auth/dev-login', {
    data: { email, password: devPassword(email) },
  });
  expect(login.ok()).toBe(true);
  const { access_token: token } = (await login.json()) as { access_token: string };
  const headers = { Authorization: `Bearer ${token}` };

  async function call<T>(method: 'get' | 'post' | 'put', path: string, data?: unknown) {
    const response = await request[method](`/api${path}`, { headers, data });
    expect(response.ok(), `${method.toUpperCase()} ${path}: ${await response.text()}`).toBe(true);
    return (await response.json()) as T;
  }

  return {
    registerTeam: (name: string, leaderEmail: string) =>
      call<{ id: string }>('post', '/teams', { name, leader_email: leaderEmail }),
    addMember: (teamId: string, memberEmail: string) =>
      call('post', `/teams/${teamId}/members`, { email: memberEmail }),
    openMeeting: (teamId: string, date: string) =>
      call<{ id: string }>('post', `/teams/${teamId}/meetings`, { date, time: '13:00' }),
    addMetric: (teamId: string, metric: Record<string, unknown>) =>
      call<{ id: string }>('post', `/teams/${teamId}/metrics`, metric),
    addThreshold: (teamId: string, metricId: string, threshold: Record<string, unknown>) =>
      call('post', `/teams/${teamId}/metrics/${metricId}/thresholds`, threshold),
    /** `reason` makes it an administrator's correction, for a frozen meeting. */
    recordValue: (
      teamId: string,
      meetingId: string,
      metricId: string,
      value: string,
      reason?: string,
    ) =>
      call('put', `/teams/${teamId}/meetings/${meetingId}/values/${metricId}`, {
        value,
        manual_status: null,
        comment: null,
        reason,
      }),
  };
}

/** A date some days from another, as the API writes dates. */
export function addDays(date: string, days: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

export function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
