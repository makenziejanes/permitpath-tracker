'use client';

const safe = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
export const store = safe;

const codeHeader = () => ({ 'x-team-code': safe.get('pp-code') || '' });

export async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store', headers: codeHeader() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.error || `Couldn’t load (${r.status})`);
    err.code = j.code;
    throw err;
  }
  return j;
}

// A plain link can't carry the team code header, so the CSV is fetched and saved from memory.
export async function downloadCSV(url) {
  const r = await fetch(url, { cache: 'no-store', headers: codeHeader() });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `Couldn’t export (${r.status})`);
  }
  const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || 'export.csv';
  const href = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export async function act(type, payload = {}) {
  const r = await fetch('/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...codeHeader() },
    body: JSON.stringify({ type, actor: safe.get('pp-me'), ...payload }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.error || 'Couldn’t save that. Check your connection and try again.');
    err.code = j.code;
    throw err;
  }
  return j;
}

function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupport() {
  if (typeof window === 'undefined') return { supported: false };
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { supported, ios, standalone, permission: supported ? Notification.permission : 'unsupported' };
}

export async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(person) {
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your phone or browser settings, then try again.');
  const { key } = await getJSON('/api/push');
  if (!key) throw new Error('Notifications aren’t set up on the server yet (missing VAPID keys).');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) });
  await savePush(person, sub, true);
  return sub;
}

export async function savePush(person, sub, test = false) {
  const r = await fetch('/api/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...codeHeader() },
    body: JSON.stringify({ person, sub: sub.toJSON(), test }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Couldn’t turn on notifications.');
  return j;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json', ...codeHeader() }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  await sub.unsubscribe();
}

export async function celebrate(kind = 'milestone') {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const confetti = (await import('canvas-confetti')).default;
  const colors = ['#c4473f', '#6a52a3', '#e0a12e', '#2f7d4e', '#3d7fb8'];
  if (kind === 'complete') {
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.35 }, colors });
    setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors }), 250);
    setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors }), 400);
  } else {
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.35 }, colors, scalar: 0.9 });
  }
}
