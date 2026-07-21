/**
 * appFlavor — which PetWash app is this bundle running as?
 *
 *   'provider'  — the native Provider app  (il.co.petwash.provider)
 *   'customer'  — the native Prestige app  (com.petwash.il)
 *   'web'       — browser (no Capacitor bundle id)
 *
 * The same React bundle ships in both native apps and on the web, so the
 * flavor is detected ONCE from the Capacitor bundle id and cached at module
 * level. Detection is async (Capacitor plugin import); consumers get 'web'
 * until it resolves, then re-render via the hook. Mirrors the detection in
 * App.tsx Router (bundle id contains '.provider' → provider app).
 */
import { useEffect, useState } from 'react';

export type AppFlavor = 'provider' | 'customer' | 'web';

// Build-time flavor: each native app is built with VITE_APP_FLAVOR stamped in
// (scripts/mobile/run-capacitor-app.mjs), so the flavor is known SYNCHRONOUSLY
// at frame 0 — no async bundle-id lookup, no web-experience flash, and the two
// apps are hardcoded-distinct. Falls through to runtime detection on web/dev
// where the var is unset.
// MUST be the exact `import.meta.env` token: Vite's env injection (dev) and
// static define replacement (build) only recognise that precise expression.
// The previous optional-chained form (cast through `any`) was invisible to
// both, so VITE_APP_FLAVOR was NEVER read — the "synchronous frame-0 flavor"
// silently didn't exist and every build fell back to the async Capacitor probe.
const BUILD_FLAVOR = (import.meta.env.VITE_APP_FLAVOR ?? '') as string;

let cachedFlavor: AppFlavor | null =
  BUILD_FLAVOR === 'provider' ? 'provider' : BUILD_FLAVOR === 'customer' ? 'customer' : null;
let pending: Promise<AppFlavor> | null = null;
const listeners = new Set<(f: AppFlavor) => void>();

export function detectAppFlavor(): Promise<AppFlavor> {
  if (cachedFlavor) return Promise.resolve(cachedFlavor);
  if (pending) return pending;
  pending = import('@capacitor/app')
    .then(async ({ App: CapApp }) => {
      try {
        const info = await CapApp.getInfo();
        const id = typeof info?.id === 'string' ? info.id : '';
        const flavor: AppFlavor = id === '' ? 'web' : id.includes('.provider') ? 'provider' : 'customer';
        cachedFlavor = flavor;
        listeners.forEach((l) => l(flavor));
        return flavor;
      } catch {
        cachedFlavor = 'web';
        return 'web' as AppFlavor;
      }
    })
    .catch(() => {
      cachedFlavor = 'web';
      return 'web' as AppFlavor;
    });
  return pending;
}

/** React hook: 'web' until native detection resolves (native resolves in ms). */
export function useAppFlavor(): AppFlavor {
  const [flavor, setFlavor] = useState<AppFlavor>(cachedFlavor ?? 'web');
  useEffect(() => {
    if (cachedFlavor) { setFlavor(cachedFlavor); return; }
    let mounted = true;
    const onResolve = (f: AppFlavor) => { if (mounted) setFlavor(f); };
    listeners.add(onResolve);
    detectAppFlavor();
    return () => { mounted = false; listeners.delete(onResolve); };
  }, []);
  return flavor;
}
