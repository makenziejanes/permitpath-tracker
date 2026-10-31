import crypto from 'node:crypto';
import { db, ready } from './server';
import { dayStartUtc } from './booking';

// Each of you connects your own Google account once (Settings → Google Calendar).
// The refresh token lets the booking page read when you're busy and add meetings.
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.events',
];

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

const base = (origin) => (process.env.PUBLIC_URL || origin).replace(/\/$/, '');
export const redirectUri = (origin) => `${base(origin)}/api/google/callback`;

// The state value says who is connecting, signed so nobody can attach their calendar to your name.
const sign = (s) => crypto.createHmac('sha256', process.env.GOOGLE_CLIENT_SECRET).update(s).digest('base64url').slice(0, 24);
export const makeState = (person) => `${person}.${sign(person)}`;
export function readState(state = '') {
  const [person, sig] = state.split('.');
  return person && sig === sign(person) ? person : null;
}

export function authUrl(origin, person) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: makeState(person),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenCall(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    cache: 'no-store', // Next.js would otherwise cache these calls and serve stale tokens and busy times
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google token error: ${j.error_description || j.error || r.status}`);
  return j;
}

export async function ensureTable() {
  await ready();
  await db()`create table if not exists google_accounts (
    person text primary key, email text, refresh_token text not null,
    connected_at timestamptz not null default now())`;
}

export async function saveConnection(origin, person, code) {
  const t = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: redirectUri(origin) });
  if (!t.refresh_token) throw new Error('Google didn’t return a long-term key. Try connecting again.');
  const claims = JSON.parse(Buffer.from(t.id_token.split('.')[1], 'base64url').toString());
  await ensureTable();
  await db()`insert into google_accounts (person, email, refresh_token) values (${person}, ${claims.email}, ${t.refresh_token})
    on conflict (person) do update set email = excluded.email, refresh_token = excluded.refresh_token, connected_at = now()`;
  return claims.email;
}

export async function connections() {
  await ensureTable();
  return db()`select person, email, refresh_token, connected_at from google_accounts`;
}

const _tokens = new Map();
async function accessToken(acct) {
  const hit = _tokens.get(acct.person);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const t = await tokenCall({ refresh_token: acct.refresh_token, grant_type: 'refresh_token' });
  _tokens.set(acct.person, { token: t.access_token, exp: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

async function gcal(acct, path, init = {}) {
  const r = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    cache: 'no-store',
    headers: { authorization: `Bearer ${await accessToken(acct)}`, 'content-type': 'application/json', ...init.headers },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google Calendar error for ${acct.person}: ${j.error?.message || r.status}`);
  return j;
}

// Busy periods across every connected calendar, as [{ start, end, meeting }] in ms.
// A "meeting" has other guests or a video link; those get a longer gap because calls run long.
// Only timing, free/busy, guests-or-not and video-or-not are read; titles and details are never requested.
const EVENT_FIELDS = 'nextPageToken,items(status,transparency,start,end,eventType,hangoutLink,conferenceData/entryPoints/entryPointType,attendees(self,resource,responseStatus))';

export async function busyTimes(accounts, from, to) {
  const lists = await Promise.all(accounts.map(async (a) => {
    const out = [];
    let pageToken = '';
    do {
      const q = new URLSearchParams({
        timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', maxResults: '2500', fields: EVENT_FIELDS,
        ...(pageToken ? { pageToken } : {}),
      });
      const j = await gcal(a, `/calendars/primary/events?${q}`);
      for (const e of j.items || []) {
        if (e.status === 'cancelled' || e.transparency === 'transparent') continue; // marked "free"
        if (e.eventType === 'workingLocation') continue;
        const me = (e.attendees || []).find((x) => x.self);
        if (me?.responseStatus === 'declined') continue;
        const start = e.start.dateTime ? Date.parse(e.start.dateTime) : dayStartUtc(e.start.date);
        const end = e.end.dateTime ? Date.parse(e.end.dateTime) : dayStartUtc(e.end.date);
        const guests = (e.attendees || []).some((x) => !x.self && !x.resource);
        const video = Boolean(e.hangoutLink || e.conferenceData?.entryPoints?.some((p) => p.entryPointType === 'video'));
        out.push({ start, end, meeting: guests || video });
      }
      pageToken = j.nextPageToken || '';
    } while (pageToken);
    return out;
  }));
  return lists.flat();
}

export async function createEvent(acct, event) {
  return gcal(acct, '/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}
