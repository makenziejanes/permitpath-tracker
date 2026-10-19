'use client';
import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { pace } from '@/lib/pace';
import { OWNERS, nameOf } from '@/lib/people';
import { fmtDay, addDays, dayOf } from '@/lib/dates';

function GoalForm({ goal, today, onSave, onCancel, onDelete, busy }) {
  const [f, setF] = useState({
    name: goal.name || '',
    owner: goal.owner || 'shared',
    target: goal.target ?? '',
    start_date: goal.start_date || today,
    deadline: goal.deadline || addDays(today, 14),
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <label>Goal name<input value={f.name} onChange={set('name')} placeholder="New city contacts" maxLength={80} required /></label>
      <fieldset className="seg">
        <legend>Owner</legend>
        {Object.entries(OWNERS).map(([id, label]) => (
          <label key={id} className={f.owner === id ? 'on' : ''}>
            <input type="radio" name="owner" value={id} checked={f.owner === id} onChange={set('owner')} />{label}
          </label>
        ))}
      </fieldset>
      <label>Target number<input type="number" inputMode="numeric" min="1" value={f.target} onChange={set('target')} placeholder="300" required /></label>
      <div className="form-row">
        <label>Start date<input type="date" value={f.start_date} onChange={set('start_date')} required /></label>
        <label>Deadline<input type="date" value={f.deadline} onChange={set('deadline')} required /></label>
      </div>
      <p className="hint">Pace is measured as a straight line from the start date to the deadline.</p>
      <div className="form-actions">
        {onDelete && <button type="button" className="btn btn-danger-quiet" onClick={onDelete} disabled={busy}>Delete goal</button>}
        <span className="spacer" />
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{goal.id ? 'Save changes' : 'Add goal'}</button>
      </div>
    </form>
  );
}

export default function GoalSheet({ goal, today, canEdit, onClose, onSave, onProgress, onDelete }) {
  const [editing, setEditing] = useState(!goal.id);
  const [value, setValue] = useState(goal.current ?? 0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValue(goal.current ?? 0); }, [goal.current]);
  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  if (editing) {
    return (
      <Sheet title={goal.id ? 'Edit goal' : 'New goal'} onClose={onClose}>
        <GoalForm goal={goal} today={today} busy={busy}
          onSave={(f) => run(() => onSave({ id: goal.id, ...f }))}
          onCancel={goal.id ? () => setEditing(false) : onClose}
          onDelete={goal.id ? () => { if (confirm(`Delete “${goal.name}”? Its progress will be removed.`)) run(() => onDelete(goal)); } : null} />
      </Sheet>
    );
  }

  const p = pace(goal, today);
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
  return (
    <Sheet title={goal.name} onClose={onClose}>
      <div className="goal-detail">
        <div className="goal-big">
          <span className="goal-num">{goal.current.toLocaleString()}</span>
          <span className="goal-of">of {goal.target.toLocaleString()}</span>
        </div>
        <div className="meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} className={`meter-${goal.owner}`} />
        </div>
        <p className="goal-meta">
          <span className={`pace pace-${p.state}`}>{p.label}</span>
          {' '}{OWNERS[goal.owner]} goal, due {fmtDay(goal.deadline)}.
          {p.state !== 'done' && p.need !== undefined && p.left > 0 && <> About {p.need} per day to finish on time.</>}
        </p>

        {canEdit ? (
          <>
            <div className="stepper">
              <button type="button" className="btn btn-quiet btn-step" disabled={busy || goal.current <= 0}
                onClick={() => run(() => onProgress(goal, { delta: -1 }))} aria-label="Subtract one">−1</button>
              <button type="button" className="btn btn-primary btn-step btn-plus" disabled={busy}
                onClick={() => run(() => onProgress(goal, { delta: 1 }))}>+1</button>
            </div>
            <form className="set-value" onSubmit={(e) => { e.preventDefault(); run(() => onProgress(goal, { value })); }}>
              <label>Set the count to
                <input type="number" inputMode="numeric" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
              </label>
              <button type="submit" className="btn btn-quiet" disabled={busy}>Set</button>
            </form>
          </>
        ) : null}
        <p className="fine">
          {goal.updated_by ? `Last changed by ${nameOf(goal.updated_by)}, ${fmtDay(dayOf(goal.updated_at))}.` : ''}
          {' '}Started {fmtDay(goal.start_date)}.
        </p>
        {canEdit && <button type="button" className="btn btn-quiet btn-block" onClick={() => setEditing(true)}>Edit name, owner, target, or dates</button>}
      </div>
    </Sheet>
  );
}
