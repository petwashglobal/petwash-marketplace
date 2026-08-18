/**
 * becomeProviderRouting — pure resume-target derivation for the
 * /become-provider surface.
 *
 * Extracted from client/src/pages/BecomeProviderResume.tsx so the
 * routing rule can be unit-tested independently of React JSX (vitest
 * node environment cannot parse the .tsx file).
 *
 * The React component re-exports this function so consumers keep the
 * same import path.
 *
 * Per CEO §35.5 + §8: never route an already-approved provider back
 * through the onboarding wizard.
 */

export type ResumeTarget = string;

/** Provider type whitelist matches client/src/lib/becomeProvider.ts. */
const PROVIDER_TYPE_WHITELIST = new Set([
  'walker', 'sitter', 'driver', 'trainer', 'station_operator', 'pet_trek',
]);

export function providerTypeSafe(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return PROVIDER_TYPE_WHITELIST.has(raw) ? raw : null;
}

export function onboardingHref(type: string | null): ResumeTarget {
  return type ? `/provider-onboarding?type=${encodeURIComponent(type)}` : '/provider-onboarding';
}

/**
 * Map a server application record to the correct destination path.
 * Kept side-effect-free + typed narrowly so future callers can reuse it.
 */
export function resumeTargetFromApplication(
  application: { status?: string | null; stage?: string | null } | null | undefined,
  providerType: string | null | undefined,
): ResumeTarget {
  const type = providerType ?? null;
  if (!application) return onboardingHref(type);
  const status = (application.status || '').toString().toLowerCase();
  // Approved wins over stage — server may mark stage='approved' before
  // status is finalized, but "approved" as a status is the terminal grant.
  if (status === 'approved' || application.stage === 'approved') return '/provider/today';
  if (status === 'rejected' || application.stage === 'rejected') return '/provider/rejected';
  if (status === 'withdrawn') return onboardingHref(type);
  if (status === 'pending_review' || status === 'under_review') return '/provider/pending';
  // draft OR unrecognized status → resume the onboarding flow.
  return onboardingHref(type);
}
