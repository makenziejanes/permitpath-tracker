import { db, ready, json, checkCode, visibleItems, computeStreak, computeScores, pushConfigured } from '@/lib/server';
import { today, hourNow } from '@/lib/dates';
import { PERSON_IDS } from '@/lib/people';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!checkCode(req)) return json({ error: 'Your team code is missing or wrong.', code: 'team_code' }, 401);
  try {
    await ready();
    const sql = db();
    const t = today();
    const [items, entries, goals, wins, openBlockers, checkins, planned] = await Promise.all([
      visibleItems(sql, t),
      sql`select id, person, kind, created_at from entries where date = ${t} order by created_at`,
      sql`select * from goals order by created_at, id`,
      sql`select * from wins order by coalesce(said_on, '') desc, created_at desc`,
      sql`select * from blockers where resolved_at is null order by created_at`,
      sql`select distinct person, date from entries where kind = 'checkin'`,
      sql`select person, plan_date, done from items where source in ('plan', 'request')`,
    ]);
    const byPerson = Object.fromEntries(PERSON_IDS.map((p) => [p, items.filter((i) => i.person === p)]));
    return json({
      today: t,
      hour: hourNow(),
      items: byPerson,
      entriesToday: entries,
      goals,
      wins,
      openBlockers,
      streak: computeStreak(checkins, t),
      scores: computeScores(planned, t),
      codeRequired: Boolean(process.env.TEAM_CODE),
      pushReady: pushConfigured(),
    });
  } catch (e) {
    console.error(e);
    return json({ error: e.message }, 500);
  }
}
