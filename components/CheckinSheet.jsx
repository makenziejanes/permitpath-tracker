'use client';
import { useState } from 'react';
import Sheet from './Sheet';
import { sortItems } from './TodayColumn';
import { nameOf } from '@/lib/people';

export default function CheckinSheet({ person, partner, items, onClose, onSubmit }) {
  const planned = sortItems(items.filter((i) => i.source !== 'extra'));
  const [states, setStates] = useState(() => Object.fromEntries(planned.map((i) => [i.id, i.done])));
  const [extras, setExtras] = useState([]);
  const [extra, setExtra] = useState('');
  const [blocker, setBlocker] = useState('');
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addExtra = () => { const t = extra.trim(); if (t) { setExtras([...extras, t]); setExtra(''); } };
  const doneCount = Object.values(states).filter(Boolean).length + extras.length;

  const submit = async () => {
    setBusy(true); setError('');
    const pending = extra.trim() ? [...extras, extra.trim()] : extras;
    try { await onSubmit({ states, extras: pending, blocker, request }); }
    catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Sheet title="8pm check-in" onClose={onClose}
      footer={<>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
          {busy ? 'Submitting…' : `Submit check-in${doneCount ? ` (${doneCount} done)` : ''}`}
        </button>
      </>}>
      <section className="ci-section">
        <h3>What got done</h3>
        {planned.length ? (
          <ul className="items items-compact">
            {planned.map((i) => (
              <li key={i.id} className={`item${states[i.id] ? ' item-done' : ''}`}>
                <button type="button" role="checkbox" aria-checked={!!states[i.id]} className="check"
                  onClick={() => setStates({ ...states, [i.id]: !states[i.id] })}>
                  <span className="box" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg></span>
                  <span className="item-text">{i.text}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="hint">Nothing was planned today. Add what you did below.</p>}
        {extras.length > 0 && (
          <ul className="chips">
            {extras.map((t, n) => (
              <li key={n} className="chip">{t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setExtras(extras.filter((_, k) => k !== n))}>×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="add">
          <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Something else you got done"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtra(); } }} maxLength={280} aria-label="Extra item you got done" />
          <button type="button" className="btn btn-quiet" onClick={addExtra} disabled={!extra.trim()}>Add</button>
        </div>
        <p className="hint">Anything left unchecked moves to tomorrow on its own.</p>
      </section>

      <section className="ci-section">
        <h3>What’s blocked</h3>
        <textarea rows={2} value={blocker} onChange={(e) => setBlocker(e.target.value)} placeholder="Leave empty if nothing is blocked" maxLength={500} aria-label="Blocker" />
        <label className="sub-label">I need something from {nameOf(partner)}
          <input value={request} onChange={(e) => setRequest(e.target.value)} placeholder={`Goes to the top of ${nameOf(partner)}’s list tomorrow`} maxLength={280} />
        </label>
      </section>
    </Sheet>
  );
}
