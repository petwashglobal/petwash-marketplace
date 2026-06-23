/**
 * app-flavor.ts
 *
 * SINGLE source of truth for "which native app are we running inside?".
 *
 * The Prestige (customer) app and the Provider app ship the SAME web bundle
 * inside two separate Capacitor native projects with different bundle ids:
 *   • Prestige / customer → com.petwash.il  /  il.co.petwash.customer
 *   • Provider            → il.co.petwash.provider
 * The plain browser (web / SEO site) has no native runtime at all.
 *
 * Before this helper the detection logic was duplicated in two places that
 * could drift apart:
 *   • client/src/App.tsx (cold-start flavor effect)
 *   • client/src/components/AppTermsGate.tsx (detectFlavor)
 * Both now call getAppFlavor() so the mapping lives in exactly one place.
 *
 * Naming note: the customer native app is the "Prestige" app in product
 * language. The flavor literal stays 'customer' here because that is what the
 * existing call sites (AppTermsGate FLAVOR_DOC / COPY records) are keyed on.
 * The app-structure rebuild treats 'customer' === the Prestige flavor.
 *
 * Pure-ish: getAppFlavor() does one lazy dynamic import of @capacitor/app and
 * caches the result (the bundle id cannot change at runtime). flavorFromBundleId
 * is a pure function and is the unit-test seam.
 */

export type AppFlavor = 'web' | 'customer' | 'provider';

/**
 * Map a native bundle id to an app flavor. Pure — no I/O. Empty / missing id
 * (the browser case) resolves to 'web'.
 */
export function flavorFromBundleId(id: string | null | undefined): AppFlavor {
  if (!id) return 'web';
  return id.includes('.provider') ? 'provider' : 'customer';
}

let cached: AppFlavor | null = null;

/**
 * Resolve the running native app flavor exactly once. Returns 'web' when there
 * is no Capacitor runtime (a normal browser). Result is memoised because the
 * bundle id is fixed for the life of the process.
 */
export async function getAppFlavor(): Promise<AppFlavor> {
  if (cached !== null) return cached;
  try {
    const { App: CapApp } = await import('@capacitor/app');
    const info = await CapApp.getInfo();
    cached = flavorFromBundleId(typeof info?.id === 'string' ? info.id : '');
  } catch {
    cached = 'web'; // browser / no Capacitor plugin
  }
  return cached;
}

/** Test-only: clear the memoised flavor between cases. */
export function __resetAppFlavorCacheForTests(): void {
  cached = null;
}
