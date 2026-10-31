'use client';
import { useRef, useState } from 'react';
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

const SWIPE_GO = 80;

function CheckBox() {
  return (
    <span className="box" aria-hidden="true">
      <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
    </span>
  );
}

function Item({ item, today, mine, onToggle, onDelete, onUnfocus }) {
  const carried = item.source !== 'extra' && !item.done && item.plan_date < today;
  const age = carried ? daysBetween(item.plan_date, today) : 0;
  const canUnfocus = mine && item.source === 'plan' && !item.done && item.plan_date === today;
  return (
    <li className={`item${item.done ? ' item-done' : ''}${item.source === 'request' ? ' item-request' : ''}`}>
      <button type="button" role="checkbox" aria-checked={item.done} disabled={!mine}
        className="check" onClick={() => onToggle(item)}>
        <CheckBox />
        <span className="item-text">
          {item.text}
          <span className="tags">
            {item.source === 'request' && <span className="tag tag-request">From {nameOf(item.from_person)}</span>}
            {carried && <span className="tag">Carried over from {age === 1 ? 'yesterday' : fmtDay(item.plan_date, { weekday: 'short' })}</span>}
            {item.source === 'extra' && <span className="tag">Extra</span>}
          </span>
        </span>
      </button>
      {canUnfocus && (
        <button type="button" className="item-move" onClick={() => onUnfocus(item)} aria-label={`Move “${item.text}” back to your checklist`} title="Back to checklist">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M5 11l5 5 5-5" /></svg>
        </button>
      )}
      {mine && <button type="button" className="item-x" onClick={() => onDelete(item)} aria-label={`Remove “${item.text}”`}>×</button>}
    </li>
  );
}

// A checklist row. On a phone, sliding it to the right moves it into today's focus; the ↑ button does the same.
function ChecklistItem({ item, mine, onToggle, onDelete, onFocus }) {
  const touch = useRef(null);
  const [dx, setDx] = useState(0);
  const canMove = mine && !item.done;

  const onTouchStart = (e) => {
    if (!canMove) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, axis: null };
  };
  const onTouchMove = (e) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const x = t.clientX - s.x;
    const y = t.clientY - s.y;
    if (!s.axis && (Math.abs(x) > 8 || Math.abs(y) > 8)) s.axis = Math.abs(x) > Math.abs(y) ? 'x' : 'y';
    if (s.axis === 'x') setDx(Math.max(0, Math.min(x, 160)));
  };
  const onTouchEnd = () => {
    const go = touch.current?.axis === 'x' && dx >= SWIPE_GO;
    touch.current = null;
    setDx(0);
    if (go) onFocus(item);
  };

  return (
    <li className={`item cl-item${item.done ? ' item-done' : ''}${dx >= SWIPE_GO ? ' cl-ready' : ''}`}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      {canMove && <span className="cl-reveal" aria-hidden="true">Move to today →</span>}
      <div className="cl-row" style={dx ? { transform: `translateX(${dx}px)`, transition: 'none' } : undefined}>
        <button type="button" role="checkbox" aria-checked={item.done} disabled={!mine}
          className="check" onClick={() => onToggle(item)}>
          <CheckBox />
          <span className="item-text">{item.text}</span>
        </button>
        {canMove && (
          <button type="button" className="item-move item-move-up" onClick={() => onFocus(item)} aria-label={`Move “${item.text}” to today’s focus`} title="Move to today">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4M5 9l5-5 5 5" /></svg>
          </button>
        )}
        {mine && <button type="button" className="item-x" onClick={() => onDelete(item)} aria-label={`Remove “${item.text}”`}>×</button>}
      </div>
    </li>
  );
}

function AddForm({ placeholder, label, onAdd }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try { await onAdd(t); setText(''); } finally { setBusy(false); }
  };
  return (
    <form className="add" onSubmit={submit}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={280} aria-label={label} enterKeyHint="done" />
      <button type="submit" className="btn btn-quiet" disabled={busy || !text.trim()}>Add</button>
    </form>
  );
}

function Checklist({ person, items, mine, onToggle, onDelete, onFocus, onAdd }) {
  const open = items.filter((i) => !i.done).length;
  const list = items.length ? (
    <ul className="items">
      {items.map((i) => <ChecklistItem key={i.id} item={i} mine={mine} onToggle={onToggle} onDelete={onDelete} onFocus={onFocus} />)}
    </ul>
  ) : (
    <p className="empty">{mine ? 'Everything on your plate goes here. It stays put day to day.' : 'Nothing on the checklist.'}</p>
  );

  if (!mine) {
    return (
      <details className="checklist">
        <summary>{nameOf(person)}’s checklist <span className="cl-count">{open}</span></summary>
        {list}
      </details>
    );
  }
  return (
    <section className="checklist" aria-label="Your checklist">
      <h4 className="cl-head">Checklist <span className="cl-count">{open}</span></h4>
      {items.some((i) => !i.done) && <p className="cl-hint">Each morning, slide your most important items right (or tap ↑) to make them today’s focus.</p>}
      {list}
      <AddForm placeholder="Add to checklist" label="New checklist item" onAdd={onAdd} />
    </section>
  );
}

export default function TodayColumn({ person, items, checklist = [], today, mine, entries, score,
  onToggle, onAdd, onDelete, onSharePlan, onFocus, onUnfocus, onToggleChecklist, onAddChecklist }) {
  const sorted = sortItems(items);
  const planEntry = [...entries].reverse().find((e) => e.person === person && e.kind === 'plan');
  const checkin = [...entries].reverse().find((e) => e.person === person && e.kind === 'checkin');
  const approved = dayApproved(items);
  const p = PEOPLE[person];
  const weekPct = score?.week?.pct;
  const partnerName = nameOf(person === 'makenzie' ? 'collin' : 'makenzie');
  const hasChecklist = checklist.some((i) => !i.done);

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

      <h4 className="focus-head">Today’s focus</h4>
      {sorted.length ? (
        <ul className="items">
          {sorted.map((i) => <Item key={i.id} item={i} today={today} mine={mine} onToggle={onToggle} onDelete={onDelete} onUnfocus={onUnfocus} />)}
        </ul>
      ) : (
        <p className="empty">
          {mine
            ? hasChecklist ? 'What matters most today? Slide it over from your checklist below, or add it here.' : 'What are you committing to today? Add your first item below.'
            : `${p.name} hasn’t picked anything for today.`}
        </p>
      )}

      {mine && (
        <>
          <AddForm placeholder="Add to today" label="New commitment for today" onAdd={onAdd} />
          {items.length > 0 && (
            <button type="button" className="btn btn-quiet btn-block" onClick={onSharePlan}>
              {planEntry ? `Share updated plan with ${partnerName}` : `Share plan with ${partnerName}`}
            </button>
          )}
        </>
      )}

      <Checklist person={person} items={checklist} mine={mine} onToggle={onToggleChecklist}
        onDelete={onDelete} onFocus={onFocus} onAdd={onAddChecklist} />
    </section>
  );
}
