import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Home, Footprints, CalendarDays, MessageCircle, User } from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useWhoami } from '@/auth/useWhoami';
import { useLanguage } from '@/lib/languageStore';
import { useAccountNavigation } from '@/hooks/useAccountNavigation';
import { isImmersiveRoute } from '@/lib/immersive-routes';

const GOLD = '#C5A55A';
const GRAY = '#9CA3AF';

interface NavItem {
  path: string;
  labelHe: string;
  labelEn: string;
  Icon: React.ElementType;
}

const CUSTOMER_NAV: NavItem[] = [
  { path: '/home',               labelHe: 'בית',       labelEn: 'Home',      Icon: Home },
  { path: '/paw-finder',         labelHe: 'מציאת חיות', labelEn: 'PawFinder', Icon: Footprints },
  { path: '/bookings',           labelHe: 'הזמנות',    labelEn: 'Bookings',  Icon: CalendarDays },
  { path: '/booking-chat/inbox', labelHe: 'הודעות',    labelEn: 'Messages',  Icon: MessageCircle },
  { path: '/my-account',         labelHe: 'חשבון',     labelEn: 'Account',   Icon: User },
];

const PROVIDER_NAV: NavItem[] = [
  { path: '/provider-os',                   labelHe: 'בית',    labelEn: 'Home',     Icon: Home },
  { path: '/provider-os/bookings',          labelHe: 'הזמנות', labelEn: 'Bookings', Icon: CalendarDays },
  { path: '/provider-os/inbox',             labelHe: 'הודעות', labelEn: 'Messages', Icon: MessageCircle },
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
  const { role, isLoading: roleLoading } = useWhoami();
  const { language } = useLanguage();
  const { resolveAccountRoute } = useAccountNavigation();
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
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

  const isProvider = role === 'provider';
  const NAV_ITEMS = isProvider ? PROVIDER_NAV : CUSTOMER_NAV;

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
          const color = isActive ? GOLD : GRAY;
          const inner = (
            <button
              type="button"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              aria-busy={isAccountTab && isResolvingAccount ? true : undefined}
              onClick={isAccountTab ? handleAccountTap : undefined}
              className="flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors"
            >
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
