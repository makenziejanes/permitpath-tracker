import { json } from '@/lib/server';
import { googleConfigured, connections, busyTimes } from '@/lib/google';
import { BOOKING, candidateSlots, freeSlots, lengthOf } from '@/lib/booking';

export const dynamic = 'force-dynamic';

// Public: open times when everyone who connected a calendar is free. ?minutes=15 or 30
export async function GET(req) {
  const minutes = lengthOf(req.nextUrl.searchParams.get('minutes'));
  const base = { minutes, lengths: BOOKING.lengths, tz: BOOKING.tz };
  if (!googleConfigured()) return json({ ...base, open: false, slots: [] });
  try {
    const accounts = await connections();
    if (!accounts.length) return json({ ...base, open: false, slots: [] });
    const cands = candidateSlots(minutes);
    if (!cands.length) return json({ ...base, open: true, slots: [] });
    const gap = BOOKING.bufferMinutes * 60000;
    const busy = await busyTimes(accounts, new Date(cands[0] - gap), new Date(cands.at(-1) + minutes * 60000 + gap));
    return json({ ...base, open: true, slots: freeSlots(cands, busy, minutes).map((t) => new Date(t).toISOString()) });
  } catch (e) {
    console.error('slots failed', e);
    return json({ ...base, open: false, slots: [], error: 'We couldn’t load open times. Please try again in a minute.' }, 502);
  }
}
