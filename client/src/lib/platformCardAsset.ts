/**
 * Locale-aware asset resolver for premium platform cards
 * (PR-PREMIUM-CARDS-1).
 *
 * CEO directive (2026-05-10): NEVER use IP-only language detection.
 * Priority order:
 *   1. explicit app language (prop / context)
 *   2. user profile language (out of scope at Phase 1; resolver
 *      accepts but Phase-1 callers do not pass it)
 *   3. browser navigator.language
 *   4. IP/country fallback ONLY if a sensible language emerges
 *      (out of scope at Phase 1; resolver leaves the slot for
 *      future use)
 *   5. English fallback
 *
 * Asset naming: {platform}-card.{locale}.webp
 * Asset directory: /assets/platform-cards/
 *
 * Fallback chain (per CEO):
 *   - requested locale not present → English variant
 *   - English variant not present → caller renders premium
 *     CSS-only fallback (gradient + heading); never recreate
 *     station imagery; never auto-translate text inside images.
 *
 * No network call. Pure function module. Source-pin tested.
 */

export type SupportedLocale = 'en' | 'he' | 'ar' | 'ru' | 'fr' | 'es';
const SUPPORTED: ReadonlySet<SupportedLocale> = new Set<SupportedLocale>([
  'en',
  'he',
  'ar',
  'ru',
  'fr',
  'es',
]);

/** Phase 1 ship list — only locales for which approved binary
 *  assets exist (per CEO 2026-05-10: Hebrew + English). Other
 *  locales fall back to English. */
const PHASE_1_SHIPPED: ReadonlySet<SupportedLocale> = new Set<SupportedLocale>([
  'en',
  'he',
]);

export interface ResolverInput {
  /** 1. Explicit app language. Highest priority. */
  explicit?: string | null;
  /** 2. User profile language. Slot reserved for future Phase. */
  profile?: string | null;
  /** 3. Browser navigator language hint. */
  navigator?: string | null;
  /** 4. IP / country fallback hint. **Lowest** before English. */
  ipCountry?: string | null;
}

function normalise(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null;
  const head = value.toLowerCase().split(/[-_]/)[0] as SupportedLocale;
  return SUPPORTED.has(head) ? head : null;
}

/** Resolve the locale to use for asset selection.
 *  Returns a SupportedLocale, never null (English is the floor). */
export function resolveLocale(input: ResolverInput): SupportedLocale {
  const explicit = normalise(input.explicit);
  if (explicit) return explicit;
  const profile = normalise(input.profile);
  if (profile) return profile;
  const nav = normalise(input.navigator);
  if (nav) return nav;
  const ip = normalise(input.ipCountry);
  if (ip) return ip;
  return 'en';
}

/** Compute the asset URL for a given platform + resolved locale.
 *  If the resolved locale is not in the Phase-1 shipped set,
 *  falls back to English. Caller is responsible for the
 *  CSS-only fallback if both .webp variants are physically
 *  missing from the build. */
export function platformCardAsset(
  platformId: string,
  locale: SupportedLocale,
): string {
  const lang = PHASE_1_SHIPPED.has(locale) ? locale : 'en';
  return `/assets/platform-cards/${platformId}-card.${lang}.webp`;
}

/** Convenience: combine resolver + asset path in one call. */
export function platformCardAssetFor(
  platformId: string,
  input: ResolverInput,
): string {
  return platformCardAsset(platformId, resolveLocale(input));
}
