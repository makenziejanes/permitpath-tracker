import { json, checkCode } from '@/lib/server';
import { PERSON_IDS } from '@/lib/people';
import { googleConfigured, connections, authUrl } from '@/lib/google';

export const dynamic = 'force-dynamic';

// Who has connected a Google Calendar so far.
export async function GET(req) {
  if (!checkCode(req)) return json({ error: 'Your team code is missing or wrong.', code: 'team_code' }, 401);
  if (!googleConfigured()) return json({ configured: false, accounts: [] });
  const rows = await connections();
  return json({ configured: true, accounts: rows.map((r) => ({ person: r.person, email: r.email, connected_at: r.connected_at })) });
}

// Start connecting: returns the Google sign-in link for this person.
export async function POST(req) {
  if (!checkCode(req)) return json({ error: 'Your team code is missing or wrong.', code: 'team_code' }, 401);
  if (!googleConfigured()) return json({ error: 'Google isn’t set up on the server yet (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).' }, 400);
  const { person } = await req.json();
  if (!PERSON_IDS.includes(person)) return json({ error: 'Unknown person' }, 400);
  return json({ url: authUrl(req.nextUrl.origin, person) });
}
