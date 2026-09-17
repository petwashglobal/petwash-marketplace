import { readReturnTo } from '@/auth/returnTo';

/**
 * Where to land after signing in. AdminRouteGuard sends a lapsed admin here
 * with ?returnTo=<the admin page they were on>; take them back there.
 * readReturnTo() is the one canonical reader (it also accepts the legacy
 * ?next= and rejects anything that is not a safe same-site path); on top of
 * that only an /admin page is a valid landing — never the sign-in page itself.
 */
export function adminLandingPath(search: string = typeof window !== 'undefined' ? window.location.search : ''): string {
  try {
    const target = readReturnTo(search);
    if (target && /^\/admin(\/|$|\?)/.test(target) && !target.startsWith('/admin/login')) return target;
  } catch { /* fall through */ }
  return '/admin/octopus';
}
