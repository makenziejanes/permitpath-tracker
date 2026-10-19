'use client';
import { useState } from 'react';
import { PEOPLE, nameOf } from '@/lib/people';
import { fmtDay, fmtTime, daysBetween } from '@/lib/dates';
import { ApprovedStamp } from './Stamp';

export function sortItems(items) {
  const rank = (i) => (i.source === 'request' && !i.done ? 0 : i.source === 'extra' ? 2 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}

export function dayApproved(items) {
  const planned = items.filter((i) => i.source !== 'extra');
  return planned.length > 0 && planned.every((i) => i.done);
}

function Item({ item, today, mine, onToggle, onDelete }) {
  const carried = item.source !== 'extra' && !item.done && item.plan_date < today;
  const age = carried ? daysBetween(item.plan_date, today) : 0;
  return (
    <li className={`item${item.done ? ' item-done' : ''}${item.source === 'request' ? ' item-request' : ''}`}>
      <button type="button" role="checkbox" aria-checked={item.done} disabled={!mine}
        className="check" onClick={() => onToggle(item)}>
        <span className="box" aria-hidden="true">
          <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
        </span>
        <span className="item-text">
          {item.text}
          <span className="tags">
            {item.source === 'request' && <span className="tag tag-request">From {nameOf(item.from_person)}</span>}
            {carried && <span className="tag">Carried over from {age === 1 ? 'yesterday' : fmtDay(item.plan_date, { weekday: 'short' })}</span>}
            {item.source === 'extra' && <span className="tag">Extra</span>}
          </span>
        </span>
      </button>
      {mine && <button type="button" className="item-x" onClick={() => onDelete(item)} aria-label={`Remove “${item.text}”`}>×</button>}
    </li>
  );
}

export default function TodayColumn({ person, items, today, mine, entries, score, onToggle, onAdd, onDelete, onSharePlan }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const sorted = sortItems(items);
  const planEntry = [...entries].reverse().find((e) => e.person === person && e.kind === 'plan');
  const checkin = [...entries].reverse().find((e) => e.person === person && e.kind === 'checkin');
  const approved = dayApproved(items);
  const p = PEOPLE[person];
  const weekPct = score?.week?.pct;

  const submit = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try { await onAdd(t); setText(''); } finally { setBusy(false); }
  };

  return (
    <section className={`col col-${person}${mine ? ' col-mine' : ''}`} aria-label={`${p.name}’s day`}>
      <header className="col-head">
        <div>
          <h3>{mine ? `Your day` : `${p.name}’s day`}</h3>
          <p className="col-sub">
            {planEntry ? `Plan shared ${fmtTime(planEntry.created_at)}` : 'Plan not shared yet'}
            {checkin ? `, checked in ${fmtTime(checkin.created_at)}` : ''}
          </p>
        </div>
        {approved ? <ApprovedStamp /> : weekPct !== null && weekPct !== undefined ? (
          <div className="col-score" title="Share of planned items completed this week"><b>{weekPct}%</b><span>this week</span></div>
        ) : null}
      </header>

      {sorted.length ? (
        <ul className="items">
          {sorted.map((i) => <Item key={i.id} item={i} today={today} mine={mine} onToggle={onToggle} onDelete={onDelete} />)}
        </ul>
      ) : (
        <p className="empty">{mine ? 'What are you committing to today? Add your first item below.' : `${p.name} hasn’t added anything for today.`}</p>
      )}

      {mine && (
        <>
          <form className="add" onSubmit={submit}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a commitment" maxLength={280} aria-label="New commitment" enterKeyHint="done" />
            <button type="submit" className="btn btn-quiet" disabled={busy || !text.trim()}>Add</button>
          </form>
          {items.length > 0 && (
            <button type="button" className="btn btn-quiet btn-block" onClick={onSharePlan}>
              {planEntry ? `Share updated plan with ${nameOf(person === 'makenzie' ? 'collin' : 'makenzie')}` : `Share plan with ${nameOf(person === 'makenzie' ? 'collin' : 'makenzie')}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
