/**
 * becomeProvider.ts — canonical "Become Provider" CTA helper.
 *
 * This module is the ONE place a "generic" Become-Provider CTA goes
 * through. It:
 *   1. Emits the canonical URL `/become-provider?requestedService=<code>`
 *      (CEO MASTER §A7 §D vocabulary — pet_sitting / dog_walking /
 *      training / pet_transport / station_operator). The `/become-provider`
 *      resume gate then decides anonymous → sign-in-with-preserved-context
 *      vs signed-in → draft/pending/approved.
 *   2. Sets localStorage.signup_intent='provider' so the post-login
 *      coordinator and the /api/auth/seed-intent HttpOnly cookie see a
 *      consistent intent across the auth redirect.
 *
 * The public signature — becomeProviderHref(type?) — remains
 * COMPATIBLE with every existing caller (legacy short-form aliases
 * `walker` / `sitter` / `trainer` / `driver` / `pet_trek` and even the
 * canonical codes `pet_sitting` etc. all work). The output URL is
 * upgraded to canonical form so no NEW emitter shipped downstream
 * writes the legacy `?type=<alias>` shape. The resume gate still
 * accepts the legacy shape for old bookmarks + email links.
 *
 * Related:
 *   * shared/lib/providerServiceVocabulary — the ONE vocabulary
 *   * @/lib/ctaActions — urlForProviderIntent + safeInternalReturnTo
 *   * @/pages/BecomeProviderResume — the resume gate this URL routes to
 */

import {
  normaliseToProviderServiceCode,
  type ProviderServiceCode,
} from '@shared/lib/providerServiceVocabulary';
import { urlForProviderIntent, type CtaUrlAttribution } from './ctaActions';

/** Legacy short-form alphabet the wizard + provider_services still use. */
export const PROVIDER_TYPE_WHITELIST = [
  'walker',
  'sitter',
  'driver',
  'trainer',
  'station_operator',
  'pet_trek',
] as const;

export type ProviderType = (typeof PROVIDER_TYPE_WHITELIST)[number];

export const BECOME_PROVIDER_PATH = '/become-provider';

export function isProviderType(value: unknown): value is ProviderType {
  return typeof value === 'string'
    && (PROVIDER_TYPE_WHITELIST as readonly string[]).includes(value);
}

/**
 * The canonical URL a generic Become-Provider CTA should navigate to.
 * Accepts:
 *   * any canonical code (pet_sitting / dog_walking / …)
 *   * any legacy alias (walker / sitter / …)
 *   * marketing shorthand (walk / sit / train / pet_trek / trek)
 *   * null / undefined → bare /become-provider (no intent seed)
 *
 * Emits `/become-provider?requestedService=<canonical code>` — the
 * shape the Lane E URL emitter, BecomeProviderResume canonical reader,
 * and ProviderOnboarding wizard all agree on. Legacy `?type=<alias>`
 * shape is NO LONGER EMITTED by this helper; the resume gate still
 * accepts it at the edge for old bookmarks + email links.
 */
export function becomeProviderHref(
  type?: string | null,
  attribution?: CtaUrlAttribution,
): string {
  const code: ProviderServiceCode | null = normaliseToProviderServiceCode(type);
  if (!code) return BECOME_PROVIDER_PATH;
  return urlForProviderIntent(code, attribution);
}

export function setProviderSignupIntent(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('signup_intent', 'provider');
    }
  } catch {
    // private mode / quota — non-fatal
  }
}

export function onClickBecomeProvider(
  navigate: (path: string) => void,
  type?: string | null,
  attribution?: CtaUrlAttribution,
): void {
  setProviderSignupIntent();
  navigate(becomeProviderHref(type, attribution));
}
