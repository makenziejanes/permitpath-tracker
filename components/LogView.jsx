'use client';
import { useEffect, useState, useCallback } from 'react';
import { getJSON } from '@/lib/client';
import { fmtDay, fmtTime, weekdaysBetween } from '@/lib/dates';
import { nameOf } from '@/lib/people';

function Blocker({ b, canEdit, onResolve, onReopen }) {
  if (!b) return null;
  const days = b.resolved_date ? weekdaysBetween(b.date, b.resolved_date) : null;
  return (
    <div className={`blocker${b.resolved_at ? ' blocker-done' : ''}`}>
      <p><b>Blocked:</b> {b.note}</p>
      {b.resolved_at ? (
        <p className="blocker-status">
          Resolved {fmtDay(b.resolved_date)} by {nameOf(b.resolved_by)}
          {days === 0 ? ', same day.' : `, ${days} weekday${days === 1 ? '' : 's'} later.`}
          {canEdit && <button type="button" className="link" onClick={() => onReopen(b)}>Reopen</button>}
        </p>
      ) : canEdit ? (
        <button type="button" className="btn btn-quiet btn-small" onClick={() => onResolve(b)}>Mark resolved</button>
      ) : <p className="blocker-status">Open</p>}
    </div>
  );
}

export default function LogView({ canEdit, onResolve, onReopen, version }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => getJSON('/api/log').then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load, version]);

  const resolve = async (b) => { await onResolve(b); load(); };
  const reopen = async (b) => { await onReopen(b); load(); };

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="hint">Loading the log…</p>;

  const blockerByEntry = new Map(data.blockers.filter((b) => b.entry_id).map((b) => [b.entry_id, b]));
  const days = new Map();
  const bucket = (d) => { if (!days.has(d)) days.set(d, { entries: [], goals: [] }); return days.get(d); };
  data.entries.forEach((e) => bucket(e.date).entries.push(e));
  data.goalEvents.forEach((g) => bucket(g.date).goals.push(g));
  const dates = [...days.keys()].sort().reverse();

  return (
    <section className="log" aria-labelledby="log-h">
      <div className="section-head">
        <h2 id="log-h">Check-in log</h2>
        <div className="exports">
          <a className="btn btn-quiet" href="/api/export" download>Export log (CSV)</a>
          <a className="btn btn-quiet" href="/api/export?what=items" download>Export items (CSV)</a>
        </div>
      </div>
      {!dates.length && <p className="empty">Morning plans and 8pm check-ins will show up here, one day at a time.</p>}
      {dates.map((d) => {
        const { entries, goals } = days.get(d);
        return (
          <article key={d} className="log-day">
            <h3>{fmtDay(d, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            {[...entries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((e) => (
              <div key={e.id} className={`log-entry log-${e.person}`}>
                <p className="log-who"><b>{nameOf(e.person)}</b>, {e.kind === 'plan' ? 'morning plan' : '8pm check-in'}, {fmtTime(e.created_at)}</p>
                {e.kind === 'plan' ? (
                  <ul className="log-list">{e.planned.map((t, n) => <li key={n}>{t}</li>)}</ul>
                ) : (
                  <>
                    <p className="log-tally">{e.done.length} of {e.done.length + e.still_open.length} planned items done{e.extras.length ? `, plus ${e.extras.length} extra` : ''}.</p>
                    <ul className="log-list">
                      {e.done.map((t, n) => <li key={`d${n}`} className="done">{t}</li>)}
                      {e.extras.map((t, n) => <li key={`x${n}`} className="done">{t} <span className="tag">Extra</span></li>)}
                      {e.still_open.map((t, n) => <li key={`o${n}`} className="open">{t} <span className="tag">Rolls to tomorrow</span></li>)}
                    </ul>
                    <Blocker b={blockerByEntry.get(e.id)} canEdit={canEdit} onResolve={resolve} onReopen={reopen} />
                    {e.request && <p className="log-request"><b>Asked {nameOf(e.person === 'makenzie' ? 'collin' : 'makenzie')} for:</b> {e.request}</p>}
                  </>
                )}
              </div>
            ))}
            {goals.length > 0 && (
              <details className="log-goals">
                <summary>{goals.length} goal update{goals.length === 1 ? '' : 's'}</summary>
                <ul>{goals.map((g) => <li key={g.id}>{nameOf(g.person)}: {g.goal_name}, {g.detail}</li>)}</ul>
              </details>
            )}
          </article>
        );
      })}
    </section>
  );
}
