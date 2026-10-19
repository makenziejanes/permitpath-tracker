// All "days" in the app are Mountain Time calendar days, stored as 'YYYY-MM-DD' strings.
export const TZ = 'America/Denver';

export function today(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export function hourNow(d = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(d));
}

const noon = (s) => new Date(s + 'T12:00:00Z');
export const dow = (s) => noon(s).getUTCDay();
export const isWeekday = (s) => { const w = dow(s); return w > 0 && w < 6; };

export function addDays(s, n) {
  const d = noon(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function nextWeekday(s) { let d = addDays(s, 1); while (!isWeekday(d)) d = addDays(d, 1); return d; }
export function prevWeekday(s) { let d = addDays(s, -1); while (!isWeekday(d)) d = addDays(d, -1); return d; }
export function weekStart(s) { return addDays(s, -((dow(s) + 6) % 7)); } // Monday
export function daysBetween(a, b) { return Math.round((noon(b) - noon(a)) / 864e5); }

// Weekdays elapsed from day a to day b (0 if same day, 1 if next weekday, ...)
export function weekdaysBetween(a, b) {
  if (b <= a) return 0;
  let n = 0, d = a;
  while (d < b) { d = addDays(d, 1); if (isWeekday(d)) n++; }
  return n;
}

export function fmtDay(s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return noon(s).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}
export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
}
export function dayOf(ts) { return today(new Date(ts)); }
