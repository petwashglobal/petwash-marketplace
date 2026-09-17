/**
 * Where to land after signing in. AdminRouteGuard sends a lapsed admin here
 * with ?next=<the admin page they were on>; take them back there. Only a
 * same-site /admin path is accepted (no "//host", no scheme) so the parameter
 * can never become an open redirect.
 */
export function adminLandingPath(search: string = typeof window !== 'undefined' ? window.location.search : ''): string {
  try {
    const next = new URLSearchParams(search).get('next') || '';
    if (/^\/admin(\/[A-Za-z0-9._~\-\/]*)?$/.test(next) && !next.startsWith('/admin/login')) return next;
  } catch { /* fall through */ }
  return '/admin/octopus';
}
