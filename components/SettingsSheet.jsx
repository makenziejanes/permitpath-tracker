'use client';
import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { pushSupport, currentSubscription, enablePush, disablePush, savePush, store, getJSON } from '@/lib/client';
import { nameOf, partnerOf } from '@/lib/people';

export default function SettingsSheet({ me, pushReady, codeRequired, onSwitch, onClose }) {
  const [sup, setSup] = useState({});
  const [subbed, setSubbed] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(store.get('pp-code') || '');
  const viewer = me === 'viewer';

  useEffect(() => { setSup(pushSupport()); currentSubscription().then((s) => setSubbed(Boolean(s))).catch(() => {}); }, []);

  const [gcal, setGcal] = useState(null);
  const [gMsg, setGMsg] = useState('');
  useEffect(() => {
    getJSON('/api/google/connect').then(setGcal).catch((e) => setGMsg(e.message));
    const g = new URLSearchParams(location.search).get('google');
    if (g) {
      setGMsg({ connected: 'Google Calendar connected.', cancelled: 'Connecting was cancelled.' }[g] || 'Connecting didn’t work. Try again.');
      history.replaceState(null, '', location.pathname);
    }
  }, []);
  const connectGoogle = async () => {
    setGMsg('');
    try {
      const r = await fetch('/api/google/connect', { method: 'POST', headers: { 'content-type': 'application/json', 'x-team-code': store.get('pp-code') || '' }, body: JSON.stringify({ person: me }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      location.href = j.url;
    } catch (e) { setGMsg(e.message || 'Couldn’t start connecting.'); }
  };
  const mine = gcal?.accounts?.find((a) => a.person === me);

  const turnOn = async () => {
    setBusy(true); setMsg('');
    try { await enablePush(me); setSubbed(true); setMsg('Done. A test notification is on its way.'); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true); setMsg('');
    try { const s = await currentSubscription(); const r = await savePush(me, s, true); setMsg(r.sent ? 'Test sent.' : 'Couldn’t reach this device. Turn notifications off and on again.'); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const turnOff = async () => { setBusy(true); await disablePush().catch(() => {}); setSubbed(false); setMsg('Notifications are off on this device.'); setBusy(false); };

  let pushBody;
  if (viewer) pushBody = <p className="hint">Pick Makenzie or Collin to get notifications.</p>;
  else if (!pushReady) pushBody = <p className="hint">Notifications aren’t set up on the server yet. Add the VAPID keys in Vercel (see the README).</p>;
  else if (sup.ios && !sup.standalone) pushBody = (
    <ol className="steps">
      <li>Open this page in Safari.</li>
      <li>Tap the Share button, then <b>Add to Home Screen</b>.</li>
      <li>Open PermitPath from your home screen and come back here.</li>
    </ol>
  );
  else if (!sup.supported) pushBody = <p className="hint">This browser can’t receive notifications. Try Chrome on Android, or Safari on iPhone after adding to the home screen.</p>;
  else pushBody = subbed ? (
    <div className="row-btns">
      <button type="button" className="btn btn-quiet" onClick={test} disabled={busy}>Send a test</button>
      <button type="button" className="btn btn-quiet" onClick={turnOff} disabled={busy}>Turn off</button>
    </div>
  ) : <button type="button" className="btn btn-primary btn-block" onClick={turnOn} disabled={busy}>Turn on notifications</button>;

  return (
    <Sheet title="Settings" onClose={onClose}>
      <section className="ci-section">
        <h3>Notifications</h3>
        {!viewer && <p className="hint">You’ll get a notification when {nameOf(partnerOf(me))} shares a plan, checks in, or needs something from you.</p>}
        {pushBody}
        {msg && <p className="hint" role="status">{msg}</p>}
      </section>
      {!viewer && (
        <section className="ci-section">
          <h3>Google Calendar</h3>
          <p className="hint">The booking page (<a href="/book">/book</a>) only offers times when everyone connected is free.</p>
          {gcal && !gcal.configured && <p className="hint">Google isn’t set up on the server yet (see the README).</p>}
          {gcal?.configured && (
            <>
              {gcal.accounts.map((a) => <p key={a.person} className="hint">✓ {nameOf(a.person)}: {a.email}</p>)}
              <button type="button" className={`btn btn-block ${mine ? 'btn-quiet' : 'btn-primary'}`} onClick={connectGoogle}>
                {mine ? 'Reconnect my calendar' : 'Connect my Google Calendar'}
              </button>
            </>
          )}
          {gMsg && <p className="hint" role="status">{gMsg}</p>}
        </section>
      )}
      {codeRequired && !viewer && (
        <section className="ci-section">
          <h3>Team code</h3>
          <div className="add">
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" aria-label="Team code" />
            <button type="button" className="btn btn-quiet" onClick={() => { store.set('pp-code', code.trim()); setMsg('Team code saved.'); }}>Save</button>
          </div>
        </section>
      )}
      <section className="ci-section">
        <h3>This device</h3>
        <p className="hint">{viewer ? 'Viewing only.' : `Signed in as ${nameOf(me)}.`}</p>
        <button type="button" className="btn btn-quiet btn-block" onClick={onSwitch}>Switch person</button>
      </section>
    </Sheet>
  );
}
