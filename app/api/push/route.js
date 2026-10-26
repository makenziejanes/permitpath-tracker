import { db, ready, json, checkCode, notify, pushConfigured } from '@/lib/server';
import { PERSON_IDS } from '@/lib/people';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json({ key: process.env.VAPID_PUBLIC_KEY || null, ready: pushConfigured() });
}

export async function POST(req) {
  if (!checkCode(req)) return json({ error: 'Enter your team code to turn on notifications.' }, 401);
  const { person, sub, test } = await req.json();
  if (!PERSON_IDS.includes(person)) return json({ error: 'Unknown person' }, 400);
  await ready();
  const sql = db();
  if (sub?.endpoint) {
    await sql`insert into push_subs (endpoint, person, sub) values (${sub.endpoint}, ${person}, ${sql.json(sub)})
      on conflict (endpoint) do update set person = excluded.person, sub = excluded.sub`;
  }
  if (test) {
    const r = await notify(person, { title: 'Notifications are on', body: 'You’ll hear when your partner posts a plan, checks in, or needs something.', tag: 'test' });
    return json({ ok: true, ...r });
  }
  return json({ ok: true });
}

export async function DELETE(req) {
  if (!checkCode(req)) return json({ error: 'Your team code is missing or wrong.', code: 'team_code' }, 401);
  const { endpoint } = await req.json();
  await ready();
  if (endpoint) await db()`delete from push_subs where endpoint = ${endpoint}`;
  return json({ ok: true });
}
