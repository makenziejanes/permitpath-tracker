'use client';
import { useState } from 'react';
import Badge from './Badge';
import { PEOPLE } from '@/lib/people';

export default function Picker({ codeRequired, wrongCode, onPick }) {
  const [code, setCode] = useState('');
  return (
    <main className="picker">
      <Badge size={64} />
      <h1>PermitPath HQ</h1>
      <p>Who’s on this device?</p>
      {codeRequired && (
        <label className="code-field">Team code
          <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" placeholder="Only needed once per device" />
        </label>
      )}
      {wrongCode && <p className="error" role="alert">That team code didn’t work. Check it and try again.</p>}
      <div className="picker-btns">
        {Object.values(PEOPLE).map((p) => (
          <button key={p.id} type="button" className={`pick pick-${p.id}`} onClick={() => onPick(p.id, code)}>
            <span className="pick-name">{p.name}</span><span className="pick-role">{p.role}</span>
          </button>
        ))}
      </div>
      <button type="button" className="link" onClick={() => onPick('viewer', code)}>Just looking (view only)</button>
    </main>
  );
}
