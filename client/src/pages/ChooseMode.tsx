/**
 * ChooseMode — Pet Parent ↔ Provider workspace picker.
 *
 * CORRECTED MODEL (CEO 2026-08-26 §1-7): the two workspaces are
 *   • Pet Parent (customer) — present for every human user
 *   • Provider (approved provider application)
 *
 * Prestige is NOT a workspace / role — it is a MEMBERSHIP that travels
 * with the human. When the user is enrolled we surface a Prestige badge
 * INSIDE the Pet Parent tile (and, later, inside the Pet Parent home)
 * — never as a third mode, never as an identity to log in as.
 *
 * Contract:
 *   - Server post-login decider returns `nextUrl: '/mode'` for any
 *     approved provider when no explicit intent was supplied. Explicit
 *     intent (`provider` / `customer` / `pet_parent`) always wins and
 *     routes directly, so this page is only reached when the human
 *     genuinely needs to choose.
 *   - Selection sets the local UI mode (uiMode: 'customer' | 'provider')
 *     AND fires a fresh POST /api/auth/post-login with intent=chosen so
 *     the server hands back the canonical landing URL.
 *   - Single-workspace users (no provider capability) never see this
 *     page — they auto-route to /home. A user with ONLY provider
 *     capability but no customer capability shouldn't exist in this
 *     product (every human has a customer surface), but we still
 *     auto-route to /provider-os as a fail-safe.
 *
 * Fallback: on capabilities lookup failure the page renders the picker
 * anyway so the user is never trapped. On post-login failure after
 * selection we navigate to the canonical route for the picked mode.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { auth } from '@/lib/firebase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUiMode } from '@/lib/uiMode';
import { resolvePostLogin } from '@/lib/postLoginCoordinator';
import { getApiUrl } from '@/lib/apiConfig';
import { logger } from '@/lib/logger';

type Mode = 'petParent' | 'provider';

const PROVIDER_FALLBACK = '/provider-os';
const CUSTOMER_FALLBACK = '/prestige/home';

// The intent string the server post-login decider understands. Pet Parent
// maps to 'customer' — the historical name of the capability — so the
// server routes/intent allowlist keeps working without change.
const INTENT_BY_MODE: Record<Mode, string> = {
  petParent: 'customer',
  provider: 'provider',
};

export default function ChooseMode() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const he = language === 'he';
  const [, setUiMode] = useUiMode();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [capsLoading, setCapsLoading] = useState(true);
  const [hasProvider, setHasProvider] = useState(false);
  const [prestigeEnrolled, setPrestigeEnrolled] = useState(false);
  const [prestigeTier, setPrestigeTier] = useState<string | null>(null);
  const [providerServices, setProviderServices] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken().catch(() => undefined);
        const res = await fetch(getApiUrl('/api/me/capabilities'), {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({} as any));
        if (cancelled) return;
        const caps = data?.capabilities ?? data ?? {};
        const providerActive = !!caps?.provider?.active;
        setHasProvider(providerActive);
        setPrestigeEnrolled(!!caps?.prestige?.enrolled);
        setPrestigeTier(caps?.prestige?.tier ?? null);
        setProviderServices(Array.isArray(caps?.provider?.services) ? caps.provider.services : []);
        // NO provider capability → nothing to pick. Every human has Pet
        // Parent — send them straight there.
        if (!providerActive) { navigate(CUSTOMER_FALLBACK); return; }
      } catch (err: any) {
        logger.warn('[ChooseMode] capabilities load failed', { error: String(err?.message ?? err) });
      } finally {
        if (!cancelled) setCapsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  async function pick(mode: Mode) {
    if (busy) return;
    setBusy(mode);
    // Persist the UI-mode preference so the header ModeSwitch and nav
    // read the same value on subsequent renders. uiMode values are
    // 'customer' | 'provider' — the historical field name kept for
    // backwards compat; Pet Parent → 'customer'.
    setUiMode(mode === 'provider' ? 'provider' : 'customer');
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);
      const result = await resolvePostLogin({
        body: { intent: INTENT_BY_MODE[mode] },
        idToken,
      });
      const next = result?.nextUrl || result?.redirectTo;
      if (next && next !== '/mode') { navigate(next); return; }
    } catch (err: any) {
      logger.warn('[ChooseMode] post-login failed, using fallback', { mode, error: String(err?.message ?? err) });
    }
    navigate(mode === 'provider' ? PROVIDER_FALLBACK : CUSTOMER_FALLBACK);
  }

  const dir = he ? 'rtl' : 'ltr';
  const title = he ? 'איך תרצו להתחיל היום?' : 'How would you like to start today?';
  const subtitle = he
    ? 'לחשבון שלכם יש גם צד לקוח וגם סביבת ספק. בחרו איפה להתחיל — אפשר להחליף בכל רגע מהתפריט העליון.'
    : 'Your account has both a Pet Parent side and a Provider workspace. Pick where to start — you can flip anytime from the top bar.';

  if (capsLoading) {
    return (
      <div dir={dir} className="min-h-screen w-full bg-[#FAFAF7] flex items-center justify-center">
        <div className="text-[#555]" data-testid="choose-mode-loading">
          {he ? 'טוען…' : 'Loading…'}
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className="min-h-screen w-full bg-[#FAFAF7]">
      <div className="mx-auto w-full max-w-[720px] px-5 pt-10 pb-16">
        <h1 className="text-[26px] font-extrabold text-[#0E1B12] leading-tight">{title}</h1>
        <p className="mt-2 text-[15px] text-[#555] leading-relaxed">{subtitle}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {/* Pet Parent tile — always available. Prestige tier shows here
              as a BADGE (a benefit), never as a separate mode. */}
          <button
            type="button"
            data-testid="choose-mode-pet-parent"
            disabled={busy !== null}
            onClick={() => pick('petParent')}
            className="text-start rounded-2xl border border-[#ECE6D8] bg-white p-5 shadow-sm transition-transform active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#0E1B12]"
          >
            <div className="text-[13px] font-semibold uppercase tracking-wide text-[#0E1B12]">
              {he ? 'צד לקוח' : 'Customer side'}
            </div>
            <div className="mt-1 text-[22px] font-extrabold text-[#0E1B12]">
              {he ? 'המשך כהורה של חיה' : 'Continue as Pet Parent'}
            </div>
            <div className="mt-2 text-[13.5px] text-[#555] leading-relaxed">
              {he
                ? 'החיות שלכם, הזמנת שירותים, תחנות, ארנק, מתנות, נקודות והטבות.'
                : 'Your pets, bookings, stations, wallet, e-gifts, rewards and offers.'}
            </div>
            {prestigeEnrolled && (
              <div
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#E7D38F] bg-[#FBF3DA] px-2 py-0.5 text-[11.5px] font-semibold text-[#7A5A00]"
                data-testid="choose-mode-prestige-badge"
              >
                {he ? 'חבר Prestige' : 'PetWash Prestige'}
                {prestigeTier && <span className="opacity-70">· {String(prestigeTier).toUpperCase()}</span>}
              </div>
            )}
            <div className="mt-4 inline-flex text-[13.5px] font-bold text-[#0E1B12]">
              {busy === 'petParent' ? (he ? 'טוען…' : 'Loading…') : (he ? 'המשך ›' : 'Continue ›')}
            </div>
          </button>

          {/* Provider tile — only offered when caps.provider.active. */}
          <button
            type="button"
            data-testid="choose-mode-provider"
            disabled={!hasProvider || busy !== null}
            onClick={() => pick('provider')}
            className="text-start rounded-2xl border border-[#ECE6D8] bg-white p-5 shadow-sm transition-transform active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#0e7a54]"
          >
            <div className="text-[13px] font-semibold uppercase tracking-wide text-[#0e7a54]">
              {he ? 'סביבת עבודה' : 'Workspace'}
            </div>
            <div className="mt-1 text-[22px] font-extrabold text-[#0E1B12]">
              {he ? 'המשך כספק' : 'Continue as Provider'}
            </div>
            <div className="mt-2 text-[13.5px] text-[#555] leading-relaxed">
              {he
                ? 'היום, בקשות, יומן, הודעות, רווחים והתראות בטיחות.'
                : 'Today, requests, calendar, messages, earnings and safety alerts.'}
            </div>
            {providerServices.length > 0 && (
              <div className="mt-3 text-[12px] text-[#7A6E4D]">
                {providerServices.join(' · ')}
              </div>
            )}
            <div className="mt-4 inline-flex text-[13.5px] font-bold text-[#0E1B12]">
              {busy === 'provider' ? (he ? 'טוען…' : 'Loading…') : (he ? 'המשך ›' : 'Continue ›')}
            </div>
          </button>
        </div>

        <div className="mt-8 text-[12.5px] text-[#8A8A8A] leading-relaxed">
          {he
            ? 'ההטבות שלכם (Prestige, ארנק, מתנות, נקודות) שייכות לחשבון וזמינות תמיד בצד הלקוח — גם אחרי שהתחלתם בצד הספק.'
            : 'Your benefits (Prestige, wallet, e-gifts, points) belong to the account and are always available on the customer side — even after you start on the provider side.'}
        </div>
      </div>
    </div>
  );
}
