import { db, ready, json, checkCode, visibleItems, notify, listPreview } from '@/lib/server';
import { today, nextWeekday } from '@/lib/dates';
import { PERSON_IDS, OWNERS, partnerOf, nameOf } from '@/lib/people';

export const dynamic = 'force-dynamic';

const clean = (s, max = 280) => String(s ?? '').trim().slice(0, max);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const toInt = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : null; };
class Bad extends Error {}
const need = (cond, msg) => { if (!cond) throw new Bad(msg); };

async function logGoal(sql, goal, person, action, detail) {
  await sql`insert into goal_events (goal_id, goal_name, person, action, detail, date)
    values (${goal.id}, ${goal.name}, ${person}, ${action}, ${detail}, ${today()})`;
}

const handlers = {
  async addItem(sql, { actor, text, list }) {
    text = clean(text);
    need(text, 'Type something to add.');
    const source = list === 'checklist' ? 'checklist' : 'plan';
    const [item] = await sql`insert into items (person, text, source, plan_date)
      values (${actor}, ${text}, ${source}, ${today()}) returning *`;
    return { item };
  },

  // Morning move: a checklist item becomes one of today's commitments and starts counting toward the score.
  async focusItem(sql, { actor, id }) {
    const [item] = await sql`update items set source = 'plan', plan_date = ${today()}, updated_at = now()
      where id = ${id} and person = ${actor} and source = 'checklist' and done = false returning *`;
    need(item, 'That item is no longer on your checklist.');
    return { item };
  },

  // Undo for today only. Items carried over from an earlier day stay committed so the score stays honest.
  async unfocusItem(sql, { actor, id }) {
    const [item] = await sql`update items set source = 'checklist', updated_at = now()
      where id = ${id} and person = ${actor} and source = 'plan' and done = false and plan_date = ${today()} returning *`;
    need(item, 'Only items added today can go back to the checklist.');
    return { item };
  },

  async toggleItem(sql, { actor, id, done }) {
    const t = today();
    const [item] = await sql`update items set done = ${!!done}, done_date = ${done ? t : null}, updated_at = now()
      where id = ${id} and person = ${actor} returning *`;
    need(item, 'That item is not on your list.');
    return { item };
  },

  async editItem(sql, { actor, id, text }) {
    text = clean(text);
    need(text, 'Item text can’t be empty.');
    const [item] = await sql`update items set text = ${text}, updated_at = now()
      where id = ${id} and person = ${actor} returning *`;
    need(item, 'That item is not on your list.');
    return { item };
  },

  async deleteItem(sql, { actor, id }) {
    await sql`delete from items where id = ${id} and person = ${actor}`;
    return {};
  },

  async postPlan(sql, { actor }) {
    const t = today();
    const mine = (await visibleItems(sql, t)).filter((i) => i.person === actor && i.source !== 'extra');
    const planned = mine.map((i) => i.text);
    need(planned.length, 'Add at least one item before sharing your plan.');
    const [entry] = await sql`insert into entries (person, kind, date, planned)
      values (${actor}, 'plan', ${t}, ${sql.json(planned)}) returning *`;
    await notify(partnerOf(actor), {
      title: `${nameOf(actor)}’s plan for today`,
      body: listPreview(planned),
      tag: `plan-${actor}-${t}`,
    });
    return { entry };
  },

  async checkin(sql, { actor, states = {}, extras = [], blocker, request }) {
    const t = today();
    const partner = partnerOf(actor);
    const current = (await visibleItems(sql, t)).filter((i) => i.person === actor);
    for (const i of current) {
      const want = states[i.id];
      if (typeof want === 'boolean' && want !== i.done) {
        await sql`update items set done = ${want}, done_date = ${want ? t : null}, updated_at = now() where id = ${i.id}`;
      }
    }
    const extraTexts = (Array.isArray(extras) ? extras : []).map((e) => clean(e)).filter(Boolean).slice(0, 20);
    for (const text of extraTexts) {
      await sql`insert into items (person, text, source, plan_date, done, done_date)
        values (${actor}, ${text}, 'extra', ${t}, true, ${t})`;
    }
    const after = (await visibleItems(sql, t)).filter((i) => i.person === actor && i.source !== 'extra');
    const done = after.filter((i) => i.done).map((i) => i.text);
    const stillOpen = after.filter((i) => !i.done).map((i) => i.text);
    blocker = clean(blocker, 500) || null;
    request = clean(request, 280) || null;

    const [entry] = await sql`insert into entries (person, kind, date, done, still_open, extras, blocker, request)
      values (${actor}, 'checkin', ${t}, ${sql.json(done)}, ${sql.json(stillOpen)}, ${sql.json(extraTexts)}, ${blocker}, ${request})
      returning *`;
    if (blocker) {
      await sql`insert into blockers (person, note, date, entry_id) values (${actor}, ${blocker}, ${t}, ${entry.id})`;
    }
    if (request) {
      await sql`insert into items (person, text, source, from_person, plan_date)
        values (${partner}, ${request}, 'request', ${actor}, ${nextWeekday(t)})`;
    }

    const total = done.length + stillOpen.length;
    const allDone = total > 0 && stillOpen.length === 0;
    let body = total ? `${done.length} of ${total} done` : 'Checked in';
    if (extraTexts.length) body += `, plus ${extraTexts.length} extra`;
    body += '.';
    if (blocker) body += ` Blocked: ${blocker}`;
    await notify(partner, { title: `${nameOf(actor)} checked in${allDone ? ': day approved' : ''}`, body, tag: `checkin-${actor}-${t}` });
    if (request) {
      await notify(partner, { title: `${nameOf(actor)} needs something from you`, body: `${request} (on your list tomorrow morning)`, tag: `request-${entry.id}` });
    }
    return { entry, allDone };
  },

  async resolveBlocker(sql, { actor, id }) {
    const [b] = await sql`update blockers set resolved_at = now(), resolved_date = ${today()}, resolved_by = ${actor}
      where id = ${id} and resolved_at is null returning *`;
    return { blocker: b || null };
  },

  async reopenBlocker(sql, { id }) {
    await sql`update blockers set resolved_at = null, resolved_date = null, resolved_by = null where id = ${id}`;
    return {};
  },

  async saveGoal(sql, { actor, id, name, owner, target, start_date, deadline }) {
    name = clean(name, 80);
    target = toInt(target);
    need(name, 'Give the goal a name.');
    need(OWNERS[owner], 'Pick who owns this goal.');
    need(target && target > 0, 'Target must be a number above 0.');
    need(isDate(deadline), 'Pick a deadline.');
    start_date = isDate(start_date) ? start_date : today();
    need(deadline > start_date, 'The deadline has to be after the start date.');
    if (!id) {
      const [goal] = await sql`insert into goals (name, owner, target, start_date, deadline, updated_by)
        values (${name}, ${owner}, ${target}, ${start_date}, ${deadline}, ${actor}) returning *`;
      await logGoal(sql, goal, actor, 'created', `created, target ${target} by ${deadline} (${OWNERS[owner]})`);
      return { goal };
    }
    const [old] = await sql`select * from goals where id = ${id}`;
    need(old, 'That goal no longer exists.');
    const changes = [];
    if (old.name !== name) changes.push(`renamed from "${old.name}"`);
    if (old.owner !== owner) changes.push(`owner ${OWNERS[old.owner]} to ${OWNERS[owner]}`);
    if (old.target !== target) changes.push(`target ${old.target} to ${target}`);
    if (old.start_date !== start_date) changes.push(`start ${old.start_date} to ${start_date}`);
    if (old.deadline !== deadline) changes.push(`deadline ${old.deadline} to ${deadline}`);
    const completed = old.current >= target;
    const [goal] = await sql`update goals set name = ${name}, owner = ${owner}, target = ${target},
      start_date = ${start_date}, deadline = ${deadline}, updated_at = now(), updated_by = ${actor},
      completed_at = ${completed ? (old.completed_at || new Date()) : null}
      where id = ${id} returning *`;
    if (changes.length) await logGoal(sql, goal, actor, 'edited', changes.join(', '));
    return { goal };
  },

  async setProgress(sql, { actor, id, value, delta }) {
    const [old] = await sql`select * from goals where id = ${id}`;
    need(old, 'That goal no longer exists.');
    const next = Math.max(0, delta !== undefined ? old.current + (toInt(delta) || 0) : toInt(value) ?? old.current);
    if (next === old.current) return { goal: old, before: old.current };
    const completed = next >= old.target;
    const [goal] = await sql`update goals set current = ${next}, updated_at = now(), updated_by = ${actor},
      completed_at = ${completed ? (old.completed_at || new Date()) : null}
      where id = ${id} returning *`;
    await logGoal(sql, goal, actor, 'progress', `${old.current} to ${next} of ${old.target}`);
    return { goal, before: old.current };
  },

  async deleteGoal(sql, { actor, id }) {
    const [old] = await sql`delete from goals where id = ${id} returning *`;
    if (old) await logGoal(sql, old, actor, 'deleted', `deleted at ${old.current} of ${old.target}`);
    return {};
  },

  async addWin(sql, { actor, quote, speaker, city, said_on }) {
    quote = clean(quote, 600);
    need(quote, 'Paste the quote first.');
    const [win] = await sql`insert into wins (quote, speaker, city, said_on, added_by)
      values (${quote}, ${clean(speaker, 120) || null}, ${clean(city, 80) || null},
      ${isDate(said_on) ? said_on : today()}, ${actor}) returning *`;
    return { win };
  },

  async deleteWin(sql, { id }) {
    await sql`delete from wins where id = ${id}`;
    return {};
  },
};

export async function POST(req) {
  if (!checkCode(req)) return json({ error: 'Your team code is missing or wrong.', code: 'team_code' }, 401);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const fn = handlers[body.type];
  if (!fn) return json({ error: 'Unknown action' }, 400);
  if (!PERSON_IDS.includes(body.actor)) return json({ error: 'Pick who you are first.' }, 400);
  try {
    await ready();
    const result = await fn(db(), body);
    return json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof Bad) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: 'Something went wrong saving that. Try again.' }, 500);
  }
}
