/**
 * welcomeBackOr — where to send a member right after a successful sign-in.
 *
 * CEO flow (2026-09-12, "Returning User – Sign in with Google"): Google /
 * Apple / One Tap are AUTHENTICATION only. A RETURNING member whose profile is
 * already complete must never see the completion form again — instead they get
 * a personal "ברוך שובך, ניר!" beat on /welcome-back and then continue to the
 * destination the server decided. A NEW or incomplete member goes straight to
 * the server's destination (/complete-profile, /verify-email, KYC, …).
 *
 * The server's decision (nextUrl) is never overridden — it is only carried
 * through /welcome-back as the canonical `returnTo` (validated by readReturnTo).
 */
const GATE_PREFIXES = ['/complete-profile', '/welcome-back', '/verify', '/blocked', '/provider-onboarding'];

export function welcomeBackOr(data: any, dest: string): string {
  const next: string = data?.nextUrl || data?.redirectTo || dest;
  const status = data?.profileStatus;
  const settled = status === 'complete' || status === 'approved';
  const returning = settled && data?.userStatus !== 'new';
  if (!returning || !next || GATE_PREFIXES.some((p) => next.startsWith(p))) return next;
  return `/welcome-back?returnTo=${encodeURIComponent(next)}`;
}
