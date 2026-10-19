'use client';
import { fmtDay } from '@/lib/dates';

export function ApprovedStamp({ date, size = 'small' }) {
  return (
    <div className={`stamp stamp-${size}`} aria-label="Day approved">
      <span className="stamp-word">Approved</span>
      {date && <span className="stamp-date">{fmtDay(date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
    </div>
  );
}

export function StampOverlay({ date, name, onDone }) {
  return (
    <div className="stamp-overlay" onClick={onDone} onAnimationEnd={(e) => { if (e.animationName === 'overlay-out') onDone(); }}>
      <div className="stamp-overlay-inner">
        <ApprovedStamp date={date} size="big" />
        <p>{name}’s day is complete.</p>
      </div>
    </div>
  );
}
