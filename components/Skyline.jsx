'use client';
import { pace } from '@/lib/pace';

const FLOOR = 13;
const ROOF = 34;

function Building({ goal, big, today, onOpen }) {
  const maxF = big ? 14 : 9;
  const w = big ? 76 : 56;
  const target = goal.target || 1;
  const pct = Math.min(1, goal.current / target);
  const built = goal.current <= 0 ? 0 : Math.max(1, Math.round(pct * maxF));
  const done = goal.current >= goal.target;
  const H = maxF * FLOOR + ROOF;
  const topBuilt = H - built * FLOOR;
  const topPlan = H - maxF * FLOOR;
  const cols = big ? 4 : 3;
  const winW = big ? 8 : 7;
  const gap = (w - cols * winW) / (cols + 1);
  const p = pace(goal, today);
  const district = goal.owner === 'shared' ? 'downtown' : goal.owner === 'makenzie' ? 'sales' : 'product';

  const floors = [];
  for (let i = 0; i < maxF; i++) {
    const y = H - (i + 1) * FLOOR;
    if (i < built) {
      floors.push(
        <g key={i}>
          <rect x="0" y={y} width={w} height={FLOOR} className="b-floor" />
          {Array.from({ length: cols }, (_, c) => (
            <rect key={c} x={gap + c * (winW + gap)} y={y + 3.5} width={winW} height={6} rx="1"
              className={(i * 7 + c * 3 + goal.id) % 5 === 0 ? 'b-win b-win-off' : 'b-win'} />
          ))}
        </g>
      );
    } else {
      floors.push(<rect key={i} x="0.75" y={y + 0.75} width={w - 1.5} height={FLOOR - 1.5} className="b-plan" />);
    }
  }

  return (
    <button type="button" className={`building building-${district}${big ? ' building-big' : ''}`} onClick={() => onOpen(goal)}
      aria-label={`${goal.name}: ${goal.current} of ${goal.target}, ${p.label}. Open to update.`}>
      <svg viewBox={`-10 0 ${w + 20} ${H}`} width={w + 20} height={H} aria-hidden="true">
        {floors}
        {built > 0 && <rect x="-3" y={topBuilt - 3} width={w + 6} height="3" className="b-cap" />}
        {done ? (
          <g className="b-flag">
            <line x1={w / 2} y1={topBuilt - 3} x2={w / 2} y2={topBuilt - 30} />
            <path d={`M${w / 2} ${topBuilt - 30} l17 5.5 l-17 5.5 z`} />
          </g>
        ) : (
          <g className="b-crane">
            <line x1={w - 6} y1={topPlan} x2={w - 6} y2={topPlan - 26} />
            <line x1={-8} y1={topPlan - 24} x2={w + 8} y2={topPlan - 24} />
            <line x1={w - 6} y1={topPlan - 26} x2={w + 8} y2={topPlan - 24} />
            <line x1={w / 2 - 6} y1={topPlan - 24} x2={w / 2 - 6} y2={(built ? topBuilt : H) - 8} className="b-cable" />
            <rect x={w / 2 - 10} y={(built ? topBuilt : H) - 8} width="8" height="5" />
          </g>
        )}
      </svg>
      <span className="b-label">
        <span className="b-name">{goal.name}</span>
        <span className="b-count">{goal.current.toLocaleString()}<span> / {goal.target.toLocaleString()}</span></span>
        <span className={`pace pace-${p.state}`}>{p.label}</span>
      </span>
    </button>
  );
}

function District({ name, goals, big, today, onOpen, onAdd, emptyHint }) {
  return (
    <section className={`district${big ? ' district-downtown' : ''}`} aria-label={name}>
      <div className="district-row">
        {goals.map((g) => <Building key={g.id} goal={g} big={big} today={today} onOpen={onOpen} />)}
        {goals.length === 0 && (onAdd ? (
          <button type="button" className="lot" onClick={onAdd}>
            <span className="lot-sign"><span className="lot-plus" aria-hidden="true">+</span>{emptyHint}</span>
            <span className="lot-post" aria-hidden="true" />
          </button>
        ) : (
          <div className="lot lot-empty"><span className="lot-sign">No goals yet</span><span className="lot-post" /></div>
        ))}
      </div>
      <div className="street-sign"><span>{name}</span></div>
    </section>
  );
}

export default function Skyline({ goals, today, hour, onOpen, onAdd, canEdit }) {
  const by = (o) => goals.filter((g) => g.owner === o);
  const night = hour >= 19 || hour < 6;
  return (
    <div className={`skyline${night ? ' skyline-night' : ''}`}>
      <div className="sky-orb" aria-hidden="true" />
      {canEdit && goals.length > 0 && (
        <button type="button" className="sky-add" onClick={() => onAdd('shared')}>+ New goal</button>
      )}
      <div className="skyline-scroll">
        <District name="Sales District" goals={by('makenzie')} today={today} onOpen={onOpen}
          onAdd={canEdit ? () => onAdd('makenzie') : null} emptyHint="Add a sales goal" />
        <District name="Downtown" big goals={by('shared')} today={today} onOpen={onOpen}
          onAdd={canEdit ? () => onAdd('shared') : null} emptyHint="Add a shared goal" />
        <District name="Product District" goals={by('collin')} today={today} onOpen={onOpen}
          onAdd={canEdit ? () => onAdd('collin') : null} emptyHint="Add a product goal" />
      </div>
      <div className="ground" aria-hidden="true" />
    </div>
  );
}
