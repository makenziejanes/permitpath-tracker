'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Badge from './Badge';
import Picker from './Picker';
import Skyline from './Skyline';
import GoalSheet from './GoalSheet';
import TodayColumn, { dayApproved } from './TodayColumn';
import CheckinSheet from './CheckinSheet';
import WinsWall from './WinsWall';
import LogView from './LogView';
import SettingsSheet from './SettingsSheet';
import { StampOverlay } from './Stamp';
import { act, getJSON, store, celebrate, currentSubscription, savePush } from '@/lib/client';
import { crossedMilestone } from '@/lib/pace';
import { PEOPLE, PERSON_IDS, partnerOf, nameOf } from '@/lib/people';
import { fmtDay, fmtTime } from '@/lib/dates';

const TABS = [['today', 'Today'], ['wins', 'Wins'], ['log', 'Log']];

function Stats({ data }) {
  const { streak, scores, entriesToday } = data;
  const checked = (p) => entriesToday.some((e) => e.person === p && e.kind === 'checkin');
  const pct = (v) => (v === null || v === undefined ? '–' : `${v}%`);
  return (
    <div className="stats">
      <div className="stat stat-streak">
        <span className="stat-num">{streak.count}</span>
        <span className="stat-label">
          weekday{streak.count === 1 ? '' : 's'} in a row you both checked in
          <span className="stat-today">
            {PERSON_IDS.map((p) => (
              <span key={p} className={checked(p) ? 'dot dot-on' : 'dot'}>{nameOf(p)} {checked(p) ? 'checked in' : 'not yet'}</span>
            ))}
          </span>
        </span>
      </div>
      <div className="stat stat-scores">
        <p className="stat-title">Commitment score <span>planned items completed</span></p>
        <table>
          <thead><tr><th scope="col"><span className="sr">Person</span></th><th scope="col">This week</th><th scope="col">Overall</th></tr></thead>
          <tbody>
            {PERSON_IDS.map((p) => (
              <tr key={p}>
                <th scope="row">{nameOf(p)}</th>
                <td>{pct(scores[p].week.pct)} <small>{scores[p].week.done}/{scores[p].week.total}</small></td>
                <td>{pct(scores[p].all.pct)} <small>{scores[p].all.done}/{scores[p].all.total}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [needCode, setNeedCode] = useState(false);
  const [tab, setTab] = useState('today');
  const [goalOpen, setGoalOpen] = useState(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stamp, setStamp] = useState(null);
  const [toast, setToast] = useState('');
  const [logVersion, setLogVersion] = useState(0);
  const toastTimer = useRef();

  const load = useCallback(async () => {
    try { setData(await getJSON('/api/state')); setLoadError(''); setNeedCode(false); }
    catch (e) {
      setLoadError(e.message);
      // Reading the dashboard needs the team code too, so a missing or wrong one sends the device back to the picker.
      const codeProblem = e.code === 'team_code';
      if (codeProblem) setData(null);
      setNeedCode(codeProblem);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    setMe(store.get('pp-me'));
    load();
    // Coming back from Google's "Allow" screen: reopen Settings so the result shows there.
    if (new URLSearchParams(location.search).has('google')) setSettingsOpen(true);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    const onMsg = (e) => { if (e.data?.type === 'refresh') load(); };
    document.addEventListener('visibilitychange', onVis);
    navigator.serviceWorker?.addEventListener('message', onMsg);
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); navigator.serviceWorker?.removeEventListener('message', onMsg); };
  }, [load]);

  const say = (m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3500); };

  const run = async (type, payload) => {
    try { const r = await act(type, payload); return r; }
    catch (e) {
      say(e.message);
      if (e.code === 'team_code') setSettingsOpen(true);
      throw e;
    }
  };

  const pick = async (who, code) => {
    store.set('pp-me', who);
    if (code) store.set('pp-code', code.trim());
    setMe(who);
    load();
    // If this device already had notifications on for someone else, re-point them.
    if (who !== 'viewer') currentSubscription().then((s) => s && savePush(who, s)).catch(() => {});
  };

  if (!mounted) return null;
  if (!me || needCode) {
    return <Picker codeRequired={data?.codeRequired || needCode} wrongCode={needCode && Boolean(store.get('pp-code'))} onPick={pick} />;
  }
  if (!data) {
    return (
      <main className="loading">
        <Badge size={48} />
        <p>{loadError ? `Couldn’t load the dashboard. ${loadError}` : 'Loading…'}</p>
        {loadError && <button type="button" className="btn btn-quiet" onClick={load}>Try again</button>}
      </main>
    );
  }

  const canEdit = me !== 'viewer';
  const partner = canEdit ? partnerOf(me) : null;
  const order = canEdit ? [me, partner] : PERSON_IDS;
  const myItems = canEdit ? data.items[me] : [];
  const myCheckin = canEdit && [...data.entriesToday].reverse().find((e) => e.person === me && e.kind === 'checkin');
  const evening = data.hour >= 17;

  const setItems = (person, fn) => setData((d) => ({ ...d, items: { ...d.items, [person]: fn(d.items[person]) } }));
  const setChecklist = (person, fn) => setData((d) => ({ ...d, checklist: { ...d.checklist, [person]: fn(d.checklist?.[person] || []) } }));

  const toggle = async (item) => {
    const before = dayApproved(data.items[me]);
    const next = data.items[me].map((i) => (i.id === item.id ? { ...i, done: !i.done, done_date: !i.done ? data.today : null } : i));
    setItems(me, () => next);
    try {
      await run('toggleItem', { id: item.id, done: !item.done });
      if (!before && dayApproved(next)) setStamp({ name: nameOf(me) });
    } catch { /* toast shown */ }
    load();
  };

  const addItem = async (text) => { const { item } = await run('addItem', { text }); setItems(me, (l) => [...l, item]); load(); };
  const delItem = async (item) => {
    setItems(me, (l) => l.filter((i) => i.id !== item.id));
    setChecklist(me, (l) => l.filter((i) => i.id !== item.id));
    await run('deleteItem', { id: item.id }).catch(() => {});
    load();
  };

  const addChecklist = async (text) => { const { item } = await run('addItem', { text, list: 'checklist' }); setChecklist(me, (l) => [...l, item]); load(); };
  const toggleChecklist = async (item) => {
    setChecklist(me, (l) => l.map((i) => (i.id === item.id ? { ...i, done: !i.done, done_date: !i.done ? data.today : null } : i)));
    await run('toggleItem', { id: item.id, done: !item.done }).catch(() => {});
    load();
  };
  // Checklist → today's focus, and back. Both update the screen first so the slide feels instant.
  const focus = async (item) => {
    setChecklist(me, (l) => l.filter((i) => i.id !== item.id));
    setItems(me, (l) => [...l, { ...item, source: 'plan', plan_date: data.today }]);
    try { await run('focusItem', { id: item.id }); say('Moved to today’s focus.'); } catch { /* toast shown */ }
    load();
  };
  const unfocus = async (item) => {
    setItems(me, (l) => l.filter((i) => i.id !== item.id));
    setChecklist(me, (l) => [...l, { ...item, source: 'checklist' }].sort((a, b) => a.id - b.id));
    try { await run('unfocusItem', { id: item.id }); say('Back on your checklist.'); } catch { /* toast shown */ }
    load();
  };
  const sharePlan = async () => {
    try { await run('postPlan'); say(`Plan shared with ${nameOf(partner)}.`); load(); setLogVersion((v) => v + 1); } catch {}
  };

  const submitCheckin = async (payload) => {
    const r = await act('checkin', payload).catch((e) => { if (e.code === 'team_code') setSettingsOpen(true); throw e; });
    setCheckinOpen(false);
    if (r.allDone) { setStamp({ name: nameOf(me) }); celebrate('milestone'); }
    else say(`Checked in. ${nameOf(partner)} will get a notification.`);
    load(); setLogVersion((v) => v + 1);
  };

  const saveGoal = async (f) => {
    const { goal } = await run('saveGoal', f);
    setGoalOpen(null); say(f.id ? 'Goal updated.' : `Added “${goal.name}”.`); load();
  };
  const progress = async (goal, change) => {
    const { goal: g, before } = await run('setProgress', { id: goal.id, ...change });
    setGoalOpen(g);
    const m = crossedMilestone(before, g.current, g.target);
    if (m) { celebrate(m === 1 ? 'complete' : 'milestone'); say(m === 1 ? `${g.name}: complete!` : `${g.name}: ${Math.round(m * 100)}% of the way there.`); }
    load();
  };
  const deleteGoal = async (goal) => { await run('deleteGoal', { id: goal.id }); setGoalOpen(null); say('Goal deleted.'); load(); };

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><Badge /><div><h1>PermitPath HQ</h1><p>{fmtDay(data.today, { weekday: 'long', month: 'long', day: 'numeric' })}</p></div></div>
        <div className="top-actions">
          <div className="book-pill">
            <a href="/book" target="_blank" rel="noopener" className="me-btn" aria-label="Open the booking page">
              <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12" rx="2" /><path d="M3 8.5h14M7 2.5v4M13 2.5v4" /></svg>
              Book
            </a>
            <button type="button" className="me-btn book-copy" aria-label="Copy booking link"
              onClick={() => navigator.clipboard.writeText(`${location.origin}/book`).then(() => say('Booking link copied.'), () => say(`${location.origin}/book`))}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M13 4.5V4a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 3 4v7a1.5 1.5 0 0 0 1.5 1.5H5" /></svg>
            </button>
          </div>
          <button type="button" className="me-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings and notifications">
            {canEdit ? nameOf(me) : 'Viewing'}
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3a5 5 0 0 0-5 5v3l-1.5 2.5h13L15 11V8a5 5 0 0 0-5-5zM8 16a2 2 0 0 0 4 0" /></svg>
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      <main className="main">
        {tab === 'today' && (
          <>
            <Skyline goals={data.goals} today={data.today} hour={data.hour} canEdit={canEdit}
              onOpen={(g) => setGoalOpen(g)} onAdd={(owner) => setGoalOpen({ owner })} />
            <Stats data={data} />
            <div className="cols">
              {order.map((p) => (
                <TodayColumn key={p} person={p} items={data.items[p]} checklist={data.checklist?.[p] || []}
                  today={data.today} mine={p === me} entries={data.entriesToday} score={data.scores[p]}
                  onToggle={toggle} onAdd={addItem} onDelete={delItem} onSharePlan={sharePlan}
                  onFocus={focus} onUnfocus={unfocus} onToggleChecklist={toggleChecklist} onAddChecklist={addChecklist} />
              ))}
            </div>
          </>
        )}
        {tab === 'wins' && (
          <WinsWall wins={data.wins} today={data.today} canEdit={canEdit}
            onAdd={async (f) => { await run('addWin', f); say('Pinned.'); load(); }}
            onDelete={async (w) => { await run('deleteWin', { id: w.id }); load(); }} />
        )}
        {tab === 'log' && (
          <LogView canEdit={canEdit} version={logVersion}
            onResolve={async (b) => { await run('resolveBlocker', { id: b.id }); load(); }}
            onReopen={async (b) => { await run('reopenBlocker', { id: b.id }); load(); }} />
        )}
      </main>

      {canEdit && tab === 'today' && (
        <div className="fab-wrap">
          <button type="button" className={`fab${evening && !myCheckin ? ' fab-due' : ''}`} onClick={() => setCheckinOpen(true)}>
            {myCheckin ? `Checked in ${fmtTime(myCheckin.created_at)}. Update` : '8pm check-in'}
          </button>
        </div>
      )}

      {goalOpen && (
        <GoalSheet key={goalOpen.id || 'new'} goal={goalOpen} today={data.today} canEdit={canEdit}
          onClose={() => setGoalOpen(null)} onSave={saveGoal} onProgress={progress} onDelete={deleteGoal} />
      )}
      {checkinOpen && (
        <CheckinSheet person={me} partner={partner} items={myItems} onClose={() => setCheckinOpen(false)} onSubmit={submitCheckin} />
      )}
      {settingsOpen && (
        <SettingsSheet me={me} pushReady={data.pushReady} codeRequired={data.codeRequired}
          onClose={() => setSettingsOpen(false)} onSwitch={() => { setSettingsOpen(false); store.set('pp-me', null); setMe(null); }} />
      )}
      {stamp && <StampOverlay date={data.today} name={stamp.name} onDone={() => setStamp(null)} />}
      <div className="toast" role="status" aria-live="polite">{toast && <span>{toast}</span>}</div>
    </div>
  );
}
