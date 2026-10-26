import { db, ready, json, checkCode } from '@/lib/server';
import { fmtTime, weekdaysBetween, dow } from '@/lib/dates';
import { nameOf } from '@/lib/people';

export const dynamic = 'force-dynamic';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function csv(rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = Array.isArray(v) ? v.join('; ') : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

export async function GET(req) {
  if (!checkCode(req)) return json({ error: 'Your team code is missing or wrong.', code: 'team_code' }, 401);
  await ready();
  const sql = db();
  const what = new URL(req.url).searchParams.get('what') || 'log';
  let rows, name;

  if (what === 'items') {
    const items = await sql`select * from items order by plan_date, id`;
    rows = [['item_id', 'person', 'planned_for', 'source', 'requested_by', 'item', 'done', 'done_on', 'counts_toward_score']];
    for (const i of items) {
      rows.push([i.id, nameOf(i.person), i.plan_date, i.source, i.from_person ? nameOf(i.from_person) : '',
        i.text, i.done ? 'yes' : 'no', i.done_date || '', i.source === 'extra' ? 'no' : 'yes']);
    }
    name = 'permitpath-items';
  } else {
    const [entries, blockers, events] = await Promise.all([
      sql`select * from entries order by created_at`,
      sql`select * from blockers order by created_at`,
      sql`select * from goal_events order by created_at`,
    ]);
    const blockerByEntry = new Map(blockers.filter((b) => b.entry_id).map((b) => [b.entry_id, b]));
    rows = [['date', 'weekday', 'time_mt', 'person', 'type', 'planned_items', 'planned_count',
      'done_items', 'done_count', 'still_open', 'extra_done', 'blocker', 'blocker_resolved_on',
      'blocker_resolved_by', 'weekdays_to_resolve', 'request_to_partner', 'detail']];
    const out = [];
    for (const e of entries) {
      const b = blockerByEntry.get(e.id);
      const isPlan = e.kind === 'plan';
      out.push({ at: e.created_at, row: [
        e.date, DAYS[dow(e.date)], fmtTime(e.created_at), nameOf(e.person),
        isPlan ? 'Morning plan' : '8pm check-in',
        isPlan ? e.planned : [...e.done, ...e.still_open], isPlan ? e.planned.length : e.done.length + e.still_open.length,
        isPlan ? '' : e.done, isPlan ? '' : e.done.length, isPlan ? '' : e.still_open, isPlan ? '' : e.extras,
        e.blocker || '', b?.resolved_date || (b ? 'open' : ''), b?.resolved_by ? nameOf(b.resolved_by) : '',
        b?.resolved_date ? weekdaysBetween(b.date, b.resolved_date) : '', e.request || '', '',
      ] });
    }
    for (const g of events) {
      out.push({ at: g.created_at, row: [g.date, DAYS[dow(g.date)], fmtTime(g.created_at), nameOf(g.person),
        'Goal change', '', '', '', '', '', '', '', '', '', '', '', `${g.goal_name}: ${g.detail}`] });
    }
    out.sort((a, b) => new Date(a.at) - new Date(b.at));
    rows.push(...out.map((o) => o.row));
    name = 'permitpath-checkin-log';
  }

  return new Response(csv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
