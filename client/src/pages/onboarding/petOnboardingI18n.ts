/**
 * Pet onboarding shell — minimal i18n consumer for PR-PET-2 keys (PR-PET-4).
 *
 * PR-PET-2 (#217) added the canonical petOnboarding.* keys to
 *   client/public/locales/<lang>/translation.json
 * for all 6 supported languages (en/he/ar/ru/fr/es), but did NOT wire
 * them into either the monolithic client/src/lib/i18n.ts catalogue or
 * the dormant client/src/lib/i18next-init.ts (resources still empty).
 *
 * The proper canonicalisation (an i18next loader, or merging into the
 * monolith) is a separate PR class (PR-PET-7+ canonicalisation) and is
 * explicitly out of scope for PR-PET-4 (CEO directive 2026-05-09:
 * "no backend persistence expansion, no schema writes, no provider
 * coupling"). Activating a global i18n loader now would expand scope
 * and risk regressing every other client surface.
 *
 * What we do here, instead — minimum-viable activation, only inside the
 * pet onboarding shell:
 *   • Lazy-fetch /locales/<lang>/translation.json (the same files
 *     PR-PET-2 wrote) the FIRST time the shell renders.
 *   • Cache per-language in a module-scoped map.
 *   • Resolve dotted keys ("petOnboarding.start.continue") with a
 *     defensive fall-back to English when a key is missing in the
 *     active language (matches the PR-PET-2 stub-pattern guidance
 *     where translations have not yet been authored).
 *
 * NOT in scope:
 *   • Wiring i18next-init.ts.
 *   • Adding a new dependency (i18next-http-backend etc.).
 *   • Touching client/src/lib/i18n.ts (the monolithic catalogue).
 *   • Activating these keys outside the pet onboarding shell.
 */

type Bundle = Record<string, unknown>;

const cache = new Map<string, Bundle>();
const inflight = new Map<string, Promise<Bundle>>();

const SUPPORTED_LANGS = ['en', 'he', 'ar', 'ru', 'fr', 'es'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

function isSupportedLang(value: string): value is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(value);
}

export async function loadPetOnboardingBundle(lang: string): Promise<Bundle> {
  const safeLang: SupportedLang = isSupportedLang(lang) ? lang : 'en';
  const cached = cache.get(safeLang);
  if (cached) return cached;
  const pending = inflight.get(safeLang);
  if (pending) return pending;

  const promise = (async () => {
    const res = await fetch(`/locales/${safeLang}/translation.json`, {
      credentials: 'omit',
      cache: 'force-cache',
    });
    if (!res.ok) {
      throw new Error(`pet onboarding i18n: failed to load ${safeLang}`);
    }
    const json = (await res.json()) as Bundle;
    cache.set(safeLang, json);
    inflight.delete(safeLang);
    return json;
  })();

  inflight.set(safeLang, promise);
  return promise;
}

/** Resolve a dotted key against a loaded bundle. Returns the key itself
 *  on miss, so the UI never shows undefined. */
export function lookup(bundle: Bundle | null, key: string): string {
  if (!bundle) return key;
  const segments = key.split('.');
  let cursor: unknown = bundle;
  for (const seg of segments) {
    if (cursor && typeof cursor === 'object' && seg in (cursor as object)) {
      cursor = (cursor as Record<string, unknown>)[seg];
    } else {
      return key;
    }
  }
  return typeof cursor === 'string' ? cursor : key;
}

/** Resolve with English fallback when the active-language bundle is
 *  missing the key (PR-PET-2 stub pattern). */
export function lookupWithFallback(
  active: Bundle | null,
  english: Bundle | null,
  key: string,
): string {
  const fromActive = lookup(active, key);
  if (fromActive !== key) return fromActive;
  return lookup(english, key);
}
