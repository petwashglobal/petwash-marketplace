/**
 * Which surface the user was last working in — admin, provider or member.
 *
 * WHY (CEO, 2026-09-19): "when i log in it take me to admin always".
 *
 * server/routes/post-login.ts already routes a super_admin by `intent`:
 *   'provider'                        → /provider-os
 *   'loyalty' | 'customer' | 'member' → /pet-parent/home
 *   'admin' or ABSENT                 → /admin/dashboard
 *
 * Nothing ever sent an intent on an ordinary sign-in, so it fell to the
 * default and the CEO landed on the admin dashboard every single time — even
 * when he had spent the previous session in the member or provider view.
 * client/src/lib/uiMode.ts already remembers customer-vs-provider, but it has
 * no 'admin' value and the login path never read it.
 *
 * This records the surface actually being used and hands it back as the intent
 * on the next sign-in, so login lands you where you left off. It is a LANDING
 * preference only: the super_admin claim and the header mode-switch are
 * untouched, and any explicit intent (a signup flow, an invite link) still
 * wins over it.
 */

export type Surface = 'admin' | 'provider' | 'customer';

const STORAGE_KEY = 'pw_last_surface';

/** Map a pathname to the surface it belongs to, or null if it belongs to none. */
export function surfaceForPath(pathname: string): Surface | null {
  if (!pathname) return null;
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/provider')) return 'provider';
  if (pathname.startsWith('/pet-parent') || pathname.startsWith('/my-')) return 'customer';
  return null;
}

export function readLastSurface(): Surface | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'admin' || v === 'provider' || v === 'customer' ? v : null;
  } catch {
    // Private mode / blocked storage — fall back to the server default.
    return null;
  }
}

export function writeLastSurface(surface: Surface): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, surface);
  } catch {
    /* storage unavailable — landing simply falls back to the server default */
  }
}

/** Record the surface for a pathname, if that path maps to one. */
export function recordSurfaceForPath(pathname: string): void {
  const s = surfaceForPath(pathname);
  if (s) writeLastSurface(s);
}

/**
 * The intent to send on sign-in when the caller has no explicit one.
 * 'admin' is returned as-is: the server already treats it as the admin landing.
 */
export function intentFromLastSurface(): string | undefined {
  return readLastSurface() ?? undefined;
}
