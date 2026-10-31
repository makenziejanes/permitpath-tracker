import dns from 'node:dns/promises';
import { db, ready } from './server';
import { TZ, addDays } from './dates';

// Change these to change what the booking page offers. Hours are Mountain Time.
export const BOOKING = {
  lengths: [15, 30],    // meeting lengths people can pick
  defaultLength: 30,
  bufferMinutes: 30,    // keep this much free time before and after anything on your calendars (calls run long)
  days: [1, 2, 3, 4, 5], // Monday–Friday
  startHour: 8,         // first slot 8:00 am
  endHour: 18,          // last slot ends by 6:00 pm
  noticeHours: 12,      // nobody can book less than 12 hours ahead
  daysAhead: 21,        // how far out the calendar goes
  tz: TZ,
};

// ---------- time zone math (no libraries) ----------
function offsetMs(ts, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(ts).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(ts / 60000) * 60000;
}
// 'YYYY-MM-DD' + local hour/minute in tz → UTC ms
function zonedToUtc(day, h, m, tz) {
  const [y, mo, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, m);
  const t = guess - offsetMs(guess, tz);
  return guess - offsetMs(t, tz);
}
const localDay = (ts, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);

export function formatWhen(ts, tz = BOOKING.tz) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(ts);
}

export const lengthOf = (m) => (BOOKING.lengths.includes(Number(m)) ? Number(m) : BOOKING.defaultLength);

// Every slot inside working hours, before checking anyone's calendar.
// Slots start every `minutes` (15-minute calls on the quarter hour, 30-minute calls on the half hour).
export function candidateSlots(minutes, now = Date.now()) {
  const c = BOOKING;
  const earliest = now + c.noticeHours * 36e5;
  const out = [];
  const first = localDay(now, c.tz);
  for (let i = 0; i <= c.daysAhead; i++) {
    const day = addDays(first, i);
    const wd = new Date(day + 'T12:00:00Z').getUTCDay();
    if (!c.days.includes(wd)) continue;
    for (let min = c.startHour * 60; min + minutes <= c.endHour * 60; min += minutes) {
      const start = zonedToUtc(day, Math.floor(min / 60), min % 60, c.tz);
      if (start >= earliest) out.push(start);
    }
  }
  return out;
}

// A slot is free only if nothing on any calendar sits within the buffer before or after it.
export function freeSlots(candidates, busy, minutes) {
  const len = minutes * 60000;
  const gap = BOOKING.bufferMinutes * 60000;
  return candidates.filter((s) => !busy.some((b) => b.start < s + len + gap && b.end + gap > s));
}

// ---------- is this a real city email? ----------
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.us', 'mail.com', 'zoho.com', 'yandex.com',
  'comcast.net', 'att.net', 'sbcglobal.net', 'verizon.net', 'cox.net', 'charter.net', 'hey.com', 'fastmail.com',
]);
const squash = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

async function hasMail(domain) {
  try {
    const mx = await Promise.race([dns.resolveMx(domain), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
    return mx.length > 0;
  } catch (e) {
    return e.message === 'timeout' ? null : false; // null = couldn't tell
  }
}

// Returns { ok, reasons }. ok=false means someone should look before the meeting.
export async function checkCityEmail(email, city) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const reasons = [];
  if (FREE_MAIL.has(domain)) {
    reasons.push(`Uses a personal email (${domain}), not a city address.`);
  } else {
    const label = squash(domain.replace(/\.[a-z]+$/, ''));
    const cityName = squash(city);
    const govLike = /\.gov$/.test(domain) || /\.us$/.test(domain) || /\.(ci|city|town|co|vil|twp)\.[a-z.]+\.us$/.test(domain);
    const named = (cityName.length >= 3 && label.includes(cityName)) || /(cityof|townof|villageof|ci\.)/.test(domain);
    if (!govLike && !named) reasons.push(`${domain} doesn’t look like a city government address${city ? ` for ${city}` : ''}.`);
    const mail = await hasMail(domain);
    if (mail === false) reasons.push(`${domain} can’t receive email (no mail server found).`);
  }
  return { ok: reasons.length === 0, reasons };
}

// ---------- storage ----------
export async function ensureBookings() {
  await ready();
  await db()`create table if not exists bookings (
    id serial primary key, start_at timestamptz not null unique, end_at timestamptz not null,
    name text not null, role text, email text not null, city text not null, state text not null, notes text,
    email_ok boolean not null, email_reasons jsonb not null default '[]',
    event_id text, event_link text, created_at timestamptz not null default now())`;
}
