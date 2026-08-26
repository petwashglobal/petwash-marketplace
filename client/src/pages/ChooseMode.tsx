/**
 * ChooseMode — the role-mode picker for accounts that are BOTH an
 * approved Provider AND an enrolled Prestige member.
 *
 * CEO Nir directive (2026-08-26): "provider and also loyalty member, if
 * yes two dashboards, user choose log in as provider or loyalty that
 * changes things, even profile and dashboard, no place for mix."
 *
 * Contract:
 *   - Post-login decider returns `nextUrl: '/mode'` for a dual-role
 *     account when no explicit `intent` was supplied.
 *   - This page presents TWO tiles: Provider workspace / Prestige member.
 *   - The user's pick is (a) written to localStorage via useUiMode so
 *     the header mode-switch stays consistent, and (b) sent back as
 *     `intent` on a fresh POST /api/auth/post-login so the server hands
 *     us the canonical dashboard URL for that mode.
 *   - No local guesses about URLs — the server is authoritative.
 *
 * Fallbacks:
 *   - If capabilities load reveals only ONE role, the page auto-routes
 *     to that role's dashboard (no dead "you have nothing to pick" screen).
 *   - If /post-login is unavailable, we fall back to the known route for
 *     the picked mode (/provider-os or /prestige/home) rather than trap
 *     the user on this page.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { auth } from '@/lib/firebase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUiMode } from '@/lib/uiMode';
import { resolvePostLogin } from '@/lib/postLoginCoordinator';
import { getApiUrl } from '@/lib/apiConfig';
import { logger } from '@/lib/logger';

type Mode = 'provider' | 'loyalty';

const PROVIDER_FALLBACK = '/provider-os';
const LOYALTY_FALLBACK = '/prestige/home';

export default function ChooseMode() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const he = language === 'he';
  const [, setUiMode] = useUiMode();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [capsLoading, setCapsLoading] = useState(true);
  const [hasProvider, setHasProvider] = useState(false);
  const [hasPrestige, setHasPrestige] = useState(false);

  // Load capabilities so we can (a) auto-route when only one role exists
  // and (b) render tier / service badges on the tiles.
  const [tier, setTier] = useState<string | null>(null);
  const [services, setServices] = useState<string[]>([]);
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
        const prestigeEnrolled = !!caps?.prestige?.enrolled;
        setHasProvider(providerActive);
        setHasPrestige(prestigeEnrolled);
        setTier(caps?.prestige?.tier ?? null);
        setServices(Array.isArray(caps?.provider?.services) ? caps.provider.services : []);
        // Single-role auto-route — never trap the user on a picker they
        // have nothing to pick.
        if (providerActive && !prestigeEnrolled) { navigate(PROVIDER_FALLBACK); return; }
        if (!providerActive && prestigeEnrolled) { navigate(LOYALTY_FALLBACK); return; }
        if (!providerActive && !prestigeEnrolled) { navigate('/home'); return; }
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
    // Persist the UI-mode preference so the header switcher and nav read
    // the same value on subsequent renders (uiMode uses 'provider'|'customer').
    setUiMode(mode === 'provider' ? 'provider' : 'customer');
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);
      const result = await resolvePostLogin({ body: { intent: mode }, idToken });
      const next = result?.nextUrl || result?.redirectTo;
      if (next) { navigate(next); return; }
    } catch (err: any) {
      logger.warn('[ChooseMode] post-login failed, using fallback', { mode, error: String(err?.message ?? err) });
    }
    // Fallback: known canonical route for the picked mode.
    navigate(mode === 'provider' ? PROVIDER_FALLBACK : LOYALTY_FALLBACK);
  }

  const dir = he ? 'rtl' : 'ltr';
  const title = he ? 'איך תרצו להתחיל היום?' : 'How would you like to sign in today?';
  const subtitle = he
    ? 'החשבון שלכם הוא גם ספק וגם חבר PetWash Prestige. בחרו מצב — תוכלו להחליף בכל רגע מתוך התפריט.'
    : 'Your account is both a Provider and a PetWash Prestige member. Pick a mode — you can switch anytime from the header.';

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
          {/* Provider tile */}
          <button
            type="button"
            data-testid="choose-mode-provider"
            disabled={!hasProvider || busy !== null}
            onClick={() => pick('provider')}
            className="text-start rounded-2xl border border-[#ECE6D8] bg-white p-5 shadow-sm transition-transform active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#0E1B12]"
          >
            <div className="text-[13px] font-semibold uppercase tracking-wide text-[#0E1B12]">
              {he ? 'סביבת עבודה' : 'Workspace'}
            </div>
            <div className="mt-1 text-[22px] font-extrabold text-[#0E1B12]">
              {he ? 'התחברות כספק' : 'Continue as Provider'}
            </div>
            <div className="mt-2 text-[13.5px] text-[#555] leading-relaxed">
              {he
                ? 'לוח הזמנים, הזמנות פתוחות, יומן, תשלומים והתראות בטיחות.'
                : 'Your schedule, live bookings, calendar, payouts and safety alerts.'}
            </div>
            {services.length > 0 && (
              <div className="mt-3 text-[12px] text-[#7A6E4D]">
                {services.join(' · ')}
              </div>
            )}
            <div className="mt-4 inline-flex text-[13.5px] font-bold text-[#0E1B12]">
              {busy === 'provider' ? (he ? 'טוען…' : 'Loading…') : (he ? 'המשך ›' : 'Continue ›')}
            </div>
          </button>

          {/* Prestige tile */}
          <button
            type="button"
            data-testid="choose-mode-loyalty"
            disabled={!hasPrestige || busy !== null}
            onClick={() => pick('loyalty')}
            className="text-start rounded-2xl border border-[#ECE6D8] bg-white p-5 shadow-sm transition-transform active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#D4AF37]"
          >
            <div className="text-[13px] font-semibold uppercase tracking-wide text-[#7A5A00]">
              {he ? 'חבר Prestige' : 'PetWash Prestige'}
            </div>
            <div className="mt-1 text-[22px] font-extrabold text-[#0E1B12]">
              {he ? 'התחברות כחבר' : 'Continue as Member'}
            </div>
            <div className="mt-2 text-[13.5px] text-[#555] leading-relaxed">
              {he
                ? 'הזמנת שירותים, ארנק, מתנות, נקודות והנחות.'
                : 'Book services, wallet, e-gifts, rewards and member offers.'}
            </div>
            {tier && (
              <div className="mt-3 text-[12px] text-[#7A5A00]">
                {he ? 'רמה' : 'Tier'}: {String(tier).toUpperCase()}
              </div>
            )}
            <div className="mt-4 inline-flex text-[13.5px] font-bold text-[#0E1B12]">
              {busy === 'loyalty' ? (he ? 'טוען…' : 'Loading…') : (he ? 'המשך ›' : 'Continue ›')}
            </div>
          </button>
        </div>

        <div className="mt-8 text-[12.5px] text-[#8A8A8A] leading-relaxed">
          {he
            ? 'ניתן להחליף מצב מכל מקום בסרגל העליון. הפרופיל, הדשבורד וההזמנות עוברים בהתאם — אין ערבוב.'
            : 'You can switch mode anytime from the top bar. Your profile, dashboard and bookings follow the mode — never mixed.'}
        </div>
      </div>
    </div>
  );
}
