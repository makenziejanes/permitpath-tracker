'use client';
import { useEffect, useMemo, useState } from 'react';

const STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN',
  'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

const myTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const dayKey = (iso) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const dayLabel = (iso) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
const timeLabel = (iso) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const fullLabel = (iso) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));

export default function BookingPage() {
  const [data, setData] = useState(null);
  const [day, setDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState({ name: '', role: '', email: '', city: '', state: '', notes: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const [minutes, setMinutes] = useState(30);

  const load = (m = minutes) => fetch(`/api/book/slots?minutes=${m}`, { cache: 'no-store' }).then((r) => r.json()).then(setData)
    .catch(() => setData({ open: false, slots: [], error: 'We couldn’t load open times. Check your connection and refresh.' }));
  useEffect(() => { setData(null); load(minutes); }, [minutes]);

  const days = useMemo(() => {
    const m = new Map();
    for (const s of data?.slots || []) { const k = dayKey(s); if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
    return [...m.entries()];
  }, [data]);
  useEffect(() => { if (days.length && !days.some(([k]) => k === day)) setDay(days[0][0]); }, [days, day]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, start: slot, minutes }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error || 'Something went wrong. Please try again.');
        if (j.code === 'taken') { setSlot(null); load(); }
      } else setDone(slot);
    } catch { setErr('Couldn’t reach us. Check your connection and try again.'); }
    setBusy(false);
  };

  let body;
  if (done) {
    body = (
      <div className="bk-card bk-done">
        <h2>You’re booked</h2>
        <p><b>{fullLabel(done)}</b></p>
        <p>A calendar invite with a Google Meet link is on its way to <b>{form.email}</b>. Talk soon!</p>
      </div>
    );
  } else if (!data) {
    body = <div className="bk-card"><p className="bk-muted">Loading open times…</p></div>;
  } else if (!data.open || !data.slots.length) {
    body = (
      <div className="bk-card">
        <p>{data.error || (data.open ? 'We’re fully booked for the next few weeks.' : 'Online booking isn’t open yet.')}</p>
        <p className="bk-muted">Email <a href="mailto:makenzie@permitpathcities.com">makenzie@permitpathcities.com</a> and we’ll find a time.</p>
      </div>
    );
  } else if (!slot) {
    const times = days.find(([k]) => k === day)?.[1] || [];
    body = (
      <div className="bk-card">
        <h2>Pick a time</h2>
        <div className="bk-len" role="radiogroup" aria-label="Meeting length">
          {(data.lengths || [15, 30]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={m === minutes} className={`bk-day${m === minutes ? ' on' : ''}`} onClick={() => setMinutes(m)}>
              {m} min
            </button>
          ))}
        </div>
        <p className="bk-muted">Google Meet · times shown in {myTz().replace(/_/g, ' ')}</p>
        <div className="bk-days" role="tablist" aria-label="Day">
          {days.map(([k, list]) => (
            <button key={k} type="button" role="tab" aria-selected={k === day} className={`bk-day${k === day ? ' on' : ''}`} onClick={() => setDay(k)}>
              {dayLabel(list[0])}
            </button>
          ))}
        </div>
        <div className="bk-times">
          {times.map((s) => <button key={s} type="button" className="bk-time" onClick={() => setSlot(s)}>{timeLabel(s)}</button>)}
        </div>
      </div>
    );
  } else {
    body = (
      <form className="bk-card bk-form" onSubmit={submit}>
        <div className="bk-picked">
          <span><b>{fullLabel(slot)}</b> · {data.minutes} min</span>
          <button type="button" className="bk-link" onClick={() => { setSlot(null); setErr(''); }}>Change</button>
        </div>
        <label>Your name<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
        <label><span>Job title <span className="bk-muted">(optional)</span></span><input value={form.role} onChange={set('role')} autoComplete="organization-title" /></label>
        <div className="bk-row">
          <label>City<input required value={form.city} onChange={set('city')} autoComplete="address-level2" /></label>
          <label>State
            <select required value={form.state} onChange={set('state')}>
              <option value="" disabled>Pick</option>
              {STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label>Work email<input required type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@yourcity.gov" />
          <span className="bk-muted bk-small">Please use your city email address.</span>
        </label>
        <label><span>What would you like to talk about? <span className="bk-muted">(optional)</span></span>
          <textarea rows={3} value={form.notes} onChange={set('notes')} />
        </label>
        <label className="bk-hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
        {err && <p className="bk-err" role="alert">{err}</p>}
        <button type="submit" className="bk-submit" disabled={busy}>{busy ? 'Booking…' : 'Book meeting'}</button>
      </form>
    );
  }

  return (
    <main className="bk">
      <header className="bk-head">
        <img src="/icon-192.png" alt="" width="48" height="48" />
        <div>
          <p className="bk-brand">PermitPath</p>
          <h1>Meet with Makenzie &amp; Collin</h1>
        </div>
      </header>
      <p className="bk-intro">A short call to show your city how PermitPath helps new businesses get through permitting, and to hear what your team needs.</p>
      {body}
    </main>
  );
}
