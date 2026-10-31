import { readState, saveConnection } from '@/lib/google';

export const dynamic = 'force-dynamic';

// Google sends you back here after you click Allow.
export async function GET(req) {
  const p = req.nextUrl.searchParams;
  const back = (msg) => Response.redirect(new URL(`/?google=${encodeURIComponent(msg)}`, req.nextUrl.origin), 302);
  if (p.get('error')) return back('cancelled');
  const person = readState(p.get('state'));
  if (!person) return back('bad-link');
  try {
    await saveConnection(req.nextUrl.origin, person, p.get('code'));
    return back('connected');
  } catch (e) {
    console.error('google connect failed', e);
    return back('failed');
  }
}
