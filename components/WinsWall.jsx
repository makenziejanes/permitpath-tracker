'use client';
import { useState } from 'react';
import Sheet from './Sheet';
import { fmtDay } from '@/lib/dates';
import { nameOf } from '@/lib/people';

function WinForm({ today, onSave, onClose }) {
  const [f, setF] = useState({ quote: '', speaker: '', city: '', said_on: today });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Sheet title="Pin a win" onClose={onClose}>
      <form className="form" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError('');
        try { await onSave(f); } catch (err) { setError(err.message); setBusy(false); }
      }}>
        <label>What they said<textarea rows={4} value={f.quote} onChange={set('quote')} maxLength={600} required placeholder="“This would save our front desk hours every week.”" /></label>
        <label>Who said it<input value={f.speaker} onChange={set('speaker')} maxLength={120} placeholder="Name and title" /></label>
        <div className="form-row">
          <label>City<input value={f.city} onChange={set('city')} maxLength={80} placeholder="Littleton, CO" /></label>
          <label>Date<input type="date" value={f.said_on} onChange={set('said_on')} /></label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions"><span className="spacer" />
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Pin to the wall</button>
        </div>
      </form>
    </Sheet>
  );
}

export default function WinsWall({ wins, today, canEdit, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="wins" aria-labelledby="wins-h">
      <div className="section-head">
        <h2 id="wins-h">Wins wall</h2>
        {canEdit && <button type="button" className="btn btn-quiet" onClick={() => setAdding(true)}>Pin a win</button>}
      </div>
      {wins.length ? (
        <ul className="board">
          {wins.map((w, n) => (
            <li key={w.id} className={`note note-${n % 4}`}>
              <span className="pin" aria-hidden="true" />
              <blockquote>{w.quote}</blockquote>
              <p className="note-by">{w.speaker || 'City official'}{w.city ? `, ${w.city}` : ''}</p>
              <p className="note-date">{w.said_on ? fmtDay(w.said_on, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}{w.added_by ? `. Pinned by ${nameOf(w.added_by)}` : ''}</p>
              {canEdit && <button type="button" className="note-x" aria-label="Remove this win"
                onClick={() => { if (confirm('Remove this quote from the wall?')) onDelete(w); }}>×</button>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">When a city official says something good about PermitPath, pin it here.</p>
      )}
      {adding && <WinForm today={today} onClose={() => setAdding(false)} onSave={async (f) => { await onAdd(f); setAdding(false); }} />}
    </section>
  );
}
