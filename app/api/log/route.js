import { db, ready, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ready();
    const sql = db();
    const [entries, blockers, goalEvents] = await Promise.all([
      sql`select * from entries order by created_at desc limit 600`,
      sql`select * from blockers order by created_at desc limit 300`,
      sql`select * from goal_events order by created_at desc limit 300`,
    ]);
    return json({ entries, blockers, goalEvents });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
