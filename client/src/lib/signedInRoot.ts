/**
 * Where a SIGNED-IN web visitor at "/" or "/home" should go, given the
 * post-login decider's answer. Pure, so it is tested for real (the component
 * that uses it pulls in wouter + Firebase and cannot be imported under node).
 *
 * Returns null when the visitor should see the fallback (the marketing
 * Landing, as before 2026-09-19): decider not ok, 401, empty/relative-less
 * URL, an absolute/protocol-relative URL, or a target that would loop back.
 */
export const LOOPING_TARGETS: ReadonlySet<string> = new Set(['/', '/home']);

export function decideSignedInRoot(next: { ok: boolean; status: number; nextUrl?: string }): string | null {
  if (!next.ok || next.status === 401) return null;
  const url = (next.nextUrl || '').trim();
  if (!url || !url.startsWith('/') || url.startsWith('//')) return null;
  if (LOOPING_TARGETS.has(url.split('?')[0].split('#')[0])) return null;
  return url;
}
