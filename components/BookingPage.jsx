'use client';
import { useEffect, useMemo, useState } from 'react';

const STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN',
  'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

// US time zones people pick from before seeing times. Arizona is separate because it skips daylight saving.
const ZONES = [
  { id: 'America/New_York', name: 'Eastern' },
  { id: 'America/Chicago', name: 'Central' },
  { id: 'America/Denver', name: 'Mountain' },
  { id: 'America/Phoenix', name: 'Arizona' },
  { id: 'America/Los_Angeles', name: 'Pacific' },
  { id: 'America/Anchorage', name: 'Alaska' },
  { id: 'Pacific/Honolulu', name: 'Hawaii' },
];
const zoneName = (tz) => ZONES.find((z) => z.id === tz)?.name || tz;
// The browser's zone, matched to one of ours by its current offset, so we can mark it "Looks like yours".
function guessZone() {
  try {
    const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (ZONES.some((z) => z.id === mine)) return mine;
    const off = (tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).format(new Date()).split(' ').pop();
    return ZONES.find((z) => off(z.id) === off(mine))?.id || null;
  } catch { return null; }
}
const fmt = (iso, o, tz) => new Intl.DateTimeFormat('en-US', { ...o, timeZone: tz || undefined }).format(new Date(iso));
const dayKey = (iso, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const timeLabel = (iso, tz) => fmt(iso, { hour: 'numeric', minute: '2-digit' }, tz);
const fullLabel = (iso, tz) => fmt(iso, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }, tz);

const Icon = ({ d, ...p }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}><path d={d} /></svg>
);
const I = {
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  video: 'M15 10l5-3v10l-5-3M4 7h11v10H4z',
  free: 'M5 12l4 4L19 6',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  chat: 'M4 5h16v11H8l-4 4z',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  check: 'M5 12l4 4L19 6',
  back: 'M15 6l-6 6 6 6',
};

export default function BookingPage() {
  const [data, setData] = useState(null);
  const [day, setDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState({ name: '', role: '', email: '', city: '', state: '', notes: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const [minutes, setMinutes] = useState(30);
  const [tz, setTz] = useState(null);
  const [guess, setGuess] = useState(null);
  useEffect(() => { setGuess(guessZone()); }, []);

  const load = (m = minutes) => fetch(`/api/book/slots?minutes=${m}`, { cache: 'no-store' }).then((r) => r.json()).then(setData)
    .catch(() => setData({ open: false, slots: [], error: 'We couldn’t load open times. Check your connection and refresh.' }));
  useEffect(() => { setData(null); load(minutes); }, [minutes]);

  const days = useMemo(() => {
    const m = new Map();
    for (const s of data?.slots || []) { const k = dayKey(s, tz); if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
    return [...m.entries()];
  }, [data, tz]);
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

  const step = done ? 3 : slot ? 2 : 1;
  const clockIn = (z) => fmt(Date.now(), { hour: 'numeric', minute: '2-digit' }, z);

  let body;
  if (done) {
    body = (
      <div className="bk-done">
        <div className="bk-done-mark"><Icon d={I.check} /></div>
        <h2>You’re booked!</h2>
        <p className="bk-done-when">{fullLabel(done, tz)}</p>
        <p>A calendar invite with a Google Meet link is on its way to <b>{form.email}</b>. We’re looking forward to meeting you.</p>
      </div>
    );
  } else if (!data) {
    body = (
      <div className="bk-loading" aria-live="polite">
        <span className="sr">Loading open times…</span>
        <div className="bk-skel bk-skel-strip" />
        <div className="bk-skel-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="bk-skel" />)}</div>
      </div>
    );
  } else if (!data.open || !data.slots.length) {
    body = (
      <div className="bk-empty">
        <h2>{data.error ? 'Something went wrong' : data.open ? 'We’re fully booked' : 'Booking opens soon'}</h2>
        <p>{data.error || (data.open ? 'There are no open times in the next few weeks.' : 'Online booking isn’t open yet.')}</p>
        <p>Email <a href="mailto:makenzie@permitpathcities.com">makenzie@permitpathcities.com</a> and we’ll find a time that works.</p>
      </div>
    );
  } else if (!tz) {
    body = (
      <>
        <div className="bk-section-head"><h2>What time zone are you in?</h2></div>
        <div className="bk-zones" role="radiogroup" aria-label="Your time zone">
          {ZONES.map((z) => (
            <button key={z.id} type="button" role="radio" aria-checked={false} className={`bk-zone${z.id === guess ? ' guess' : ''}`} onClick={() => setTz(z.id)}>
              <b>{z.name}</b>
              <span>{clockIn(z.id)} now{z.id === guess ? ' · looks like yours' : ''}</span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (!slot) {
    const times = days.find(([k]) => k === day)?.[1] || [];
    body = (
      <>
        <div className="bk-section-head">
          <h2>Pick a time</h2>
          <div className="bk-seg" role="radiogroup" aria-label="Meeting length">
            {(data.lengths || [15, 30]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={m === minutes} className={m === minutes ? 'on' : ''} onClick={() => setMinutes(m)}>
                {m} min
              </button>
            ))}
          </div>
        </div>
        <div className="bk-days" role="tablist" aria-label="Day">
          {days.map(([k, list]) => (
            <button key={k} type="button" role="tab" aria-selected={k === day} className={`bk-day${k === day ? ' on' : ''}`} onClick={() => setDay(k)}>
              <span className="bk-day-wd">{fmt(list[0], { weekday: 'short' }, tz)}</span>
              <span className="bk-day-n">{fmt(list[0], { day: 'numeric' }, tz)}</span>
              <span className="bk-day-m">{fmt(list[0], { month: 'short' }, tz)}</span>
            </button>
          ))}
        </div>
        <p className="bk-dayline">
          <b>{day && times[0] ? fmt(times[0], { weekday: 'long', month: 'long', day: 'numeric' }, tz) : ''}</b>
          <span>{zoneName(tz)} Time · <button type="button" className="bk-link" onClick={() => setTz(null)}>Change</button></span>
        </p>
        <div className="bk-times">
          {times.map((s) => <button key={s} type="button" className="bk-time" onClick={() => setSlot(s)}>{timeLabel(s, tz)}</button>)}
        </div>
      </>
    );
  } else {
    body = (
      <form className="bk-form" onSubmit={submit}>
        <div className="bk-picked">
          <button type="button" className="bk-back" onClick={() => { setSlot(null); setErr(''); }} aria-label="Pick a different time"><Icon d={I.back} /></button>
          <div>
            <b>{fullLabel(slot, tz)}</b>
            <span>{minutes} minutes · Google Meet</span>
          </div>
        </div>
        <h2>Your details</h2>
        <label>Your name<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
        <label><span>Job title <span className="bk-opt">(optional)</span></span><input value={form.role} onChange={set('role')} autoComplete="organization-title" /></label>
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
          <span className="bk-help">Please use your city email address.</span>
        </label>
        <label><span>What would you like to talk about? <span className="bk-opt">(optional)</span></span>
          <textarea rows={3} value={form.notes} onChange={set('notes')} />
        </label>
        <label className="bk-hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
        {err && <p className="bk-err" role="alert">{err}</p>}
        <button type="submit" className="bk-submit" disabled={busy}>{busy ? 'Booking…' : 'Confirm meeting'}</button>
      </form>
    );
  }

  return (
    <div className="bk-page">
      <main className="bk">
        <aside className="bk-hero">
          <div className="bk-logo">
            <img src="/permitpath-logo.png" alt="PermitPath" width="816" height="208" />
          </div>
          <div className="bk-faces" aria-hidden="true"><span>M</span><span>C</span></div>
          <h1>Meet with Makenzie &amp; Collin</h1>
          <p className="bk-intro">A short call to show your city how PermitPath helps new businesses get through permitting, and to hear what your team needs.</p>
          <ul className="bk-chips">
            <li><Icon d={I.clock} />15 or 30 min</li>
            <li><Icon d={I.video} />Google Meet</li>
            <li><Icon d={I.free} />No cost</li>
          </ul>
          <div className="bk-cover">
            <p>What we’ll cover</p>
            <ul>
              <li><Icon d={I.map} />How PermitPath walks new businesses through your city’s permits</li>
              <li><Icon d={I.bolt} />Where applicants get stuck today, and how we can help</li>
              <li><Icon d={I.chat} />Your team’s questions</li>
            </ul>
          </div>
        </aside>

        <section className="bk-panel">
          <ol className="bk-steps" aria-label="Steps">
            {['Time', 'Details', 'Done'].map((s, i) => (
              <li key={s} className={i + 1 === step ? 'on' : i + 1 < step ? 'past' : ''} aria-current={i + 1 === step ? 'step' : undefined}>
                <span>{i + 1 < step ? <Icon d={I.check} /> : i + 1}</span>{s}
              </li>
            ))}
          </ol>
          {body}
        </section>
      </main>
      <footer className="bk-foot">
        <span>© PermitPath</span>
        <a href="/privacy">Privacy</a>
        <a href="mailto:makenzie@permitpathcities.com">Contact</a>
      </footer>
    </div>
  );
}
