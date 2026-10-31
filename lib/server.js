import postgres from 'postgres';
import webpush from 'web-push';
import { today, isWeekday, prevWeekday, weekStart } from './dates';
import { PERSON_IDS, nameOf } from './people';

let _sql;
export function db() {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL is not set. Connect a Neon database in Vercel (Storage tab).');
    const local = /localhost|127\.0\.0\.1/.test(url);
    _sql = postgres(url, { ssl: local ? false : 'require', max: 1, prepare: false, idle_timeout: 20, onnotice: () => {} });
  }
  return _sql;
}

const SCHEMA = [
  `create table if not exists items (
    id serial primary key, person text not null, text text not null,
    source text not null default 'plan',        -- plan | request | extra | checklist
    from_person text, plan_date text not null,
    done boolean not null default false, done_date text,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  `create table if not exists entries (
    id serial primary key, person text not null, kind text not null,  -- plan | checkin
    date text not null, planned jsonb not null default '[]', done jsonb not null default '[]',
    still_open jsonb not null default '[]', extras jsonb not null default '[]',
    blocker text, request text, created_at timestamptz not null default now())`,
  `create table if not exists blockers (
    id serial primary key, person text not null, note text not null, date text not null,
    entry_id int, created_at timestamptz not null default now(),
    resolved_at timestamptz, resolved_date text, resolved_by text)`,
  `create table if not exists goals (
    id serial primary key, name text not null, owner text not null,
    current int not null default 0, target int not null, start_date text not null, deadline text not null,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    updated_by text, completed_at timestamptz)`,
  `create table if not exists goal_events (
    id serial primary key, goal_id int, goal_name text, person text, action text, detail text,
    date text not null, created_at timestamptz not null default now())`,
  `create table if not exists wins (
    id serial primary key, quote text not null, speaker text, city text, said_on text,
    added_by text, created_at timestamptz not null default now())`,
  `create table if not exists push_subs (
    endpoint text primary key, person text not null, sub jsonb not null,
    created_at timestamptz not null default now())`,
  `create index if not exists items_person_idx on items (person, done, plan_date)`,
  `create index if not exists entries_date_idx on entries (date)`,
];

let _ready;
export function ready() {
  if (!_ready) {
    _ready = (async () => {
      const sql = db();
      for (const stmt of SCHEMA) await sql.unsafe(stmt);
    })().catch((e) => { _ready = null; throw e; });
  }
  return _ready;
}

export function checkCode(req) {
  const code = process.env.TEAM_CODE;
  if (!code) return true;
  return (req.headers.get('x-team-code') || '').trim() === code.trim();
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function visibleItems(sql, t = today()) {
  return sql`select * from items
    where source <> 'checklist' and ((done = false and plan_date <= ${t}) or (done = true and done_date = ${t}))
    order by created_at, id`;
}

// The standing checklist: kept day over day until an item is moved to today or finished.
export async function checklistItems(sql, t = today()) {
  return sql`select * from items
    where source = 'checklist' and (done = false or done_date = ${t})
    order by created_at, id`;
}

export function computeStreak(rows, t) {
  const by = Object.fromEntries(PERSON_IDS.map((p) => [p, new Set()]));
  for (const r of rows) by[r.person]?.add(r.date);
  const both = (d) => PERSON_IDS.every((p) => by[p].has(d));
  let d = t;
  if (!isWeekday(d) || !both(d)) d = prevWeekday(d); // today still in progress, or weekend
  let count = 0;
  while (both(d)) { count++; d = prevWeekday(d); }
  return { count, todayDone: isWeekday(t) && both(t) };
}

export function computeScores(rows, t) {
  const ws = weekStart(t);
  const out = {};
  for (const p of PERSON_IDS) {
    const mine = rows.filter((r) => r.person === p && r.plan_date <= t);
    const week = mine.filter((r) => r.plan_date >= ws);
    const sum = (list) => {
      const done = list.filter((r) => r.done).length;
      return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : null };
    };
    out[p] = { week: sum(week), all: sum(mine) };
  }
  return out;
}

// ---- Push notifications ----
export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function notify(person, payload) {
  if (!pushConfigured()) return { sent: 0 };
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:team@permitpath.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  const sql = db();
  const subs = await sql`select * from push_subs where person = ${person}`;
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s.sub, JSON.stringify({ url: '/', ...payload }), { TTL: 60 * 60 * 12 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await sql`delete from push_subs where endpoint = ${s.endpoint}`;
      else console.error('push failed', e.statusCode, e.body);
    }
  }));
  return { sent };
}

export function listPreview(texts, max = 3) {
  if (!texts.length) return 'No items yet.';
  const head = texts.slice(0, max).join(', ');
  return texts.length > max ? `${head}, +${texts.length - max} more` : head;
}

export { nameOf };
