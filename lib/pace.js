import { daysBetween } from './dates';

// Straight-line pace from the goal's start date to its deadline.
export function pace(goal, todayStr) {
  const target = Number(goal.target) || 0;
  const current = Number(goal.current) || 0;
  if (target > 0 && current >= target) return { state: 'done', label: 'Complete' };
  const total = Math.max(1, daysBetween(goal.start_date, goal.deadline));
  const elapsed = Math.min(total, Math.max(0, daysBetween(goal.start_date, todayStr)));
  const left = Math.max(0, daysBetween(todayStr, goal.deadline));
  if (todayStr > goal.deadline) return { state: 'behind', label: 'Past deadline', left: 0 };
  const rate = target / total;
  const expected = rate * elapsed;
  const diffDays = rate > 0 ? (current - expected) / rate : 0;
  const perDay = left > 0 ? (target - current) / left : target - current;
  const need = perDay >= 10 ? Math.ceil(perDay) : Math.round(perDay * 10) / 10;
  const n = Math.round(Math.abs(diffDays));
  const plural = (k) => `${k} day${k === 1 ? '' : 's'}`;
  if (diffDays <= -1) return { state: 'behind', label: `${plural(n)} behind`, need, left };
  if (diffDays >= 1) return { state: 'ahead', label: `${plural(n)} ahead`, need, left };
  return { state: 'on', label: 'On pace', need, left };
}

export const MILESTONES = [0.25, 0.5, 0.75, 1];
export function crossedMilestone(before, after, target) {
  if (!target) return null;
  const a = before / target, b = after / target;
  let hit = null;
  for (const m of MILESTONES) if (a < m && b >= m) hit = m;
  return hit;
}
