/**
 * BecomeProviderResume — pure helpers. Extracted from
 * BecomeProviderResume.tsx so vitest (no JSX transform on server-side
 * tests) can pin them without having to parse a .tsx module.
 *
 * These helpers are side-effect free. Anything that reads
 * `window.location` or navigates lives in the component file.
 */

import {
  CODE_TO_LEGACY,
  type ProviderServiceCode,
} from '@shared/lib/providerServiceVocabulary';

export type ResumeTarget = string;

/** Attribution allowlist — CEO §A5. Nothing outside this set survives. */
export const ATTRIBUTION_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign',
  'utm_content', 'utm_term', 'campaignId', 'referrer',
] as const;
export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

/**
 * Onboarding href for a signed-in user with no existing draft. Emits
 * the CANONICAL `?requestedService=<code>` — CEO §A7 vocabulary.
 */
export function onboardingHref(service: ProviderServiceCode | null): ResumeTarget {
  if (!service) return '/provider-onboarding';
  return `/provider-onboarding?requestedService=${encodeURIComponent(service)}`;
}

/**
 * The canonical /become-provider URL to bounce back to after sign-in.
 * Attribution FIRST so the canonical `requestedService` stays
 * authoritative — CEO §6 (a hostile attribution cannot override it).
 */
export function canonicalBecomeProviderUrl(
  service: ProviderServiceCode | null,
  attribution: URLSearchParams,
): string {
  const params = new URLSearchParams(attribution);
  if (service) params.set('requestedService', service);
  const qs = params.toString();
  return qs ? `/become-provider?${qs}` : '/become-provider';
}

/**
 * Legacy accessor. Some tests + older adjacent surfaces still read the
 * `providerType` string in the legacy short-form alphabet.
 */
export function legacyProviderTypeFor(service: ProviderServiceCode | null): string | null {
  return service ? CODE_TO_LEGACY[service] : null;
}

/**
 * Map a server application record to the correct destination path.
 * Kept side-effect-free + typed narrowly so future callers can reuse it.
 */
export function resumeTargetFromApplication(
  application: { status?: string | null; stage?: string | null } | null,
  service: ProviderServiceCode | null,
): ResumeTarget {
  if (!application) return onboardingHref(service);
  const status = (application.status || '').toString().toLowerCase();
  if (status === 'approved' || application.stage === 'approved') return '/provider/today';
  if (status === 'rejected' || application.stage === 'rejected') return '/provider/rejected';
  if (status === 'withdrawn') return onboardingHref(service);
  if (
    status === 'pending' ||
    status === 'pending_review' ||
    status === 'under_review' ||
    status === 'processing' ||
    status === 'pending_resubmission'
  ) return '/provider/pending';
  return onboardingHref(service);
}
