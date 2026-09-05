import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Home, Footprints, CalendarDays, MessageCircle, User } from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useWhoami } from '@/auth/useWhoami';
import { useLanguage } from '@/lib/languageStore';
import { useAccountNavigation } from '@/hooks/useAccountNavigation';
import { isImmersiveRoute } from '@/lib/immersive-routes';
import { useAppFlavor } from '@/lib/appFlavor';
import { PrestigeTabsBar, ProviderTabsBar } from '@/components/app-shell/FlavorBottomNav';
// MULTI-ROLE CONTRACT (2026-08-20): the bottom nav must never collapse a
// user to a single role — a provider-customer keeps their Bookings/Wallet/
// Pets/eGift surfaces. Base tab visibility on additive CAPABILITIES; use
// `uiMode` only to decide which set to emphasise when both capabilities
// are true.
import { useUserCapabilities } from '@/hooks/useUserCapabilities';
import { hasCustomerCapability, hasProviderCapability } from '@shared/lib/userCapabilities';
import { useUiMode } from '@/lib/uiMode';

/**
 * A11Y CONTRAST (agent-13, 2026-09-05) — WCAG 2.1 AA, petwash-ui-ux §6.1.
 *
 * The bar paints on solid #FFFFFF. The previous pair failed badly, and the
 * ACTIVE tab — the "you are here" signal — was the worst of the two:
 *
 *   old active  #D9B84C on #FFF = 1.92:1   (needs 4.5:1 text / 3:1 icon)
 *   old inactive #9CA3AF on #FFF = 2.55:1  (needs 4.5:1)
 *
 * The labels are 10px, so the large-text 3:1 allowance does not apply, and
 * the 22px icons are UI components that still owe 3:1. No hue in the brand
 * gold family clears 4.5:1 on white — #D4AF37 itself is only 2.11:1 — so
 * gold cannot carry the text on a white bar at any usable saturation.
 *
 * Resolution that keeps gold as the brand signal without failing AA:
 *   • ACTIVE   → GOLD_DEEP #8A6D1F, the same gold hue darkened to 4.94:1.
 *                Reads unmistakably as gold next to the neutral grey, and
 *                the active tab additionally carries a solid bright-gold
 *                #D9B84C indicator bar on its top edge — that bar is
 *                decorative, adjacent to the AA-compliant glyph, and is
 *                what actually catches the eye.
 *   • INACTIVE → #6B7280 (grey-500) = 4.92:1.
 *
 * NOTE FOR CEO: this darkens the gold ON THIS BAR ONLY. Gold on dark
 * surfaces is untouched (#D8AD55 on #000 is 7.2:1 and already passes).
 * If the brighter gold glyph is wanted back, the accessible alternative is
 * to invert the bar to the dark shell — say the word and it is a one-line
 * token swap here.
 */
const GOLD_BRIGHT = '#D9B84C';   // indicator bar only (decorative)
const GOLD_DEEP = '#8A6D1F';     // active icon + label — 4.94:1 on white
const GRAY = '#6B7280';          // inactive icon + label — 4.92:1 on white

interface NavItem {
  path: string;
  labelHe: string;
  labelEn: string;
  Icon: React.ElementType;
}

const CUSTOMER_NAV: NavItem[] = [
  { path: '/home',               labelHe: 'בית',       labelEn: 'Home',      Icon: Home },
  { path: '/paw-finder',         labelHe: '⁦PawFinder⁩', labelEn: 'PawFinder', Icon: Footprints },
  { path: '/bookings',           labelHe: 'הזמנות',    labelEn: 'Bookings',  Icon: CalendarDays },
  { path: '/booking-chat/inbox', labelHe: 'הודעות',    labelEn: 'Messages',  Icon: MessageCircle },
  { path: '/my-account',         labelHe: 'חשבון',     labelEn: 'Account',   Icon: User },
];

// Provider OS drives its modules via internal state (not URL sub-routes), so the
// global nav deep-links into it with ?m=<module>. /provider-os/bookings and
// /provider-os/inbox were dead routes (→ Not Found); ?m=jobs / ?m=notifications
// open the real modules. (On /provider-os itself this global nav is suppressed —
// /provider-os is immersive — so these only matter on shared pages.)
const PROVIDER_NAV: NavItem[] = [
  { path: '/provider-os',                   labelHe: 'בית',    labelEn: 'Home',     Icon: Home },
  { path: '/provider-os?m=jobs',            labelHe: 'הזמנות', labelEn: 'Bookings', Icon: CalendarDays },
  { path: '/provider-os?m=notifications',   labelHe: 'הודעות', labelEn: 'Messages', Icon: MessageCircle },
  { path: '/my-account',                    labelHe: 'חשבון',  labelEn: 'Account',  Icon: User },
];

/**
 * PR-SHELL-IMMERSIVE: HIDDEN_PREFIXES retired in favour of the canonical
 * `isImmersiveRoute(pathname)` helper at @/lib/immersive-routes. The old
 * list drifted from sticky-account-paths and PROMO_EXCLUDED_PATTERN —
 * missing /loyalty/join, /apply-provider, /join-team, /join/walker (and
 * siblings), /kyc, /admin/kyc, /activate-account, /consent-onboarding,
 * /forms/onboarding — which is why the CEO's screenshot showed the nav
 * bleeding into KYC/onboarding flows. Internal /admin /internal hides
 * are absorbed into the immersive list.
 *
 * The component-level path check below is kept as defence-in-depth —
 * App.tsx ALSO wraps the mount with `!isImmersiveRoute(currentPath)`.
 * Either layer alone hides the nav; the double-check survives a future
 * App.tsx refactor that drops the wrap.
 */

/**
 * Paths that represent an "account home" for the role-aware Account tab.
 * Post-PR-NAV-1 the Account tab no longer routes only to /my-account. It
 * resolves via useAccountNavigation.resolveAccountRoute() which can return
 * /admin/dashboard, /franchise/dashboard, /provider-os, or any role-specific
 * dashboard (e.g. /pet-wash-ltd/executive/ceo). The active-state must match.
 *
 * NOTE: prefixes that are also another visible tab path (e.g. /provider-os
 * is the Provider Home tab) are intentionally excluded here so we don't
 * double-light Home + Account on the same page. Admin paths are hidden by
 * HIDDEN_PREFIXES anyway, but listed for completeness.
 */
const ACCOUNT_HOME_PREFIXES = [
  '/my-account',
  '/franchise/dashboard',
  '/franchise',
  '/admin/dashboard',
  '/pet-wash-ltd',
];

export function MobileBottomNav() {
  const [location, setLocation] = useLocation();
  const { user, loading } = useFirebaseAuth();
  const { isLoading: roleLoading } = useWhoami();
  const { language } = useLanguage();
  const { resolveAccountRoute } = useAccountNavigation();
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const flavor = useAppFlavor();
  const { capabilities } = useUserCapabilities();
  const [uiMode] = useUiMode();
  const isRTL = language === 'he' || language === 'ar';

  if (loading || roleLoading || !user) return null;

  /**
   * The Account tab must route by role. CEO / admin / provider / franchise
   * should never land on /my-account. Use the same resolver the gold profile
   * icon uses. Falls back to '/home' on any error.
   */
  const handleAccountTap = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isResolvingAccount) return;
    setIsResolvingAccount(true);
    try {
      const route = await resolveAccountRoute();
      setLocation(route);
    } catch {
      setLocation('/home');
    } finally {
      setIsResolvingAccount(false);
    }
  };

  if (isImmersiveRoute(location)) return null;

  // APP-FLAVOR SHELLS (CEO 2026-06-23 spec): each native app carries its OWN
  // persistent tab bar on every non-immersive screen — Prestige gets
  // Home/Book/Shop/Wallet/Account + center QR, Provider gets
  // Jobs/Calendar/Earnings/Compliance/Account + center Home. The web bundle
  // keeps the classic role-aware nav below, except when previewing the app
  // surfaces themselves (/prestige/*, /provider/*) where parity with the
  // native experience is wanted.
  const onPrestigeSurface = location.startsWith('/prestige');
  const onProviderSurface = location.startsWith('/provider/');
  if (flavor === 'customer' || (flavor === 'web' && onPrestigeSurface)) return <PrestigeTabsBar />;
  if (flavor === 'provider' || (flavor === 'web' && onProviderSurface)) return <ProviderTabsBar />;

  // Capability-driven nav (never a single role): a provider-customer keeps
  // BOTH surfaces available. `uiMode` decides emphasis when both are true;
  // the user swaps via ModeSwitch. Never mutate users.role to swap tabs.
  const canCustomer = hasCustomerCapability(capabilities);
  const canProvider = hasProviderCapability(capabilities);
  // Precedence rules:
  //  • both capabilities → show the surface for the current uiMode
  //  • provider-only     → PROVIDER_NAV
  //  • customer-only (or none yet) → CUSTOMER_NAV (least-privilege default)
  const NAV_ITEMS = canProvider && canCustomer
    ? (uiMode === 'provider' ? PROVIDER_NAV : CUSTOMER_NAV)
    : canProvider
      ? PROVIDER_NAV
      : CUSTOMER_NAV;

  return (
    <nav
      aria-label={isRTL ? 'ניווט ראשי' : 'Main navigation'}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
      }}
    >
      <ul className="flex items-stretch h-14">
        {NAV_ITEMS.map(({ path, labelHe, labelEn, Icon }) => {
          const isAccountTab = path === '/my-account';

          const pawFinderAliases = ['/find-pet', '/lost-pet', '/paw-finder'];
          const isActive = isAccountTab
            ? ACCOUNT_HOME_PREFIXES.some(p => location === p || location.startsWith(p + '/'))
            : (
                location === path
                || location.startsWith(path + '/')
                || (path === '/paw-finder' && pawFinderAliases.some(a => location === a || location.startsWith(a + '/')))
              );
          const label = isRTL ? labelHe : labelEn;
          const color = isActive ? GOLD_DEEP : GRAY;
          const inner = (
            <button
              type="button"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              aria-busy={isAccountTab && isResolvingAccount ? true : undefined}
              onClick={isAccountTab ? handleAccountTap : undefined}
              className="relative flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors"
            >
              {/* Bright-gold active indicator. Decorative (the state is
                  already conveyed by aria-current and by the deep-gold
                  glyph), so it carries no contrast obligation of its own
                  and keeps the brand gold visible on the bar. */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 inset-x-0 h-0.5"
                  style={{ background: GOLD_BRIGHT }}
                />
              )}
              <Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.8}
                style={{ color }}
              />
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color }}
              >
                {label}
              </span>
            </button>
          );

          return (
            <li key={path} className="flex-1">
              {isAccountTab ? inner : <Link href={path}>{inner}</Link>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
