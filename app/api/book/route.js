import crypto from 'node:crypto';
import { db, json, notify } from '@/lib/server';
import { PERSON_IDS } from '@/lib/people';
import { googleConfigured, connections, busyTimes, createEvent } from '@/lib/google';
import { BOOKING, candidateSlots, freeSlots, lengthOf, checkCityEmail, ensureBookings, formatWhen } from '@/lib/booking';

export const dynamic = 'force-dynamic';

const clean = (s, max = 200) => String(s || '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// Public: book a meeting. Every booking goes through; a doubtful email gets flagged and you both get an alert.
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (b.website) return json({ ok: true }); // hidden field only bots fill in

  const f = {
    name: clean(b.name, 120), role: clean(b.role, 120), email: clean(b.email, 200).toLowerCase(),
    city: clean(b.city, 120), state: clean(b.state, 40), notes: clean(b.notes, 2000), start: Date.parse(b.start),
  };
  if (!f.name || !f.city || !f.state) return json({ error: 'Please fill in your name, city, and state.' }, 400);
  if (!EMAIL.test(f.email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (!googleConfigured()) return json({ error: 'Booking isn’t open yet.' }, 503);

  // The time must be one we offer and still free on every connected calendar.
  const minutes = lengthOf(b.minutes);
  if (!candidateSlots(minutes).includes(f.start)) return json({ error: 'That time isn’t available. Please pick another.', code: 'taken' }, 409);
  const accounts = await connections();
  if (!accounts.length) return json({ error: 'Booking isn’t open yet.' }, 503);
  const end = f.start + minutes * 60000;
  const gap = BOOKING.bufferMinutes * 60000;
  const busy = await busyTimes(accounts, new Date(f.start - gap), new Date(end + gap));
  if (!freeSlots([f.start], busy, minutes).length) return json({ error: 'Someone just took that time. Please pick another.', code: 'taken' }, 409);

  await ensureBookings();
  const sql = db();
  const [{ n }] = await sql`select count(*)::int as n from bookings where email = ${f.email} and start_at > now()`;
  if (n >= 2) return json({ error: 'You already have meetings booked with us. Reply to your invite if you need to change one.' }, 429);

  const check = await checkCityEmail(f.email, f.city);
  let row;
  try {
    [row] = await sql`insert into bookings (start_at, end_at, name, role, email, city, state, notes, email_ok, email_reasons)
      values (${new Date(f.start)}, ${new Date(end)}, ${f.name}, ${f.role || null}, ${f.email}, ${f.city}, ${f.state},
        ${f.notes || null}, ${check.ok}, ${sql.json(check.reasons)}) returning id`;
  } catch (e) {
    if (e.code === '23505') return json({ error: 'Someone just took that time. Please pick another.', code: 'taken' }, 409);
    throw e;
  }

  // Makenzie's calendar holds the meeting when connected; everyone else is invited.
  const host = accounts.find((a) => a.person === 'makenzie') || accounts[0];
  const team = accounts.filter((a) => a !== host).map((a) => ({ email: a.email }));
  const flag = check.ok ? '' : '⚠️ CHECK EMAIL · ';
  const description = [
    `Booked through the PermitPath booking page.`,
    ``,
    `Name: ${f.name}${f.role ? `, ${f.role}` : ''}`,
    `City: ${f.city}, ${f.state}`,
    `Email: ${f.email}`,
    f.notes ? `\nWhat they'd like to cover:\n${f.notes}` : '',
    check.ok ? '' : `\n⚠️ This email may not be a real city address:\n- ${check.reasons.join('\n- ')}`,
  ].join('\n');

  try {
    const ev = await createEvent(host, {
      summary: `${flag}PermitPath × ${f.city}, ${f.state} (${f.name}, ${minutes} min)`,
      description,
      start: { dateTime: new Date(f.start).toISOString(), timeZone: BOOKING.tz },
      end: { dateTime: new Date(end).toISOString(), timeZone: BOOKING.tz },
      attendees: [{ email: f.email, displayName: f.name }, ...team],
      conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: true },
    });
    await sql`update bookings set event_id = ${ev.id}, event_link = ${ev.htmlLink} where id = ${row.id}`;
  } catch (e) {
    await sql`delete from bookings where id = ${row.id}`;
    console.error('create event failed', e);
    return json({ error: 'We couldn’t add the meeting to our calendar. Please try again, or email makenzie@permitpathcities.com.' }, 502);
  }

  const when = formatWhen(f.start);
  const payload = check.ok
    ? { title: `New meeting: ${f.city}, ${f.state}`, body: `${f.name} (${f.email}) booked ${minutes} min on ${when}.`, tag: `booking-${row.id}` }
    : { title: `⚠️ Check this booking: ${f.city}, ${f.state}`, body: `${f.name} booked ${when} with ${f.email}. ${check.reasons.join(' ')}`, tag: `booking-${row.id}` };
  await Promise.all(PERSON_IDS.map((p) => notify(p, payload).catch(() => {})));

  return json({ ok: true, when });
}
